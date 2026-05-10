import mongoose, { Schema } from 'mongoose';

const creditLedgerSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: ['consume', 'refund', 'purchase', 'subscription'],
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ['wallet', 'stripe', 'system'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      credits: { type: Number, default: 0 },
    },
    metadata: {
      jobId: String,
      queueJobId: String,
      outputMode: String,
      reason: String,
      stripeSessionId: String,
      stripeCustomerId: String,
      stripeSubscriptionId: String,
      requestId: String,
    },
  },
  { timestamps: true }
);

creditLedgerSchema.index({ userId: 1, createdAt: -1 });

export const CreditLedger =
  mongoose.models.CreditLedger || mongoose.model('CreditLedger', creditLedgerSchema);
