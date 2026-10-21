const config = require('./config/env');
const pool = require('./db/pool');
const migrate = require('./db/migrate');
const createApp = require('./app');

async function main() {
  if (config.autoMigrate && config.databaseUrl) {
    await migrate();
    console.log('[db] Schema is up to date.');
  }

  const server = createApp().listen(config.port, () => {
    console.log(`[server] Listening on http://localhost:${config.port} (${config.env})`);
  });

  // Let in-flight requests finish before exiting (Cloud Run sends SIGTERM).
  const shutdown = () => {
    server.close(() => pool.end().then(() => process.exit(0)));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[server] Failed to start:', err);
  process.exit(1);
});
