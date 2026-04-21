import path from 'node:path';
import { config } from '../config';
import { fileExists } from '../utils/files';

export const selectBackgroundMusic = async () => {
  const configured = path.isAbsolute(config.localMusicPath)
    ? config.localMusicPath
    : path.join(config.rootDir, config.localMusicPath);

  if (await fileExists(configured)) {
    return { source: 'local', path: configured };
  }

  return { source: 'none', path: '' };
};
