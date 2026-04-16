import IORedis from 'ioredis';
import { Queue } from 'bullmq';
import { config } from './config';

const createRedisClient = (label: string) => {
  let hasReportedFailure = false;

  const client = new IORedis(config.redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    enableOfflineQueue: false,
  });

  client.on('error', (error) => {
    if (!hasReportedFailure) {
      console.error(`Redis ${label} connection failed: ${error.message}`);
      hasReportedFailure = true;
    }
  });

  client.on('ready', () => {
    hasReportedFailure = false;
  });

  return client;
};

export const redisConnection = config.queueMode === 'bullmq' ? createRedisClient('queue') : null;
export const progressPublisher = config.queueMode === 'bullmq' ? createRedisClient('publisher') : null;

export const VIDEO_QUEUE_NAME = 'video-generation';

export const videoQueue =
  config.queueMode === 'bullmq' && redisConnection
    ? new Queue(VIDEO_QUEUE_NAME, {
        connection: redisConnection,
      })
    : null;

export const ensureRedisConnection = async () => {
  if (!redisConnection || !progressPublisher) {
    return;
  }

  await Promise.all([redisConnection.connect(), progressPublisher.connect()]);
  await Promise.all([redisConnection.ping(), progressPublisher.ping()]);
};

export const closeRedisConnections = async () => {
  const closers = [];

  if (redisConnection) {
    closers.push(redisConnection.quit());
  }

  if (progressPublisher) {
    closers.push(progressPublisher.quit());
  }

  await Promise.allSettled(closers);
};
