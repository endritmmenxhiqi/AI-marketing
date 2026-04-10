import { CacheEntry } from '../models/CacheEntry';
import { config } from '../config';

export const getCache = async <T>(key: string) => {
  const entry = await CacheEntry.findOne({ key }).lean<{ value: T }>();
  return entry?.value || null;
};

export const setCache = async <T>(key: string, value: T) => {
  const expiresAt = new Date(Date.now() + config.cacheTtlHours * 60 * 60 * 1000);
  await CacheEntry.findOneAndUpdate(
    { key },
    { key, value, expiresAt },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};
