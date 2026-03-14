import crypto from 'crypto';
import { config } from './config.js';
import { logger } from './logger.js';

/**
 * Send an SMS via SMSGlobal REST API with MAC authentication.
 * Gracefully skips if credentials are not configured.
 */
export async function sendSms(message) {
  if (!config.smsGlobalKey || !config.smsGlobalSecret) {
    logger.warn('SMSGlobal credentials not configured, skipping SMS');
    return;
  }

  const method = 'POST';
  const host = 'api.smsglobal.com';
  const port = '443';
  const uri = '/v2/sms';
  const url = `https://${host}${uri}`;

  const ts = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');

  // MAC hash: ts\nnonce\nMETHOD\nURI\nHOST\nPORT\n\n
  const macString = `${ts}\n${nonce}\n${method}\n${uri}\n${host}\n${port}\n\n`;
  const mac = crypto.createHmac('sha256', config.smsGlobalSecret)
    .update(macString)
    .digest('base64');

  const authHeader = `MAC id="${config.smsGlobalKey}", ts="${ts}", nonce="${nonce}", mac="${mac}"`;

  const body = {
    destination: config.smsNotificationNumber,
    message,
    origin: config.smsSenderName,
  };

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      logger.info('SMS sent successfully', { destination: config.smsNotificationNumber });
    } else {
      const errorText = await response.text();
      logger.error(`SMS send failed: ${response.status} ${errorText}`);
    }
  } catch (error) {
    logger.error('SMS send error:', error.message);
  }
}
