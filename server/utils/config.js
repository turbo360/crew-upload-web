import crypto from 'crypto';

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
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
  fileOwner: process.env.FILE_OWNER || '1030',
  fileGroup: process.env.FILE_GROUP || '100',
  smsGlobalKey: process.env.SMSGLOBAL_API_KEY || '',
  smsGlobalSecret: process.env.SMSGLOBAL_API_SECRET || '',
  smsNotificationNumber: process.env.SMS_NOTIFICATION_NUMBER || '+61499944333',
  smsSenderName: process.env.SMS_SENDER_NAME || 'Turbo 360',
};
