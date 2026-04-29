import mongoose, { Schema } from 'mongoose';

const cacheEntrySchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: Schema.Types.Mixed, required: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true }
);

export const CacheEntry =
  mongoose.models.CacheEntry || mongoose.model('CacheEntry', cacheEntrySchema);
