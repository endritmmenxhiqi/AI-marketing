import { progressPublisher } from '../queue';
import { VideoJob } from '../models/VideoJob';
import { PhotoJob } from '../models/PhotoJob';
import { JobProgressPayload } from '../types';
import { config } from '../config';
import { localJobEvents } from './localEventBus';

const channelForJob = (jobId: string) => `job-progress:${jobId}`;

export const publishJobProgress = async (jobId: string, payload: JobProgressPayload) => {
  const updateData: any = {
    status: payload.status,
    stage: payload.stage,
    progress: payload.progress,
    message: payload.message,
    error: payload.error || '',
    ...(payload.videoUrl ? { 'output.video.url': payload.videoUrl } : {}),
    ...(payload.previewUrl ? { 'output.preview.url': payload.previewUrl } : {}),
    ...(payload.trimUrl ? { 'output.trim.asset.url': payload.trimUrl } : {}),
    ...(payload.variants ? { 'output.variants': payload.variants } : {}),
  };

  // Try updating VideoJob first
  let updated = await VideoJob.findByIdAndUpdate(jobId, updateData);
  
  // If not found, try PhotoJob
  if (!updated) {
    updated = await PhotoJob.findByIdAndUpdate(jobId, updateData);
  }

  localJobEvents.emit(channelForJob(jobId), payload);

  if (config.queueMode === 'bullmq' && progressPublisher) {
    await progressPublisher.publish(channelForJob(jobId), JSON.stringify(payload));
  }
};

export const getJobChannel = channelForJob;
