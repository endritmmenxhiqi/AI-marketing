const { registerUser, loginUser, getUserById, generateResetToken, resetPassword: resetPasswordService } = require('../services/authService');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Basic email format validation */
const isValidEmail = (email) => /^\S+@\S+\.\S+$/.test(email);

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const data = await registerUser(email, password);
    return res.status(201).json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const data = await loginUser(email, password);
    return res.status(200).json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me  (protected)
 */
const getMe = async (req, res, next) => {
  try {
    const user = await getUserById(req.user.userId);
    return res.status(200).json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/forgot-password
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email' });
    }

    const resetToken = await generateResetToken(email);

    // In a production app, you would send this token via email.
    // For this MVP, we return it in the response so the frontend can display it locally.
    const resetUrl = `http://localhost:5173/reset-password/${resetToken}`;

    return res.status(200).json({ 
      success: true, 
      message: 'Token generated successfully.',
      resetUrl,
      resetToken 
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/auth/reset-password/:token
 */
const resetPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const data = await resetPasswordService(req.params.token, password);
    return res.status(200).json({ success: true, message: 'Password reset successful', ...data });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, getMe, forgotPassword, resetPassword };
