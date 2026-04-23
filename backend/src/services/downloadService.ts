import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config';
import { ensureDir, fileExists, sha256, uniqueFile } from '../utils/files';

export const downloadToFile = async ({
  url,
  outputDir,
  label,
  extension
}: {
  url: string;
  outputDir: string;
  label: string;
  extension: string;
}) => {
  await ensureDir(outputDir);
  const normalizedExtension = extension.replace(/^\./, '');
  const cachePath = path.join(config.cacheDir, 'downloads', `${sha256(url)}.${normalizedExtension}`);

  await ensureDir(path.dirname(cachePath));
  if (!(await fileExists(cachePath))) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download asset: ${response.status} ${url}`);
  }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(cachePath, buffer);
  }

  const outputPath = path.join(outputDir, uniqueFile(label, normalizedExtension));
  await fs.copyFile(cachePath, outputPath);
  return outputPath;
};
