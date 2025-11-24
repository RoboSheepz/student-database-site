require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';
const TOKEN_NAME = 'token';

// --- Database setup ---
const db = new sqlite3.Database(path.join(__dirname, 'db.sqlite'));
db.run('PRAGMA foreign_keys = ON');

db.runAsync = promisify(db.run).bind(db);
db.getAsync = promisify(db.get).bind(db);
db.allAsync = promisify(db.all).bind(db);

// Create tables if not exist
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  acct_type INTEGER NOT NULL DEFAULT 0
)`);

db.run(`CREATE TABLE IF NOT EXISTS user_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT,
  street_addr TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  acct_type INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
)`);

db.run(`CREATE TABLE IF NOT EXISTS invites (
  code TEXT PRIMARY KEY,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  used INTEGER NOT NULL DEFAULT 0,
  used_by INTEGER,
  FOREIGN KEY(created_by) REFERENCES users(id),
  FOREIGN KEY(used_by) REFERENCES users(id)
)`);

// Create courses table
db.serialize(() => {
  db.run(`DROP TABLE IF EXISTS courses`, (err) => {
    if (err) console.error('Error dropping courses table:', err);
  });
  
  db.run(`CREATE TABLE courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    units INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT,
    instructor_id INTEGER,
    meeting_days TEXT,
    add_code TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) console.error('Error creating courses table:', err);
    else console.log('Courses table ready');
  });
});

// --- Middleware ---
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// --- Helpers ---
function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

async function getUserById(id) {
  return await db.getAsync('SELECT id, email, created_at, acct_type FROM users WHERE id = ?', [id]);
}

// Auth middleware
function requireAuth(req, res, next) {
  const token = req.cookies[TOKEN_NAME];
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Not authenticated' });
  req.user = decoded;
  next();
}

// --- Routes ---

// Register
app.post('/api/register', async (req, res) => {
  const { email, password, acct_type = 0, student_id, invite_code } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const normalizedEmail = String(email).trim().toLowerCase();

  if (Number(acct_type) === 1) {
    if (!invite_code) return res.status(400).json({ error: 'invite_code required to create admin' });

    try {
      const normalizedCode = String(invite_code).trim().toUpperCase();
      const inv = await db.getAsync(
        `SELECT code, used FROM invites WHERE UPPER(TRIM(code)) = ? AND used = 0`,
        [normalizedCode]
      );
      if (!inv) {
        return res.status(400).json({ error: 'Invalid or already used invite code' });
      }
    } catch (err) {
      console.error('Invite lookup failed', err);
      return res.status(500).json({ error: 'Server error validating invite' });
    }
  }

  try {
    const exists = await db.getAsync('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (exists) return res.status(409).json({ error: 'User already exists' });

    const hashed = await bcrypt.hash(password, 12);
    await db.runAsync('INSERT INTO users (email, password, acct_type) VALUES (?, ?, ?)', [normalizedEmail, hashed, acct_type]);
    const user = await db.getAsync('SELECT id, email, created_at, acct_type FROM users WHERE email = ?', [normalizedEmail]);

    if (Number(acct_type) === 1 && invite_code) {
      const normalizedCode = String(invite_code).trim().toUpperCase();
      await db.runAsync(
        'UPDATE invites SET used = 1, used_by = ? WHERE UPPER(TRIM(code)) = ?',
        [user.id, normalizedCode]
      );
    }

    if (student_id && Number(acct_type) === 0) {
      const pid = Number(student_id);
      const profile = await db.getAsync('SELECT id, user_id FROM user_profiles WHERE id = ?', [pid]);
      if (!profile) {
        await db.runAsync('DELETE FROM users WHERE id = ?', [user.id]);
        return res.status(400).json({ error: 'student profile not found' });
      }
      if (profile.user_id) {
        await db.runAsync('DELETE FROM users WHERE id = ?', [user.id]);
        return res.status(409).json({ error: 'student profile already linked' });
      }
      await db.runAsync('UPDATE user_profiles SET user_id = ? WHERE id = ?', [user.id, pid]);
    }

    const token = createToken({ id: user.id, email: user.email, acct_type: user.acct_type });
    res.cookie(TOKEN_NAME, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ user });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const normalizedEmail = String(email).trim().toLowerCase();

  try {
    const row = await db.getAsync('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
    if (!row) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, row.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = createToken({ id: row.id, email: row.email, acct_type: row.acct_type });
    res.cookie(TOKEN_NAME, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 });

    const user = await getUserById(row.id);
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  res.clearCookie(TOKEN_NAME);
  res.json({ success: true });
});

// Get current user
app.get('/api/me', requireAuth, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Secret endpoint
app.get('/api/secret', requireAuth, (req, res) => {
  res.json({ 
    message: 'This is secret data!',
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

// Get all users (admin only)
app.get('/api/users', requireAuth, async (req, res) => {
  try {
    if (req.user.acct_type !== 1) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const users = await db.allAsync('SELECT id, email, acct_type, created_at FROM users ORDER BY created_at DESC');
    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Generate invite code (admin only)
app.post('/api/invites', requireAuth, async (req, res) => {
  try {
    if (req.user.acct_type !== 1) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const code = require('crypto').randomBytes(8).toString('hex').toUpperCase();
    await db.runAsync('INSERT INTO invites (code, created_by, used) VALUES (?, ?, 0)', [code, req.user.id]);
    res.json({ code });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate invite' });
  }
});


// Get all courses
app.get('/api/courses', requireAuth, async (req, res) => {
  try {
    const courses = await db.allAsync('SELECT * FROM courses ORDER BY start_date DESC');
    res.json(courses);
  } catch (err) {
    console.error('Error fetching courses:', err);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// Create new course - CALLBACK STYLE
app.post('/api/courses', requireAuth, (req, res) => {
  const { title, units, start_date, end_date, instructor_id, meeting_days, add_code } = req.body;
  
  console.log('Received course data:', req.body);
  
  if (!title || !units || !start_date) {
    return res.status(400).json({ error: 'Missing required fields: title, units, start_date' });
  }

  db.run(
    `INSERT INTO courses (title, units, start_date, end_date, instructor_id, meeting_days, add_code) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [title, Number(units), start_date, end_date || start_date, instructor_id || null, meeting_days || null, add_code || null],
    function(err) {
      if (err) {
        console.error('Error creating course:', err);
        return res.status(500).json({ error: 'Failed to create course: ' + err.message });
      }
      
      const courseId = this.lastID;
      console.log('Course created with ID:', courseId);
      
      db.get('SELECT * FROM courses WHERE id = ?', [courseId], (err, course) => {
        if (err) {
          console.error('Error fetching course:', err);
          return res.status(500).json({ error: 'Course created but failed to retrieve' });
        }
        res.status(201).json({ success: true, course });
      });
    }
  );
});


// Get students
app.get('/api/students', requireAuth, async (req, res) => {
  try {
    const students = await db.allAsync('SELECT * FROM user_profiles ORDER BY id');
    res.json({ students });
  } catch (err) {
    console.error('Error fetching students:', err);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Add student - CALLBACK STYLE
app.post('/api/students', requireAuth, (req, res) => {
  const { first_name, last_name, email, phone, street_addr, city, state, country, acct_type } = req.body;
  
  if (!first_name || !last_name || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  db.run(
    `INSERT INTO user_profiles (first_name, last_name, email, phone, street_addr, city, state, country, acct_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [first_name, last_name, email, phone || null, street_addr || '', city || '', state || '', country || '', acct_type || 0],
    function(err) {
      if (err) {
        console.error('Error creating student:', err);
        return res.status(500).json({ error: 'Failed to create student: ' + err.message });
      }
      
      const studentId = this.lastID;
      
      db.get('SELECT * FROM user_profiles WHERE id = ?', [studentId], (err, student) => {
        if (err) {
          return res.status(500).json({ error: 'Student created but failed to retrieve' });
        }
        res.status(201).json({ success: true, student });
      });
    }
  );
});

// Link student to user
app.post('/api/students/link', requireAuth, async (req, res) => {
  try {
    if (req.user.acct_type !== 1) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { profile_id, user_id } = req.body;
    
    if (!profile_id || !user_id) {
      return res.status(400).json({ error: 'profile_id and user_id required' });
    }

    await db.runAsync('UPDATE user_profiles SET user_id = ? WHERE id = ?', [user_id, profile_id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error linking student:', err);
    res.status(500).json({ error: 'Failed to link student' });
  }
});


// Fallback: serve frontend (MUST BE LAST)
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});