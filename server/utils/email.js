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

const VIDEO_EXTS = ['mov', 'mp4', 'avi', 'mkv', 'wmv', 'flv', 'webm', 'mxf', 'r3d', 'braw', 'arf', 'prores', 'm4v', 'mts', 'm2ts', 'mpg', 'mpeg'];
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif', 'webp', 'heic', 'heif', 'raw', 'cr2', 'cr3', 'nef', 'arw', 'dng', 'orf', 'rw2', 'psd', 'ai', 'svg'];
const AUDIO_EXTS = ['mp3', 'wav', 'aac', 'flac', 'ogg', 'wma', 'aiff', 'aif', 'm4a', 'opus'];

export function getFileTypePrefix(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase();
  if (VIDEO_EXTS.includes(ext)) return 'VID';
  if (IMAGE_EXTS.includes(ext)) return 'IMG';
  if (AUDIO_EXTS.includes(ext)) return 'AUD';
  return 'FILE';
}

/**
 * Shared email HTML builder for all upload notification templates.
 *
 * @param {object} cfg
 * @param {string} cfg.title - e.g. "Batch 3 Complete"
 * @param {string} cfg.subtitle - e.g. "Wedding Shoot — John Smith"
 * @param {'success'|'partial'} cfg.status
 * @param {string} cfg.statusText - e.g. "12 files uploaded successfully"
 * @param {Array<{value:string, label:string}>} cfg.stats
 * @param {Array<{label:string, value:string}>} cfg.details
 * @param {{items:Array<{name:string, size?:string}>, maxShow?:number}} [cfg.files]
 * @param {Array<{name:string, error:string}>} [cfg.failedFiles]
 * @param {string} [cfg.folderPath]
 * @param {string} cfg.timestamp
 * @param {string} [cfg.source]
 * @returns {{html:string, text:string}}
 */
export function buildEmailHtml(cfg) {
  const {
    title,
    subtitle,
    status = 'success',
    statusText,
    stats = [],
    details = [],
    files,
    failedFiles = [],
    folderPath,
    timestamp,
    source
  } = cfg;

  const maxShow = files?.maxShow ?? 10;
  const fileItems = files?.items ?? [];
  const shownFiles = fileItems.slice(0, maxShow);
  const remainingCount = fileItems.length - shownFiles.length;

  const isSuccess = status === 'success';
  const pillBg = isSuccess ? '#f0fdf4' : '#fef2f2';
  const pillColor = isSuccess ? '#16a34a' : '#dc2626';
  const pillIcon = isSuccess ? '&#10003;' : '!';

  // Badge colors for file type prefixes
  const badgeStyle = 'display:inline-block;padding:2px 6px;border-radius:3px;font-size:10px;font-weight:700;letter-spacing:0.5px;background-color:#fff7ed;color:#f97316;margin-right:6px;vertical-align:middle;';

  // --- Stats row ---
  let statsHtml = '';
  if (stats.length > 0) {
    const statCells = stats.map((s, i) => {
      const spacer = i < stats.length - 1 ? '<td width="12"></td>' : '';
      return `<td style="background-color:#fff7ed;border-radius:8px;padding:14px 0;text-align:center;" width="${Math.floor(100 / stats.length)}%">
        <span style="color:#f97316;font-size:26px;font-weight:700;line-height:1;">${s.value}</span><br>
        <span style="color:#a1a1aa;font-size:11px;text-transform:uppercase;letter-spacing:1px;">${s.label}</span>
      </td>${spacer}`;
    }).join('\n');
    statsHtml = `<tr><td style="padding:0 40px 24px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr>${statCells}</tr></table>
    </td></tr>`;
  }

  // --- Details rows ---
  let detailsHtml = '';
  if (details.length > 0) {
    const rows = details.map((d, i) => {
      const border = i < details.length - 1 ? 'border-bottom:1px solid #e4e4e7;' : '';
      return `<tr>
        <td style="padding:10px 0;${border}color:#a1a1aa;font-size:13px;width:110px;vertical-align:top;">${d.label}</td>
        <td style="padding:10px 0;${border}color:#18181b;font-size:14px;font-weight:500;">${d.value}</td>
      </tr>`;
    }).join('\n');
    detailsHtml = `<tr><td style="padding:0 40px 24px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">${rows}</table>
    </td></tr>`;
  }

  // --- File list ---
  let filesHtml = '';
  if (shownFiles.length > 0) {
    const fileRows = shownFiles.map((f, i) => {
      const border = (i < shownFiles.length - 1 || remainingCount > 0) ? 'border-bottom:1px solid #e4e4e7;' : '';
      const prefix = getFileTypePrefix(f.name);
      const sizeSpan = f.size ? `<span style="color:#a1a1aa;font-size:12px;white-space:nowrap;">${f.size}</span>` : '';
      return `<tr>
        <td style="padding:9px 14px;${border}">
          <span style="${badgeStyle}">${prefix}</span>
          <span style="color:#18181b;font-size:13px;vertical-align:middle;">${f.name}</span>
        </td>
        <td style="padding:9px 14px;${border}text-align:right;">${sizeSpan}</td>
      </tr>`;
    }).join('\n');

    const moreRow = remainingCount > 0 ? `<tr>
      <td colspan="2" style="padding:9px 14px;color:#a1a1aa;font-size:13px;font-weight:500;">+${remainingCount} more files</td>
    </tr>` : '';

    filesHtml = `<tr><td style="padding:0 40px 24px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border:1px solid #e4e4e7;border-radius:8px;border-collapse:separate;">
        ${fileRows}
        ${moreRow}
      </table>
    </td></tr>`;
  }

  // --- Failed files ---
  let failedHtml = '';
  if (failedFiles.length > 0) {
    const failedRows = failedFiles.map((f, i) => {
      const border = i < failedFiles.length - 1 ? 'border-bottom:1px solid #fecaca;' : '';
      return `<tr>
        <td style="padding:9px 14px;${border}">
          <span style="color:#dc2626;font-size:13px;font-weight:500;">${f.name}</span><br>
          <span style="color:#a1a1aa;font-size:12px;">${f.error || 'Unknown error'}</span>
        </td>
      </tr>`;
    }).join('\n');

    failedHtml = `<tr><td style="padding:0 40px 24px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr><td style="padding-bottom:10px;color:#dc2626;font-size:13px;font-weight:600;">Failed Uploads</td></tr>
      </table>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:8px;border-collapse:separate;">
        ${failedRows}
      </table>
    </td></tr>`;
  }

  // --- Folder path ---
  let folderHtml = '';
  if (folderPath) {
    folderHtml = `<tr><td style="padding:0 40px 24px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
          <td style="background-color:#f4f4f5;border-radius:6px;padding:10px 14px;font-family:'SFMono-Regular','Menlo','Monaco',monospace;font-size:12px;color:#a1a1aa;word-break:break-all;">
            NAS: ${folderPath}
          </td>
        </tr>
      </table>
    </td></tr>`;
  }

  // --- Footer ---
  const footerParts = ['Turbo 360 Crew Upload'];
  if (source) footerParts.push(source);
  const footerLeft = footerParts.join(' &middot; ');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f4f4f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f4f4f5;">
    <tr>
      <td style="padding:40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin:0 auto;background-color:#ffffff;border-radius:8px;overflow:hidden;border-top:4px solid #f97316;">

          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 0;">
              <span style="color:#f97316;font-size:14px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;">TURBO 360</span>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 40px 4px;">
              <h1 style="margin:0;font-size:20px;font-weight:600;color:#18181b;line-height:1.3;">${title}</h1>
            </td>
          </tr>
          ${subtitle ? `<tr>
            <td style="padding:0 40px 20px;">
              <span style="color:#a1a1aa;font-size:14px;">${subtitle}</span>
            </td>
          </tr>` : '<tr><td style="padding:0 0 16px;"></td></tr>'}

          <!-- Divider -->
          <tr><td style="padding:0 40px;"><div style="border-top:1px solid #e4e4e7;"></div></td></tr>

          <!-- Status pill -->
          <tr>
            <td style="padding:20px 40px 24px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="background-color:${pillBg};border-radius:20px;padding:8px 16px;">
                    <span style="color:${pillColor};font-size:13px;font-weight:600;">${pillIcon} ${statusText}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Stats -->
          ${statsHtml}

          <!-- Details -->
          ${detailsHtml}

          <!-- Files -->
          ${filesHtml}

          <!-- Failed -->
          ${failedHtml}

          <!-- Folder -->
          ${folderHtml}

          <!-- Footer -->
          <tr>
            <td style="padding:0 40px;"><div style="border-top:1px solid #e4e4e7;"></div></td>
          </tr>
          <tr>
            <td style="padding:20px 40px 28px;">
              <span style="color:#a1a1aa;font-size:12px;">${footerLeft} &middot; ${timestamp}</span>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // --- Plain text version ---
  const textLines = [title];
  if (subtitle) textLines.push(subtitle);
  textLines.push('');
  if (statusText) textLines.push(statusText);
  textLines.push('');
  if (stats.length > 0) {
    stats.forEach(s => textLines.push(`${s.label}: ${s.value}`));
    textLines.push('');
  }
  if (details.length > 0) {
    details.forEach(d => textLines.push(`${d.label}: ${d.value}`));
    textLines.push('');
  }
  if (fileItems.length > 0) {
    textLines.push('Files:');
    shownFiles.forEach(f => {
      const prefix = getFileTypePrefix(f.name);
      textLines.push(`  [${prefix}] ${f.name}${f.size ? ` (${f.size})` : ''}`);
    });
    if (remainingCount > 0) textLines.push(`  +${remainingCount} more files`);
    textLines.push('');
  }
  if (failedFiles.length > 0) {
    textLines.push('Failed Uploads:');
    failedFiles.forEach(f => textLines.push(`  ${f.name}: ${f.error || 'Unknown error'}`));
    textLines.push('');
  }
  if (folderPath) textLines.push(`NAS: ${folderPath}`, '');
  textLines.push('---', `${footerParts.join(' · ')} · ${timestamp}`);

  return { html, text: textLines.join('\n') };
}

function formatDateAU(dateStr) {
  return new Date(dateStr).toLocaleString('en-AU', {
    timeZone: 'Australia/Sydney',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function todayStamp() {
  return new Date().toLocaleDateString('en-AU', {
    timeZone: 'Australia/Sydney',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
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

  const dateTime = formatDateAU(session.created_at);
  const duration = session.completed_at
    ? formatDuration(session.created_at, session.completed_at)
    : 'N/A';

  const hasFailures = failedUploads.length > 0;
  const statusWord = hasFailures ? 'partial' : 'success';
  const statusMsg = hasFailures
    ? `${completedUploads.length} files uploaded, ${failedUploads.length} failed`
    : `${completedUploads.length} files uploaded successfully`;

  const { html, text } = buildEmailHtml({
    title: 'Upload Complete',
    subtitle: `${session.project_name} — ${session.crew_name}`,
    status: statusWord,
    statusText: statusMsg,
    stats: [
      { value: String(completedUploads.length), label: 'Files' },
      { value: formatBytes(session.uploaded_bytes).split(' ')[0], label: formatBytes(session.uploaded_bytes).split(' ')[1] || 'Bytes' },
      { value: duration, label: 'Duration' }
    ],
    details: [
      { label: 'Project', value: session.project_name },
      { label: 'Crew', value: session.crew_name },
      { label: 'Date', value: dateTime }
    ],
    files: {
      items: completedUploads.map(u => ({ name: u.filename, size: formatBytes(u.file_size) })),
      maxShow: 10
    },
    failedFiles: failedUploads.map(u => ({ name: u.filename, error: u.error_message || 'Unknown error' })),
    folderPath: session.folder_path,
    timestamp: todayStamp(),
    source: 'Server'
  });

  const totalSize = formatBytes(session.uploaded_bytes);
  const subject = `[Turbo 360] Upload complete: ${session.project_name} — ${session.crew_name} (${completedUploads.length} files, ${totalSize})`;

  try {
    await client.sendEmail({
      From: 'hello@turbo360.com.au',
      To: config.notificationEmail,
      Subject: subject,
      HtmlBody: html,
      TextBody: text,
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

  const dateTime = formatDateAU(completedAt);
  const duration = formatDuration(startedAt, completedAt);

  const hasFailures = failedFiles > 0;
  const statusWord = hasFailures ? 'partial' : 'success';
  const statusMsg = hasFailures
    ? `${completedFiles} files uploaded, ${failedFiles} failed`
    : `${completedFiles} files uploaded successfully`;

  const { html, text } = buildEmailHtml({
    title: `Batch ${batchNumber} Complete`,
    subtitle: `${session.project_name} — ${session.crew_name}`,
    status: statusWord,
    statusText: statusMsg,
    stats: [
      { value: String(completedFiles), label: 'Files' },
      { value: formatBytes(totalBytes).split(' ')[0], label: formatBytes(totalBytes).split(' ')[1] || 'Bytes' },
      { value: duration, label: 'Duration' }
    ],
    details: [
      { label: 'Project', value: session.project_name },
      { label: 'Crew', value: session.crew_name },
      { label: 'Date', value: dateTime }
    ],
    files: fileNames ? {
      items: fileNames.map(n => ({ name: n })),
      maxShow: 10
    } : undefined,
    folderPath: session.folder_path,
    timestamp: todayStamp(),
    source: 'Server'
  });

  const subject = `[Turbo 360] Batch ${batchNumber}: ${session.project_name} — ${session.crew_name} (${completedFiles} files, ${formatBytes(totalBytes)})`;

  try {
    await client.sendEmail({
      From: 'hello@turbo360.com.au',
      To: config.notificationEmail,
      Subject: subject,
      HtmlBody: html,
      TextBody: text,
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
