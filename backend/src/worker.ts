import { Worker } from 'bullmq';
import { connectDatabase } from './db';
import { config } from './config';
import { VIDEO_QUEUE_NAME, closeRedisConnections, ensureRedisConnection, redisConnection } from './queue';
import { processGenerationJob } from './services/jobOrchestrator';
import { publishJobProgress } from './services/jobProgressService';
import { refundGenerationCredit } from './services/userCreditService';
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
    async (queueJob) => {
      try {
        return await processGenerationJob(String(queueJob.data.jobId));
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

  worker.on('completed', (job) => {
    console.log(`Completed generation job ${job.data.jobId}`);
  });

  worker.on('failed', async (job, error) => {
    console.error(`Failed generation job ${job?.data?.jobId}:`, error.message);
    if (!job) {
      return;
    }

    const maxAttempts = Number(job.opts.attempts || 1);
    if (job.attemptsMade < maxAttempts) {
      return;
    }

    const source = job.data?.credit?.source;
    const userId = job.data?.userId;
    if (!source || !userId) {
      return;
    }

    try {
      await refundGenerationCredit({
        userId: String(userId),
        source: 'wallet',
        reason: 'worker_job_failed',
        jobId: String(job.data.jobId || ''),
      });
    } catch (refundError: any) {
      console.error(`Unable to refund credits for failed job ${job.data?.jobId}:`, refundError?.message);
    }
  });
};

bootWorker().catch(async (error) => {
  console.error(error);
  await closeRedisConnections();
  process.exit(1);
});
