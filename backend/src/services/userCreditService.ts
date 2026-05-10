import mongoose from 'mongoose';
import { CreditLedger } from '../models/CreditLedger';
import { config } from '../config';

const User = require('../models/User') as mongoose.Model<any>;

export type CreditSource = 'wallet';

export type CreditState = {
  role: 'user' | 'premium';
  subscriptionStatus: 'free' | 'active' | 'cancelled';
  credits: number;
  totalGenerations: number;
};

export type CreditConsumeResult = {
  consumed: true;
  source: CreditSource;
  state: CreditState;
};

const mapCreditState = (user: any): CreditState => ({
  role: user?.role === 'premium' ? 'premium' : 'user',
  subscriptionStatus:
    user?.subscriptionStatus === 'active' || user?.subscriptionStatus === 'cancelled'
      ? user.subscriptionStatus
      : 'free',
  credits: Number(user?.credits || 0),
  totalGenerations: Number(user?.totalGenerations || 0),
});

const findCreditUserById = (userId: string) =>
  User.findById(userId)
    .select('role subscriptionStatus credits totalGenerations stripeCustomerId stripeSubscriptionId')
    .lean();

const ensureCreditWalletInitialized = async (userId: string) => {
  await User.findOneAndUpdate(
    {
      _id: userId,
      credits: { $exists: false },
    },
    {
      $set: {
        credits: config.initialUserCredits,
      },
    }
  );
};

const logCreditEvent = async ({
  userId,
  kind,
  source,
  amount,
  state,
  metadata,
}: {
  userId: string;
  kind: 'consume' | 'refund' | 'purchase' | 'subscription';
  source: 'wallet' | 'stripe' | 'system';
  amount: number;
  state: CreditState;
  metadata?: Record<string, unknown>;
}) => {
  await CreditLedger.create({
    userId,
    kind,
    source,
    amount,
    balanceAfter: {
      credits: state.credits,
    },
    metadata,
  });
};

export const getUserCreditState = async (userId: string) => {
  await ensureCreditWalletInitialized(userId);
  const user = await findCreditUserById(userId);
  if (!user) {
    const error = new Error('User not found.');
    (error as any).statusCode = 404;
    throw error;
  }

  return mapCreditState(user);
};

export const consumeGenerationCredit = async ({
  userId,
  outputMode,
  requestId,
}: {
  userId: string;
  outputMode: 'video' | 'image';
  requestId?: string;
}): Promise<CreditConsumeResult | null> => {
  await ensureCreditWalletInitialized(userId);

  const updated = await User.findOneAndUpdate(
    {
      _id: userId,
      credits: { $gt: 0 },
    },
    {
      $inc: {
        credits: -1,
        totalGenerations: 1,
      },
    },
    {
      returnDocument: 'after',
    }
  )
    .select('role subscriptionStatus credits totalGenerations')
    .lean();

  if (!updated) {
    return null;
  }

  const state = mapCreditState(updated);
  await logCreditEvent({
    userId,
    kind: 'consume',
    source: 'wallet',
    amount: -1,
    state,
    metadata: {
      outputMode,
      requestId,
    },
  });

  return {
    consumed: true,
    source: 'wallet',
    state,
  };
};

export const refundGenerationCredit = async ({
  userId,
  source,
  reason,
  jobId,
}: {
  userId: string;
  source: CreditSource;
  reason: string;
  jobId?: string;
}) => {
  const updated = await User.findByIdAndUpdate(
    userId,
    {
      $inc: {
        credits: 1,
        totalGenerations: -1,
      },
    },
    {
      returnDocument: 'after',
    }
  )
    .select('role subscriptionStatus credits totalGenerations')
    .lean();

  if (!updated) {
    return null;
  }

  const state = mapCreditState(updated);
  await logCreditEvent({
    userId,
    kind: 'refund',
    source,
    amount: 1,
    state,
    metadata: {
      reason,
      jobId,
    },
  });

  return state;
};

export const addPurchasedCredits = async ({
  userId,
  credits,
  stripeSessionId,
  stripeCustomerId,
}: {
  userId: string;
  credits: number;
  stripeSessionId?: string;
  stripeCustomerId?: string;
}) => {
  const updated = await User.findByIdAndUpdate(
    userId,
    {
      $inc: {
        credits,
      },
      ...(stripeCustomerId ? { $set: { stripeCustomerId } } : {}),
    },
    {
      returnDocument: 'after',
    }
  )
    .select('role subscriptionStatus credits totalGenerations')
    .lean();

  if (!updated) {
    const error = new Error('User not found for credit purchase.');
    (error as any).statusCode = 404;
    throw error;
  }

  const state = mapCreditState(updated);
  await logCreditEvent({
    userId,
    kind: 'purchase',
    source: 'stripe',
    amount: credits,
    state,
    metadata: {
      stripeSessionId,
      stripeCustomerId,
    },
  });

  return state;
};

export const activatePremiumSubscription = async ({
  userId,
  stripeCustomerId,
  stripeSubscriptionId,
  stripeSessionId,
}: {
  userId: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeSessionId?: string;
}) => {
  const updated = await User.findByIdAndUpdate(
    userId,
    {
      $set: {
        role: 'premium',
        subscriptionStatus: 'active',
        ...(stripeCustomerId ? { stripeCustomerId } : {}),
        ...(stripeSubscriptionId ? { stripeSubscriptionId } : {}),
      },
    },
    { returnDocument: 'after' }
  )
    .select('role subscriptionStatus credits totalGenerations')
    .lean();

  if (!updated) {
    const error = new Error('User not found for subscription activation.');
    (error as any).statusCode = 404;
    throw error;
  }

  const state = mapCreditState(updated);

  await logCreditEvent({
    userId,
    kind: 'subscription',
    source: 'stripe',
    amount: 0,
    state,
    metadata: {
      stripeCustomerId,
      stripeSubscriptionId,
      stripeSessionId,
      reason: 'subscription_activated',
    },
  });

  return state;
};

export const cancelPremiumSubscription = async ({
  userId,
  stripeSubscriptionId,
}: {
  userId: string;
  stripeSubscriptionId?: string;
}) => {
  const updated = await User.findByIdAndUpdate(
    userId,
    {
      $set: {
        role: 'user',
        subscriptionStatus: 'cancelled',
        ...(stripeSubscriptionId ? { stripeSubscriptionId } : {}),
      },
    },
    { returnDocument: 'after' }
  )
    .select('role subscriptionStatus credits totalGenerations')
    .lean();

  if (!updated) {
    return null;
  }

  const state = mapCreditState(updated);

  await logCreditEvent({
    userId,
    kind: 'subscription',
    source: 'system',
    amount: 0,
    state,
    metadata: {
      stripeSubscriptionId,
      reason: 'subscription_cancelled',
    },
  });

  return state;
};
