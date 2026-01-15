export function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({ error: 'Resource already exists' });
  }

  if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    return res.status(400).json({ error: 'Invalid reference' });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
}
