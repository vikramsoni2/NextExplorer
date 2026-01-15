const crypto = require('crypto');
const pty = require('@homebridge/node-pty-prebuilt-multiarch');
const WebSocket = require('ws');
const logger = require('../utils/logger');

const CONTROL_PREFIX = '\u001e';

class TerminalService {
  constructor() {
    this.terminals = new Map();
    this.sessionTokens = new Map();
    this.tokenTtlMs = 5 * 60 * 1000; // 5 minutes
  }

  createSessionToken(user) {
    if (!user || !user.id) {
      const err = new Error('User context is required to create terminal session token.');
      err.status = 400;
      throw err;
    }

    const roles = Array.isArray(user.roles) ? user.roles : [];
    const isAdmin = roles.includes('admin');

    if (!isAdmin) {
      const err = new Error('Admin privileges required to create terminal session token.');
      err.status = 403;
      throw err;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();

    this.sessionTokens.set(token, {
      userId: user.id,
      roles,
      createdAt: now,
    });

    logger.info({ userId: user.id }, 'Created terminal session token');

    return token;
  }

  validateSessionToken(token) {
    if (!token) return null;

    const entry = this.sessionTokens.get(token);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.createdAt > this.tokenTtlMs) {
      this.sessionTokens.delete(token);
      return null;
    }

    // Single-use token: consume after successful validation
    this.sessionTokens.delete(token);

    return entry;
  }

  createWebSocketServer(server) {
    logger.info('Creating WebSocket server for terminal on path: /terminal');

    const wss = new WebSocket.Server({
      server,
      path: '/api/terminal',
    });

    wss.on('connection', (ws, req) => {
      try {
        const connectionUrl = new URL(req.url, 'http://localhost');
        const token = connectionUrl.searchParams.get('token') || null;

        const session = this.validateSessionToken(token);

        if (!session) {
          logger.warn(
            { url: req.url },
            'Rejected terminal WebSocket connection: invalid or expired token'
          );
          ws.close(1008, 'Invalid or expired terminal session token');
          return;
        }

        logger.info(
          {
            url: req.url,
            headers: req.headers,
            userId: session.userId,
            roles: session.roles,
          },
          'Terminal WebSocket connection established for admin user'
        );

        this.handleConnection(ws);
      } catch (error) {
        logger.error({ err: error }, 'Error handling terminal WebSocket connection');
        try {
          ws.close(1011, 'Internal server error');
        } catch (_) {
          /* ignore */
        }
      }
    });

    wss.on('error', (error) => {
      logger.error({ err: error }, 'WebSocket server error');
    });

    logger.info('WebSocket server created successfully');
    return wss;
  }

  handleConnection(ws) {
    const terminalId = Date.now().toString();
    const shell = process.env.SHELL || 'bash';

    logger.info(
      {
        terminalId,
        shell,
        cwd: process.env.HOME,
        wsReadyState: ws.readyState,
      },
      'Attempting to spawn terminal process'
    );

    try {
      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 30,
        cwd: process.env.HOME,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          FORCE_COLOR: '1',
          CLICOLOR: '1',
          CLICOLOR_FORCE: '1',
        },
      });

      this.terminals.set(terminalId, ptyProcess);
      logger.info(
        { terminalId, shell, pid: ptyProcess.pid },
        'Terminal process spawned successfully'
      );

      ptyProcess.on('data', (data) => {
        try {
          logger.debug({ terminalId, dataLength: data.length }, 'Received data from PTY');
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
            logger.debug({ terminalId }, 'Sent data to WebSocket client');
          } else {
            logger.warn(
              { terminalId, readyState: ws.readyState },
              'WebSocket not open, cannot send data'
            );
          }
        } catch (error) {
          logger.error({ err: error, terminalId }, 'Error sending data to WebSocket');
        }
      });

      ws.on('message', (message) => {
        try {
          logger.debug(
            { terminalId, messageLength: message.length },
            'Received message from WebSocket client'
          );

          const messageText =
            typeof message === 'string' ? message : Buffer.from(message).toString('utf8');

          if (messageText.startsWith(CONTROL_PREFIX)) {
            const payloadText = messageText.slice(CONTROL_PREFIX.length);
            let payload;
            try {
              payload = JSON.parse(payloadText);
            } catch (error) {
              logger.warn({ err: error, terminalId }, 'Invalid terminal control message JSON');
              return;
            }

            if (payload?.type === 'resize') {
              const cols = Number.isFinite(payload.cols) ? Math.max(1, Math.floor(payload.cols)) : null;
              const rows = Number.isFinite(payload.rows) ? Math.max(1, Math.floor(payload.rows)) : null;
              if (!cols || !rows) return;

              try {
                ptyProcess.resize(cols, rows);
                logger.debug({ terminalId, cols, rows }, 'Resized PTY');
              } catch (error) {
                logger.warn({ err: error, terminalId, cols, rows }, 'Failed to resize PTY');
              }
              return;
            }

            logger.debug({ terminalId, type: payload?.type }, 'Ignored terminal control message');
            return;
          }

          ptyProcess.write(messageText);
        } catch (error) {
          logger.error({ err: error, terminalId }, 'Error writing to terminal');
        }
      });

      ws.on('close', () => {
        logger.info({ terminalId }, 'WebSocket connection closed');
        ptyProcess.kill();
        this.terminals.delete(terminalId);
      });

      ws.on('error', (error) => {
        logger.error({ err: error, terminalId }, 'WebSocket error');
      });
    } catch (error) {
      logger.error({ err: error }, 'Failed to spawn terminal process');
      ws.close();
    }
  }

  cleanup() {
    logger.info({ count: this.terminals.size }, 'Cleaning up terminal processes');
    this.terminals.forEach((terminal, id) => {
      try {
        terminal.kill();
      } catch (error) {
        logger.error({ err: error, terminalId: id }, 'Error killing terminal process');
      }
    });
    this.terminals.clear();
  }
}

module.exports = new TerminalService();
