# XTASK - NXSYS Hierarchical Task Management System

A web-based hierarchical task management system where users with different seniority levels can create and manage tasks with unlimited subtask nesting.

## Features

- **User Authentication**: JWT-based login and registration
- **Seniority-Based Permissions**:
  - Level 1 = most senior, higher numbers = more junior
  - Seniors can assign tasks to themselves or juniors
  - Juniors can only add subtasks to tasks assigned to them
- **Hierarchical Tasks**: Unlimited subtask nesting with tree view
- **Task Management**:
  - Create, edit, and delete tasks
  - Status tracking (Not Started, In Progress, Completed)
  - Priority levels (High, Medium, Low)
  - Due date tracking with overdue highlighting
- **Smart Permissions**:
  - Edit: Only the creator can edit a task
  - Complete: Only the assignee can mark a task complete
  - Add subtasks: Only the assignee can add subtasks
  - Auto-complete parent when all subtasks are done
- **Multiple Views**:
  - My Tasks: Tasks assigned to you
  - Team Tasks: Tasks assigned to your juniors
  - All Tasks: Entire organization with search and filters
- **Search & Filters**: Filter by status, priority, assignee, or search text

## Tech Stack

- **Frontend**: React 18 with React Router
- **Backend**: Node.js with Express
- **Database**: SQLite3 (better-sqlite3)
- **Authentication**: JWT tokens
- **Styling**: Custom CSS

## Quick Start

### Prerequisites

- Node.js 18 or higher
- npm

### Installation

```bash
# Clone and navigate to the project
cd XTASK

# Install all dependencies (root, backend, and frontend)
npm run install:all

# Set up the database
npm run setup

# Seed sample data
npm run seed

# Start the application
npm run dev
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

### Test Accounts

All accounts use password: `password123`

| Email | Name | Seniority Level |
|-------|------|-----------------|
| ceo@nxsys.com | Alice Chen | Level 1 (Most Senior) |
| manager1@nxsys.com | Bob Martinez | Level 2 |
| manager2@nxsys.com | Carol Johnson | Level 2 |
| dev1@nxsys.com | David Kim | Level 3 |
| dev2@nxsys.com | Emma Wilson | Level 3 |

## Project Structure

```
XTASK/
├── backend/
│   ├── database/
│   │   ├── setup.js       # Database schema setup
│   │   ├── seed.js        # Sample data seeding
│   │   └── xtask.db       # SQLite database (created after setup)
│   ├── src/
│   │   ├── middleware/
│   │   │   ├── auth.js    # JWT authentication
│   │   │   └── errorHandler.js
│   │   ├── routes/
│   │   │   ├── auth.js    # Login/register endpoints
│   │   │   ├── users.js   # User management
│   │   │   └── tasks.js   # Task CRUD operations
│   │   ├── db.js          # Database connection
│   │   └── index.js       # Express server entry
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.jsx     # App layout with nav
│   │   │   ├── Modal.jsx      # Reusable modal
│   │   │   ├── TaskCard.jsx   # Task display card
│   │   │   ├── TaskFilters.jsx # Search and filters
│   │   │   ├── TaskForm.jsx   # Create/edit form
│   │   │   └── TaskTree.jsx   # Hierarchical task view
│   │   ├── context/
│   │   │   └── AuthContext.jsx # Auth state management
│   │   ├── pages/
│   │   │   ├── AllTasks.jsx   # All tasks view
│   │   │   ├── Login.jsx      # Login page
│   │   │   ├── MyTasks.jsx    # Personal tasks
│   │   │   ├── Register.jsx   # Registration page
│   │   │   ├── TaskDetail.jsx # Single task view
│   │   │   └── TeamTasks.jsx  # Team tasks view
│   │   ├── styles/
│   │   │   └── index.css      # Global styles
│   │   ├── utils/
│   │   │   └── api.js         # API client
│   │   ├── App.jsx            # Root component
│   │   └── main.jsx           # Entry point
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── .env.example
├── package.json
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users` - Get all users
- `GET /api/users/juniors` - Get users junior to current user
- `GET /api/users/assignable` - Get assignable users

### Tasks
- `GET /api/tasks` - Get all tasks (tree structure)
- `GET /api/tasks/my` - Get tasks assigned to current user
- `GET /api/tasks/team` - Get tasks assigned to juniors
- `GET /api/tasks/:id` - Get single task with subtasks
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `PATCH /api/tasks/:id/status` - Update task status
- `DELETE /api/tasks/:id` - Delete task

## Permission Rules

| Action | Who Can Do It |
|--------|---------------|
| View all tasks | Everyone |
| Create root task | Anyone (assigns to self or juniors) |
| Add subtask | Only assignee of parent task |
| Edit task | Only creator |
| Complete task | Only assignee |
| Delete task | Only creator (if no subtasks) |

## Database Schema

```sql
-- Users table
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  seniority_level INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tasks table
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  priority TEXT CHECK(priority IN ('high', 'medium', 'low')),
  status TEXT CHECK(status IN ('not started', 'in progress', 'completed')),
  created_by INTEGER NOT NULL,
  assigned_to INTEGER NOT NULL,
  parent_task_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id),
  FOREIGN KEY (parent_task_id) REFERENCES tasks(id)
);
```

## Development

### Running in Development Mode

```bash
npm run dev
```

This runs both frontend and backend concurrently with hot reload.

### Running Individually

```bash
# Backend only
npm run dev:backend

# Frontend only
npm run dev:frontend
```

### Building for Production

```bash
npm run build
```

### Reset Database

```bash
npm run setup  # Recreates database
npm run seed   # Re-seeds sample data
```

## License

MIT
