/** Blocks the request unless the session belongs to a logged-in user. */
function requireAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  return res.status(401).json({ error: 'Authentication required' });
}

module.exports = { requireAuth };
