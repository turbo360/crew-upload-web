import { ServerClient } from 'postmark';
import { config } from './config.js';
import { logger } from './logger.js';
import { sessionModel, uploadModel } from '../models/database.js';

let postmarkClient = null;

function getClient() {
  if (!postmarkClient && config.postmarkApiKey) {
    postmarkClient = new ServerClient(config.postmarkApiKey);
  }
  return postmarkClient;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDuration(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end - start;

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(' ');
}

export async function sendCompletionEmail(sessionId) {
  const client = getClient();
  if (!client) {
    logger.warn('Postmark client not configured, skipping email');
    return;
  }

  const session = sessionModel.getById(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const uploads = uploadModel.getBySessionId(sessionId);
  const completedUploads = uploads.filter(u => u.status === 'completed');
  const failedUploads = uploads.filter(u => u.status === 'failed');

  const dateTime = new Date(session.created_at).toLocaleString('en-AU', {
    timeZone: 'Australia/Sydney',
    dateStyle: 'full',
    timeStyle: 'short'
  });

  const duration = session.completed_at
    ? formatDuration(session.created_at, session.completed_at)
    : 'N/A';

  // Build file list HTML
  const fileListHtml = completedUploads.map(u =>
    `<li>${u.filename} (${formatBytes(u.file_size)})</li>`
  ).join('\n');

  // Build failed files section if any
  const failedSection = failedUploads.length > 0 ? `
    <h3 style="color: #F44336; margin-top: 20px;">Failed Uploads</h3>
    <ul>
      ${failedUploads.map(u =>
        `<li>${u.filename} - ${u.error_message || 'Unknown error'}</li>`
      ).join('\n')}
    </ul>
  ` : '';

  const logoUrl = `${config.baseUrl}/logo-light.png`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Crew Upload Complete</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #1a1a2e; color: #ffffff;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #1a1a2e;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #16213e; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">

          <!-- Header with Logo -->
          <tr>
            <td style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px 40px; text-align: center;">
              <img src="${logoUrl}" alt="Turbo 360" height="50" style="display: block; margin: 0 auto 15px;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #ffffff; letter-spacing: -0.5px;">Crew Upload Complete</h1>
            </td>
          </tr>

          <!-- Success Badge -->
          <tr>
            <td style="padding: 30px 40px 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="background-color: #065f46; border-radius: 8px; padding: 15px 20px; text-align: center;">
                    <span style="color: #34d399; font-size: 14px; font-weight: 600;">&#10003; Upload Session Completed Successfully</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Summary Card -->
          <tr>
            <td style="padding: 25px 40px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #1e3a5f; border-radius: 10px; overflow: hidden;">
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #2d4a6f;">
                          <span style="color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Project</span><br>
                          <span style="color: #ffffff; font-size: 18px; font-weight: 600;">${session.project_name}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #2d4a6f;">
                          <span style="color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Crew Member</span><br>
                          <span style="color: #ffffff; font-size: 18px; font-weight: 600;">${session.crew_name}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0;">
                          <span style="color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Date & Time</span><br>
                          <span style="color: #ffffff; font-size: 16px;">${dateTime}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Stats Grid -->
          <tr>
            <td style="padding: 0 40px 25px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td width="32%" style="background-color: #1e3a5f; border-radius: 8px; padding: 15px; text-align: center;">
                    <span style="color: #f97316; font-size: 28px; font-weight: 700;">${completedUploads.length}</span><br>
                    <span style="color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Files</span>
                  </td>
                  <td width="2%"></td>
                  <td width="32%" style="background-color: #1e3a5f; border-radius: 8px; padding: 15px; text-align: center;">
                    <span style="color: #f97316; font-size: 28px; font-weight: 700;">${formatBytes(session.uploaded_bytes).split(' ')[0]}</span><br>
                    <span style="color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">${formatBytes(session.uploaded_bytes).split(' ')[1] || 'Bytes'}</span>
                  </td>
                  <td width="2%"></td>
                  <td width="32%" style="background-color: #1e3a5f; border-radius: 8px; padding: 15px; text-align: center;">
                    <span style="color: #f97316; font-size: 28px; font-weight: 700;">${duration.replace(/[hms]/g, '')}</span><br>
                    <span style="color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Duration</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- File List -->
          <tr>
            <td style="padding: 0 40px 25px;">
              <h3 style="color: #ffffff; font-size: 14px; font-weight: 600; margin: 0 0 15px; text-transform: uppercase; letter-spacing: 1px;">Uploaded Files</h3>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #1e3a5f; border-radius: 8px;">
                ${completedUploads.map((u, i) => `
                <tr>
                  <td style="padding: 12px 15px; ${i < completedUploads.length - 1 ? 'border-bottom: 1px solid #2d4a6f;' : ''}">
                    <span style="color: #ffffff; font-size: 14px;">${u.filename}</span>
                    <span style="color: #94a3b8; font-size: 12px; float: right;">${formatBytes(u.file_size)}</span>
                  </td>
                </tr>
                `).join('')}
              </table>
            </td>
          </tr>

          ${failedUploads.length > 0 ? `
          <!-- Failed Files -->
          <tr>
            <td style="padding: 0 40px 25px;">
              <h3 style="color: #ef4444; font-size: 14px; font-weight: 600; margin: 0 0 15px; text-transform: uppercase; letter-spacing: 1px;">Failed Uploads</h3>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #451a1a; border-radius: 8px; border: 1px solid #7f1d1d;">
                ${failedUploads.map((u, i) => `
                <tr>
                  <td style="padding: 12px 15px; ${i < failedUploads.length - 1 ? 'border-bottom: 1px solid #7f1d1d;' : ''}">
                    <span style="color: #fca5a5; font-size: 14px;">${u.filename}</span><br>
                    <span style="color: #f87171; font-size: 12px;">${u.error_message || 'Unknown error'}</span>
                  </td>
                </tr>
                `).join('')}
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- File Location -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <h3 style="color: #ffffff; font-size: 14px; font-weight: 600; margin: 0 0 15px; text-transform: uppercase; letter-spacing: 1px;">File Location</h3>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="background-color: #0f172a; border-radius: 6px; padding: 12px 15px; font-family: 'Monaco', 'Menlo', monospace; font-size: 12px; color: #22d3ee; word-break: break-all;">
                    ${session.folder_path}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0f172a; padding: 25px 40px; text-align: center;">
              <p style="margin: 0 0 5px; color: #64748b; font-size: 12px;">Turbo 360 Crew Upload Portal</p>
              <p style="margin: 0; color: #475569; font-size: 11px;">${config.baseUrl}</p>
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
Crew Upload Complete

Project: ${session.project_name}
Crew: ${session.crew_name}
Date: ${dateTime}

Summary:
- Files Uploaded: ${completedUploads.length}
- Total Size: ${formatBytes(session.uploaded_bytes)}
- Duration: ${duration}

Files:
${completedUploads.map(u => `- ${u.filename} (${formatBytes(u.file_size)})`).join('\n')}

${failedUploads.length > 0 ? `
Failed Uploads:
${failedUploads.map(u => `- ${u.filename}: ${u.error_message || 'Unknown error'}`).join('\n')}
` : ''}

Files saved to: ${session.folder_path}

---
Turbo 360 Crew Upload Portal
${config.baseUrl}
  `;

  try {
    await client.sendEmail({
      From: 'hello@turbo360.com.au',
      To: config.notificationEmail,
      Subject: `Crew Upload Complete: ${session.project_name} - ${session.crew_name}`,
      HtmlBody: htmlBody,
      TextBody: textBody,
      MessageStream: 'outbound'
    });

    logger.info('Completion email sent', {
      sessionId,
      to: config.notificationEmail,
      project: session.project_name,
      crew: session.crew_name
    });
  } catch (error) {
    logger.error('Failed to send email', {
      sessionId,
      error: error.message
    });
    throw error;
  }
}

export async function sendBatchCompletionEmail(sessionId, batchInfo) {
  const client = getClient();
  if (!client) {
    logger.warn('Postmark client not configured, skipping batch email');
    return;
  }

  const session = sessionModel.getById(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const { batchNumber, fileCount, completedFiles, failedFiles, totalBytes, startedAt, completedAt, fileNames } = batchInfo;

  const dateTime = new Date(completedAt).toLocaleString('en-AU', {
    timeZone: 'Australia/Sydney',
    dateStyle: 'full',
    timeStyle: 'short'
  });

  const duration = formatDuration(startedAt, completedAt);
  const logoUrl = `${config.baseUrl}/logo-light.png`;

  const statusColor = failedFiles > 0 ? '#F59E0B' : '#10B981';
  const statusText = failedFiles > 0
    ? `Batch ${batchNumber} Complete (${failedFiles} failed)`
    : `Batch ${batchNumber} Complete`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Batch Upload Complete</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #1a1a2e; color: #ffffff;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #1a1a2e;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #16213e; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
          <tr>
            <td style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px 40px; text-align: center;">
              <img src="${logoUrl}" alt="Turbo 360" height="50" style="display: block; margin: 0 auto 15px;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #ffffff;">Batch ${batchNumber} Upload Complete</h1>
              <p style="margin: 8px 0 0; font-size: 14px; color: rgba(255,255,255,0.8);">${session.project_name} &mdash; ${session.crew_name}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="background-color: ${failedFiles > 0 ? '#78350f' : '#065f46'}; border-radius: 8px; padding: 15px 20px; text-align: center;">
                    <span style="color: ${failedFiles > 0 ? '#fbbf24' : '#34d399'}; font-size: 14px; font-weight: 600;">&#10003; ${statusText}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 25px 40px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td width="32%" style="background-color: #1e3a5f; border-radius: 8px; padding: 15px; text-align: center;">
                    <span style="color: #f97316; font-size: 28px; font-weight: 700;">${completedFiles}</span><br>
                    <span style="color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Files</span>
                  </td>
                  <td width="2%"></td>
                  <td width="32%" style="background-color: #1e3a5f; border-radius: 8px; padding: 15px; text-align: center;">
                    <span style="color: #f97316; font-size: 28px; font-weight: 700;">${formatBytes(totalBytes).split(' ')[0]}</span><br>
                    <span style="color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">${formatBytes(totalBytes).split(' ')[1] || 'Bytes'}</span>
                  </td>
                  <td width="2%"></td>
                  <td width="32%" style="background-color: #1e3a5f; border-radius: 8px; padding: 15px; text-align: center;">
                    <span style="color: #f97316; font-size: 28px; font-weight: 700;">${duration}</span><br>
                    <span style="color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Duration</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${fileNames && fileNames.length > 0 ? `
          <tr>
            <td style="padding: 0 40px 25px;">
              <h3 style="color: #ffffff; font-size: 14px; font-weight: 600; margin: 0 0 15px; text-transform: uppercase; letter-spacing: 1px;">Files in Batch ${batchNumber}</h3>
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
            <td style="padding: 0 40px 30px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="background-color: #0f172a; border-radius: 6px; padding: 12px 15px; font-family: 'Monaco', 'Menlo', monospace; font-size: 12px; color: #22d3ee; word-break: break-all;">
                    ${session.folder_path}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #0f172a; padding: 25px 40px; text-align: center;">
              <p style="margin: 0 0 5px; color: #64748b; font-size: 12px;">Turbo 360 Crew Upload Portal</p>
              <p style="margin: 0; color: #475569; font-size: 11px;">${config.baseUrl}</p>
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
Batch ${batchNumber} Upload Complete

Project: ${session.project_name}
Crew: ${session.crew_name}
Date: ${dateTime}

Batch Summary:
- Files Uploaded: ${completedFiles}
- Failed: ${failedFiles}
- Total Size: ${formatBytes(totalBytes)}
- Duration: ${duration}

${fileNames && fileNames.length > 0 ? `Files:\n${fileNames.map(n => `- ${n}`).join('\n')}` : ''}

Files saved to: ${session.folder_path}

---
Turbo 360 Crew Upload Portal
${config.baseUrl}
  `;

  try {
    await client.sendEmail({
      From: 'hello@turbo360.com.au',
      To: config.notificationEmail,
      Subject: `Batch ${batchNumber} Complete: ${session.project_name} - ${session.crew_name} (${completedFiles} files, ${formatBytes(totalBytes)})`,
      HtmlBody: htmlBody,
      TextBody: textBody,
      MessageStream: 'outbound'
    });

    logger.info('Batch completion email sent', {
      sessionId,
      batchNumber,
      to: config.notificationEmail,
      project: session.project_name,
      crew: session.crew_name,
      files: completedFiles
    });
  } catch (error) {
    logger.error('Failed to send batch email', {
      sessionId,
      batchNumber,
      error: error.message
    });
    throw error;
  }
}

export async function sendFailureNotification(sessionId, uploadId, errorMessage) {
  const client = getClient();
  if (!client) return;

  const session = sessionModel.getById(sessionId);
  const upload = uploadModel.getById(uploadId);

  if (!session || !upload) return;

  try {
    await client.sendEmail({
      From: 'hello@turbo360.com.au',
      To: config.notificationEmail,
      Subject: `Upload Failed: ${session.project_name} - ${upload.filename}`,
      TextBody: `
Upload Failure Alert

Project: ${session.project_name}
Crew: ${session.crew_name}
File: ${upload.filename}
Size: ${formatBytes(upload.file_size)}
Error: ${errorMessage}

The crew member may retry this upload automatically.

---
Turbo 360 Crew Upload Portal
      `,
      MessageStream: 'outbound'
    });
  } catch (error) {
    logger.error('Failed to send failure notification', { error: error.message });
  }
}

export async function sendAbandonedNotification(session) {
  const client = getClient();
  if (!client) return;

  const uploads = uploadModel.getBySessionId(session.id);
  const completedCount = uploads.filter(u => u.status === 'completed').length;
  const pendingCount = uploads.filter(u => u.status !== 'completed').length;

  try {
    await client.sendEmail({
      From: 'hello@turbo360.com.au',
      To: config.notificationEmail,
      Subject: `Abandoned Upload Session: ${session.project_name} - ${session.crew_name}`,
      TextBody: `
Abandoned Upload Session Alert

Project: ${session.project_name}
Crew: ${session.crew_name}
Started: ${new Date(session.created_at).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}

Status:
- Completed: ${completedCount} files
- Pending/Failed: ${pendingCount} files

This session has been inactive for 24+ hours with incomplete uploads.

Files location: ${session.folder_path}

---
Turbo 360 Crew Upload Portal
      `,
      MessageStream: 'outbound'
    });
  } catch (error) {
    logger.error('Failed to send abandoned notification', { error: error.message });
  }
}
