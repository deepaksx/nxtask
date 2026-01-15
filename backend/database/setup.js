import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'xtask.db');

// Remove existing database if exists
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('Removed existing database');
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('Creating database schema...');

// Create users table
db.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    seniority_level INTEGER NOT NULL CHECK(seniority_level >= 1),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

console.log('Created users table');

// Create tasks table
db.exec(`
  CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    start_date DATE,
    due_date DATE,
    priority TEXT CHECK(priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
    status TEXT CHECK(status IN ('not started', 'in progress', 'completed')) DEFAULT 'not started',
    category TEXT CHECK(category IN ('Projects', 'Pre-Sales', 'Admin', 'Miscellaneous')),
    created_by INTEGER NOT NULL,
    assigned_to INTEGER NOT NULL,
    parent_task_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    FOREIGN KEY (parent_task_id) REFERENCES tasks(id)
  )
`);

console.log('Created tasks table');

// Create user_categories table (which categories each user can access)
db.exec(`
  CREATE TABLE user_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('Projects', 'Pre-Sales', 'Admin', 'Miscellaneous')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, category)
  )
`);

console.log('Created user_categories table');

// Create indexes
db.exec(`
  CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
  CREATE INDEX idx_tasks_created_by ON tasks(created_by);
  CREATE INDEX idx_tasks_parent_task_id ON tasks(parent_task_id);
  CREATE INDEX idx_tasks_status ON tasks(status);
  CREATE INDEX idx_tasks_priority ON tasks(priority);
  CREATE INDEX idx_tasks_start_date ON tasks(start_date);
  CREATE INDEX idx_tasks_due_date ON tasks(due_date);
  CREATE INDEX idx_tasks_category ON tasks(category);
  CREATE INDEX idx_users_seniority_level ON users(seniority_level);
  CREATE INDEX idx_user_categories_user_id ON user_categories(user_id);
`);

console.log('Created indexes');

db.close();
console.log('\nDatabase setup complete!');
console.log('Run "npm run seed" to populate sample data.');
