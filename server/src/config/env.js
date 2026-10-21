require('dotenv').config();

const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';
const isTest = env === 'test';

if (isProd && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set in production');
}

module.exports = {
  env,
  isProd,
  isTest,
  port: Number(process.env.PORT) || 4000,
  databaseUrl: process.env.DATABASE_URL || null,
  dbSsl: process.env.DB_SSL === 'true',
  sessionSecret: process.env.SESSION_SECRET || 'dev-only-insecure-secret',
  sessionCookieName: 'ttm.sid',
  // In development, SESSION_STORE=memory keeps sessions in process memory.
  useMemorySessions: !isProd && process.env.SESSION_STORE === 'memory',
  cookieSecure:
    process.env.COOKIE_SECURE !== undefined
      ? process.env.COOKIE_SECURE === 'true'
      : isProd,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 12,
  autoMigrate: process.env.AUTO_MIGRATE !== 'false',
};
