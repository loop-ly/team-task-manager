const { Pool, types } = require('pg');
const config = require('../config/env');

// Return DATE columns (OID 1082) as plain "YYYY-MM-DD" strings. By default `pg`
// converts them to JS Dates in the server's timezone, which shifts due dates by a day.
types.setTypeParser(1082, (value) => value);

if (!config.databaseUrl) {
  console.warn('[db] DATABASE_URL is not set - database queries will fail.');
}

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.dbSsl ? { rejectUnauthorized: false } : undefined,
  max: 10,
});

pool.on('error', (err) => {
  console.error('[db] Unexpected error on idle client', err);
});

module.exports = pool;
