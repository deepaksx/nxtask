import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Helper to get date offset
function getDate(daysFromNow) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split('T')[0];
}

async function seed() {
  console.log('Seeding database with sample data...\n');

  try {
    // Create users
    const users = [
      { email: 'ceo@nxsys.com', password: 'password123', name: 'Alice Chen', seniority_level: 1 },
      { email: 'manager1@nxsys.com', password: 'password123', name: 'Bob Martinez', seniority_level: 2 },
      { email: 'manager2@nxsys.com', password: 'password123', name: 'Carol Johnson', seniority_level: 2 },
      { email: 'dev1@nxsys.com', password: 'password123', name: 'David Kim', seniority_level: 3 },
      { email: 'dev2@nxsys.com', password: 'password123', name: 'Emma Wilson', seniority_level: 3 }
    ];

    console.log('Creating users:');
    const userIds = {};
    for (const user of users) {
      const hash = await bcrypt.hash(user.password, 10);
      const result = await pool.query(
        'INSERT INTO users (email, password_hash, name, seniority_level) VALUES ($1, $2, $3, $4) RETURNING id',
        [user.email, hash, user.name, user.seniority_level]
      );
      userIds[user.name] = result.rows[0].id;
      console.log(`  - ${user.name} (Level ${user.seniority_level}): ${user.email}`);
    }

    console.log('\nCreating tasks:');

    // Task 1: Q1 Product Launch (root task) - Projects category
    const task1Result = await pool.query(
      `INSERT INTO tasks (title, description, start_date, due_date, priority, status, created_by, assigned_to, parent_task_id, completed_at, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      ['Q1 Product Launch', 'Complete all preparations for the Q1 product launch including development, testing, and marketing.',
       getDate(-10), getDate(30), 'high', 'in progress', userIds['Alice Chen'], userIds['Bob Martinez'], null, null, 'Projects']
    );
    const task1 = task1Result.rows[0].id;
    console.log('  - Q1 Product Launch [Projects]');

    // Task 1.1: Backend API Development
    const task1_1Result = await pool.query(
      `INSERT INTO tasks (title, description, start_date, due_date, priority, status, created_by, assigned_to, parent_task_id, completed_at, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      ['Backend API Development', 'Develop all required REST APIs for the new product features.',
       getDate(-8), getDate(14), 'high', 'in progress', userIds['Bob Martinez'], userIds['David Kim'], task1, null, null]
    );
    const task1_1 = task1_1Result.rows[0].id;
    console.log('    - Backend API Development');

    // Task 1.1.1: User Authentication API
    await pool.query(
      `INSERT INTO tasks (title, description, start_date, due_date, priority, status, created_by, assigned_to, parent_task_id, completed_at, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      ['User Authentication API', 'Implement JWT-based authentication endpoints.',
       getDate(-7), getDate(5), 'high', 'completed', userIds['David Kim'], userIds['David Kim'], task1_1, new Date().toISOString(), null]
    );
    console.log('      - User Authentication API [COMPLETED]');

    // Task 1.1.2: Product Catalog API (overdue)
    await pool.query(
      `INSERT INTO tasks (title, description, start_date, due_date, priority, status, created_by, assigned_to, parent_task_id, completed_at, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      ['Product Catalog API', 'Build CRUD endpoints for product management.',
       getDate(-5), getDate(-2), 'high', 'in progress', userIds['David Kim'], userIds['David Kim'], task1_1, null, null]
    );
    console.log('      - Product Catalog API [OVERDUE]');

    // Task 1.2: Frontend Development
    const task1_2Result = await pool.query(
      `INSERT INTO tasks (title, description, start_date, due_date, priority, status, created_by, assigned_to, parent_task_id, completed_at, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      ['Frontend Development', 'Build React components for the new product pages.',
       getDate(-5), getDate(20), 'high', 'in progress', userIds['Bob Martinez'], userIds['Emma Wilson'], task1, null, null]
    );
    const task1_2 = task1_2Result.rows[0].id;
    console.log('    - Frontend Development');

    // Task 1.2.1: Product List Page
    await pool.query(
      `INSERT INTO tasks (title, description, start_date, due_date, priority, status, created_by, assigned_to, parent_task_id, completed_at, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      ['Product List Page', 'Create responsive product listing with filters and search.',
       getDate(0), getDate(10), 'medium', 'not started', userIds['Emma Wilson'], userIds['Emma Wilson'], task1_2, null, null]
    );
    console.log('      - Product List Page');

    // Task 2: Security Audit - Admin category (overdue)
    const task2Result = await pool.query(
      `INSERT INTO tasks (title, description, start_date, due_date, priority, status, created_by, assigned_to, parent_task_id, completed_at, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      ['Security Audit', 'Conduct comprehensive security review of all systems.',
       getDate(-15), getDate(-5), 'high', 'in progress', userIds['Alice Chen'], userIds['Carol Johnson'], null, null, 'Admin']
    );
    const task2 = task2Result.rows[0].id;
    console.log('  - Security Audit [Admin, OVERDUE]');

    // Task 2.1: Penetration Testing
    await pool.query(
      `INSERT INTO tasks (title, description, start_date, due_date, priority, status, created_by, assigned_to, parent_task_id, completed_at, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      ['Penetration Testing', 'Perform penetration testing on production systems.',
       getDate(-14), getDate(-3), 'high', 'completed', userIds['Carol Johnson'], userIds['David Kim'], task2, new Date().toISOString(), null]
    );
    console.log('    - Penetration Testing [COMPLETED]');

    // Task 2.2: Code Review
    await pool.query(
      `INSERT INTO tasks (title, description, start_date, due_date, priority, status, created_by, assigned_to, parent_task_id, completed_at, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      ['Code Review', 'Review codebase for security vulnerabilities.',
       getDate(-10), getDate(3), 'medium', 'not started', userIds['Carol Johnson'], userIds['Emma Wilson'], task2, null, null]
    );
    console.log('    - Code Review');

    // Task 3: Documentation Update - Miscellaneous category
    await pool.query(
      `INSERT INTO tasks (title, description, start_date, due_date, priority, status, created_by, assigned_to, parent_task_id, completed_at, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      ['Documentation Update', 'Update all technical documentation for the new release.',
       getDate(5), getDate(25), 'low', 'not started', userIds['Bob Martinez'], userIds['Emma Wilson'], null, null, 'Miscellaneous']
    );
    console.log('  - Documentation Update [Miscellaneous]');

    // Task 4: Database Optimization - Admin category
    const task4Result = await pool.query(
      `INSERT INTO tasks (title, description, start_date, due_date, priority, status, created_by, assigned_to, parent_task_id, completed_at, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      ['Database Optimization', 'Optimize database queries and indexes for better performance.',
       getDate(-3), getDate(15), 'medium', 'not started', userIds['Alice Chen'], userIds['Carol Johnson'], null, null, 'Admin']
    );
    const task4 = task4Result.rows[0].id;
    console.log('  - Database Optimization [Admin]');

    // Task 4.1: Query Analysis
    await pool.query(
      `INSERT INTO tasks (title, description, start_date, due_date, priority, status, created_by, assigned_to, parent_task_id, completed_at, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      ['Query Analysis', 'Analyze slow queries and identify optimization opportunities.',
       getDate(-2), getDate(7), 'medium', 'in progress', userIds['Carol Johnson'], userIds['David Kim'], task4, null, null]
    );
    console.log('    - Query Analysis');

    // Task 5: Client Demo Preparation - Pre-Sales category
    const task5Result = await pool.query(
      `INSERT INTO tasks (title, description, start_date, due_date, priority, status, created_by, assigned_to, parent_task_id, completed_at, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      ['Client Demo Preparation', 'Prepare demo environment and materials for upcoming client presentation.',
       getDate(-2), getDate(10), 'high', 'in progress', userIds['Alice Chen'], userIds['Bob Martinez'], null, null, 'Pre-Sales']
    );
    const task5 = task5Result.rows[0].id;
    console.log('  - Client Demo Preparation [Pre-Sales]');

    // Task 5.1: Demo Environment Setup
    await pool.query(
      `INSERT INTO tasks (title, description, start_date, due_date, priority, status, created_by, assigned_to, parent_task_id, completed_at, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      ['Demo Environment Setup', 'Set up isolated demo environment with sample data.',
       getDate(0), getDate(5), 'high', 'not started', userIds['Bob Martinez'], userIds['David Kim'], task5, null, null]
    );
    console.log('    - Demo Environment Setup');

    // Assign categories to users
    console.log('\nAssigning categories to users:');

    // CEO (Alice) gets all categories
    const allCategories = ['Projects', 'Pre-Sales', 'Admin', 'Miscellaneous'];
    for (const cat of allCategories) {
      await pool.query('INSERT INTO user_categories (user_id, category) VALUES ($1, $2)', [userIds['Alice Chen'], cat]);
    }
    console.log('  - Alice Chen: All categories');

    // Manager 1 (Bob) gets Projects, Pre-Sales
    for (const cat of ['Projects', 'Pre-Sales']) {
      await pool.query('INSERT INTO user_categories (user_id, category) VALUES ($1, $2)', [userIds['Bob Martinez'], cat]);
    }
    console.log('  - Bob Martinez: Projects, Pre-Sales');

    // Manager 2 (Carol) gets Admin, Miscellaneous
    for (const cat of ['Admin', 'Miscellaneous']) {
      await pool.query('INSERT INTO user_categories (user_id, category) VALUES ($1, $2)', [userIds['Carol Johnson'], cat]);
    }
    console.log('  - Carol Johnson: Admin, Miscellaneous');

    // Dev 1 (David) gets Projects, Admin
    for (const cat of ['Projects', 'Admin']) {
      await pool.query('INSERT INTO user_categories (user_id, category) VALUES ($1, $2)', [userIds['David Kim'], cat]);
    }
    console.log('  - David Kim: Projects, Admin');

    // Dev 2 (Emma) gets Projects, Pre-Sales, Miscellaneous
    for (const cat of ['Projects', 'Pre-Sales', 'Miscellaneous']) {
      await pool.query('INSERT INTO user_categories (user_id, category) VALUES ($1, $2)', [userIds['Emma Wilson'], cat]);
    }
    console.log('  - Emma Wilson: Projects, Pre-Sales, Miscellaneous');

    console.log('\n========================================');
    console.log('Seed data created successfully!');
    console.log('========================================');
    console.log('\nTest accounts (password: password123):');
    console.log('  - ceo@nxsys.com (Level 1 - All categories)');
    console.log('  - manager1@nxsys.com (Level 2 - Projects, Pre-Sales)');
    console.log('  - manager2@nxsys.com (Level 2 - Admin, Miscellaneous)');
    console.log('  - dev1@nxsys.com (Level 3 - Projects, Admin)');
    console.log('  - dev2@nxsys.com (Level 3 - Projects, Pre-Sales, Miscellaneous)');

  } catch (err) {
    console.error('Seed error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
