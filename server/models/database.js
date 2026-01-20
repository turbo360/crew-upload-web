import Database from 'better-sqlite3';
import path from 'path';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';

let db;

export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

export function initDatabase() {
  const dbPath = path.join(config.dataDir, 'uploads.db');

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  logger.info(`Database initialized at: ${dbPath}`);

  // Create tables
  db.exec(`
    -- Upload sessions
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      crew_name TEXT NOT NULL,
      project_name TEXT NOT NULL,
      folder_path TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      status TEXT DEFAULT 'active',
      total_files INTEGER DEFAULT 0,
      total_bytes INTEGER DEFAULT 0,
      uploaded_files INTEGER DEFAULT 0,
      uploaded_bytes INTEGER DEFAULT 0,
      failed_files INTEGER DEFAULT 0
    );

    -- Individual file uploads
    CREATE TABLE IF NOT EXISTS uploads (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      original_path TEXT,
      file_size INTEGER NOT NULL,
      mime_type TEXT,
      status TEXT DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      bytes_uploaded INTEGER DEFAULT 0,
      started_at DATETIME,
      completed_at DATETIME,
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      tus_upload_id TEXT,
      final_path TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    -- Audit log
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      session_id TEXT,
      event_type TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT
    );

    -- Create indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
    CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
    CREATE INDEX IF NOT EXISTS idx_uploads_session_id ON uploads(session_id);
    CREATE INDEX IF NOT EXISTS idx_uploads_status ON uploads(status);
    CREATE INDEX IF NOT EXISTS idx_uploads_tus_id ON uploads(tus_upload_id);
    CREATE INDEX IF NOT EXISTS idx_audit_session ON audit_log(session_id);
    CREATE INDEX IF NOT EXISTS idx_audit_type ON audit_log(event_type);
  `);

  logger.info('Database tables created/verified');

  return db;
}

// Session operations
export const sessionModel = {
  create(data) {
    const stmt = db.prepare(`
      INSERT INTO sessions (id, crew_name, project_name, folder_path)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(data.id, data.crewName, data.projectName, data.folderPath);
    return this.getById(data.id);
  },

  getById(id) {
    const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
    return stmt.get(id);
  },

  update(id, data) {
    const fields = [];
    const values = [];

    Object.entries(data).forEach(([key, value]) => {
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      fields.push(`${dbKey} = ?`);
      values.push(value);
    });

    values.push(id);
    const stmt = db.prepare(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return this.getById(id);
  },

  updateStats(sessionId) {
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_files,
        COALESCE(SUM(file_size), 0) as total_bytes,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as uploaded_files,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN file_size ELSE 0 END), 0) as uploaded_bytes,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_files
      FROM uploads WHERE session_id = ?
    `).get(sessionId);

    db.prepare(`
      UPDATE sessions SET
        total_files = ?,
        total_bytes = ?,
        uploaded_files = ?,
        uploaded_bytes = ?,
        failed_files = ?
      WHERE id = ?
    `).run(
      stats.total_files,
      stats.total_bytes,
      stats.uploaded_files,
      stats.uploaded_bytes,
      stats.failed_files,
      sessionId
    );

    return stats;
  },

  markComplete(id) {
    const stmt = db.prepare(`
      UPDATE sessions SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    stmt.run(id);
    return this.getById(id);
  },

  getActive() {
    const stmt = db.prepare('SELECT * FROM sessions WHERE status = ? ORDER BY created_at DESC');
    return stmt.all('active');
  },

  getAll(limit = 100, offset = 0) {
    const stmt = db.prepare('SELECT * FROM sessions ORDER BY created_at DESC LIMIT ? OFFSET ?');
    return stmt.all(limit, offset);
  },

  getAbandoned(hoursAgo = 24) {
    const stmt = db.prepare(`
      SELECT s.* FROM sessions s
      WHERE s.status = 'active'
      AND s.created_at < datetime('now', '-' || ? || ' hours')
      AND s.uploaded_files < s.total_files
    `);
    return stmt.all(hoursAgo);
  }
};

// Upload operations
export const uploadModel = {
  create(data) {
    const stmt = db.prepare(`
      INSERT INTO uploads (id, session_id, filename, original_path, file_size, mime_type, tus_upload_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      data.id,
      data.sessionId,
      data.filename,
      data.originalPath || null,
      data.fileSize,
      data.mimeType || null,
      data.tusUploadId || null
    );
    return this.getById(data.id);
  },

  getById(id) {
    const stmt = db.prepare('SELECT * FROM uploads WHERE id = ?');
    return stmt.get(id);
  },

  getByTusId(tusUploadId) {
    const stmt = db.prepare('SELECT * FROM uploads WHERE tus_upload_id = ?');
    return stmt.get(tusUploadId);
  },

  getBySessionId(sessionId) {
    const stmt = db.prepare('SELECT * FROM uploads WHERE session_id = ? ORDER BY filename');
    return stmt.all(sessionId);
  },

  update(id, data) {
    const fields = [];
    const values = [];

    Object.entries(data).forEach(([key, value]) => {
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      fields.push(`${dbKey} = ?`);
      values.push(value);
    });

    values.push(id);
    const stmt = db.prepare(`UPDATE uploads SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return this.getById(id);
  },

  markStarted(id) {
    const stmt = db.prepare(`
      UPDATE uploads SET status = 'uploading', started_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    stmt.run(id);
    return this.getById(id);
  },

  markComplete(id, finalPath) {
    const stmt = db.prepare(`
      UPDATE uploads SET
        status = 'completed',
        progress = 100,
        bytes_uploaded = file_size,
        completed_at = CURRENT_TIMESTAMP,
        final_path = ?
      WHERE id = ?
    `);
    stmt.run(finalPath, id);
    return this.getById(id);
  },

  markFailed(id, errorMessage) {
    const stmt = db.prepare(`
      UPDATE uploads SET
        status = 'failed',
        error_message = ?,
        retry_count = retry_count + 1
      WHERE id = ?
    `);
    stmt.run(errorMessage, id);
    return this.getById(id);
  },

  updateProgress(id, bytesUploaded, progress) {
    const stmt = db.prepare(`
      UPDATE uploads SET bytes_uploaded = ?, progress = ? WHERE id = ?
    `);
    stmt.run(bytesUploaded, progress, id);
  }
};

// Audit log operations
export const auditModel = {
  log(data) {
    const stmt = db.prepare(`
      INSERT INTO audit_log (session_id, event_type, details, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(
      data.sessionId || null,
      data.eventType,
      JSON.stringify(data.details || {}),
      data.ipAddress || null,
      data.userAgent || null
    );
  },

  getBySession(sessionId) {
    const stmt = db.prepare('SELECT * FROM audit_log WHERE session_id = ? ORDER BY timestamp DESC');
    return stmt.all(sessionId);
  },

  getRecent(limit = 100) {
    const stmt = db.prepare('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?');
    return stmt.all(limit);
  }
};
