import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import mime from 'mime-types';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { StorageAsset } from '../types';
import { ensureDir, normalizePathForUrl } from '../utils/files';

const uploadToLocal = async (sourcePath: string, key: string): Promise<StorageAsset> => {
  const outputPath = path.join(config.outputDir, key);
  await ensureDir(path.dirname(outputPath));
  await fsPromises.copyFile(sourcePath, outputPath);

  return {
    provider: 'local',
    key,
    localPath: outputPath,
    url: `${config.appUrl}/storage/${normalizePathForUrl(key)}`
  };
};

const uploadToS3 = async (sourcePath: string, key: string): Promise<StorageAsset> => {
  const client = new S3Client({
    region: config.s3Region,
    credentials: {
      accessKeyId: config.s3AccessKeyId,
      secretAccessKey: config.s3SecretAccessKey
    }
  });

  await client.send(
    new PutObjectCommand({
      Bucket: config.s3Bucket,
      Key: key,
      Body: fs.createReadStream(sourcePath),
      ContentType: mime.lookup(sourcePath) || 'application/octet-stream'
    })
  );

  return {
    provider: 's3',
    key,
    url: config.s3PublicUrl
      ? `${config.s3PublicUrl.replace(/\/$/, '')}/${key}`
      : `https://${config.s3Bucket}.s3.${config.s3Region}.amazonaws.com/${key}`
  };
};

const uploadToSupabase = async (sourcePath: string, key: string): Promise<StorageAsset> => {
  const client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
  const fileBuffer = await fsPromises.readFile(sourcePath);
  const contentType = mime.lookup(sourcePath) || 'application/octet-stream';

  const { error } = await client.storage.from(config.supabaseBucket).upload(key, fileBuffer, {
    contentType,
    upsert: true
  });

  if (error) {
    throw error;
  }

  const { data } = client.storage.from(config.supabaseBucket).getPublicUrl(key);
  return {
    provider: 'supabase',
    key,
    url: data.publicUrl
  };
};

export const uploadAsset = async (sourcePath: string, key: string) => {
  if (config.storageProvider === 's3') {
    return uploadToS3(sourcePath, key);
  }

  if (config.storageProvider === 'supabase') {
    return uploadToSupabase(sourcePath, key);
  }

  return uploadToLocal(sourcePath, key);
};
