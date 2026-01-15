import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
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
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const stmt = db.prepare(`
      INSERT INTO users (email, password_hash, name, seniority_level)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(email, passwordHash, name, seniority_level);

    const user = db.prepare('SELECT id, email, name, seniority_level, created_at FROM users WHERE id = ?')
      .get(result.lastInsertRowid);

    res.status(201).json(user);
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

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

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
    const categories = db.prepare('SELECT category FROM user_categories WHERE user_id = ?')
      .all(user.id).map(c => c.category);

    res.json({ user: { ...userWithoutPassword, categories }, token });
  } catch (err) {
    next(err);
  }
});

// Get current user
router.get('/me', authenticateToken, (req, res, next) => {
  try {
    const user = db.prepare('SELECT id, email, name, seniority_level, created_at FROM users WHERE id = ?')
      .get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's allowed categories
    const categories = db.prepare('SELECT category FROM user_categories WHERE user_id = ?')
      .all(req.user.id).map(c => c.category);

    res.json({ ...user, categories });
  } catch (err) {
    next(err);
  }
});

export default router;
