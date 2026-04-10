import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import IORedis from 'ioredis';
import mime from 'mime-types';
import { VideoJob } from './models/VideoJob';
import { config } from './config';
import { videoQueue } from './queue';
import { ensureDir, relativeFrom, uniqueFile } from './utils/files';
import { getJobChannel } from './services/jobProgressService';
import { trimVideo } from './services/renderService';
import { uploadAsset } from './services/storageService';
import { processVideoJob } from './services/jobOrchestrator';
import { localJobEvents } from './services/localEventBus';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', project: 'AI Marketing Studio MVP' });
});

router.get('/jobs', async (_req, res, next) => {
  try {
    const jobs = await VideoJob.find().sort({ createdAt: -1 }).limit(12).lean();
    res.json({ data: jobs });
  } catch (error) {
    next(error);
  }
});

router.post('/jobs', upload.single('image'), async (req, res, next) => {
  try {
    const description = String(req.body.description || '').trim();
    const style = String(req.body.style || '').trim();
    const productCategory = String(req.body.productCategory || 'general-product').trim();
    const enableStyleTransfer = String(req.body.enableStyleTransfer || 'false') === 'true';

    if (!description || !style) {
      res.status(400).json({ message: 'Description and style are required.' });
      return;
    }

    let imagePath = '';
    let imageUrl = '';

    if (req.file) {
      await ensureDir(config.uploadsDir);
      const extension =
        mime.extension(req.file.mimetype || '') ||
        path.extname(req.file.originalname).replace(/^\./, '') ||
        'png';
      const imageFileName = uniqueFile('product-image', extension);
      imagePath = path.join(config.uploadsDir, imageFileName);
      await fs.writeFile(imagePath, req.file.buffer);
      imageUrl = `${config.appUrl}/storage/uploads/${imageFileName}`;
    }

    const job = await VideoJob.create({
      description,
      productCategory,
      style,
      enableStyleTransfer,
      imagePath,
      imageUrl,
      message: req.file
        ? 'Queued for generation.'
        : 'Queued for generation from product description only.',
      output: {
        trim: {
          startSeconds: 0,
          endSeconds: 0
        }
      }
    });

    if (config.queueMode === 'bullmq' && videoQueue) {
      const queueJob = await videoQueue.add(
        'generate-video',
        { jobId: String(job._id) },
        {
          removeOnComplete: 100,
          removeOnFail: 100,
          attempts: 2
        }
      );

      job.metadata = {
        ...(job.metadata || {}),
        queueJobId: String(queueJob.id)
      };
    } else {
      job.metadata = {
        ...(job.metadata || {}),
        queueJobId: 'inline'
      };
      setImmediate(() => {
        processVideoJob(String(job._id)).catch(async (error) => {
          await VideoJob.findByIdAndUpdate(job._id, {
            status: 'failed',
            stage: 'failed',
            progress: 100,
            message: 'Generation failed.',
            error: error.message || 'Unknown inline processing error.'
          });
          localJobEvents.emit(getJobChannel(String(job._id)), {
            status: 'failed',
            stage: 'failed',
            progress: 100,
            message: 'Generation failed.',
            error: error.message || 'Unknown inline processing error.'
          });
        });
      });
    }

    await job.save();

    res.status(201).json({ data: job });
  } catch (error) {
    next(error);
  }
});

router.get('/jobs/:jobId', async (req, res, next) => {
  try {
    const job = await VideoJob.findById(req.params.jobId).lean();
    if (!job) {
      res.status(404).json({ message: 'Job not found.' });
      return;
    }

    res.json({ data: job });
  } catch (error) {
    next(error);
  }
});

router.get('/jobs/:jobId/events', async (req, res, next) => {
  const { jobId } = req.params;
  const subscriber =
    config.queueMode === 'bullmq'
      ? new IORedis(config.redisUrl, {
          maxRetriesPerRequest: null
        })
      : null;

  try {
    const job = await VideoJob.findById(jobId).lean();
    if (!job) {
      res.status(404).json({ message: 'Job not found.' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    res.write(`data: ${JSON.stringify(job)}\n\n`);

    const channel = getJobChannel(jobId);
    const localHandler = (payload: unknown) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    if (subscriber) {
      await subscriber.subscribe(channel);
      subscriber.on('message', (_channel, payload) => {
        res.write(`data: ${payload}\n\n`);
      });
    } else {
      localJobEvents.on(channel, localHandler);
    }

    const heartbeat = setInterval(() => {
      res.write('event: ping\ndata: {}\n\n');
    }, 15000);

    req.on('close', async () => {
      clearInterval(heartbeat);
      if (subscriber) {
        await subscriber.unsubscribe(channel);
        subscriber.disconnect();
      } else {
        localJobEvents.off(channel, localHandler);
      }
    });
  } catch (error) {
    subscriber?.disconnect();
    next(error);
  }
});

router.post('/jobs/:jobId/trim', async (req, res, next) => {
  try {
    const startSeconds = Number(req.body.startSeconds || 0);
    const endSeconds = Number(req.body.endSeconds || 0);
    const job = await VideoJob.findById(req.params.jobId);

    if (!job || !job.output?.video?.localPath) {
      res.status(404).json({ message: 'Rendered video not found for this job.' });
      return;
    }

    const trimOutputPath = path.join(config.workingDir, String(job._id), 'trimmed.mp4');
    await trimVideo({
      sourcePath: job.output.video.localPath,
      startSeconds,
      endSeconds,
      outputPath: trimOutputPath
    });

    const trimAsset = await uploadAsset(trimOutputPath, `${job._id}/final/trimmed.mp4`);
    job.output.trim = {
      startSeconds,
      endSeconds,
      asset: trimAsset
    };
    await job.save();

    res.json({
      data: {
        trim: job.output.trim,
        relativePath: relativeFrom(config.rootDir, trimOutputPath)
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
