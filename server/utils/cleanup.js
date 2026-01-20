import fs from 'fs/promises';
import path from 'path';
import { config } from './config.js';
import { logger } from './logger.js';
import { sessionModel, uploadModel } from '../models/database.js';

export async function cleanupIncompleteUploads() {
  const tusDir = path.join(config.uploadDir, '.tus');
  const cutoffTime = Date.now() - (config.cleanupDays * 24 * 60 * 60 * 1000);

  logger.info('Starting cleanup of incomplete uploads');

  try {
    const files = await fs.readdir(tusDir);

    for (const file of files) {
      const filePath = path.join(tusDir, file);
      const stats = await fs.stat(filePath);

      if (stats.mtimeMs < cutoffTime) {
        await fs.unlink(filePath);
        logger.info(`Cleaned up incomplete upload: ${file}`);
      }
    }

    // Check for abandoned sessions
    const abandonedSessions = sessionModel.getAbandoned(24);
    for (const session of abandonedSessions) {
      logger.warn(`Found abandoned session: ${session.id}`, {
        crewName: session.crew_name,
        projectName: session.project_name,
        createdAt: session.created_at
      });

      // Mark session as abandoned
      sessionModel.update(session.id, { status: 'abandoned' });

      // TODO: Send notification email about abandoned session
    }

    logger.info('Cleanup completed');
  } catch (error) {
    logger.error('Error during cleanup:', error);
    throw error;
  }
}

export function sanitizeFilename(filename) {
  // Remove path traversal attempts and dangerous characters
  return filename
    .replace(/\.\./g, '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/^\.+/, '')
    .trim();
}

export function generateUniqueFilename(baseDir, filename) {
  const ext = path.extname(filename);
  const name = path.basename(filename, ext);
  let finalPath = path.join(baseDir, filename);
  let counter = 1;

  // Check if file exists and add timestamp if needed
  try {
    const fs = require('fs');
    while (fs.existsSync(finalPath)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      finalPath = path.join(baseDir, `${name}_${timestamp}${ext}`);
      counter++;
      if (counter > 100) break; // Prevent infinite loop
    }
  } catch {
    // File doesn't exist, use original path
  }

  return finalPath;
}
