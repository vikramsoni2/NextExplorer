const pty = require('@homebridge/node-pty-prebuilt-multiarch');
const WebSocket = require('ws');
const logger = require('../utils/logger');

class TerminalService {
  constructor() {
    this.terminals = new Map();
  }

  createWebSocketServer(server) {
    logger.info('Creating WebSocket server for terminal on path: /terminal');

    const wss = new WebSocket.Server({
      server,
      path: '/api/terminal'
    });

    wss.on('connection', (ws, req) => {
      logger.info({
        url: req.url,
        headers: req.headers
      }, 'Terminal WebSocket connection established');
      this.handleConnection(ws);
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

    logger.info({
      terminalId,
      shell,
      cwd: process.env.HOME,
      wsReadyState: ws.readyState
    }, 'Attempting to spawn terminal process');

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
        }
      });

      this.terminals.set(terminalId, ptyProcess);
      logger.info({ terminalId, shell, pid: ptyProcess.pid }, 'Terminal process spawned successfully');

      ptyProcess.on('data', (data) => {
        try {
          logger.debug({ terminalId, dataLength: data.length }, 'Received data from PTY');
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
            logger.debug({ terminalId }, 'Sent data to WebSocket client');
          } else {
            logger.warn({ terminalId, readyState: ws.readyState }, 'WebSocket not open, cannot send data');
          }
        } catch (error) {
          logger.error({ err: error, terminalId }, 'Error sending data to WebSocket');
        }
      });

      ws.on('message', (message) => {
        try {
          logger.debug({ terminalId, messageLength: message.length }, 'Received message from WebSocket client');
          ptyProcess.write(message);
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
