import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { config } from './config';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const jwt = require('jsonwebtoken');

export type AuthenticatedUser = {
  userId: string;
  iat?: number;
  exp?: number;
};

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

const unauthorized = (res: Response, message: string) =>
  res.status(401).json({
    success: false,
    message
  });

const readAccessToken = (req: Request) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  const queryToken = Array.isArray(req.query.access_token)
    ? req.query.access_token[0]
    : req.query.access_token;

  return typeof queryToken === 'string' && queryToken.trim() ? queryToken.trim() : '';
};

export const requireAuth: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const token = readAccessToken(req);
  if (!token) {
    unauthorized(res, 'Not authorized. Please sign in to continue.');
    return;
  }

  if (!config.jwtSecret) {
    res.status(500).json({
      success: false,
      message: 'Authentication is not configured on the server.'
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (!decoded || typeof decoded !== 'object' || typeof decoded.userId !== 'string') {
      unauthorized(res, 'Not authorized. Invalid authentication token.');
      return;
    }

    (req as AuthenticatedRequest).user = decoded as AuthenticatedUser;
    next();
  } catch {
    unauthorized(res, 'Not authorized. Your session token is invalid or expired.');
  }
};

export const getAuthenticatedUserId = (req: Request) => {
  const userId = (req as AuthenticatedRequest).user?.userId;
  if (!userId) {
    const error = new Error('Authenticated user context is missing.');
    (error as Error & { statusCode?: number }).statusCode = 401;
    throw error;
  }

  return userId;
};
