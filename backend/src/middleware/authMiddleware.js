const jwt = require('jsonwebtoken');

/**
 * Middleware: verify Bearer token and attach user payload to req.user.
 * Sends 401 if the token is missing or invalid.
 */
const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized — no token provided',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { userId, iat, exp }
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized — token invalid or expired',
    });
  }
};

module.exports = { protect };
