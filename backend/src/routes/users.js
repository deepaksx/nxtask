import express from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all users (for task assignment)
router.get('/', authenticateToken, (req, res, next) => {
  try {
    const users = db.prepare(`
      SELECT id, email, name, seniority_level, created_at
      FROM users
      ORDER BY seniority_level ASC, name ASC
    `).all();

    // Get categories for each user
    const getCategories = db.prepare('SELECT category FROM user_categories WHERE user_id = ?');
    const usersWithCategories = users.map(user => ({
      ...user,
      categories: getCategories.all(user.id).map(c => c.category)
    }));

    res.json(usersWithCategories);
  } catch (err) {
    next(err);
  }
});

// Get juniors (users with higher seniority_level number than current user)
router.get('/juniors', authenticateToken, (req, res, next) => {
  try {
    const juniors = db.prepare(`
      SELECT id, email, name, seniority_level, created_at
      FROM users
      WHERE seniority_level > ?
      ORDER BY seniority_level ASC, name ASC
    `).all(req.user.seniority_level);

    res.json(juniors);
  } catch (err) {
    next(err);
  }
});

// Get assignable users (same level and below for task creation)
router.get('/assignable', authenticateToken, (req, res, next) => {
  try {
    const users = db.prepare(`
      SELECT id, email, name, seniority_level, created_at
      FROM users
      WHERE seniority_level >= ?
      ORDER BY seniority_level ASC, name ASC
    `).all(req.user.seniority_level);

    res.json(users);
  } catch (err) {
    next(err);
  }
});

// Get user by ID
router.get('/:id', authenticateToken, (req, res, next) => {
  try {
    const user = db.prepare(`
      SELECT id, email, name, seniority_level, created_at
      FROM users
      WHERE id = ?
    `).get(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    next(err);
  }
});

// Update user seniority level (Level 1 users only)
router.put('/:id', authenticateToken, (req, res, next) => {
  try {
    // Only Level 1 users can manage users
    if (req.user.seniority_level !== 1) {
      return res.status(403).json({ error: 'Only senior executives can manage users' });
    }

    const { seniority_level } = req.body;
    const userId = parseInt(req.params.id);

    // Validate seniority level
    if (!seniority_level || seniority_level < 1 || seniority_level > 5) {
      return res.status(400).json({ error: 'Seniority level must be between 1 and 5' });
    }

    // Check if user exists
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent demoting yourself if you're the only Level 1
    if (userId === req.user.id && seniority_level !== 1) {
      const otherLevel1Count = db.prepare(
        'SELECT COUNT(*) as count FROM users WHERE seniority_level = 1 AND id != ?'
      ).get(userId).count;

      if (otherLevel1Count === 0) {
        return res.status(400).json({ error: 'Cannot demote yourself - you are the only senior executive' });
      }
    }

    // Update seniority level
    db.prepare('UPDATE users SET seniority_level = ? WHERE id = ?').run(seniority_level, userId);

    const updatedUser = db.prepare(`
      SELECT id, email, name, seniority_level, created_at
      FROM users WHERE id = ?
    `).get(userId);

    // Get categories
    const categories = db.prepare('SELECT category FROM user_categories WHERE user_id = ?')
      .all(userId).map(c => c.category);

    res.json({ ...updatedUser, categories });
  } catch (err) {
    next(err);
  }
});

// Update user categories (Level 1 users only)
router.put('/:id/categories', authenticateToken, (req, res, next) => {
  try {
    // Only Level 1 users can manage categories
    if (req.user.seniority_level !== 1) {
      return res.status(403).json({ error: 'Only senior executives can manage user categories' });
    }

    const { categories } = req.body;
    const userId = parseInt(req.params.id);

    // Validate categories
    const validCategories = ['Projects', 'Pre-Sales', 'Admin', 'Miscellaneous'];
    if (!Array.isArray(categories)) {
      return res.status(400).json({ error: 'Categories must be an array' });
    }

    const invalidCats = categories.filter(c => !validCategories.includes(c));
    if (invalidCats.length > 0) {
      return res.status(400).json({ error: `Invalid categories: ${invalidCats.join(', ')}` });
    }

    // Check if user exists
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete existing categories and insert new ones
    db.prepare('DELETE FROM user_categories WHERE user_id = ?').run(userId);

    const insertCategory = db.prepare('INSERT INTO user_categories (user_id, category) VALUES (?, ?)');
    categories.forEach(cat => insertCategory.run(userId, cat));

    res.json({ userId, categories });
  } catch (err) {
    next(err);
  }
});

// Delete user (Level 1 users only)
router.delete('/:id', authenticateToken, (req, res, next) => {
  try {
    // Only Level 1 users can delete users
    if (req.user.seniority_level !== 1) {
      return res.status(403).json({ error: 'Only senior executives can delete users' });
    }

    const userId = parseInt(req.params.id);

    // Can't delete yourself
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Check if user exists
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has any tasks assigned
    const taskCount = db.prepare(
      'SELECT COUNT(*) as count FROM tasks WHERE assigned_to = ? OR created_by = ?'
    ).get(userId, userId).count;

    if (taskCount > 0) {
      return res.status(400).json({
        error: `Cannot delete user - they have ${taskCount} task(s) assigned or created. Reassign tasks first.`
      });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
