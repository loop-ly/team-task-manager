/**
 * Validates req[source] against a Joi schema.
 * Cleaned values are stored on `req.valid[source]` (Express 5 makes req.query read-only,
 * so we never overwrite the original request properties).
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const { value, error } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map((d) => ({
          field: d.path.join('.'),
          message: d.message.replace(/"/g, ''),
        })),
      });
    }

    req.valid = req.valid || {};
    req.valid[source] = value;
    return next();
  };
}

module.exports = validate;
