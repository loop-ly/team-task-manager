const fs = require('fs');
const path = require('path');
const pool = require('./pool');

/** Applies schema.sql. The script is idempotent, so it can run on every boot. */
async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
}

module.exports = migrate;

// `npm run migrate` runs this file directly.
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('[db] Schema is up to date.');
      return pool.end();
    })
    .catch((err) => {
      console.error('[db] Migration failed:', err.message);
      process.exit(1);
    });
}
