import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { sessionModel, uploadModel, auditModel } from '../models/database.js';
import { sanitizeFilename } from '../utils/cleanup.js';

// Function to send upload history to turbo.net.au
async function sendUploadHistoryWebhook(session, uploads) {
  if (!config.turboApiUrl || !config.turboApiKey) {
    logger.warn('Turbo API URL or key not configured, skipping webhook');
    return;
  }

  try {
    const payload = {
      api_key: config.turboApiKey,
      session_id: session.id,
      project_name: session.project_name,
      crew_name: session.crew_name,
      started_at: session.created_at,
      ended_at: new Date().toISOString(),
      end_reason: 'completed',
      total_files: session.total_files || 0,
      completed_files: session.uploaded_files || 0,
      error_files: session.failed_files || 0,
      total_bytes: session.total_bytes || 0,
      uploaded_bytes: session.uploaded_bytes || 0,
      files: uploads.map(u => ({
        name: u.filename,
        size: u.file_size,
        status: u.status,
        error: u.error_message || null
      })),
      source: 'web_portal'
    };

    const response = await fetch(`${config.turboApiUrl}/api/crew-upload/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      logger.info('Upload history sent to turbo.net.au successfully');
    } else {
      const errorText = await response.text();
      logger.error(`Failed to send webhook to turbo.net.au: ${response.status} ${errorText}`);
    }
  } catch (error) {
    logger.error('Error sending upload history webhook:', error.message);
  }
}

const router = Router();

// Create new upload session
router.post('/create', async (req, res) => {
  const { crewName, projectName } = req.body;

  if (!crewName || !projectName) {
    return res.status(400).json({
      error: 'Crew name and project name are required'
    });
  }

  try {
    const sessionId = uuidv4();

    // Sanitize names for folder creation
    const sanitizedProject = sanitizeFilename(projectName.trim());
    const sanitizedCrew = sanitizeFilename(crewName.trim());

    // Generate timestamp folder
    const timestamp = new Date().toISOString()
      .replace(/T/, '_')
      .replace(/:/g, '')
      .substring(0, 15); // YYYY-MM-DD_HHMM

    // Build folder path
    const folderPath = path.join(
      config.uploadDir,
      sanitizedProject,
      sanitizedCrew,
      timestamp
    );

    // Create the folder structure
    await fs.mkdir(folderPath, { recursive: true });

    // Fix directory ownership for NAS sync
    try {
      const { execSync } = await import('child_process');
      execSync(`chown -R ${config.fileOwner}:${config.fileGroup} "${folderPath}"`);
    } catch (chownErr) {
      logger.warn('Failed to set directory ownership', { folderPath, error: chownErr.message });
    }

    // Create session in database
    const session = sessionModel.create({
      id: sessionId,
      crewName: crewName.trim(),
      projectName: projectName.trim(),
      folderPath
    });

    logger.info('Session created', {
      sessionId,
      crewName,
      projectName,
      folderPath
    });

    auditModel.log({
      sessionId,
      eventType: 'session_start',
      details: { crewName, projectName, folderPath },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      session: {
        id: session.id,
        crewName: session.crew_name,
        projectName: session.project_name,
        folderPath: session.folder_path,
        createdAt: session.created_at
      }
    });

  } catch (error) {
    logger.error('Failed to create session', { error: error.message });
    res.status(500).json({ error: 'Failed to create upload session' });
  }
});

// Get session details
router.get('/:id', (req, res) => {
  const { id } = req.params;

  const session = sessionModel.getById(id);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json({
    session: {
      id: session.id,
      crewName: session.crew_name,
      projectName: session.project_name,
      folderPath: session.folder_path,
      createdAt: session.created_at,
      completedAt: session.completed_at,
      status: session.status,
      totalFiles: session.total_files,
      totalBytes: session.total_bytes,
      uploadedFiles: session.uploaded_files,
      uploadedBytes: session.uploaded_bytes,
      failedFiles: session.failed_files
    }
  });
});

// Update session (mark complete, etc.)
router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const session = sessionModel.getById(id);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (status === 'completed') {
    // Update stats to ensure we have accurate counts
    sessionModel.updateStats(id);
    sessionModel.markComplete(id);

    // Get fresh session data with updated stats
    const freshSession = sessionModel.getById(id);

    auditModel.log({
      sessionId: id,
      eventType: 'session_complete',
      details: {
        totalFiles: freshSession.total_files,
        uploadedFiles: freshSession.uploaded_files,
        failedFiles: freshSession.failed_files
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    // Send upload history to turbo.net.au for logging and email notification
    const uploads = uploadModel.getBySessionId(id);
    sendUploadHistoryWebhook(freshSession, uploads).catch(err => {
      logger.error('Webhook send failed:', err.message);
    });
  }

  const updatedSession = sessionModel.getById(id);

  res.json({
    success: true,
    session: {
      id: updatedSession.id,
      status: updatedSession.status,
      completedAt: updatedSession.completed_at
    }
  });
});

// Get all uploads for a session
router.get('/:id/uploads', (req, res) => {
  const { id } = req.params;

  const session = sessionModel.getById(id);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const uploads = uploadModel.getBySessionId(id);

  res.json({
    uploads: uploads.map(u => ({
      id: u.id,
      filename: u.filename,
      originalPath: u.original_path,
      fileSize: u.file_size,
      mimeType: u.mime_type,
      status: u.status,
      progress: u.progress,
      bytesUploaded: u.bytes_uploaded,
      startedAt: u.started_at,
      completedAt: u.completed_at,
      errorMessage: u.error_message,
      retryCount: u.retry_count
    }))
  });
});

// Register a new upload (before starting tus upload)
router.post('/:id/upload', (req, res) => {
  const { id } = req.params;
  const { filename, originalPath, fileSize, mimeType, tusUploadId } = req.body;

  if (!filename || fileSize === undefined) {
    return res.status(400).json({
      error: 'Filename and file size are required'
    });
  }

  const session = sessionModel.getById(id);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    const uploadId = uuidv4();

    const upload = uploadModel.create({
      id: uploadId,
      sessionId: id,
      filename,
      originalPath,
      fileSize,
      mimeType,
      tusUploadId
    });

    // Update session stats
    sessionModel.updateStats(id);

    auditModel.log({
      sessionId: id,
      eventType: 'upload_start',
      details: { uploadId, filename, fileSize },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      upload: {
        id: upload.id,
        filename: upload.filename,
        status: upload.status
      }
    });

  } catch (error) {
    logger.error('Failed to register upload', { error: error.message });
    res.status(500).json({ error: 'Failed to register upload' });
  }
});

// Update upload status
router.patch('/:sessionId/upload/:uploadId', (req, res) => {
  const { sessionId, uploadId } = req.params;
  const { tusUploadId, status, bytesUploaded, progress, errorMessage } = req.body;

  const upload = uploadModel.getById(uploadId);

  if (!upload || upload.session_id !== sessionId) {
    return res.status(404).json({ error: 'Upload not found' });
  }

  try {
    const updates = {};

    if (tusUploadId) updates.tusUploadId = tusUploadId;
    if (status) updates.status = status;
    if (bytesUploaded !== undefined) updates.bytesUploaded = bytesUploaded;
    if (progress !== undefined) updates.progress = progress;
    if (errorMessage) updates.errorMessage = errorMessage;

    if (status === 'uploading' && !upload.started_at) {
      uploadModel.markStarted(uploadId);
    } else if (status === 'failed') {
      uploadModel.markFailed(uploadId, errorMessage || 'Unknown error');

      auditModel.log({
        sessionId,
        eventType: 'upload_failed',
        details: { uploadId, filename: upload.filename, errorMessage },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
    } else if (Object.keys(updates).length > 0) {
      uploadModel.update(uploadId, updates);
    }

    // Update session stats
    sessionModel.updateStats(sessionId);

    res.json({ success: true });

  } catch (error) {
    logger.error('Failed to update upload', { error: error.message });
    res.status(500).json({ error: 'Failed to update upload' });
  }
});

export default router;
