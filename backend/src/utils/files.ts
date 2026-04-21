import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export const ensureDir = async (dirPath: string) => {
  await fs.mkdir(dirPath, { recursive: true });
};

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'asset';

export const uniqueFile = (baseName: string, extension: string) =>
  `${slugify(baseName)}-${crypto.randomUUID()}.${extension.replace(/^\./, '')}`;

export const sha256 = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex');

export const normalizePathForUrl = (value: string) => value.replace(/\\/g, '/');

export const fileExists = async (filePath: string) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

export const relativeFrom = (from: string, to: string) => normalizePathForUrl(path.relative(from, to));
