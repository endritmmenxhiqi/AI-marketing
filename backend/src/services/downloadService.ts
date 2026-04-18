import fs from 'node:fs/promises';
import path from 'node:path';
import { ensureDir, uniqueFile } from '../utils/files';

export const downloadToFile = async ({
  url,
  outputDir,
  label,
  extension,
  retries = 3
}: {
  url: string;
  outputDir: string;
  label: string;
  extension: string;
  retries?: number;
}) => {
  await ensureDir(outputDir);
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[Download] Attempt ${attempt}/${retries} for ${label}: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download asset: ${response.status} ${url}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const outputPath = path.join(outputDir, uniqueFile(label, extension));
      await fs.writeFile(outputPath, buffer);
      return outputPath;
    } catch (error: any) {
      if (attempt === retries) throw error;
      console.warn(`[Download] Attempt ${attempt} failed: ${error.message}. Retrying in 2s...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  throw new Error('Download failed after multiple attempts.');
};
