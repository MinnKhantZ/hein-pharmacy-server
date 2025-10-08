const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

const authorizeOwner = (req, res, next) => {
  // Allow access to own resources or admin access
  const resourceOwnerId = req.params.ownerId || req.body.owner_id;
  
  if (req.user.id !== parseInt(resourceOwnerId) && req.user.username !== 'admin') {
    return res.status(403).json({ error: 'Access denied: insufficient permissions' });
  }
  
  next();
};

module.exports = {
  authenticateToken,
  authorizeOwner
};