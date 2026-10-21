const express = require('express');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const passport = require('../auth/passport');
const pool = require('../db/pool');
const config = require('../config/env');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');
const { acceptPendingInvites } = require('../services/invites');

const router = express.Router();

// Slows down password guessing and mass sign-ups.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => config.isTest,
  message: { error: 'Too many attempts, please try again later' },
});

// POST /api/auth/register
router.post('/register', authLimiter, validate(schemas.register), async (req, res, next) => {
  const { name, email, password } = req.valid.body;
  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);

  const client = await pool.connect();
  let user;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, passwordHash]
    );
    user = rows[0];
    await acceptPendingInvites(client, user);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    throw err;
  } finally {
    client.release();
  }

  // Logging in right after registering saves the user a step.
  return req.login(user, (err) => (err ? next(err) : res.status(201).json({ user })));
});

// POST /api/auth/login
router.post('/login', authLimiter, validate(schemas.login), (req, res, next) => {
  req.body = req.valid.body; // passport reads credentials from req.body
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      return res.status(401).json({ error: (info && info.message) || 'Invalid email or password' });
    }
    return req.login(user, (loginErr) => (loginErr ? next(loginErr) : res.json({ user })));
  })(req, res, next);
});

// POST /api/auth/logout
router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    return req.session.destroy((destroyErr) => {
      if (destroyErr) return next(destroyErr);
      res.clearCookie(config.sessionCookieName);
      return res.status(204).end();
    });
  });
});

// GET /api/auth/me - lets the client restore its state after a page refresh
router.get('/me', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Authentication required' });
  return res.json({ user: req.user });
});

module.exports = router;
