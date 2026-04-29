const jwt = require('jsonwebtoken');
const { extractAuthToken } = require('../utils/authSecurity');

/**
 * Middleware: verify Bearer token or HttpOnly auth cookie and attach user payload to req.user.
 * Sends 401 if the token is missing or invalid.
 */
const protect = (req, res, next) => {
  const token = extractAuthToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized - no active session found',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { userId, iat, exp }
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized - session invalid or expired',
    });
  }
};

module.exports = { protect };
