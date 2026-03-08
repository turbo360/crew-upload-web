import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { uploadModel, sessionModel } from '../models/database.js';
import { sanitizeFilename } from '../utils/cleanup.js';
import { sendCompletionEmail } from '../utils/email.js';

// Notify Synology indexer so Drive Client sees new files/folders immediately
function notifySynology(filePath, isDir = false) {
  try {
    const flag = isDir ? '-A' : '-a';
    execSync(`/usr/syno/bin/synoindex ${flag} "${filePath}"`, { timeout: 5000 });
    logger.info(`Synology index notified: ${filePath}`);
  } catch (err) {
    // Non-critical — don't fail the upload if indexing fails
    logger.warn(`Synology index notification failed: ${err.message}`);
  }
}

// Track partial uploads waiting for concatenation: groupId -> { totalParts, receivedParts: Map<index, tusId> }
const pendingGroups = new Map();

export async function tusUploadHandler(upload) {
  try {
    const metadata = parseMetadata(upload.metadata);
    const { sessionId, filename, originalPath, groupId, partIndex, totalParts } = metadata;

    // If this is a partial upload (part of a parallel group), store it and wait
    if (groupId && partIndex !== undefined && totalParts) {
      await handlePartialUpload(upload, metadata);
      return;
    }

    // Normal single-stream upload — process immediately
    await processCompletedUpload(upload.id, metadata);

  } catch (error) {
    logger.error('Error handling upload completion', {
      uploadId: upload.id,
      error: error.message,
      stack: error.stack
    });
  }
}

async function handlePartialUpload(upload, metadata) {
  const { groupId, partIndex, totalParts } = metadata;
  const numParts = parseInt(totalParts, 10);
  const idx = parseInt(partIndex, 10);

  logger.info(`Partial upload received`, { groupId, partIndex: idx, totalParts: numParts, tusId: upload.id });

  if (!pendingGroups.has(groupId)) {
    pendingGroups.set(groupId, { totalParts: numParts, metadata, receivedParts: new Map() });
  }

  const group = pendingGroups.get(groupId);
  group.receivedParts.set(idx, upload.id);

  // Check if all parts have arrived
  if (group.receivedParts.size >= numParts) {
    logger.info(`All parts received for group ${groupId}, concatenating...`);
    try {
      await concatenateAndProcess(group);
    } finally {
      pendingGroups.delete(groupId);
    }
  }
}

async function concatenateAndProcess(group) {
  const { totalParts, metadata, receivedParts } = group;
  const tusDir = path.join(config.uploadDir, '.tus');

  // Build the final file by concatenating parts in order
  const { sessionId, filename, originalPath } = metadata;

  const session = sessionModel.getById(sessionId);
  if (!session) {
    logger.error('Session not found for concat', { sessionId });
    return;
  }

  // Build destination path
  const sanitizedFilename = sanitizeFilename(filename);
  let destDir = session.folder_path;

  if (originalPath) {
    const sanitizedPath = originalPath
      .split('/')
      .map(p => sanitizeFilename(p))
      .join('/');
    destDir = path.join(destDir, path.dirname(sanitizedPath));
  }

  await fs.mkdir(destDir, { recursive: true });

  // Fix directory ownership
  try {
    const { execSync } = await import('child_process');
    execSync(`chown -R ${config.fileOwner}:${config.fileGroup} "${session.folder_path}"`);
  } catch (chownErr) {
    logger.warn('Failed to set directory ownership', { destDir, error: chownErr.message });
  }

  // Generate final filename (handle duplicates)
  let finalPath = path.join(destDir, sanitizedFilename);
  let counter = 1;
  const ext = path.extname(sanitizedFilename);
  const baseName = path.basename(sanitizedFilename, ext);

  while (await fileExists(finalPath)) {
    finalPath = path.join(destDir, `${baseName}_${Date.now()}_${counter}${ext}`);
    counter++;
  }

  // Concatenate all parts into the final file
  const writeStream = createWriteStream(finalPath);

  for (let i = 0; i < totalParts; i++) {
    const tusId = receivedParts.get(i);
    if (!tusId) {
      logger.error(`Missing part ${i} for group`, { groupId: metadata.groupId });
      writeStream.destroy();
      return;
    }
    const partPath = path.join(tusDir, tusId);
    await new Promise((resolve, reject) => {
      const readStream = createReadStream(partPath);
      readStream.on('error', reject);
      readStream.on('end', resolve);
      readStream.pipe(writeStream, { end: false });
    });
  }

  await new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
    writeStream.end();
  });

  logger.info(`Concatenated ${totalParts} parts into ${finalPath}`);

  // Clean up part files and their .json metadata
  for (let i = 0; i < totalParts; i++) {
    const tusId = receivedParts.get(i);
    const partPath = path.join(tusDir, tusId);
    try { await fs.unlink(partPath); } catch { /* ignore */ }
    try { await fs.unlink(partPath + '.json'); } catch { /* ignore */ }
  }

  // Fix file ownership
  try {
    const { execSync } = await import('child_process');
    execSync(`chown ${config.fileOwner}:${config.fileGroup} "${finalPath}"`);
    logger.info('Set ownership', { finalPath, owner: `${config.fileOwner}:${config.fileGroup}` });
  } catch (chownErr) {
    logger.error('Failed to set file ownership', { finalPath, error: chownErr.message });
  }

  logger.info(`File moved to final location`, { sessionId, finalPath });

  // Notify Synology so Drive Client syncs this file immediately
  notifySynology(destDir, true);
  notifySynology(finalPath, false);

  // Find and update upload record (uses the groupId as tusUploadId)
  const uploadRecord = uploadModel.getByTusId(metadata.groupId);
  if (uploadRecord) {
    uploadModel.markComplete(uploadRecord.id, finalPath);
  }

  // Update session stats
  const stats = sessionModel.updateStats(sessionId);

  // Check if all uploads are complete
  if (stats.uploaded_files + stats.failed_files >= stats.total_files && stats.total_files > 0) {
    sessionModel.markComplete(sessionId);
    logger.info(`Session completed`, { sessionId, stats });

    try {
      await sendCompletionEmail(sessionId);
    } catch (emailError) {
      logger.error('Failed to send completion email', { sessionId, error: emailError.message });
    }
  }
}

async function processCompletedUpload(tusId, metadata) {
  const { sessionId, filename, originalPath } = metadata;

  if (!sessionId || !filename) {
    logger.error('Missing required metadata', { tusId, metadata });
    return;
  }

  const session = sessionModel.getById(sessionId);
  if (!session) {
    logger.error('Session not found', { sessionId, tusId });
    return;
  }

  // Build destination path
  const sanitizedFilename = sanitizeFilename(filename);
  let destDir = session.folder_path;

  if (originalPath) {
    const sanitizedPath = originalPath
      .split('/')
      .map(p => sanitizeFilename(p))
      .join('/');
    destDir = path.join(destDir, path.dirname(sanitizedPath));
  }

  await fs.mkdir(destDir, { recursive: true });

  // Fix directory ownership
  try {
    const { execSync } = await import('child_process');
    execSync(`chown -R ${config.fileOwner}:${config.fileGroup} "${session.folder_path}"`);
  } catch (chownErr) {
    logger.warn('Failed to set directory ownership', { destDir, error: chownErr.message });
  }

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
  const tusFilePath = path.join(config.uploadDir, '.tus', tusId);
  await fs.rename(tusFilePath, finalPath);

  // Fix file ownership
  try {
    const { execSync } = await import('child_process');
    execSync(`chown ${config.fileOwner}:${config.fileGroup} "${finalPath}"`);
    logger.info('Set ownership', { finalPath, owner: `${config.fileOwner}:${config.fileGroup}` });
  } catch (chownErr) {
    logger.error('Failed to set file ownership', { finalPath, error: chownErr.message });
  }

  // Clean up .json metadata file
  try {
    await fs.unlink(tusFilePath + '.json');
  } catch { /* ignore */ }

  logger.info(`File moved to final location`, { uploadId: tusId, sessionId, finalPath });

  // Notify Synology so Drive Client syncs this file immediately
  notifySynology(destDir, true);
  notifySynology(finalPath, false);

  // Find and update upload record
  const uploadRecord = uploadModel.getByTusId(tusId);
  if (uploadRecord) {
    uploadModel.markComplete(uploadRecord.id, finalPath);
  }

  // Update session stats
  const stats = sessionModel.updateStats(sessionId);

  // Check if all uploads are complete
  if (stats.uploaded_files + stats.failed_files >= stats.total_files && stats.total_files > 0) {
    sessionModel.markComplete(sessionId);
    logger.info(`Session completed`, { sessionId, stats });

    try {
      await sendCompletionEmail(sessionId);
    } catch (emailError) {
      logger.error('Failed to send completion email', { sessionId, error: emailError.message });
    }
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
