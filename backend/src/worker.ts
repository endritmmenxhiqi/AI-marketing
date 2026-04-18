import { Worker, Job } from 'bullmq';
import { connectDatabase } from './db';
import { config } from './config';
import { VIDEO_QUEUE_NAME, closeRedisConnections, ensureRedisConnection, redisConnection } from './queue';
import { processVideoJob } from './services/jobOrchestrator';
import { publishJobProgress } from './services/jobProgressService';
import { ensureDir } from './utils/files';

const bootWorker = async () => {
  if (config.queueMode !== 'bullmq') {
    console.log('QUEUE_MODE is inline. Worker is not required in this mode.');
    return;
  }

  if (!redisConnection) {
    throw new Error('Redis connection is not configured for BullMQ mode.');
  }

  await Promise.all([
    ensureDir(config.uploadsDir),
    ensureDir(config.workingDir),
    ensureDir(config.cacheDir),
    ensureDir(config.outputDir)
  ]);
  await ensureRedisConnection();
  await connectDatabase();

  const worker = new Worker(
    VIDEO_QUEUE_NAME,
    async (queueJob: Job) => {
      try {
        return await processVideoJob(String(queueJob.data.jobId));
      } catch (error: any) {
        await publishJobProgress(String(queueJob.data.jobId), {
          status: 'failed',
          stage: 'failed',
          progress: 100,
          message: 'Generation failed.',
          error: error.message || 'Unknown worker error.'
        });
        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: config.jobConcurrency
    }
  );

  worker.on('completed', (job: Job) => {
    console.log(`Completed video job ${job.data.jobId}`);
  });

  worker.on('failed', (job: Job | undefined, error: Error) => {
    console.error(`Failed video job ${job?.data?.jobId}:`, error.message);
  });
};

bootWorker().catch(async (error) => {
  console.error(error);
  await closeRedisConnections();
  process.exit(1);
});
