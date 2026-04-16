import { progressPublisher } from '../queue';
import { VideoJob } from '../models/VideoJob';
import { JobProgressPayload } from '../types';
import { config } from '../config';
import { localJobEvents } from './localEventBus';

const channelForJob = (jobId: string) => `job-progress:${jobId}`;

export const publishJobProgress = async (jobId: string, payload: JobProgressPayload) => {
  await VideoJob.findByIdAndUpdate(jobId, {
    status: payload.status,
    stage: payload.stage,
    progress: payload.progress,
    message: payload.message,
    error: payload.error || '',
    ...(payload.videoUrl ? { 'output.video.url': payload.videoUrl } : {}),
    ...(payload.previewUrl ? { 'output.preview.url': payload.previewUrl } : {}),
    ...(payload.trimUrl ? { 'output.trim.asset.url': payload.trimUrl } : {}),
  });

  localJobEvents.emit(channelForJob(jobId), payload);

  if (config.queueMode === 'bullmq' && progressPublisher) {
    await progressPublisher.publish(channelForJob(jobId), JSON.stringify(payload));
  }
};

export const getJobChannel = channelForJob;
