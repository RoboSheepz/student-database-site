// server.js
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

// Enable foreign key support in SQLite
db.run('PRAGMA foreign_keys = ON');

// Promisify DB methods for async/await
db.runAsync = promisify(db.run).bind(db);
db.getAsync = promisify(db.get).bind(db);
db.allAsync = promisify(db.all).bind(db);

// Create users table if not exists (added acct_type)
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    acct_type INTEGER NOT NULL DEFAULT 0
  )
`);

// Add user_profiles table (adapted schema)
db.run(`
  CREATE TABLE IF NOT EXISTS user_profiles (
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
  )
`);

// Add invites table for admin invite codes
db.run(`
  CREATE TABLE IF NOT EXISTS invites (
    code TEXT PRIMARY KEY,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    used INTEGER NOT NULL DEFAULT 0,
    used_by INTEGER,
    FOREIGN KEY(created_by) REFERENCES users(id),
    FOREIGN KEY(used_by) REFERENCES users(id)
  )
`);

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
  // return acct_type so frontend can tell admin vs student
  return await db.getAsync('SELECT id, email, created_at, acct_type FROM users WHERE id = ?', [id]);
}

// --- Routes ---

// Register
app.post('/api/register', async (req, res) => {
  // require invite_code when creating admin accounts
  const { email, password, acct_type = 0, student_id, invite_code } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  // If attempting to create an admin, validate invite code
  if (Number(acct_type) === 1) {
    if (!invite_code) return res.status(400).json({ error: 'invite_code required to create admin' });
    try {
      const inv = await db.getAsync('SELECT code, used FROM invites WHERE code = ?', [invite_code]);
      if (!inv) return res.status(400).json({ error: 'Invalid invite code' });
      if (inv.used) return res.status(409).json({ error: 'Invite code already used' });
    } catch (err) {
      console.error('Invite lookup failed', err);
      return res.status(500).json({ error: 'Server error validating invite' });
    }
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  try {
    const exists = await db.getAsync('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (exists) return res.status(409).json({ error: 'User already exists' });

    const hashed = await bcrypt.hash(password, 12);
    await db.runAsync('INSERT INTO users (email, password, acct_type) VALUES (?, ?, ?)', [normalizedEmail, hashed, acct_type]);

    const user = await db.getAsync('SELECT id, email, created_at, acct_type FROM users WHERE email = ?', [normalizedEmail]);

    // If invite_code was used (admin), mark it used now that user exists
    if (Number(acct_type) === 1 && invite_code) {
      try {
        await db.runAsync('UPDATE invites SET used = 1, used_by = ? WHERE code = ?', [user.id, invite_code]);
      } catch (err) {
        console.error('Failed to mark invite used', err);
        // Not critical to block user creation — but inform client
      }
    }

    // If a student_id was provided for non-admin registration, try to link the new user to that student profile.
    if (student_id && Number(acct_type) === 0) {
      try {
        const pid = Number(student_id);
        const profile = await db.getAsync('SELECT id, user_id FROM user_profiles WHERE id = ?', [pid]);
        if (!profile) {
          // rollback user creation
          await db.runAsync('DELETE FROM users WHERE id = ?', [user.id]);
          return res.status(400).json({ error: 'student profile not found' });
        }
        if (profile.user_id) {
          // rollback user creation
          await db.runAsync('DELETE FROM users WHERE id = ?', [user.id]);
          return res.status(409).json({ error: 'student profile already linked' });
        }
        await db.runAsync('UPDATE user_profiles SET user_id = ? WHERE id = ?', [user.id, pid]);
      } catch (errLink) {
        console.error('Link error', errLink);
        try { await db.runAsync('DELETE FROM users WHERE id = ?', [user.id]); } catch(e){}
        return res.status(500).json({ error: 'Failed to link student profile' });
      }
    }

    const token = createToken({ id: user.id, email: user.email, acct_type: user.acct_type });

    res.cookie(TOKEN_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

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

    res.cookie(TOKEN_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    const user = await getUserById(row.id);
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  res.clearCookie(TOKEN_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });
  res.json({ ok: true });
});

// Get current user
app.get('/api/me', async (req, res) => {
  const token = req.cookies[TOKEN_NAME];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Invalid token' });

  try {
    const user = await getUserById(data.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// Secret route
app.get('/api/secret', (req, res) => {
  const token = req.cookies[TOKEN_NAME];
  const data = token && verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Not authenticated' });

  res.json({ secret: `Hello ${data.email}, here's a secret.` });
});

// Students list (reads from user_profiles)
// GET: Students list (admin sees all; student sees only their own profile)
app.get('/api/students', async (req, res) => {
  const token = req.cookies[TOKEN_NAME];
  const data = token && verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Not authenticated' });

  try {
    let students;
    if (data.acct_type === 1) {
      // admin: all profiles
      students = await db.allAsync(
        `SELECT id, user_id, first_name, last_name, email, phone, street_addr, city, state, country, acct_type FROM user_profiles ORDER BY last_name, first_name`
      );
    } else {
      // student: only their linked profile (if any)
      students = await db.allAsync(
        `SELECT id, user_id, first_name, last_name, email, phone, street_addr, city, state, country, acct_type FROM user_profiles WHERE user_id = ?`,
        [data.id]
      );
    }
    res.json({ students });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST: Link a profile to a user (admin only)
app.post('/api/students/link', async (req, res) => {
  const token = req.cookies[TOKEN_NAME];
  const data = token && verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Not authenticated' });
  if (data.acct_type !== 1) return res.status(403).json({ error: 'Forbidden' });

  const { profile_id, user_id } = req.body || {};
  if (!profile_id || !user_id) return res.status(400).json({ error: 'profile_id and user_id required' });

  try {
    await db.runAsync('UPDATE user_profiles SET user_id = ? WHERE id = ?', [user_id, profile_id]);
    const updated = await db.getAsync('SELECT id, user_id, first_name, last_name, email FROM user_profiles WHERE id = ?', [profile_id]);
    res.json({ profile: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST: Create student (admin only)
app.post('/api/students', async (req, res) => {
  const token = req.cookies[TOKEN_NAME];
  const data = token && verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Not authenticated' });
  if (data.acct_type !== 1) return res.status(403).json({ error: 'Forbidden' });

  const {
    user_id = null,
    first_name = '',
    last_name = '',
    email = '',
    phone = null,
    street_addr = '',
    city = '',
    state = '',
    country = '',
    acct_type = 0
  } = req.body || {};

  if (!first_name || !last_name || !email) {
    return res.status(400).json({ error: 'first_name, last_name and email required' });
  }

  try {
    await db.runAsync(
      `INSERT INTO user_profiles
        (user_id, first_name, last_name, email, phone, street_addr, city, state, country, acct_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

      [user_id, first_name, last_name, email, phone, street_addr, city, state, country, acct_type]
    );

    const last = await db.getAsync('SELECT last_insert_rowid() as id');
    const student = await db.getAsync(
      `SELECT id, user_id, first_name, last_name, email, phone, street_addr, city, state, country, acct_type
       FROM user_profiles WHERE id = ?`,
      [last.id]
    );

    res.status(201).json({ student });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Admin: list users
app.get('/api/users', async (req, res) => {
  const token = req.cookies[TOKEN_NAME];
  const data = token && verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Not authenticated' });
  if (data.acct_type !== 1) return res.status(403).json({ error: 'Forbidden' });

  try {
    const users = await db.allAsync('SELECT id, email, created_at, acct_type FROM users ORDER BY id');
    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Admin: create invite code
const crypto = require('crypto');
app.post('/api/invites', async (req, res) => {
  const token = req.cookies[TOKEN_NAME];
  const data = token && verifyToken(token);
  if (!data) return res.status(401).json({ error: 'Not authenticated' });
  if (data.acct_type !== 1) return res.status(403).json({ error: 'Forbidden' });

  try {
    const code = crypto.randomBytes(8).toString('hex');
    await db.runAsync('INSERT INTO invites (code, created_by) VALUES (?, ?)', [code, data.id]);
    res.status(201).json({ code });
  } catch (err) {
    console.error('Invite creation failed', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Fallback: serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
