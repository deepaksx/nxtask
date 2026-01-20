import express from 'express';
import { query } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Helper: Get task with full details
async function getTaskWithDetails(taskId) {
  const result = await query(`
    SELECT
      t.*,
      creator.name as creator_name,
      creator.seniority_level as creator_seniority,
      assignee.name as assignee_name,
      assignee.seniority_level as assignee_seniority
    FROM tasks t
    LEFT JOIN users creator ON t.created_by = creator.id
    LEFT JOIN users assignee ON t.assigned_to = assignee.id
    WHERE t.id = $1
  `, [taskId]);
  return result[0];
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
async function areAllSubtasksCompleted(taskId) {
  const subtasks = await query(
    'SELECT id, status FROM tasks WHERE parent_task_id = $1',
    [taskId]
  );

  if (subtasks.length === 0) return true;

  for (const subtask of subtasks) {
    if (subtask.status !== 'completed') return false;
    if (!(await areAllSubtasksCompleted(subtask.id))) return false;
  }

  return true;
}

// Helper: Auto-complete parent tasks
async function autoCompleteParents(taskId) {
  const result = await query('SELECT parent_task_id FROM tasks WHERE id = $1', [taskId]);
  const task = result[0];

  if (task && task.parent_task_id) {
    if (await areAllSubtasksCompleted(task.parent_task_id)) {
      await query(`
        UPDATE tasks
        SET status = 'completed', completed_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND status != 'completed'
      `, [task.parent_task_id]);

      // Recursively check parent's parent
      await autoCompleteParents(task.parent_task_id);
    }
  }
}

// Helper: Get breadcrumb path for a task
async function getTaskBreadcrumb(taskId) {
  const breadcrumb = [];
  let currentId = taskId;

  while (currentId) {
    const result = await query(
      'SELECT id, title, parent_task_id FROM tasks WHERE id = $1',
      [currentId]
    );
    const task = result[0];
    if (!task) break;
    breadcrumb.unshift({ id: task.id, title: task.title });
    currentId = task.parent_task_id;
  }

  return breadcrumb;
}

// Helper: Get user's allowed categories
async function getUserCategories(userId) {
  const result = await query(
    'SELECT category FROM user_categories WHERE user_id = $1',
    [userId]
  );
  return result.map(c => c.category);
}

// Get all tasks (tree structure)
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { status, priority, assignee, search } = req.query;

    // Get user's allowed categories
    const userCategories = await getUserCategories(req.user.id);

    // If user has no categories assigned, return empty
    if (userCategories.length === 0) {
      return res.json([]);
    }

    // Build category filter for root tasks
    const categoryPlaceholders = userCategories.map((_, i) => `$${i + 1}`).join(',');

    let queryStr = `
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
    let paramIndex = userCategories.length + 1;

    if (status) {
      queryStr += ` AND t.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (priority) {
      queryStr += ` AND t.priority = $${paramIndex}`;
      params.push(priority);
      paramIndex++;
    }

    if (assignee) {
      queryStr += ` AND t.assigned_to = $${paramIndex}`;
      params.push(parseInt(assignee));
      paramIndex++;
    }

    if (search) {
      queryStr += ` AND (t.title ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex + 1})`;
      params.push(`%${search}%`, `%${search}%`);
      paramIndex += 2;
    }

    queryStr += ' ORDER BY t.created_at DESC';

    const tasks = await query(queryStr, params);

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
router.get('/my', authenticateToken, async (req, res, next) => {
  try {
    const result = await query(`
      SELECT
        t.*,
        creator.name as creator_name,
        creator.seniority_level as creator_seniority,
        assignee.name as assignee_name,
        assignee.seniority_level as assignee_seniority
      FROM tasks t
      LEFT JOIN users creator ON t.created_by = creator.id
      LEFT JOIN users assignee ON t.assigned_to = assignee.id
      WHERE t.assigned_to = $1
      ORDER BY t.due_date ASC, t.priority DESC
    `, [req.user.id]);

    const taskTree = buildTaskTree(result);
    res.json(taskTree);
  } catch (err) {
    next(err);
  }
});

// Get team tasks (assigned to juniors)
router.get('/team', authenticateToken, async (req, res, next) => {
  try {
    const result = await query(`
      SELECT
        t.*,
        creator.name as creator_name,
        creator.seniority_level as creator_seniority,
        assignee.name as assignee_name,
        assignee.seniority_level as assignee_seniority
      FROM tasks t
      LEFT JOIN users creator ON t.created_by = creator.id
      LEFT JOIN users assignee ON t.assigned_to = assignee.id
      WHERE assignee.seniority_level > $1
      ORDER BY t.due_date ASC, t.priority DESC
    `, [req.user.seniority_level]);

    const taskTree = buildTaskTree(result);
    res.json(taskTree);
  } catch (err) {
    next(err);
  }
});

// Get single task with breadcrumb
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const task = await getTaskWithDetails(req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const breadcrumb = await getTaskBreadcrumb(task.id);
    const subtasksResult = await query(`
      SELECT
        t.*,
        creator.name as creator_name,
        assignee.name as assignee_name
      FROM tasks t
      LEFT JOIN users creator ON t.created_by = creator.id
      LEFT JOIN users assignee ON t.assigned_to = assignee.id
      WHERE t.parent_task_id = $1
      ORDER BY t.created_at ASC
    `, [task.id]);

    res.json({ ...task, breadcrumb, subtasks: subtasksResult });
  } catch (err) {
    next(err);
  }
});

// Create task
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const { title, description, start_date, due_date, priority, assigned_to, parent_task_id, category } = req.body;

    if (!title || !assigned_to) {
      return res.status(400).json({ error: 'Title and assignee are required' });
    }

    // Only Level 1 users can create main (root) tasks
    if (!parent_task_id && req.user.seniority_level !== 1) {
      return res.status(403).json({ error: 'Only Level 1 users can create main tasks' });
    }

    // Category is only valid for root tasks
    const validCategories = ['Projects', 'Pre-Sales', 'Admin', 'Miscellaneous'];
    if (category && !validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Check if parent task exists (for subtasks)
    let parentTask = null;
    if (parent_task_id) {
      const parentResult = await query('SELECT * FROM tasks WHERE id = $1', [parent_task_id]);
      parentTask = parentResult[0];

      if (!parentTask) {
        return res.status(404).json({ error: 'Parent task not found' });
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
    const assigneeResult = await query('SELECT * FROM users WHERE id = $1', [assigned_to]);
    const assignee = assigneeResult[0];

    if (!assignee) {
      return res.status(404).json({ error: 'Assignee not found' });
    }

    if (assignee.seniority_level < req.user.seniority_level) {
      return res.status(403).json({
        error: 'Cannot assign tasks to more senior users'
      });
    }

    const result = await query(`
      INSERT INTO tasks (title, description, start_date, due_date, priority, status, created_by, assigned_to, parent_task_id, category)
      VALUES ($1, $2, $3, $4, $5, 'not started', $6, $7, $8, $9)
      RETURNING id
    `, [
      title,
      description || null,
      start_date || null,
      due_date || null,
      priority || 'medium',
      req.user.id,
      assigned_to,
      parent_task_id || null,
      parent_task_id ? null : (category || null) // Only root tasks have category
    ]);

    const task = await getTaskWithDetails(result[0].id);
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

// Update task
router.put('/:id', authenticateToken, async (req, res, next) => {
  try {
    const taskResult = await query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    const task = taskResult[0];

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
      const parentResult = await query('SELECT start_date FROM tasks WHERE id = $1', [task.parent_task_id]);
      const parentTask = parentResult[0];
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
      const assigneeResult = await query('SELECT * FROM users WHERE id = $1', [assigned_to]);
      const assignee = assigneeResult[0];

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

    await query(`
      UPDATE tasks
      SET title = $1, description = $2, start_date = $3, due_date = $4, priority = $5, assigned_to = $6, category = $7
      WHERE id = $8
    `, [
      title || task.title,
      description !== undefined ? description : task.description,
      start_date !== undefined ? start_date : task.start_date,
      due_date !== undefined ? due_date : task.due_date,
      priority || task.priority,
      assigned_to || task.assigned_to,
      newCategory,
      req.params.id
    ]);

    const updatedTask = await getTaskWithDetails(req.params.id);
    res.json(updatedTask);
  } catch (err) {
    next(err);
  }
});

// Update task status (complete/uncomplete)
router.patch('/:id/status', authenticateToken, async (req, res, next) => {
  try {
    const taskResult = await query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    const task = taskResult[0];

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

    if (status === 'completed') {
      await query(`
        UPDATE tasks
        SET status = $1, completed_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [status, req.params.id]);

      // Auto-complete parent if all subtasks done
      await autoCompleteParents(req.params.id);
    } else {
      await query(`
        UPDATE tasks
        SET status = $1, completed_at = NULL
        WHERE id = $2
      `, [status, req.params.id]);
    }

    const updatedTask = await getTaskWithDetails(req.params.id);
    res.json(updatedTask);
  } catch (err) {
    next(err);
  }
});

// Delete task (only creator, and only if no subtasks)
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const taskResult = await query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    const task = taskResult[0];

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.created_by !== req.user.id) {
      return res.status(403).json({
        error: 'You can only delete tasks you created'
      });
    }

    const subtasksResult = await query(
      'SELECT COUNT(*) as count FROM tasks WHERE parent_task_id = $1',
      [req.params.id]
    );

    if (parseInt(subtasksResult[0].count) > 0) {
      return res.status(400).json({
        error: 'Cannot delete task with subtasks. Delete subtasks first.'
      });
    }

    await query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
