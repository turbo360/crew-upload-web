import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server as TusServer } from '@tus/server';
import { FileStore } from '@tus/file-store';
import { initDatabase } from './models/database.js';
import { logger } from './utils/logger.js';
import { config } from './utils/config.js';
import authRoutes from './routes/auth.js';
import sessionRoutes from './routes/session.js';
import adminRoutes from './routes/admin.js';
import notificationRoutes from './routes/notification.js';
import { authMiddleware } from './middleware/auth.js';
import { tusUploadHandler } from './middleware/tusHandler.js';
import { cleanupIncompleteUploads } from './utils/cleanup.js';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Ensure directories exist
const ensureDirectories = () => {
  const dirs = [
    config.uploadDir,
    config.dataDir,
    path.join(config.dataDir, 'logs'),
    path.join(config.uploadDir, '.tus')
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created directory: ${dir}`);
    }
  });
};

ensureDirectories();

// Initialize database
initDatabase();

// Security middleware - relaxed for HTTP access
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false,
  originAgentCluster: false
}));

// CORS configuration - allow local network access
const corsOptions = {
  origin: true, // Allow all origins for now (protected by auth)
  credentials: true,
  exposedHeaders: [
    'Upload-Offset',
    'Upload-Length',
    'Upload-Metadata',
    'Tus-Resumable',
    'Location'
  ]
};
app.use(cors(corsOptions));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (!req.path.startsWith('/files') || req.method !== 'PATCH') {
      logger.info(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const diskSpace = await getDiskSpace();
    res.json({
      status: 'healthy',
      uptime: process.uptime(),
      database: 'connected',
      diskSpace
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Get disk space helper
async function getDiskSpace() {
  try {
    const { execSync } = await import('child_process');
    const output = execSync(`df -h "${config.uploadDir}" | tail -1`).toString();
    const parts = output.split(/\s+/);
    return {
      total: parts[1] || 'unknown',
      used: parts[2] || 'unknown',
      free: parts[3] || 'unknown',
      usePercent: parts[4] || 'unknown'
    };
  } catch {
    return { total: 'unknown', free: 'unknown' };
  }
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/session', authMiddleware, sessionRoutes);
app.use('/api/admin', authMiddleware, adminRoutes);
app.use('/api/notification', notificationRoutes);

// TUS upload endpoint (requires auth)
const tusStore = new FileStore({
  directory: path.join(config.uploadDir, '.tus')
});

const tusServer = new TusServer({
  path: '/files',
  datastore: tusStore,
  maxSize: 0, // Unlimited
  respectForwardedHeaders: true,
  namingFunction: (req) => {
    return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  },
  onUploadCreate: async (req, res, upload) => {
    logger.info(`Upload created: ${upload.id}`, {
      size: upload.size,
      metadata: upload.metadata
    });
    return res;
  },
  onUploadFinish: async (req, res, upload) => {
    logger.info(`Upload finished: ${upload.id}`);
    await tusUploadHandler(upload);
    return res;
  }
});

// TUS routes with auth check
app.all('/files', authMiddleware, (req, res) => {
  tusServer.handle(req, res);
});

app.all('/files/*', authMiddleware, (req, res) => {
  tusServer.handle(req, res);
});

// Serve web upload portal
const portalPath = path.join(__dirname, 'portal');
app.use('/portal', express.static(portalPath));
app.get('/', (req, res) => {
  res.redirect('/portal');
});

// Error handling
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? err.message : undefined
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`Upload directory: ${config.uploadDir}`);

  // Schedule cleanup of incomplete uploads
  setInterval(() => {
    cleanupIncompleteUploads().catch(err => {
      logger.error('Cleanup error:', err);
    });
  }, 24 * 60 * 60 * 1000); // Run daily
});

export default app;
