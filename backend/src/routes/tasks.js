import express from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Helper: Get task with full details
function getTaskWithDetails(taskId) {
  return db.prepare(`
    SELECT
      t.*,
      creator.name as creator_name,
      creator.seniority_level as creator_seniority,
      assignee.name as assignee_name,
      assignee.seniority_level as assignee_seniority
    FROM tasks t
    LEFT JOIN users creator ON t.created_by = creator.id
    LEFT JOIN users assignee ON t.assigned_to = assignee.id
    WHERE t.id = ?
  `).get(taskId);
}

// Helper: Build task tree
function buildTaskTree(tasks) {
  const taskMap = new Map();
  const rootTasks = [];

  // First pass: create map of all tasks
  tasks.forEach(task => {
    taskMap.set(task.id, { ...task, subtasks: [] });
  });

  // Second pass: build tree structure
  tasks.forEach(task => {
    const taskNode = taskMap.get(task.id);
    if (task.parent_task_id && taskMap.has(task.parent_task_id)) {
      taskMap.get(task.parent_task_id).subtasks.push(taskNode);
    } else {
      rootTasks.push(taskNode);
    }
  });

  return rootTasks;
}

// Helper: Check if all subtasks are completed
function areAllSubtasksCompleted(taskId) {
  const subtasks = db.prepare(`
    SELECT id, status FROM tasks WHERE parent_task_id = ?
  `).all(taskId);

  if (subtasks.length === 0) return true;

  for (const subtask of subtasks) {
    if (subtask.status !== 'completed') return false;
    if (!areAllSubtasksCompleted(subtask.id)) return false;
  }

  return true;
}

// Helper: Auto-complete parent tasks
function autoCompleteParents(taskId) {
  const task = db.prepare('SELECT parent_task_id FROM tasks WHERE id = ?').get(taskId);

  if (task && task.parent_task_id) {
    if (areAllSubtasksCompleted(task.parent_task_id)) {
      db.prepare(`
        UPDATE tasks
        SET status = 'completed', completed_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status != 'completed'
      `).run(task.parent_task_id);

      // Recursively check parent's parent
      autoCompleteParents(task.parent_task_id);
    }
  }
}

// Helper: Get breadcrumb path for a task
function getTaskBreadcrumb(taskId) {
  const breadcrumb = [];
  let currentId = taskId;

  while (currentId) {
    const task = db.prepare('SELECT id, title, parent_task_id FROM tasks WHERE id = ?').get(currentId);
    if (!task) break;
    breadcrumb.unshift({ id: task.id, title: task.title });
    currentId = task.parent_task_id;
  }

  return breadcrumb;
}

// Helper: Get user's allowed categories
function getUserCategories(userId) {
  return db.prepare('SELECT category FROM user_categories WHERE user_id = ?')
    .all(userId).map(c => c.category);
}

// Get all tasks (tree structure)
router.get('/', authenticateToken, (req, res, next) => {
  try {
    const { status, priority, assignee, search } = req.query;

    // Get user's allowed categories
    const userCategories = getUserCategories(req.user.id);

    // If user has no categories assigned, return empty
    if (userCategories.length === 0) {
      return res.json([]);
    }

    // Build category filter for root tasks
    const categoryPlaceholders = userCategories.map(() => '?').join(',');

    let query = `
      SELECT
        t.*,
        creator.name as creator_name,
        creator.seniority_level as creator_seniority,
        assignee.name as assignee_name,
        assignee.seniority_level as assignee_seniority
      FROM tasks t
      LEFT JOIN users creator ON t.created_by = creator.id
      LEFT JOIN users assignee ON t.assigned_to = assignee.id
      WHERE (
        t.parent_task_id IS NULL AND t.category IN (${categoryPlaceholders})
        OR t.parent_task_id IS NOT NULL
      )
    `;
    const params = [...userCategories];

    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }

    if (priority) {
      query += ' AND t.priority = ?';
      params.push(priority);
    }

    if (assignee) {
      query += ' AND t.assigned_to = ?';
      params.push(parseInt(assignee));
    }

    if (search) {
      query += ' AND (t.title LIKE ? OR t.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY t.created_at DESC';

    const tasks = db.prepare(query).all(...params);

    // Build tree and filter - only include subtasks whose root is in allowed categories
    const taskTree = buildTaskTree(tasks);

    // Filter tree to only include tasks where root category is allowed
    const filteredTree = taskTree.filter(task => userCategories.includes(task.category));

    res.json(filteredTree);
  } catch (err) {
    next(err);
  }
});

// Get my tasks (assigned to me)
router.get('/my', authenticateToken, (req, res, next) => {
  try {
    const tasks = db.prepare(`
      SELECT
        t.*,
        creator.name as creator_name,
        creator.seniority_level as creator_seniority,
        assignee.name as assignee_name,
        assignee.seniority_level as assignee_seniority
      FROM tasks t
      LEFT JOIN users creator ON t.created_by = creator.id
      LEFT JOIN users assignee ON t.assigned_to = assignee.id
      WHERE t.assigned_to = ?
      ORDER BY t.due_date ASC, t.priority DESC
    `).all(req.user.id);

    const taskTree = buildTaskTree(tasks);
    res.json(taskTree);
  } catch (err) {
    next(err);
  }
});

// Get team tasks (assigned to juniors)
router.get('/team', authenticateToken, (req, res, next) => {
  try {
    const tasks = db.prepare(`
      SELECT
        t.*,
        creator.name as creator_name,
        creator.seniority_level as creator_seniority,
        assignee.name as assignee_name,
        assignee.seniority_level as assignee_seniority
      FROM tasks t
      LEFT JOIN users creator ON t.created_by = creator.id
      LEFT JOIN users assignee ON t.assigned_to = assignee.id
      WHERE assignee.seniority_level > ?
      ORDER BY t.due_date ASC, t.priority DESC
    `).all(req.user.seniority_level);

    const taskTree = buildTaskTree(tasks);
    res.json(taskTree);
  } catch (err) {
    next(err);
  }
});

// Get single task with breadcrumb
router.get('/:id', authenticateToken, (req, res, next) => {
  try {
    const task = getTaskWithDetails(req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const breadcrumb = getTaskBreadcrumb(task.id);
    const subtasks = db.prepare(`
      SELECT
        t.*,
        creator.name as creator_name,
        assignee.name as assignee_name
      FROM tasks t
      LEFT JOIN users creator ON t.created_by = creator.id
      LEFT JOIN users assignee ON t.assigned_to = assignee.id
      WHERE t.parent_task_id = ?
      ORDER BY t.created_at ASC
    `).all(task.id);

    res.json({ ...task, breadcrumb, subtasks });
  } catch (err) {
    next(err);
  }
});

// Create task
router.post('/', authenticateToken, (req, res, next) => {
  try {
    const { title, description, start_date, due_date, priority, assigned_to, parent_task_id, category } = req.body;

    if (!title || !assigned_to) {
      return res.status(400).json({ error: 'Title and assignee are required' });
    }

    // Category is only valid for root tasks
    const validCategories = ['Projects', 'Pre-Sales', 'Admin', 'Miscellaneous'];
    if (category && !validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Check if parent task exists and user is assignee (for subtasks)
    let parentTask = null;
    if (parent_task_id) {
      parentTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(parent_task_id);

      if (!parentTask) {
        return res.status(404).json({ error: 'Parent task not found' });
      }

      // Only assignee of parent task can add subtasks
      if (parentTask.assigned_to !== req.user.id) {
        return res.status(403).json({
          error: 'You can only add subtasks to tasks assigned to you'
        });
      }

      // Validate start_date is not before parent's start_date
      if (start_date && parentTask.start_date) {
        if (new Date(start_date) < new Date(parentTask.start_date)) {
          return res.status(400).json({
            error: `Start date cannot be before parent task's start date (${parentTask.start_date})`
          });
        }
      }
    }

    // Check assignee exists and is same level or junior
    const assignee = db.prepare('SELECT * FROM users WHERE id = ?').get(assigned_to);

    if (!assignee) {
      return res.status(404).json({ error: 'Assignee not found' });
    }

    if (assignee.seniority_level < req.user.seniority_level) {
      return res.status(403).json({
        error: 'Cannot assign tasks to more senior users'
      });
    }

    const stmt = db.prepare(`
      INSERT INTO tasks (title, description, start_date, due_date, priority, status, created_by, assigned_to, parent_task_id, category)
      VALUES (?, ?, ?, ?, ?, 'not started', ?, ?, ?, ?)
    `);

    const result = stmt.run(
      title,
      description || null,
      start_date || null,
      due_date || null,
      priority || 'medium',
      req.user.id,
      assigned_to,
      parent_task_id || null,
      parent_task_id ? null : (category || null) // Only root tasks have category
    );

    const task = getTaskWithDetails(result.lastInsertRowid);
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

// Update task
router.put('/:id', authenticateToken, (req, res, next) => {
  try {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Only creator can edit task details
    if (task.created_by !== req.user.id) {
      return res.status(403).json({
        error: 'You can only edit tasks you created'
      });
    }

    const { title, description, start_date, due_date, priority, assigned_to, category } = req.body;

    // Validate category if provided
    const validCategories = ['Projects', 'Pre-Sales', 'Admin', 'Miscellaneous'];
    if (category && !validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Validate start_date is not before parent's start_date
    if (start_date && task.parent_task_id) {
      const parentTask = db.prepare('SELECT start_date FROM tasks WHERE id = ?').get(task.parent_task_id);
      if (parentTask && parentTask.start_date) {
        if (new Date(start_date) < new Date(parentTask.start_date)) {
          return res.status(400).json({
            error: `Start date cannot be before parent task's start date (${parentTask.start_date})`
          });
        }
      }
    }

    // If changing assignee, verify they're same level or junior
    if (assigned_to && assigned_to !== task.assigned_to) {
      const assignee = db.prepare('SELECT * FROM users WHERE id = ?').get(assigned_to);

      if (!assignee) {
        return res.status(404).json({ error: 'Assignee not found' });
      }

      if (assignee.seniority_level < req.user.seniority_level) {
        return res.status(403).json({
          error: 'Cannot assign tasks to more senior users'
        });
      }
    }

    // Only root tasks (no parent) can have category
    const newCategory = task.parent_task_id ? null : (category !== undefined ? category : task.category);

    const stmt = db.prepare(`
      UPDATE tasks
      SET title = ?, description = ?, start_date = ?, due_date = ?, priority = ?, assigned_to = ?, category = ?
      WHERE id = ?
    `);

    stmt.run(
      title || task.title,
      description !== undefined ? description : task.description,
      start_date !== undefined ? start_date : task.start_date,
      due_date !== undefined ? due_date : task.due_date,
      priority || task.priority,
      assigned_to || task.assigned_to,
      newCategory,
      req.params.id
    );

    const updatedTask = getTaskWithDetails(req.params.id);
    res.json(updatedTask);
  } catch (err) {
    next(err);
  }
});

// Update task status (complete/uncomplete)
router.patch('/:id/status', authenticateToken, (req, res, next) => {
  try {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Only assignee can change status
    if (task.assigned_to !== req.user.id) {
      return res.status(403).json({
        error: 'Only the assignee can change task status'
      });
    }

    const { status } = req.body;
    const validStatuses = ['not started', 'in progress', 'completed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status. Must be: not started, in progress, or completed'
      });
    }

    const completed_at = status === 'completed' ? 'CURRENT_TIMESTAMP' : null;

    if (status === 'completed') {
      db.prepare(`
        UPDATE tasks
        SET status = ?, completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(status, req.params.id);

      // Auto-complete parent if all subtasks done
      autoCompleteParents(req.params.id);
    } else {
      db.prepare(`
        UPDATE tasks
        SET status = ?, completed_at = NULL
        WHERE id = ?
      `).run(status, req.params.id);
    }

    const updatedTask = getTaskWithDetails(req.params.id);
    res.json(updatedTask);
  } catch (err) {
    next(err);
  }
});

// Delete task (only creator, and only if no subtasks)
router.delete('/:id', authenticateToken, (req, res, next) => {
  try {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.created_by !== req.user.id) {
      return res.status(403).json({
        error: 'You can only delete tasks you created'
      });
    }

    const subtasks = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE parent_task_id = ?')
      .get(req.params.id);

    if (subtasks.count > 0) {
      return res.status(400).json({
        error: 'Cannot delete task with subtasks. Delete subtasks first.'
      });
    }

    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
