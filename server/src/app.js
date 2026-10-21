const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const session = require('express-session');
const connectPgSimple = require('connect-pg-simple');

const config = require('./config/env');
const pool = require('./db/pool');
const passport = require('./auth/passport');
const { requireAuth } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const teamRoutes = require('./routes/teams');
const taskRoutes = require('./routes/tasks');

/** Sessions live in PostgreSQL; in development they can fall back to process memory. */
function buildSessionStore() {
  if (config.useMemorySessions) {
    console.warn('[session] SESSION_STORE=memory - sessions are lost on restart (dev only).');
    return undefined; // express-session defaults to its MemoryStore
  }
  const PgStore = connectPgSimple(session);
  return new PgStore({ pool, tableName: 'user_sessions' });
}

function createApp() {
  const app = express();

  // Behind Cloud Run / App Engine / a load balancer, trust the first proxy so
  // Secure cookies and client IPs (for rate limiting) work correctly.
  if (config.isProd) app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  if (!config.isTest) app.use(morgan(config.isProd ? 'combined' : 'dev'));
  app.use(express.json({ limit: '10kb' }));

  app.use(
    session({
      name: config.sessionCookieName,
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: buildSessionStore(),
      cookie: {
        httpOnly: true, // not readable from JavaScript
        sameSite: 'lax', // not sent on cross-site POSTs (CSRF mitigation)
        secure: config.cookieSecure,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());

  // Public: liveness probe only, exposes nothing.
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  app.use('/api/auth', authRoutes);
  // Everything below requires a logged-in session.
  app.use('/api/teams', requireAuth, teamRoutes);
  app.use('/api/tasks', requireAuth, taskRoutes);

  app.use('/api', notFound);

  // In production the built React app is served by this same server.
  const clientDist = path.join(__dirname, '../../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}

module.exports = createApp;
