const { getClientIdentifier } = require('../utils/authSecurity');

const createRateLimiter = ({
  windowMs,
  max,
  message,
  keyGenerator,
}) => {
  const store = new Map();

  const pruneExpiredEntries = (now) => {
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt <= now) {
        store.delete(key);
      }
    }
  };

  return (req, res, next) => {
    const now = Date.now();
    if (store.size > 5000) {
      pruneExpiredEntries(now);
    }

    const key =
      (typeof keyGenerator === 'function' ? keyGenerator(req) : '') ||
      getClientIdentifier(req);
    const existing = store.get(key);

    if (!existing || existing.resetAt <= now) {
      store.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      next();
      return;
    }

    if (existing.count >= max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json({
        success: false,
        message,
      });
      return;
    }

    existing.count += 1;
    store.set(key, existing);
    next();
  };
};

module.exports = {
  createRateLimiter,
};
