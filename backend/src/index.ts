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

  if (config.queueMode === 'bullmq' && !process.env.REDIS_URL) {
    console.warn('Missing recommended environment variable: REDIS_URL');
  }

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

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${config.port} is already in use. Please clear it and try again.`);
    } else {
      console.error('Server error:', err);
    }
    process.exit(1);
  });

  server.listen(config.port, () => {
    console.log(`AI Marketing Studio backend listening on ${config.appUrl}`);
  });
};

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

boot().catch(async (error) => {
  console.error('Fatal boot error:', error);
  if (config.queueMode === 'bullmq') {
    await closeRedisConnections();
  }
  // Only exit if the error happened during the actual boot sequence
  if (error.code === 'EADDRINUSE') {
    process.exit(1);
  }
});
