import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'xtask.db');

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

console.log('Seeding database with sample data...\n');

// Create users
const users = [
  { email: 'ceo@nxsys.com', password: 'password123', name: 'Alice Chen', seniority_level: 1 },
  { email: 'manager1@nxsys.com', password: 'password123', name: 'Bob Martinez', seniority_level: 2 },
  { email: 'manager2@nxsys.com', password: 'password123', name: 'Carol Johnson', seniority_level: 2 },
  { email: 'dev1@nxsys.com', password: 'password123', name: 'David Kim', seniority_level: 3 },
  { email: 'dev2@nxsys.com', password: 'password123', name: 'Emma Wilson', seniority_level: 3 }
];

const insertUser = db.prepare(`
  INSERT INTO users (email, password_hash, name, seniority_level)
  VALUES (?, ?, ?, ?)
`);

console.log('Creating users:');
const userIds = {};
for (const user of users) {
  const hash = bcrypt.hashSync(user.password, 10);
  const result = insertUser.run(user.email, hash, user.name, user.seniority_level);
  userIds[user.name] = result.lastInsertRowid;
  console.log(`  - ${user.name} (Level ${user.seniority_level}): ${user.email}`);
}

// Helper to get date offset
function getDate(daysFromNow) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split('T')[0];
}

// Create tasks
const insertTask = db.prepare(`
  INSERT INTO tasks (title, description, start_date, due_date, priority, status, created_by, assigned_to, parent_task_id, completed_at, category)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

console.log('\nCreating tasks:');

// Task 1: Q1 Product Launch (root task, assigned by CEO to Manager) - Projects category
const task1 = insertTask.run(
  'Q1 Product Launch',
  'Complete all preparations for the Q1 product launch including development, testing, and marketing.',
  getDate(-10), // Started 10 days ago
  getDate(30),
  'high',
  'in progress',
  userIds['Alice Chen'],
  userIds['Bob Martinez'],
  null,
  null,
  'Projects'
).lastInsertRowid;
console.log('  - Q1 Product Launch [Projects]');

// Task 1.1: Backend API Development (subtask under task 1, added by Bob, assigned to David)
const task1_1 = insertTask.run(
  'Backend API Development',
  'Develop all required REST APIs for the new product features.',
  getDate(-8), // Started 8 days ago (after parent's start)
  getDate(14),
  'high',
  'in progress',
  userIds['Bob Martinez'],
  userIds['David Kim'],
  task1,
  null,
  null // Subtasks don't have category
).lastInsertRowid;
console.log('    - Backend API Development');

// Task 1.1.1: User Authentication API (subtask under task 1.1, added by David)
insertTask.run(
  'User Authentication API',
  'Implement JWT-based authentication endpoints.',
  getDate(-7), // Started 7 days ago
  getDate(5),
  'high',
  'completed',
  userIds['David Kim'],
  userIds['David Kim'],
  task1_1,
  new Date().toISOString(),
  null
);
console.log('      - User Authentication API [COMPLETED]');

// Task 1.1.2: Product Catalog API (subtask under task 1.1, overdue)
insertTask.run(
  'Product Catalog API',
  'Build CRUD endpoints for product management.',
  getDate(-5), // Started 5 days ago
  getDate(-2), // Overdue by 2 days
  'high',
  'in progress',
  userIds['David Kim'],
  userIds['David Kim'],
  task1_1,
  null,
  null
);
console.log('      - Product Catalog API [OVERDUE]');

// Task 1.2: Frontend Development (subtask under task 1, assigned to Emma)
const task1_2 = insertTask.run(
  'Frontend Development',
  'Build React components for the new product pages.',
  getDate(-5), // Started 5 days ago
  getDate(20),
  'high',
  'in progress',
  userIds['Bob Martinez'],
  userIds['Emma Wilson'],
  task1,
  null,
  null
).lastInsertRowid;
console.log('    - Frontend Development');

// Task 1.2.1: Product List Page
insertTask.run(
  'Product List Page',
  'Create responsive product listing with filters and search.',
  getDate(0), // Starting today
  getDate(10),
  'medium',
  'not started',
  userIds['Emma Wilson'],
  userIds['Emma Wilson'],
  task1_2,
  null,
  null
);
console.log('      - Product List Page');

// Task 2: Security Audit (assigned by CEO to Carol) - Admin category
const task2 = insertTask.run(
  'Security Audit',
  'Conduct comprehensive security review of all systems.',
  getDate(-15), // Started 15 days ago
  getDate(-5), // Overdue by 5 days
  'high',
  'in progress',
  userIds['Alice Chen'],
  userIds['Carol Johnson'],
  null,
  null,
  'Admin'
).lastInsertRowid;
console.log('  - Security Audit [Admin, OVERDUE]');

// Task 2.1: Penetration Testing
insertTask.run(
  'Penetration Testing',
  'Perform penetration testing on production systems.',
  getDate(-14), // Started 14 days ago
  getDate(-3),
  'high',
  'completed',
  userIds['Carol Johnson'],
  userIds['David Kim'],
  task2,
  new Date().toISOString(),
  null
);
console.log('    - Penetration Testing [COMPLETED]');

// Task 2.2: Code Review
insertTask.run(
  'Code Review',
  'Review codebase for security vulnerabilities.',
  getDate(-10), // Started 10 days ago
  getDate(3),
  'medium',
  'not started',
  userIds['Carol Johnson'],
  userIds['Emma Wilson'],
  task2,
  null,
  null
);
console.log('    - Code Review');

// Task 3: Documentation Update (assigned by Manager to Dev) - Miscellaneous category
const task3 = insertTask.run(
  'Documentation Update',
  'Update all technical documentation for the new release.',
  getDate(5), // Starts in 5 days
  getDate(25),
  'low',
  'not started',
  userIds['Bob Martinez'],
  userIds['Emma Wilson'],
  null,
  null,
  'Miscellaneous'
).lastInsertRowid;
console.log('  - Documentation Update [Miscellaneous]');

// Task 4: Database Optimization (assigned by CEO to Manager Carol) - Admin category
const task4 = insertTask.run(
  'Database Optimization',
  'Optimize database queries and indexes for better performance.',
  getDate(-3), // Started 3 days ago
  getDate(15),
  'medium',
  'not started',
  userIds['Alice Chen'],
  userIds['Carol Johnson'],
  null,
  null,
  'Admin'
).lastInsertRowid;
console.log('  - Database Optimization [Admin]');

// Task 4.1: Query Analysis
insertTask.run(
  'Query Analysis',
  'Analyze slow queries and identify optimization opportunities.',
  getDate(-2), // Started 2 days ago (after parent's start)
  getDate(7),
  'medium',
  'in progress',
  userIds['Carol Johnson'],
  userIds['David Kim'],
  task4,
  null,
  null
);
console.log('    - Query Analysis');

// Task 5: Client Demo Preparation (Pre-Sales category)
const task5 = insertTask.run(
  'Client Demo Preparation',
  'Prepare demo environment and materials for upcoming client presentation.',
  getDate(-2), // Started 2 days ago
  getDate(10),
  'high',
  'in progress',
  userIds['Alice Chen'],
  userIds['Bob Martinez'],
  null,
  null,
  'Pre-Sales'
).lastInsertRowid;
console.log('  - Client Demo Preparation [Pre-Sales]');

// Task 5.1: Demo Environment Setup
insertTask.run(
  'Demo Environment Setup',
  'Set up isolated demo environment with sample data.',
  getDate(0), // Starting today (after parent's start)
  getDate(5),
  'high',
  'not started',
  userIds['Bob Martinez'],
  userIds['David Kim'],
  task5,
  null,
  null
);
console.log('    - Demo Environment Setup');

// Assign categories to users
const insertUserCategory = db.prepare(`
  INSERT INTO user_categories (user_id, category) VALUES (?, ?)
`);

console.log('\nAssigning categories to users:');

// CEO (Alice) gets all categories
const allCategories = ['Projects', 'Pre-Sales', 'Admin', 'Miscellaneous'];
allCategories.forEach(cat => insertUserCategory.run(userIds['Alice Chen'], cat));
console.log('  - Alice Chen: All categories');

// Manager 1 (Bob) gets Projects, Pre-Sales
['Projects', 'Pre-Sales'].forEach(cat => insertUserCategory.run(userIds['Bob Martinez'], cat));
console.log('  - Bob Martinez: Projects, Pre-Sales');

// Manager 2 (Carol) gets Admin, Miscellaneous
['Admin', 'Miscellaneous'].forEach(cat => insertUserCategory.run(userIds['Carol Johnson'], cat));
console.log('  - Carol Johnson: Admin, Miscellaneous');

// Dev 1 (David) gets Projects, Admin
['Projects', 'Admin'].forEach(cat => insertUserCategory.run(userIds['David Kim'], cat));
console.log('  - David Kim: Projects, Admin');

// Dev 2 (Emma) gets Projects, Pre-Sales, Miscellaneous
['Projects', 'Pre-Sales', 'Miscellaneous'].forEach(cat => insertUserCategory.run(userIds['Emma Wilson'], cat));
console.log('  - Emma Wilson: Projects, Pre-Sales, Miscellaneous');

db.close();

console.log('\n========================================');
console.log('Seed data created successfully!');
console.log('========================================');
console.log('\nTest accounts (password: password123):');
console.log('  - ceo@nxsys.com (Level 1 - All categories)');
console.log('  - manager1@nxsys.com (Level 2 - Projects, Pre-Sales)');
console.log('  - manager2@nxsys.com (Level 2 - Admin, Miscellaneous)');
console.log('  - dev1@nxsys.com (Level 3 - Projects, Admin)');
console.log('  - dev2@nxsys.com (Level 3 - Projects, Pre-Sales, Miscellaneous)');
console.log('\nRun "npm run dev" to start the application.');
