const app = require('./src/app');
const { masterSequelize } = require('./src/config/database');
const dotenv = require('dotenv');

dotenv.config();

const PORT = process.env.PORT || 8001;

// ─── Global crash guards ───────────────────────────────────────────────────
// Node v15+ terminates on unhandled rejections by default. Catch them here
// so a single bad DB query or failed async operation doesn't kill the server.

process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION] A promise was rejected without a catch handler.');
  console.error('  Reason :', reason instanceof Error ? reason.stack : reason);
  // Do NOT exit — log and keep running.
});

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION] A synchronous error escaped all try/catch blocks.');
  console.error('  Error  :', err.stack || err);
  // Do NOT exit — log and keep running.
  // NOTE: if this fires repeatedly it signals a real bug; fix the source rather
  // than relying on this guard indefinitely.
});

// ─── Startup ───────────────────────────────────────────────────────────────

const start = async () => {
  try {
    // 1. Authenticate Master DB
    await masterSequelize.authenticate();
    console.log('[MASTER DB] Connection established.');

    // 2. Sync Master Models
    await masterSequelize.sync({ alter: false });
    console.log('[MASTER DB] Models synchronized.');

    // 3. Start Express Server
    app.listen(PORT, () => {
      console.log(`[SERVER] Colonel Backend running on port ${PORT}`);
      console.log(`[SERVER] Environment: ${process.env.NODE_ENV}`);
    });

  } catch (error) {
    console.error('[SERVER ERROR] Failed to start:', error);
    process.exit(1);
  }
};

// ─── Graceful shutdown ─────────────────────────────────────────────────────

process.on('SIGINT', async () => {
  console.log('[SERVER] Shutting down...');
  await masterSequelize.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[SERVER] SIGTERM received. Shutting down...');
  await masterSequelize.close();
  process.exit(0);
});

start();
