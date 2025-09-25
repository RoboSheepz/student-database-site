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

// Promisify DB methods for async/await
db.runAsync = promisify(db.run).bind(db);
db.getAsync = promisify(db.get).bind(db);
db.allAsync = promisify(db.all).bind(db);

// Create users table if not exists
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
  return await db.getAsync('SELECT id, email, created_at FROM users WHERE id = ?', [id]);
}

// --- Routes ---

// Register
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const normalizedEmail = String(email).trim().toLowerCase();

  try {
    const exists = await db.getAsync('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (exists) return res.status(409).json({ error: 'User already exists' });

    const hashed = await bcrypt.hash(password, 12);
    await db.runAsync('INSERT INTO users (email, password) VALUES (?, ?)', [normalizedEmail, hashed]);

    const user = await db.getAsync('SELECT id, email, created_at FROM users WHERE email = ?', [normalizedEmail]);
    const token = createToken({ id: user.id, email: user.email });

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

    const token = createToken({ id: row.id, email: row.email });

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

// Fallback: serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
