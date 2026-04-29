const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sign a JWT for a given user id.
 * @param {string} userId
 * @returns {string} signed JWT
 */
const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });

const buildUserPayload = (user) => ({
  id: user._id,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt,
});

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Register a new user.
 * Hashes the password and returns a JWT on success.
 */
const registerUser = async (email, password) => {
  // Check for existing user
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    const err = new Error('An account with this email already exists');
    err.statusCode = 409;
    throw err;
  }

  // Hash password
  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Create user
  const user = await User.create({ email, password: hashedPassword });

  const token = signToken(user._id);
  return { token, user: buildUserPayload(user) };
};

/**
 * Log in an existing user.
 * Returns a JWT on success.
 */
const loginUser = async (email, password) => {
  // Fetch user including password field (excluded by default)
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  if (user.resetPasswordToken || user.resetPasswordExpires) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save({ validateBeforeSave: false });
  }

  const token = signToken(user._id);
  return { token, user: buildUserPayload(user) };
};

/**
 * Fetch a user by ID (for the /me route).
 */
const getUserById = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }
  return { id: user._id, email: user.email, role: user.role, createdAt: user.createdAt };
};

/**
 * Generate a password reset token.
 * Saves a hashed token to the user document and returns the plain token (to simulate emailing it).
 */
const generateResetToken = async (email) => {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return null;
  }

  // Create a raw crypto token
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  // Hash it before saving to DB
  user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour

  await user.save({ validateBeforeSave: false });
  return resetToken;
};

/**
 * Reset password using the token.
 * Validates token, hashes the new password, and returns a fresh JWT.
 */
const resetPassword = async (token, newPassword) => {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    const err = new Error('Invalid or expired reset token');
    err.statusCode = 400;
    throw err;
  }

  // Hash new password
  const salt = await bcrypt.genSalt(12);
  user.password = await bcrypt.hash(newPassword, salt);
  
  // Clear reset fields
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save({ validateBeforeSave: false });

  const jwtToken = signToken(user._id);
  return { token: jwtToken, user: buildUserPayload(user) };
};

module.exports = { registerUser, loginUser, getUserById, generateResetToken, resetPassword };
