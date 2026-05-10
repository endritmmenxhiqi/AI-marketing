import type { NextFunction, Request, Response } from 'express';
import { consumeGenerationCredit, getUserCreditState } from '../services/userCreditService';

export const checkAndConsumeCredits = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Not authorized.' });
      return;
    }

    const outputMode = req.path.includes('/photo')
      ? 'image'
      : req.path.includes('/video')
        ? 'video'
        : String(req.body?.outputMode || 'video') === 'image'
          ? 'image'
          : 'video';

    const consumed = await consumeGenerationCredit({
      userId,
      outputMode,
      requestId: req.headers['x-request-id'] as string | undefined,
    });

    if (!consumed) {
      const state = await getUserCreditState(userId);
      res.status(403).json({
        message: 'No credits remaining. Please upgrade to continue.',
        code: 'NO_CREDITS',
        credits: state,
      });
      return;
    }

    req.creditUsage = {
      consumed: true,
      source: consumed.source,
      outputMode,
      state: consumed.state,
    };

    next();
  } catch (error) {
    next(error);
  }
};
