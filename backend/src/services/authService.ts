import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from '../config';
import { User } from '../models/User';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const jwt = require('jsonwebtoken');

type AuthenticatedUserPayload = {
  id: string;
  email: string;
  role: string;
  createdAt: Date;
};

const createHttpError = (message: string, statusCode: number) => {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const serializeUser = (user: {
  _id: unknown;
  email: string;
  role: string;
  createdAt: Date;
}): AuthenticatedUserPayload => ({
  id: String(user._id),
  email: user.email,
  role: user.role,
  createdAt: user.createdAt
});

const signToken = (userId: string) => {
  if (!config.jwtSecret) {
    throw createHttpError('Authentication is not configured on the server.', 500);
  }

  return jwt.sign({ userId }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn || '1d'
  });
};

export const registerUser = async (email: string, password: string) => {
  const normalizedEmail = normalizeEmail(email);
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw createHttpError('An account with this email already exists.', 409);
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await User.create({
    email: normalizedEmail,
    password: hashedPassword
  });

  return {
    token: signToken(String(user._id)),
    user: serializeUser(user)
  };
};

export const loginUser = async (email: string, password: string) => {
  const normalizedEmail = normalizeEmail(email);
  const user = await User.findOne({ email: normalizedEmail }).select('+password');
  if (!user) {
    throw createHttpError('Invalid email or password.', 401);
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw createHttpError('Invalid email or password.', 401);
  }

  return {
    token: signToken(String(user._id)),
    user: serializeUser(user)
  };
};

export const getUserById = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) {
    throw createHttpError('User not found.', 404);
  }

  return serializeUser(user);
};

export const generateResetToken = async (email: string) => {
  const normalizedEmail = normalizeEmail(email);
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw createHttpError('No user found with that email.', 404);
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

  return resetToken;
};

export const resetPassword = async (token: string, newPassword: string) => {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: new Date() }
  }).select('+password');

  if (!user) {
    throw createHttpError('Invalid or expired reset token.', 400);
  }

  user.password = await bcrypt.hash(newPassword, 12);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  return {
    token: signToken(String(user._id)),
    user: serializeUser(user)
  };
};
