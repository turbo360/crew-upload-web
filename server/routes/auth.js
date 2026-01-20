import { Router } from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { generateToken, authMiddleware } from '../middleware/auth.js';
import { auditModel } from '../models/database.js';

const router = Router();

// Hash password on startup (even though single password, we store hashed)
let hashedPassword = null;
(async () => {
  hashedPassword = await bcrypt.hash(config.uploadPassword, 10);
})();

// Rate limiting for login attempts
const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 attempts per hour
  message: { error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip
});

// Login endpoint
router.post('/login', loginLimiter, async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  try {
    // Compare with hashed password
    const isValid = await bcrypt.compare(password, hashedPassword);

    if (!isValid) {
      logger.warn('Failed login attempt', {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      auditModel.log({
        eventType: 'login_failed',
        details: { reason: 'invalid_password' },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(401).json({ error: 'Invalid password' });
    }

    // Generate JWT token
    const token = generateToken({ authenticated: true });

    logger.info('Successful login', { ip: req.ip });

    auditModel.log({
      eventType: 'login',
      details: { success: true },
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
