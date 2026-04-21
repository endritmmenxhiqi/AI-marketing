import fs from 'node:fs/promises';
import path from 'node:path';
import { ensureDir, uniqueFile } from '../utils/files';

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
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download asset: ${response.status} ${url}`);
  }

  const outputPath = path.join(outputDir, uniqueFile(label, extension));
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(outputPath, buffer);
  return outputPath;
};
