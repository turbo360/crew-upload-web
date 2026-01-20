import fs from 'fs/promises';
import path from 'path';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { uploadModel, sessionModel } from '../models/database.js';
import { sanitizeFilename } from '../utils/cleanup.js';
import { sendCompletionEmail } from '../utils/email.js';

export async function tusUploadHandler(upload) {
  try {
    const metadata = parseMetadata(upload.metadata);
    const { sessionId, filename, originalPath } = metadata;

    if (!sessionId || !filename) {
      logger.error('Missing required metadata', { uploadId: upload.id, metadata });
      return;
    }

    // Get session info
    const session = sessionModel.getById(sessionId);
    if (!session) {
      logger.error('Session not found', { sessionId, uploadId: upload.id });
      return;
    }

    // Build destination path
    const sanitizedFilename = sanitizeFilename(filename);
    let destDir = session.folder_path;

    // If there's an original path (folder upload), preserve structure
    if (originalPath) {
      const sanitizedPath = originalPath
        .split('/')
        .map(p => sanitizeFilename(p))
        .join('/');
      destDir = path.join(destDir, path.dirname(sanitizedPath));
    }

    // Ensure destination directory exists
    await fs.mkdir(destDir, { recursive: true });

    // Generate final filename (handle duplicates)
    let finalPath = path.join(destDir, sanitizedFilename);
    let counter = 1;
    const ext = path.extname(sanitizedFilename);
    const baseName = path.basename(sanitizedFilename, ext);

    while (await fileExists(finalPath)) {
      finalPath = path.join(destDir, `${baseName}_${Date.now()}_${counter}${ext}`);
      counter++;
    }

    // Move file from tus storage to final location
    const tusFilePath = path.join(config.uploadDir, '.tus', upload.id);
    await fs.rename(tusFilePath, finalPath);

    // Try to clean up .json metadata file
    try {
      await fs.unlink(tusFilePath + '.json');
    } catch {
      // Ignore if metadata file doesn't exist
    }

    logger.info(`File moved to final location`, {
      uploadId: upload.id,
      sessionId,
      finalPath
    });

    // Find and update upload record
    const uploadRecord = uploadModel.getByTusId(upload.id);
    if (uploadRecord) {
      uploadModel.markComplete(uploadRecord.id, finalPath);
    }

    // Update session stats
    const stats = sessionModel.updateStats(sessionId);

    // Check if all uploads are complete
    if (stats.uploaded_files + stats.failed_files >= stats.total_files && stats.total_files > 0) {
      sessionModel.markComplete(sessionId);
      logger.info(`Session completed`, { sessionId, stats });

      // Send completion email
      try {
        await sendCompletionEmail(sessionId);
      } catch (emailError) {
        logger.error('Failed to send completion email', { sessionId, error: emailError.message });
      }
    }

  } catch (error) {
    logger.error('Error handling upload completion', {
      uploadId: upload.id,
      error: error.message,
      stack: error.stack
    });
  }
}

function parseMetadata(metadata) {
  // If metadata is already an object (newer tus-server versions), return it directly
  if (metadata && typeof metadata === 'object') {
    return metadata;
  }

  const result = {};

  if (!metadata) return result;

  // TUS metadata format: "key base64value,key2 base64value2"
  const pairs = String(metadata).split(',');

  for (const pair of pairs) {
    const [key, value] = pair.trim().split(' ');
    if (key && value) {
      try {
        result[key] = Buffer.from(value, 'base64').toString('utf-8');
      } catch {
        result[key] = value;
      }
    }
  }

  return result;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
