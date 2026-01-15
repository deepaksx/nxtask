import express from 'express';
import pool from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all users (for task assignment)
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT id, email, name, seniority_level, created_at
      FROM users
      ORDER BY seniority_level ASC, name ASC
    `);

    // Get categories for each user
    const usersWithCategories = await Promise.all(
      result.rows.map(async (user) => {
        const catResult = await pool.query(
          'SELECT category FROM user_categories WHERE user_id = $1',
          [user.id]
        );
        return {
          ...user,
          categories: catResult.rows.map(c => c.category)
        };
      })
    );

    res.json(usersWithCategories);
  } catch (err) {
    next(err);
  }
});

// Get juniors (users with higher seniority_level number than current user)
router.get('/juniors', authenticateToken, async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT id, email, name, seniority_level, created_at
      FROM users
      WHERE seniority_level > $1
      ORDER BY seniority_level ASC, name ASC
    `, [req.user.seniority_level]);

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Get assignable users (same level and below for task creation)
router.get('/assignable', authenticateToken, async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT id, email, name, seniority_level, created_at
      FROM users
      WHERE seniority_level >= $1
      ORDER BY seniority_level ASC, name ASC
    `, [req.user.seniority_level]);

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Get user by ID
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT id, email, name, seniority_level, created_at
      FROM users
      WHERE id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Update user seniority level (Level 1 users only)
router.put('/:id', authenticateToken, async (req, res, next) => {
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
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent demoting yourself if you're the only Level 1
    if (userId === req.user.id && seniority_level !== 1) {
      const countResult = await pool.query(
        'SELECT COUNT(*) as count FROM users WHERE seniority_level = 1 AND id != $1',
        [userId]
      );

      if (parseInt(countResult.rows[0].count) === 0) {
        return res.status(400).json({ error: 'Cannot demote yourself - you are the only senior executive' });
      }
    }

    // Update seniority level
    await pool.query('UPDATE users SET seniority_level = $1 WHERE id = $2', [seniority_level, userId]);

    const updatedResult = await pool.query(`
      SELECT id, email, name, seniority_level, created_at
      FROM users WHERE id = $1
    `, [userId]);

    // Get categories
    const catResult = await pool.query(
      'SELECT category FROM user_categories WHERE user_id = $1',
      [userId]
    );

    res.json({ ...updatedResult.rows[0], categories: catResult.rows.map(c => c.category) });
  } catch (err) {
    next(err);
  }
});

// Update user categories (Level 1 users only)
router.put('/:id/categories', authenticateToken, async (req, res, next) => {
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
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete existing categories and insert new ones
    await pool.query('DELETE FROM user_categories WHERE user_id = $1', [userId]);

    for (const cat of categories) {
      await pool.query('INSERT INTO user_categories (user_id, category) VALUES ($1, $2)', [userId, cat]);
    }

    res.json({ userId, categories });
  } catch (err) {
    next(err);
  }
});

// Delete user (Level 1 users only)
router.delete('/:id', authenticateToken, async (req, res, next) => {
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
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has any tasks assigned
    const taskResult = await pool.query(
      'SELECT COUNT(*) as count FROM tasks WHERE assigned_to = $1 OR created_by = $1',
      [userId]
    );

    if (parseInt(taskResult.rows[0].count) > 0) {
      return res.status(400).json({
        error: `Cannot delete user - they have ${taskResult.rows[0].count} task(s) assigned or created. Reassign tasks first.`
      });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [userId]);

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
