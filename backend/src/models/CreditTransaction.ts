import mongoose, { Schema } from 'mongoose';

export type CreditTransactionType = 'purchase' | 'spend' | 'refund' | 'adjustment';

export interface CreditTransactionDocument extends mongoose.Document {
  owner: mongoose.Types.ObjectId;
  type: CreditTransactionType;
  amount: number;
  balanceAfter: number;
  source: string;
  packageId?: string;
  referenceId?: string;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const creditTransactionSchema = new Schema<CreditTransactionDocument>(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['purchase', 'spend', 'refund', 'adjustment'],
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    balanceAfter: {
      type: Number,
      required: true,
      min: 0
    },
    source: {
      type: String,
      required: true,
      trim: true
    },
    packageId: {
      type: String,
      trim: true
    },
    referenceId: {
      type: String,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    metadata: {
      type: Schema.Types.Mixed
    }
  },
  { timestamps: true }
);

creditTransactionSchema.index({ owner: 1, createdAt: -1 });
creditTransactionSchema.index({ referenceId: 1 }, { unique: true, sparse: true });

export const CreditTransaction =
  (mongoose.models.CreditTransaction as mongoose.Model<CreditTransactionDocument> | undefined) ||
  mongoose.model<CreditTransactionDocument>('CreditTransaction', creditTransactionSchema);
