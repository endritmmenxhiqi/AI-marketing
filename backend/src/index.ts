import { createServer } from 'node:http';
import { connectDatabase } from './db';
import { config, requiredAtBoot } from './config';
import { ensureDir } from './utils/files';
import { createApp } from './app';
import { closeRedisConnections, ensureRedisConnection } from './queue';

const boot = async () => {
  requiredAtBoot.forEach((key) => {
    if (!process.env[key]) {
      console.warn(`Missing required environment variable: ${key}`);
    }
  });

  await Promise.all([
    ensureDir(config.uploadsDir),
    ensureDir(config.workingDir),
    ensureDir(config.cacheDir),
    ensureDir(config.outputDir)
  ]);
  if (config.queueMode === 'bullmq') {
    await ensureRedisConnection();
  }
  await connectDatabase();

  const app = createApp();
  const server = createServer(app);

  server.listen(config.port, () => {
    console.log(`AI Marketing Studio backend listening on ${config.appUrl}`);
  });
};

boot().catch(async (error) => {
  console.error(error);
  if (config.queueMode === 'bullmq') {
    await closeRedisConnections();
  }
  process.exit(1);
});
