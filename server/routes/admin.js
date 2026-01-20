import { Router } from 'express';
import { sessionModel, uploadModel, auditModel } from '../models/database.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Get all sessions (with pagination)
router.get('/sessions', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;

  try {
    const sessions = sessionModel.getAll(limit, offset);

    res.json({
      sessions: sessions.map(s => ({
        id: s.id,
        crewName: s.crew_name,
        projectName: s.project_name,
        folderPath: s.folder_path,
        createdAt: s.created_at,
        completedAt: s.completed_at,
        status: s.status,
        totalFiles: s.total_files,
        totalBytes: s.total_bytes,
        uploadedFiles: s.uploaded_files,
        uploadedBytes: s.uploaded_bytes,
        failedFiles: s.failed_files
      })),
      pagination: {
        limit,
        offset,
        hasMore: sessions.length === limit
      }
    });
  } catch (error) {
    logger.error('Failed to get sessions', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve sessions' });
  }
});

// Get upload statistics
router.get('/stats', (req, res) => {
  try {
    const { getDatabase } = require('../models/database.js');
    const db = getDatabase();

    // Get overall stats
    const stats = db.prepare(`
      SELECT
        COUNT(DISTINCT s.id) as total_sessions,
        COALESCE(SUM(s.total_files), 0) as total_files,
        COALESCE(SUM(s.total_bytes), 0) as total_bytes,
        COALESCE(SUM(s.uploaded_bytes), 0) as uploaded_bytes,
        COUNT(CASE WHEN s.status = 'completed' THEN 1 END) as completed_sessions,
        COUNT(CASE WHEN s.status = 'active' THEN 1 END) as active_sessions,
        COUNT(CASE WHEN s.status = 'abandoned' THEN 1 END) as abandoned_sessions
      FROM sessions s
    `).get();

    // Get stats for today
    const todayStats = db.prepare(`
      SELECT
        COUNT(DISTINCT id) as sessions,
        COALESCE(SUM(uploaded_bytes), 0) as bytes
      FROM sessions
      WHERE date(created_at) = date('now')
    `).get();

    // Get stats for this week
    const weekStats = db.prepare(`
      SELECT
        COUNT(DISTINCT id) as sessions,
        COALESCE(SUM(uploaded_bytes), 0) as bytes
      FROM sessions
      WHERE created_at >= datetime('now', '-7 days')
    `).get();

    // Get recent activity (last 10 events)
    const recentActivity = auditModel.getRecent(10);

    res.json({
      overall: {
        totalSessions: stats.total_sessions,
        totalFiles: stats.total_files,
        totalBytes: stats.total_bytes,
        uploadedBytes: stats.uploaded_bytes,
        completedSessions: stats.completed_sessions,
        activeSessions: stats.active_sessions,
        abandonedSessions: stats.abandoned_sessions
      },
      today: {
        sessions: todayStats.sessions,
        bytes: todayStats.bytes
      },
      thisWeek: {
        sessions: weekStats.sessions,
        bytes: weekStats.bytes
      },
      recentActivity: recentActivity.map(a => ({
        timestamp: a.timestamp,
        eventType: a.event_type,
        sessionId: a.session_id,
        details: JSON.parse(a.details || '{}')
      }))
    });

  } catch (error) {
    logger.error('Failed to get stats', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve statistics' });
  }
});

// Get audit log for a session
router.get('/sessions/:id/audit', (req, res) => {
  const { id } = req.params;

  try {
    const logs = auditModel.getBySession(id);

    res.json({
      logs: logs.map(l => ({
        timestamp: l.timestamp,
        eventType: l.event_type,
        details: JSON.parse(l.details || '{}'),
        ipAddress: l.ip_address
      }))
    });
  } catch (error) {
    logger.error('Failed to get audit log', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve audit log' });
  }
});

export default router;
