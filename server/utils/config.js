import crypto from 'crypto';

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  uploadPassword: process.env.UPLOAD_PASSWORD || 'tcrew26',
  postmarkApiKey: process.env.POSTMARK_API_KEY || '',
  notificationEmail: process.env.NOTIFICATION_EMAIL || 'hello@turbo360.com.au',
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  dataDir: process.env.DATA_DIR || './data',
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  turboApiUrl: process.env.TURBO_API_URL || 'https://turbo.net.au',
  turboApiKey: process.env.TURBO_API_KEY || '',
  jwtSecret: process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex'),
  jwtExpiry: '24h',
  chunkSize: 50 * 1024 * 1024, // 50MB
  maxConcurrentUploads: 3,
  cleanupDays: 7,
  sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours in ms
};
