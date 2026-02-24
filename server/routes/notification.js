import { Router } from 'express';
import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';

const router = Router();

// Handle batch/upload completion notifications from Electron app
router.post('/upload-complete', async (req, res) => {
  const { projectName, crewName, batchNumber, fileCount, totalSize, fileNames } = req.body;

  if (!projectName || !crewName) {
    return res.status(400).json({ error: 'projectName and crewName are required' });
  }

  try {
    // Send email via Postmark
    const { ServerClient } = await import('postmark');

    if (!config.postmarkApiKey) {
      logger.warn('Postmark not configured, skipping notification email');
      return res.json({ success: true, skipped: true });
    }

    const client = new ServerClient(config.postmarkApiKey);
    const logoUrl = `${config.baseUrl}/logo-light.png`;
    const batchLabel = batchNumber ? `Batch ${batchNumber}` : 'Upload';

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #1a1a2e; color: #ffffff;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #1a1a2e;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #16213e; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
          <tr>
            <td style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px 40px; text-align: center;">
              <img src="${logoUrl}" alt="Turbo 360" height="50" style="display: block; margin: 0 auto 15px;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #ffffff;">${batchLabel} Complete</h1>
              <p style="margin: 8px 0 0; font-size: 14px; color: rgba(255,255,255,0.8);">${projectName} &mdash; ${crewName}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="background-color: #065f46; border-radius: 8px; padding: 15px 20px; text-align: center;">
                    <span style="color: #34d399; font-size: 14px; font-weight: 600;">&#10003; ${fileCount} files uploaded (${totalSize})</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${fileNames && fileNames.length > 0 ? `
          <tr>
            <td style="padding: 25px 40px;">
              <h3 style="color: #ffffff; font-size: 14px; font-weight: 600; margin: 0 0 15px; text-transform: uppercase; letter-spacing: 1px;">Files</h3>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #1e3a5f; border-radius: 8px;">
                ${fileNames.slice(0, 50).map((name, i) => `
                <tr>
                  <td style="padding: 10px 15px; ${i < Math.min(fileNames.length, 50) - 1 ? 'border-bottom: 1px solid #2d4a6f;' : ''}">
                    <span style="color: #ffffff; font-size: 13px;">${name}</span>
                  </td>
                </tr>
                `).join('')}
                ${fileNames.length > 50 ? `
                <tr>
                  <td style="padding: 10px 15px; color: #94a3b8; font-size: 12px; font-style: italic;">
                    ...and ${fileNames.length - 50} more files
                  </td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>
          ` : ''}
          <tr>
            <td style="background-color: #0f172a; padding: 25px 40px; text-align: center;">
              <p style="margin: 0 0 5px; color: #64748b; font-size: 12px;">Turbo 360 Crew Upload (Desktop App)</p>
              <p style="margin: 0; color: #475569; font-size: 11px;">Source: Electron App</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const textBody = `
${batchLabel} Complete

Project: ${projectName}
Crew: ${crewName}
Files: ${fileCount} (${totalSize})

${fileNames && fileNames.length > 0 ? `File list:\n${fileNames.map(n => `- ${n}`).join('\n')}` : ''}

---
Turbo 360 Crew Upload (Desktop App)
    `;

    await client.sendEmail({
      From: 'hello@turbo360.com.au',
      To: config.notificationEmail,
      Subject: `${batchLabel} Complete: ${projectName} - ${crewName} (${fileCount} files, ${totalSize})`,
      HtmlBody: htmlBody,
      TextBody: textBody,
      MessageStream: 'outbound'
    });

    logger.info('Electron notification email sent', {
      projectName,
      crewName,
      batchNumber,
      fileCount,
      to: config.notificationEmail
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to send notification email', { error: error.message });
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

export default router;
