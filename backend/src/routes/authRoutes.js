const express = require('express');
const router = express.Router();

const { register, login, getMe, forgotPassword, resetPassword, logout } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { createRateLimiter } = require('../middleware/rateLimitMiddleware');
const { getClientIdentifier, normalizeEmail } = require('../utils/authSecurity');

const loginIpLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 12,
  message: 'Too many login attempts. Please wait a few minutes and try again.',
  keyGenerator: (req) => `login:ip:${getClientIdentifier(req)}`,
});

const loginIdentityLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 6,
  message: 'Too many login attempts for this account. Please wait a few minutes and try again.',
  keyGenerator: (req) => `login:identity:${normalizeEmail(req.body?.email)}:${getClientIdentifier(req)}`,
});

const registerIpLimiter = createRateLimiter({
  windowMs: 30 * 60 * 1000,
  max: 8,
  message: 'Too many registration attempts. Please wait and try again later.',
  keyGenerator: (req) => `register:ip:${getClientIdentifier(req)}`,
});

const passwordResetRequestLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many password reset requests. Please wait before trying again.',
  keyGenerator: (req) => `forgot:${normalizeEmail(req.body?.email)}:${getClientIdentifier(req)}`,
});

const passwordResetLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many password reset attempts. Please wait before trying again.',
  keyGenerator: (req) => `reset:${getClientIdentifier(req)}`,
});

// Public routes
router.post('/register', registerIpLimiter, register);
router.post('/login', loginIpLimiter, loginIdentityLimiter, login);
router.post('/forgot-password', passwordResetRequestLimiter, forgotPassword);
router.put('/reset-password/:token', passwordResetLimiter, resetPassword);
router.post('/logout', logout);

// Protected routes
router.get('/me', protect, getMe);

module.exports = router;
