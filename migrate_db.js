#!/usr/bin/env node
/**
 * Migration script: link user_profiles to users by email and add user_id column/index.
 * Run from project root: node migrate_db.js
 */
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');

const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);
db.runAsync = promisify(db.run).bind(db);
db.getAsync = promisify(db.get).bind(db);
db.allAsync = promisify(db.all).bind(db);

async function tableExists(name) {
  const row = await db.getAsync("SELECT name FROM sqlite_master WHERE type='table' AND name = ?", [name]);
  return !!row;
}

async function main() {
  console.log('Opening', dbPath);

  // Ensure foreign keys on
  await db.runAsync('PRAGMA foreign_keys = OFF');

  const hasProfiles = await tableExists('user_profiles');
  const hasUsers = await tableExists('users');

  // If users table exists ensure acct_type column exists
  if (hasUsers) {
    const userCols = await db.allAsync("PRAGMA table_info('users')");
    const hasAcct = userCols.some(c => c.name === 'acct_type');
    if (!hasAcct) {
      console.log('Adding acct_type column to users');
      await db.runAsync("ALTER TABLE users ADD COLUMN acct_type INTEGER NOT NULL DEFAULT 0");
    } else {
      console.log('acct_type column already exists on users');
    }
  }

  if (!hasProfiles) {
    console.log('user_profiles table not found. Creating minimal table...');
    await db.runAsync(`
      CREATE TABLE user_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        first_name TEXT NOT NULL DEFAULT '',
        last_name TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        phone TEXT,
        street_addr TEXT NOT NULL DEFAULT '',
        city TEXT NOT NULL DEFAULT '',
        state TEXT NOT NULL DEFAULT '',
        country TEXT NOT NULL DEFAULT '',
        acct_type INTEGER NOT NULL DEFAULT 0
      )
    `);
    console.log('Created user_profiles');
  }

  // Add user_id column if missing
  const cols = await db.allAsync("PRAGMA table_info('user_profiles')");
  const hasUserId = cols.some(c => c.name === 'user_id');
  if (!hasUserId) {
    console.log('Adding user_id column to user_profiles');
    await db.runAsync('ALTER TABLE user_profiles ADD COLUMN user_id INTEGER');
  } else {
    console.log('user_id column already exists');
  }

  // If users table doesn't exist, nothing to link; warn and exit
  if (!hasUsers) {
    console.warn('users table not found; cannot link profiles by email. Create users first and re-run migration.');
    await db.runAsync('PRAGMA foreign_keys = ON');
    db.close();
    process.exit(0);
  }

  // Link profiles by matching lower(email)
  console.log('Linking profiles to users by email (case-insensitive)...');
  await db.runAsync(`
    UPDATE user_profiles
    SET user_id = (
      SELECT id FROM users WHERE lower(users.email) = lower(user_profiles.email) LIMIT 1
    )
    WHERE user_id IS NULL OR user_id = ''
  `);

  const linked = await db.getAsync("SELECT COUNT(*) as c FROM user_profiles WHERE user_id IS NOT NULL");
  console.log(`Profiles linked: ${linked.c}`);

  // Try to create a UNIQUE index on user_id to enforce one-to-one mapping.
  // This will fail if duplicates exist; catch and report.
  try {
    await db.runAsync('CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_user_id_unique ON user_profiles(user_id)');
    console.log('Created unique index idx_user_profiles_user_id_unique');
  } catch (err) {
    console.warn('Could not create unique index on user_id (duplicates may exist):', err.message);
  }

  // Re-enable foreign keys
  await db.runAsync('PRAGMA foreign_keys = ON');

  console.log('Migration complete.');
  db.close();
}

main().catch(err => {
  console.error('Migration failed:', err);
  try { db.close(); } catch(e){}
  process.exit(1);
});
