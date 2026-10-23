const config = require('../config/env');

function notFound(req, res) {
  res.status(404).json({ error: 'Route not found' });
}

// Express 5 forwards rejected promises from async handlers here automatically.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }
  if (err.code === '23505') {
    return res.status(409).json({ error: 'That record already exists' });
  }
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referenced record does not exist' });
  }

  if (!config.isTest) console.error(err);
  return res.status(err.status || 500).json({ error: 'Something went wrong on our side' });
}

module.exports = { notFound, errorHandler };
