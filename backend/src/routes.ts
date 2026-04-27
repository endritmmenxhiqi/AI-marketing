import fs from 'node:fs/promises';
import path from 'node:path';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import express from 'express';
import multer from 'multer';
import IORedis from 'ioredis';
import mime from 'mime-types';
import mongoose from 'mongoose';
import { VideoJob } from './models/VideoJob';
import { PhotoAd } from './models/PhotoAd';
import { config } from './config';
import { videoQueue } from './queue';
import { ensureDir, fileExists, relativeFrom, slugify, uniqueFile } from './utils/files';
import { mergeJobMetadata } from './utils/jobMetadata';
import { getJobChannel } from './services/jobProgressService';
import { trimVideo } from './services/renderService';
import { uploadAsset } from './services/storageService';
import { processVideoJob } from './services/jobOrchestrator';
import { localJobEvents } from './services/localEventBus';
import { AuthenticatedRequest, getAuthenticatedUserId, requireAuth } from './auth';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const defaultJobListLimit = 12;
const maximumJobListLimit = 50;

type AuthenticatedUploadRequest = AuthenticatedRequest & {
  file?: Express.Multer.File;
  files?: Express.Multer.File[] | Record<string, Express.Multer.File[]>;
};

const parseLimit = (value: unknown) => {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return defaultJobListLimit;
  }

  return Math.max(1, Math.min(Math.floor(parsed), maximumJobListLimit));
};

const readSingleParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] || '' : value || '';

const getOwnedJobFilter = (ownerId: string, jobId: string) => {
  if (!mongoose.isValidObjectId(jobId)) {
    return null;
  }

  return {
    _id: jobId,
    owner: ownerId
  };
};

const getOwnedPhotoAdFilter = (ownerId: string, photoAdId: string) => {
  if (!mongoose.isValidObjectId(photoAdId)) {
    return null;
  }

  return {
    _id: photoAdId,
    owner: ownerId
  };
};

const sanitizeStorageAsset = <T extends Record<string, unknown> | null | undefined>(asset: T) => {
  if (!asset) {
    return asset;
  }

  const { localPath: _localPath, ...rest } = asset;
  return rest;
};

const sanitizeJob = (job: any) => {
  if (!job) {
    return job;
  }

  const plainJob = typeof job.toObject === 'function' ? job.toObject() : { ...job };
  delete plainJob.owner;
  delete plainJob.imagePath;
  delete plainJob.secondaryImagePath;

  if (plainJob.metadata) {
    delete plainJob.metadata.jobFolder;
  }

  if (plainJob.output) {
    plainJob.output.video = sanitizeStorageAsset(plainJob.output.video);
    plainJob.output.preview = sanitizeStorageAsset(plainJob.output.preview);
    plainJob.output.voiceover = sanitizeStorageAsset(plainJob.output.voiceover);
    plainJob.output.sceneFiles = Array.isArray(plainJob.output.sceneFiles)
      ? plainJob.output.sceneFiles.map((asset: Record<string, unknown>) => sanitizeStorageAsset(asset))
      : [];

    if (plainJob.output.trim) {
      plainJob.output.trim = {
        ...plainJob.output.trim,
        asset: sanitizeStorageAsset(plainJob.output.trim.asset)
      };
    }
  }

  if (plainJob.script?.scenes) {
    plainJob.script.scenes = plainJob.script.scenes.map((scene: Record<string, unknown>) => {
      const nextScene = { ...scene };
      delete nextScene.voicePath;

      if (nextScene.media && typeof nextScene.media === 'object') {
        nextScene.media = sanitizeStorageAsset(nextScene.media as Record<string, unknown>);
      }

      return nextScene;
    });
  }

  return plainJob;
};

const sanitizePhotoAd = (photoAd: any) => {
  if (!photoAd) {
    return photoAd;
  }

  const plainPhotoAd = typeof photoAd.toObject === 'function' ? photoAd.toObject() : { ...photoAd };
  delete plainPhotoAd.owner;

  plainPhotoAd.images = Array.isArray(plainPhotoAd.images)
    ? plainPhotoAd.images.map((asset: Record<string, unknown>) => sanitizeStorageAsset(asset))
    : [];

  return plainPhotoAd;
};

const dataUrlPattern = /^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i;

const decodeImageDataUrl = (dataUrl: string) => {
  const match = dataUrlPattern.exec(dataUrl.trim());
  if (!match) {
    return null;
  }

  const mimeType = match[1].toLowerCase();
  const base64Payload = match[2];
  const extension = mime.extension(mimeType) || (mimeType === 'image/jpeg' ? 'jpg' : 'png');

  return {
    mimeType,
    extension,
    buffer: Buffer.from(base64Payload, 'base64')
  };
};

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', project: 'AI Marketing Studio MVP' });
});

router.get('/jobs', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const jobs = await VideoJob.find({ owner: userId })
      .sort({ createdAt: -1 })
      .limit(parseLimit(req.query.limit))
      .lean();
    res.json({ data: jobs.map((job) => sanitizeJob(job)) });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/jobs',
  requireAuth,
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'secondaryImage', maxCount: 1 }
  ]),
  async (req: AuthenticatedUploadRequest, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const description = String(req.body.description || '').trim();
    const style = String(req.body.style || '').trim();
    const productCategory = String(req.body.productCategory || 'general-product').trim();
    const enableStyleTransfer = String(req.body.enableStyleTransfer || 'false') === 'true';

    if (!description || !style) {
      res.status(400).json({ message: 'Description and style are required.' });
      return;
    }

    const uploadedFiles = !Array.isArray(req.files) && req.files ? req.files : {};
    const primaryFile = uploadedFiles.image?.[0];
    const secondaryFile = uploadedFiles.secondaryImage?.[0];
    const saveProductImage = async (file: Express.Multer.File, label: string) => {
      await ensureDir(config.uploadsDir);
      const extension =
        mime.extension(file.mimetype || '') ||
        path.extname(file.originalname).replace(/^\./, '') ||
        'png';
      const imageFileName = uniqueFile(label, extension);
      const imagePath = path.join(config.uploadsDir, imageFileName);
      await fs.writeFile(imagePath, file.buffer);
      return {
        path: imagePath,
        url: `${config.appUrl}/storage/uploads/${imageFileName}`
      };
    };

    const primaryImage = primaryFile ? await saveProductImage(primaryFile, 'product-image-1') : null;
    const secondaryImage = secondaryFile ? await saveProductImage(secondaryFile, 'product-image-2') : null;
    const imagePath = primaryImage?.path || secondaryImage?.path || '';
    const imageUrl = primaryImage?.url || secondaryImage?.url || '';
    const secondaryImagePath = primaryImage ? secondaryImage?.path || '' : '';
    const secondaryImageUrl = primaryImage ? secondaryImage?.url || '' : '';

    const job = await VideoJob.create({
      owner: userId,
      description,
      productCategory,
      style,
      enableStyleTransfer,
      imagePath,
      imageUrl,
      secondaryImagePath,
      secondaryImageUrl,
      message: primaryFile || secondaryFile
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

      job.metadata = mergeJobMetadata(job.metadata, {
        queueJobId: String(queueJob.id)
      });
    } else {
      job.metadata = mergeJobMetadata(job.metadata, {
        queueJobId: 'inline'
      });
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

    res.status(201).json({ data: sanitizeJob(job) });
  } catch (error) {
    next(error);
  }
});

router.get('/jobs/:jobId', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const filter = getOwnedJobFilter(userId, readSingleParam(req.params.jobId));
    const job = filter ? await VideoJob.findOne(filter).lean() : null;
    if (!job) {
      res.status(404).json({ message: 'Job not found.' });
      return;
    }

    res.json({ data: sanitizeJob(job) });
  } catch (error) {
    next(error);
  }
});

router.get('/photo-ads', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const photoAds = await PhotoAd.find({ owner: userId })
      .sort({ createdAt: -1 })
      .limit(parseLimit(req.query.limit))
      .lean();
    res.json({ data: photoAds.map((photoAd) => sanitizePhotoAd(photoAd)) });
  } catch (error) {
    next(error);
  }
});

router.post('/photo-ads', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const title = String(req.body.title || '').trim();
    const prompt = String(req.body.prompt || '').trim();
    const aspectRatio = String(req.body.aspectRatio || '1:1').trim();
    const productCategory = String(req.body.productCategory || 'general-product').trim();
    const style = String(req.body.style || 'minimal').trim();
    const source = String(req.body.source || 'puter').trim();
    const imageDataUrls = Array.isArray(req.body.imageDataUrls) ? req.body.imageDataUrls : [];

    if (!title || !prompt) {
      res.status(400).json({ message: 'Photo ad title and prompt are required.' });
      return;
    }

    if (!imageDataUrls.length) {
      res.status(400).json({ message: 'At least one generated image is required.' });
      return;
    }

    const photoAd = new PhotoAd({
      owner: userId,
      title,
      prompt,
      aspectRatio,
      productCategory,
      style,
      source,
      images: []
    });

    const tempDir = path.join(config.workingDir, 'photo-ads', String(photoAd._id));
    await ensureDir(tempDir);

    const uploadedImages = [];

    for (let index = 0; index < imageDataUrls.length; index += 1) {
      const rawDataUrl = String(imageDataUrls[index] || '');
      const decoded = decodeImageDataUrl(rawDataUrl);
      if (!decoded) {
        res.status(400).json({ message: `Image ${index + 1} is not a supported image data URL.` });
        return;
      }

      const tempFilePath = path.join(tempDir, uniqueFile(`photo-${index + 1}`, decoded.extension));
      await fs.writeFile(tempFilePath, decoded.buffer);

      const assetKey = `${photoAd._id}/images/${String(index + 1).padStart(2, '0')}-${slugify(title)}.${decoded.extension}`;
      const uploadedAsset = await uploadAsset(tempFilePath, assetKey);
      await fs.unlink(tempFilePath).catch(() => undefined);
      uploadedImages.push(uploadedAsset);
    }

    photoAd.images = uploadedImages;
    await photoAd.save();

    res.status(201).json({ data: sanitizePhotoAd(photoAd) });
  } catch (error) {
    next(error);
  }
});

router.get('/photo-ads/:photoAdId', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const filter = getOwnedPhotoAdFilter(userId, readSingleParam(req.params.photoAdId));
    const photoAd = filter ? await PhotoAd.findOne(filter).lean() : null;

    if (!photoAd) {
      res.status(404).json({ message: 'Photo ad set not found.' });
      return;
    }

    res.json({ data: sanitizePhotoAd(photoAd) });
  } catch (error) {
    next(error);
  }
});

router.get('/jobs/:jobId/events', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  const jobId = readSingleParam(req.params.jobId);
  const subscriber =
    config.queueMode === 'bullmq'
      ? new IORedis(config.redisUrl, {
          maxRetriesPerRequest: null
        })
      : null;

  try {
    const userId = getAuthenticatedUserId(req);
    const filter = getOwnedJobFilter(userId, jobId);
    const job = filter ? await VideoJob.findOne(filter).lean() : null;
    if (!job) {
      res.status(404).json({ message: 'Job not found.' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    res.write(`data: ${JSON.stringify(sanitizeJob(job))}\n\n`);

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

router.post('/jobs/:jobId/trim', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const startSeconds = Number(req.body.startSeconds || 0);
    const endSeconds = Number(req.body.endSeconds || 0);
    const filter = getOwnedJobFilter(userId, readSingleParam(req.params.jobId));
    const job = filter ? await VideoJob.findOne(filter) : null;

    if (!job || (!job.output?.video?.localPath && !job.output?.video?.url)) {
      res.status(404).json({ message: 'Rendered video not found for this job.' });
      return;
    }

    const jobDir = path.join(config.workingDir, String(job._id));
    await ensureDir(jobDir);

    let sourcePath = job.output?.video?.localPath || '';
    if (!sourcePath || !(await fileExists(sourcePath))) {
      const sourceUrl = job.output?.video?.url || '';
      if (!sourceUrl) {
        res.status(404).json({ message: 'Rendered video not found for this job.' });
        return;
      }

      const downloadPath = path.join(jobDir, 'source-for-trim.mp4');
      const response = await fetch(sourceUrl);
      if (!response.ok || !response.body) {
        res
          .status(502)
          .json({ message: `Unable to download source video for trimming (${response.status}).` });
        return;
      }

      await pipeline(Readable.fromWeb(response.body as any), createWriteStream(downloadPath));
      job.output.video = {
        ...(job.output.video || {}),
        localPath: downloadPath
      };
      await job.save();
      sourcePath = downloadPath;
    }

    const safeStart = Math.max(0, Number.isFinite(startSeconds) ? startSeconds : 0);
    const safeEnd = Math.max(0, Number.isFinite(endSeconds) ? endSeconds : 0);
    const fileName = `trim-${Math.round(safeStart * 100)}-${Math.round(safeEnd * 100)}-${Date.now()}.mp4`;
    const trimOutputPath = path.join(jobDir, fileName);
    const trimmed = await trimVideo({
      sourcePath,
      startSeconds: safeStart,
      endSeconds: safeEnd,
      outputPath: trimOutputPath
    });

    const trimAsset = await uploadAsset(trimmed.outputPath, `${job._id}/final/${fileName}`);
    job.output.trim = {
      startSeconds: trimmed.startSeconds,
      endSeconds: trimmed.endSeconds,
      asset: trimAsset
    };
    await job.save();

    res.json({
      data: {
        trim: job.output.trim,
        relativePath: relativeFrom(config.rootDir, trimmed.outputPath)
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
