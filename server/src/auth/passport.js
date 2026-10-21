const passport = require('passport');
const { Strategy: LocalStrategy } = require('passport-local');
const bcrypt = require('bcrypt');
const pool = require('../db/pool');
const config = require('../config/env');

// Compared against when the email is unknown, so response time does not reveal
// whether an account exists.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', config.bcryptRounds);

passport.use(
  new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
    try {
      const { rows } = await pool.query(
        'SELECT id, name, email, password_hash FROM users WHERE email = $1',
        [email.toLowerCase()]
      );
      const user = rows[0];
      const matches = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

      if (!user || !matches) {
        return done(null, false, { message: 'Invalid email or password' });
      }
      return done(null, { id: user.id, name: user.name, email: user.email });
    } catch (err) {
      return done(err);
    }
  })
);

// Only the user id is stored in the session; the full user is re-read on each request.
passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const { rows } = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [id]);
    done(null, rows[0] || false);
  } catch (err) {
    done(err);
  }
});

module.exports = passport;
