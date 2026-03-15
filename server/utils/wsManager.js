import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { logger } from './logger.js';

const clients = new Map(); // sessionId -> Set<WebSocket>

let wss;

export function initWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/ws/client' });

  wss.on('connection', (ws) => {
    let authenticated = false;
    let wsSessionId = null;

    // Require auth within 5 seconds
    const authTimeout = setTimeout(() => {
      if (!authenticated) {
        ws.close(4001, 'Authentication timeout');
      }
    }, 5000);

    ws.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data);
      } catch {
        return;
      }

      if (!authenticated) {
        if (msg.type === 'auth' && msg.token && msg.sessionId) {
          try {
            jwt.verify(msg.token, config.jwtSecret);
            authenticated = true;
            wsSessionId = msg.sessionId;
            clearTimeout(authTimeout);

            if (!clients.has(wsSessionId)) {
              clients.set(wsSessionId, new Set());
            }
            clients.get(wsSessionId).add(ws);

            ws.send(JSON.stringify({ type: 'auth_ok' }));
            logger.info(`WebSocket client authenticated for session ${wsSessionId}`);
          } catch (err) {
            ws.close(4003, 'Invalid token');
          }
        }
        return;
      }
    });

    ws.on('close', () => {
      clearTimeout(authTimeout);
      if (wsSessionId && clients.has(wsSessionId)) {
        clients.get(wsSessionId).delete(ws);
        if (clients.get(wsSessionId).size === 0) {
          clients.delete(wsSessionId);
        }
        logger.info(`WebSocket client disconnected from session ${wsSessionId}`);
      }
    });

    ws.on('error', (err) => {
      logger.error('WebSocket client error:', err.message);
    });

    // Keepalive ping
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
  });

  // Ping all clients every 30s
  const pingInterval = setInterval(() => {
    if (!wss) { clearInterval(pingInterval); return; }
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) { ws.terminate(); return; }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(pingInterval));

  logger.info('WebSocket server initialized at /ws/client');
}

export function sendCommandToSession(sessionId, command) {
  const sessionClients = clients.get(sessionId);
  if (!sessionClients || sessionClients.size === 0) {
    return 0;
  }

  const message = JSON.stringify(command);
  let sent = 0;
  for (const ws of sessionClients) {
    if (ws.readyState === 1) { // WebSocket.OPEN
      ws.send(message);
      sent++;
    }
  }
  return sent;
}
