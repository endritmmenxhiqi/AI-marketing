const {
  registerUser,
  loginUser,
  getUserById,
  generateResetToken,
  resetPassword: resetPasswordService,
} = require('../services/authService');
const { sendResetEmail } = require('../services/emailService');
const {
  clearAuthCookie,
  setAuthCookie,
  validatePasswordStrength,
} = require('../utils/authSecurity');

/** Basic email format validation */
const isValidEmail = (email) => /^\S+@\S+\.\S+$/.test(email);

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

    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ success: false, message: passwordValidation.message });
    }

    const data = await registerUser(email, password);
    setAuthCookie(res, data.token);
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
    setAuthCookie(res, data.token);
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
    if (resetToken) {
      const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
      const base = frontendBase.replace(/\/$/, '');
      const resetUrl = `${base}/reset-password/${resetToken}`;

      try {
        await sendResetEmail(email, resetUrl);
      } catch (_sendErr) {
        // Keep the response generic so the endpoint does not reveal account state.
      }
    }

    return res.status(200).json({
      success: true,
      message: 'If an account exists for that email, a reset link will be sent shortly.',
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
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ success: false, message: passwordValidation.message });
    }

    const data = await resetPasswordService(req.params.token, password);
    setAuthCookie(res, data.token);
    return res.status(200).json({ success: true, message: 'Password reset successful', ...data });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/logout
 */
const logout = async (_req, res) => {
  clearAuthCookie(res);
  return res.status(200).json({ success: true, message: 'Logged out successfully' });
};

module.exports = { register, login, getMe, forgotPassword, resetPassword, logout };
