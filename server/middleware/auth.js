import jwt from 'jsonwebtoken';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';

export function authMiddleware(req, res, next) {
  // Allow OPTIONS requests for CORS preflight
  if (req.method === 'OPTIONS') {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('Missing or invalid authorization header', {
      ip: req.ip,
      path: req.path
    });
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logger.warn('Token expired', { ip: req.ip });
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }

    logger.warn('Invalid token', { ip: req.ip, error: error.message });
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function generateToken(payload = {}) {
  return jwt.sign(
    { ...payload, iat: Math.floor(Date.now() / 1000) },
    config.jwtSecret,
    { expiresIn: config.jwtExpiry }
  );
}
