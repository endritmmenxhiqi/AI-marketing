import crypto from 'node:crypto';
import { CreditTransaction, CreditTransactionDocument } from '../models/CreditTransaction';
import { User } from '../models/User';

export type CreditPackage = {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
  priceLabel: string;
  description: string;
  badge?: string;
};

const creditPackages: CreditPackage[] = [
  {
    id: 'demo-5',
    name: 'Starter Boost',
    credits: 5,
    priceCents: 499,
    priceLabel: '$4.99 demo',
    description: 'Enough for 5 videos or 5 photo ad sets.',
  },
  {
    id: 'demo-15',
    name: 'Creator Pack',
    credits: 15,
    priceCents: 1199,
    priceLabel: '$11.99 demo',
    description: 'A bigger bundle for testing more campaigns.',
    badge: 'Popular'
  },
  {
    id: 'demo-50',
    name: 'Studio Pack',
    credits: 50,
    priceCents: 2999,
    priceLabel: '$29.99 demo',
    description: 'For a full demo account with room to experiment.',
    badge: 'Best value'
  }
];

const packageMap = new Map(creditPackages.map((item) => [item.id, item]));

const createCreditError = () => {
  const error = new Error('You do not have enough credits. Buy more credits to continue.') as Error & {
    statusCode?: number;
  };
  error.statusCode = 402;
  return error;
};

const createHttpError = (message: string, statusCode: number) => {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
};

const serializeTransaction = (transaction: CreditTransactionDocument) => ({
  id: String(transaction._id),
  type: transaction.type,
  amount: transaction.amount,
  balanceAfter: transaction.balanceAfter,
  source: transaction.source,
  packageId: transaction.packageId,
  referenceId: transaction.referenceId,
  description: transaction.description,
  createdAt: transaction.createdAt
});

export const listCreditPackages = () => creditPackages;

export const spendCredit = async (
  userId: string,
  details: {
    source?: string;
    description?: string;
    referenceId?: string;
  } = {}
) => {
  await User.updateOne(
    { _id: userId, credits: { $exists: false } },
    { $set: { credits: 5, creditsUsed: 0 } }
  );

  const user = await User.findOneAndUpdate(
    { _id: userId, credits: { $gte: 1 } },
    {
      $inc: {
        credits: -1,
        creditsUsed: 1
      }
    },
    { new: true }
  );

  if (!user) {
    throw createCreditError();
  }

  await CreditTransaction.create({
    owner: user._id,
    type: 'spend',
    amount: -1,
    balanceAfter: user.credits,
    source: details.source || 'generation',
    referenceId: details.referenceId,
    description: details.description || 'Spent 1 credit for a generation.'
  });

  return {
    credits: user.credits,
    creditsUsed: user.creditsUsed
  };
};

export const addCredits = async (
  userId: string,
  credits: number,
  details: {
    source?: string;
    description?: string;
    packageId?: string;
    referenceId?: string;
    metadata?: Record<string, unknown>;
  } = {}
) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { credits } },
    { new: true }
  );

  if (!user) {
    throw new Error('User not found while adding credits.');
  }

  const transaction = await CreditTransaction.create({
    owner: user._id,
    type: credits >= 0 ? 'purchase' : 'adjustment',
    amount: credits,
    balanceAfter: user.credits,
    source: details.source || 'manual',
    packageId: details.packageId,
    referenceId: details.referenceId,
    description: details.description || `Added ${credits} credits.`,
    metadata: details.metadata
  });

  return {
    credits: user.credits,
    creditsUsed: user.creditsUsed,
    transaction: serializeTransaction(transaction)
  };
};

export const completeDemoCreditPurchase = async (userId: string, packageId: string) => {
  const selectedPackage = packageMap.get(packageId);
  if (!selectedPackage) {
    throw createHttpError('Unknown credit package.', 400);
  }

  const referenceId = `demo_${crypto.randomUUID()}`;
  const result = await addCredits(userId, selectedPackage.credits, {
    source: 'demo-checkout',
    packageId: selectedPackage.id,
    referenceId,
    description: `Demo checkout purchase: ${selectedPackage.name}.`,
    metadata: {
      priceCents: selectedPackage.priceCents,
      priceLabel: selectedPackage.priceLabel
    }
  });

  return {
    package: selectedPackage,
    ...result
  };
};

export const getCreditTransactions = async (userId: string, limit = 12) => {
  const transactions = await CreditTransaction.find({ owner: userId })
    .sort({ createdAt: -1 })
    .limit(limit);

  return transactions.map(serializeTransaction);
};
