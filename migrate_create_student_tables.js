// migrate_create_student_tables.js
// Creates missing student-related tables (courses, courses_enrolled, final_grades, textbooks)
// and makes a backup of db.sqlite before modifying it.
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');

const DB_PATH = path.join(__dirname, 'db.sqlite');
const BAK_PATH = path.join(__dirname, 'db.sqlite.bak');

async function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error('Database file not found at', DB_PATH);
    process.exit(1);
  }

  // backup
  try {
    fs.copyFileSync(DB_PATH, BAK_PATH, fs.constants.COPYFILE_EXCL);
    console.log('Backup created at', BAK_PATH);
  } catch (err) {
    if (err.code === 'EEXIST') {
      console.log('Backup already exists at', BAK_PATH);
    } else {
      console.error('Failed to create backup:', err);
      process.exit(1);
    }
  }

  const db = new sqlite3.Database(DB_PATH);
  const runAsync = promisify(db.run).bind(db);
  const getAsync = promisify(db.get).bind(db);

  try {
    // Ensure foreign keys
    await runAsync('PRAGMA foreign_keys = ON');

    // courses
    await runAsync(`
      CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        units INTEGER NOT NULL DEFAULT 0,
        start_date INTEGER NOT NULL DEFAULT 0,
        end_date INTEGER NOT NULL DEFAULT 0,
        meeting_days TEXT NOT NULL DEFAULT '',
        meeting_time_start INTEGER NOT NULL DEFAULT 0,
        meeting_time_end INTEGER NOT NULL DEFAULT 0,
        last_day_to_add INTEGER NOT NULL DEFAULT 0,
        last_day_to_drop INTEGER NOT NULL DEFAULT 0,
        instructor_id INTEGER NOT NULL DEFAULT 0,
        prereq_coreq TEXT NOT NULL DEFAULT '',
        textbooks_required TEXT NOT NULL DEFAULT '',
        add_code INTEGER NOT NULL DEFAULT 0,
        published INTEGER NOT NULL DEFAULT 0
      )
    `);
    console.log('Ensured table: courses');

    // courses_enrolled
    await runAsync(`
      CREATE TABLE IF NOT EXISTS courses_enrolled (
        course_id INTEGER NOT NULL,
        student_id INTEGER NOT NULL,
        status INTEGER NOT NULL DEFAULT 0
      )
    `);
    console.log('Ensured table: courses_enrolled');

    // final_grades
    await runAsync(`
      CREATE TABLE IF NOT EXISTS final_grades (
        course_id INTEGER NOT NULL,
        student_id INTEGER NOT NULL,
        term INTEGER NOT NULL DEFAULT 0,
        grade TEXT NOT NULL DEFAULT ''
      )
    `);
    console.log('Ensured table: final_grades');

    // textbooks
    await runAsync(`
      CREATE TABLE IF NOT EXISTS textbooks (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        price REAL NOT NULL DEFAULT 0,
        quantity INTEGER NOT NULL DEFAULT 0,
        course_id INTEGER
      )
    `);
    console.log('Ensured table: textbooks');

    console.log('Migration complete.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

main();
