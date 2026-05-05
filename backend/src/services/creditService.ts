import { User } from '../models/User';

const createCreditError = () => {
  const error = new Error('You do not have enough credits. Buy more credits to continue.') as Error & {
    statusCode?: number;
  };
  error.statusCode = 402;
  return error;
};

export const spendCredit = async (userId: string) => {
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

  return {
    credits: user.credits,
    creditsUsed: user.creditsUsed
  };
};

export const addCredits = async (userId: string, credits: number) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { credits } },
    { new: true }
  );

  if (!user) {
    throw new Error('User not found while adding credits.');
  }

  return {
    credits: user.credits,
    creditsUsed: user.creditsUsed
  };
};
