import { Router } from 'express';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { generateToken, authMiddleware } from '../middleware/auth.js';
import { auditModel } from '../models/database.js';

const router = Router();

// Email format validation
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Login endpoint - accepts name + email (no password)
router.post('/login', async (req, res) => {
  const { name, email } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email is required' });
  }

  if (!isValidEmail(email.trim())) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  try {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    // Generate JWT token with user info in payload
    const token = generateToken({ name: trimmedName, email: trimmedEmail });

    logger.info('Successful login', { name: trimmedName, email: trimmedEmail, ip: req.ip });

    auditModel.log({
      eventType: 'login',
      details: { name: trimmedName, email: trimmedEmail },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      token,
      expiresIn: config.jwtExpiry
    });

  } catch (error) {
    logger.error('Login error', { error: error.message });
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Logout endpoint (mainly for audit logging)
router.post('/logout', authMiddleware, (req, res) => {
  auditModel.log({
    eventType: 'logout',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  res.json({ success: true });
});

// Check session validity
router.get('/check', authMiddleware, (req, res) => {
  res.json({
    valid: true,
    user: req.user
  });
});

export default router;
