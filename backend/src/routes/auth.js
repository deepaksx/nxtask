import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Create user (Level 1 only)
router.post('/register', authenticateToken, async (req, res, next) => {
  try {
    // Only Level 1 users can create new users
    if (req.user.seniority_level !== 1) {
      return res.status(403).json({ error: 'Only senior executives can create users' });
    }

    const { email, password, name, seniority_level } = req.body;

    if (!email || !password || !name || !seniority_level) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (seniority_level < 1 || seniority_level > 5) {
      return res.status(400).json({ error: 'Seniority level must be between 1 and 5' });
    }

    // Check if email already exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (email, password_hash, name, seniority_level) VALUES ($1, $2, $3, $4) RETURNING id, email, name, seniority_level, created_at',
      [email, passwordHash, name, seniority_level]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { password_hash, ...userWithoutPassword } = user;
    const token = generateToken(userWithoutPassword);

    // Get user's allowed categories
    const categoriesResult = await pool.query(
      'SELECT category FROM user_categories WHERE user_id = $1',
      [user.id]
    );
    const categories = categoriesResult.rows.map(c => c.category);

    res.json({ user: { ...userWithoutPassword, categories }, token });
  } catch (err) {
    next(err);
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, seniority_level, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's allowed categories
    const categoriesResult = await pool.query(
      'SELECT category FROM user_categories WHERE user_id = $1',
      [req.user.id]
    );
    const categories = categoriesResult.rows.map(c => c.category);

    res.json({ ...user, categories });
  } catch (err) {
    next(err);
  }
});

export default router;
