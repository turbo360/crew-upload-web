import { Router } from 'express';
import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';
import { buildEmailHtml, getFileTypePrefix } from '../utils/email.js';
import { sendSms } from '../utils/sms.js';

const router = Router();

// Handle batch/upload completion notifications from Electron app
router.post('/upload-complete', async (req, res) => {
  const { projectName, crewName, batchNumber, fileCount, totalSize, fileNames, fileSizes } = req.body;

  if (!projectName || !crewName) {
    return res.status(400).json({ error: 'projectName and crewName are required' });
  }

  try {
    const { ServerClient } = await import('postmark');

    if (!config.postmarkApiKey) {
      logger.warn('Postmark not configured, skipping notification email');
      return res.json({ success: true, skipped: true });
    }

    const client = new ServerClient(config.postmarkApiKey);
    const batchLabel = batchNumber ? `Batch ${batchNumber}` : 'Upload';
    const timestamp = new Date().toLocaleDateString('en-AU', {
      timeZone: 'Australia/Sydney',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    const dateTime = new Date().toLocaleString('en-AU', {
      timeZone: 'Australia/Sydney',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    const fileItems = (fileNames || []).map((name, i) => ({
      name,
      size: fileSizes?.[i] || undefined
    }));

    const { html, text } = buildEmailHtml({
      title: `${batchLabel} Complete`,
      subtitle: `${projectName} — ${crewName}`,
      status: 'success',
      statusText: `${fileCount} files uploaded (${totalSize})`,
      stats: [
        { value: String(fileCount), label: 'Files' },
        { value: totalSize?.split(' ')[0] || '0', label: totalSize?.split(' ')[1] || 'Bytes' }
      ],
      details: [
        { label: 'Project', value: projectName },
        { label: 'Crew', value: crewName },
        { label: 'Date', value: dateTime }
      ],
      files: fileItems.length > 0 ? { items: fileItems, maxShow: 10 } : undefined,
      timestamp,
      source: 'Desktop App'
    });

    const subject = `[Turbo 360] ${projectName} — ${crewName} uploaded ${fileCount} files (${totalSize})`;

    await client.sendEmail({
      From: 'hello@turbo360.com.au',
      To: config.notificationEmail,
      Subject: subject,
      HtmlBody: html,
      TextBody: text,
      MessageStream: 'outbound'
    });

    logger.info('Electron notification email sent', {
      projectName,
      crewName,
      batchNumber,
      fileCount,
      to: config.notificationEmail
    });

    // Send SMS notification for batch completion
    const batchMsg = batchNumber ? `Batch ${batchNumber}` : 'Upload';
    sendSms(`Crew Upload: ${crewName} completed ${batchMsg} — ${fileCount} files (${totalSize})`).catch(err => {
      logger.error('SMS send failed:', err.message);
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to send notification email', { error: error.message });
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

export default router;
