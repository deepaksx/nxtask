import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function setup() {
  console.log('Setting up PostgreSQL database...');

  try {
    // Drop existing tables
    await pool.query(`
      DROP TABLE IF EXISTS user_categories CASCADE;
      DROP TABLE IF EXISTS tasks CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);
    console.log('Dropped existing tables');

    // Create users table
    await pool.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        seniority_level INTEGER NOT NULL CHECK(seniority_level >= 1),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created users table');

    // Create tasks table
    await pool.query(`
      CREATE TABLE tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        start_date DATE,
        due_date DATE,
        priority VARCHAR(20) CHECK(priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
        status VARCHAR(20) CHECK(status IN ('not started', 'in progress', 'completed')) DEFAULT 'not started',
        category VARCHAR(50) CHECK(category IN ('Projects', 'Pre-Sales', 'Admin', 'Miscellaneous')),
        created_by INTEGER NOT NULL REFERENCES users(id),
        assigned_to INTEGER NOT NULL REFERENCES users(id),
        parent_task_id INTEGER REFERENCES tasks(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      )
    `);
    console.log('Created tasks table');

    // Create user_categories table
    await pool.query(`
      CREATE TABLE user_categories (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category VARCHAR(50) NOT NULL CHECK(category IN ('Projects', 'Pre-Sales', 'Admin', 'Miscellaneous')),
        UNIQUE(user_id, category)
      )
    `);
    console.log('Created user_categories table');

    // Create indexes
    await pool.query(`
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

    console.log('\nDatabase setup complete!');
    console.log('Run "npm run seed" to populate sample data.');

  } catch (err) {
    console.error('Setup error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setup();
