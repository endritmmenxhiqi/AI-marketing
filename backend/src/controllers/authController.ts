import type { RequestHandler } from 'express';
import { getAuthenticatedUserId } from '../auth';
import {
  generateResetToken,
  getUserById,
  loginUser,
  registerUser,
  resetPassword as resetPasswordService
} from '../services/authService';
import { config } from '../config';
import { sendResetEmail } from '../services/emailService';

const isValidEmail = (email: string) => /^\S+@\S+\.\S+$/.test(email);
const resetRequestMessage = 'If an account exists for that email, a reset link will arrive shortly.';

const readBodyField = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export const register: RequestHandler = async (req, res, next) => {
  try {
    const email = readBodyField(req.body?.email);
    const password = readBodyField(req.body?.password);

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password are required.' });
      return;
    }

    if (!isValidEmail(email)) {
      res.status(400).json({ success: false, message: 'Please provide a valid email.' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
      return;
    }

    const payload = await registerUser(email, password);
    res.status(201).json({ success: true, ...payload });
  } catch (error) {
    next(error);
  }
};

export const login: RequestHandler = async (req, res, next) => {
  try {
    const email = readBodyField(req.body?.email);
    const password = readBodyField(req.body?.password);

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password are required.' });
      return;
    }

    const payload = await loginUser(email, password);
    res.status(200).json({ success: true, ...payload });
  } catch (error) {
    next(error);
  }
};

export const getMe: RequestHandler = async (req, res, next) => {
  try {
    const user = await getUserById(getAuthenticatedUserId(req));
    res.status(200).json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword: RequestHandler = async (req, res, next) => {
  try {
    const email = readBodyField(req.body?.email);
    if (!email || !isValidEmail(email)) {
      res.status(400).json({ success: false, message: 'Please provide a valid email.' });
      return;
    }

    const resetToken = await generateResetToken(email);
    if (resetToken) {
      const frontendBase = config.frontendUrl.replace(/\/$/, '');
      const resetUrl = `${frontendBase}/reset-password/${resetToken}`;
      await sendResetEmail(email, resetUrl).catch(() => undefined);
    }

    res.status(200).json({
      success: true,
      message: resetRequestMessage
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword: RequestHandler = async (req, res, next) => {
  try {
    const password = readBodyField(req.body?.password);
    const token = typeof req.params.token === 'string' ? req.params.token : '';

    if (!password || password.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
      return;
    }

    if (!token) {
      res.status(400).json({ success: false, message: 'Reset token is required.' });
      return;
    }

    const payload = await resetPasswordService(token, password);
    res.status(200).json({
      success: true,
      message: 'Password reset successful.',
      ...payload
    });
  } catch (error) {
    next(error);
  }
};
