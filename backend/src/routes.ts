import fs from 'node:fs/promises';
import path from 'node:path';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import crypto from 'node:crypto';
import express from 'express';
import multer from 'multer';
import IORedis from 'ioredis';
import mime from 'mime-types';
import { CreditLedger } from './models/CreditLedger';
import { VideoJob } from './models/VideoJob';
import { config } from './config';
import { videoQueue } from './queue';
import { ensureDir, fileExists, relativeFrom, uniqueFile } from './utils/files';
import { getJobChannel } from './services/jobProgressService';
import { trimVideo } from './services/renderService';
import { uploadAsset } from './services/storageService';
import { processGenerationJob } from './services/jobOrchestrator';
import { localJobEvents } from './services/localEventBus';
import { checkAndConsumeCredits } from './middleware/creditMiddleware';
import {
  activatePremiumSubscription,
  addPurchasedCredits,
  cancelPremiumSubscription,
  getUserCreditState,
  refundGenerationCredit,
} from './services/userCreditService';
import { getBillingConfig, getStripeClient, resolveCreditPack } from './services/paymentService';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { protect } = require('./middleware/authMiddleware');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createRateLimiter } = require('./middleware/rateLimitMiddleware');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const UserModel = require('./models/User');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const generationLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 12,
  message: 'Too many generation requests. Please wait a minute and try again.',
});
const billingLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Too many billing requests. Please wait and try again.',
});

const validateGenerationRequest = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const description = String(req.body.description || '').trim();
  const style = String(req.body.style || '').trim();

  if (!description || !style) {
    res.status(400).json({ message: 'Description and style are required.' });
    return;
  }

  next();
};

const resolveOutputMode = (req: express.Request, forcedOutputMode?: 'video' | 'image') =>
  forcedOutputMode || (String(req.body.outputMode || 'video').trim() === 'image' ? 'image' : 'video');

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', project: 'AI Marketing Studio MVP' });
});

router.get('/user/credits', protect, async (req, res, next) => {
  try {
    const credits = await getUserCreditState(req.user!.userId);
    res.json({ data: credits, billing: getBillingConfig() });
  } catch (error) {
    next(error);
  }
});

router.post('/user/consume-credit', protect, checkAndConsumeCredits, async (req, res) => {
  res.status(200).json({
    consumed: true,
    data: req.creditUsage?.state,
    source: req.creditUsage?.source,
  });
});

router.post('/payments/create-checkout-session', protect, billingLimiter, async (req, res, next) => {
  try {
    const stripe = getStripeClient();
    const userId = req.user!.userId;
    const mode = String(req.body.mode || 'credits') as 'credits' | 'subscription';
    const user = await getUserCreditState(userId);

    if (mode === 'subscription') {
      if (!config.stripePremiumPriceId) {
        res.status(500).json({ message: 'Premium Stripe price id is not configured.' });
        return;
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        success_url: config.stripeCheckoutSuccessUrl,
        cancel_url: config.stripeCheckoutCancelUrl,
        line_items: [{ price: config.stripePremiumPriceId, quantity: 1 }],
        metadata: {
          userId,
          checkoutMode: 'subscription',
        },
        customer_email: (req.body.email as string | undefined) || undefined,
      });

      res.status(201).json({ data: { id: session.id, url: session.url } });
      return;
    }

    const packSize = Number(req.body.pack || 10);
    const pack = resolveCreditPack(packSize);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: config.stripeCheckoutSuccessUrl,
      cancel_url: config.stripeCheckoutCancelUrl,
      line_items: [{ price: pack.priceId, quantity: 1 }],
      metadata: {
        userId,
        checkoutMode: 'credits',
        credits: String(pack.credits),
      },
      customer_email: (req.body.email as string | undefined) || undefined,
    });

    res.status(201).json({
      data: {
        id: session.id,
        url: session.url,
        currentCredits: user,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/payments/webhook', billingLimiter, async (req, res, next) => {
  try {
    const stripe = getStripeClient();
    const signature = req.headers['stripe-signature'];
    const webhookSecret = config.stripeWebhookSecret;
    if (!webhookSecret) {
      res.status(500).json({ message: 'Stripe webhook secret is not configured.' });
      return;
    }

    if (!signature || typeof signature !== 'string') {
      res.status(400).json({ message: 'Missing Stripe signature.' });
      return;
    }

    const payload = req.rawBody;
    if (!payload) {
      res.status(400).json({ message: 'Missing raw webhook body.' });
      return;
    }

    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const checkoutMode = session.metadata?.checkoutMode;
      const existingEvent = await CreditLedger.findOne({
        'metadata.stripeSessionId': session.id,
      })
        .select('_id')
        .lean();

      if (existingEvent) {
        res.status(200).json({ received: true, ignored: 'already_processed' });
        return;
      }

      if (!userId) {
        res.status(200).json({ received: true, ignored: 'missing_user_id' });
        return;
      }

      if (checkoutMode === 'subscription') {
        await activatePremiumSubscription({
          userId,
          stripeCustomerId: typeof session.customer === 'string' ? session.customer : undefined,
          stripeSubscriptionId:
            typeof session.subscription === 'string' ? session.subscription : undefined,
          stripeSessionId: session.id,
        });
      } else {
        const credits = Number(session.metadata?.credits || 0);
        if (credits > 0) {
          await addPurchasedCredits({
            userId,
            credits,
            stripeSessionId: session.id,
            stripeCustomerId: typeof session.customer === 'string' ? session.customer : undefined,
          });
        }
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      if (typeof subscription.id === 'string') {
        const user = await UserModel
          .findOne({ stripeSubscriptionId: subscription.id })
          .select('_id')
          .lean();

        if (user?._id) {
          await cancelPremiumSubscription({
            userId: String(user._id),
            stripeSubscriptionId: subscription.id,
          });
        }
      }
    }

    res.json({ received: true });
  } catch (error: any) {
    if (error?.type === 'StripeSignatureVerificationError') {
      res.status(400).json({ message: `Webhook signature verification failed: ${error.message}` });
      return;
    }

    next(error);
  }
});

router.get('/jobs', protect, async (req, res, next) => {
  try {
    const jobs = await VideoJob.find({ userId: req.user!.userId }).sort({ createdAt: -1 }).limit(12).lean();
    res.json({ data: jobs });
  } catch (error) {
    next(error);
  }
});

const enqueueGenerationJob =
  (forcedOutputMode?: 'video' | 'image') =>
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    let createdJobId = '';
    try {
      const description = String(req.body.description || '').trim();
      const style = String(req.body.style || '').trim();
      const productCategory = String(req.body.productCategory || 'general-product').trim();
      const enableStyleTransfer = String(req.body.enableStyleTransfer || 'false') === 'true';
      const outputMode = resolveOutputMode(req, forcedOutputMode);

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

      const creditUsage = req.creditUsage;
      const premiumPriority = creditUsage?.state.role === 'premium' ? 1 : 10;
      const requestId = String(req.headers['x-request-id'] || crypto.randomUUID());

      const job = await VideoJob.create({
        userId: req.user!.userId,
        description,
        productCategory,
        style,
        enableStyleTransfer,
        outputMode,
        imagePath,
        imageUrl,
        message: req.file
          ? `Queued for ${outputMode === 'image' ? 'image' : 'video'} generation.`
          : `Queued for ${outputMode === 'image' ? 'image' : 'video'} generation from product description only.`,
        output: {
          trim: {
            startSeconds: 0,
            endSeconds: 0,
          },
        },
        metadata: {
          creditSource: creditUsage?.source,
          creditRequestId: requestId,
        },
      });
      createdJobId = String(job._id);

      if (config.queueMode === 'bullmq' && videoQueue) {
        const queueJob = await videoQueue.add(
          'generate-video',
          {
            jobId: String(job._id),
            userId: req.user!.userId,
            credit: {
              source: creditUsage?.source || 'wallet',
              outputMode,
            },
          },
          {
            removeOnComplete: 100,
            removeOnFail: 100,
            attempts: 2,
            priority: premiumPriority,
          }
        );

        job.metadata = {
          ...(job.metadata || {}),
          queueJobId: String(queueJob.id),
          queuePriority: premiumPriority,
        };
      } else {
        job.metadata = {
          ...(job.metadata || {}),
          queueJobId: 'inline',
          queuePriority: premiumPriority,
        };
        setImmediate(() => {
          processGenerationJob(String(job._id)).catch(async (error) => {
            if (creditUsage?.source) {
              await refundGenerationCredit({
                userId: req.user!.userId,
                source: creditUsage.source,
                reason: 'inline_job_failed',
                jobId: String(job._id),
              });
            }
            await VideoJob.findByIdAndUpdate(job._id, {
              status: 'failed',
              stage: 'failed',
              progress: 100,
              message: 'Generation failed.',
              error: error.message || 'Unknown inline processing error.',
            });
            localJobEvents.emit(getJobChannel(String(job._id)), {
              status: 'failed',
              stage: 'failed',
              progress: 100,
              message: 'Generation failed.',
              error: error.message || 'Unknown inline processing error.',
            });
          });
        });
      }

      await job.save();

      res.status(201).json({
        data: job,
        credits: req.creditUsage?.state,
      });
    } catch (error) {
      if (req.creditUsage?.consumed) {
        await refundGenerationCredit({
          userId: req.user!.userId,
          source: req.creditUsage.source,
          reason: 'job_creation_failed',
          jobId: createdJobId || undefined,
        });
      }
      next(error);
    }
  };

router.post(
  '/jobs',
  protect,
  generationLimiter,
  upload.single('image'),
  validateGenerationRequest,
  checkAndConsumeCredits,
  enqueueGenerationJob()
);

router.post(
  '/generate/video',
  protect,
  generationLimiter,
  upload.single('image'),
  validateGenerationRequest,
  checkAndConsumeCredits,
  enqueueGenerationJob('video')
);

router.post(
  '/generate/photo',
  protect,
  generationLimiter,
  upload.single('image'),
  validateGenerationRequest,
  checkAndConsumeCredits,
  enqueueGenerationJob('image')
);

router.get('/jobs/:jobId', protect, async (req, res, next) => {
  try {
    const job = await VideoJob.findOne({ _id: req.params.jobId, userId: req.user!.userId }).lean();
    if (!job) {
      res.status(404).json({ message: 'Job not found.' });
      return;
    }

    res.json({ data: job });
  } catch (error) {
    next(error);
  }
});

router.get('/jobs/:jobId/events', protect, async (req, res, next) => {
  const { jobId } = req.params;
  const subscriber =
    config.queueMode === 'bullmq'
      ? new IORedis(config.redisUrl, {
          maxRetriesPerRequest: null
        })
      : null;

  try {
    const job = await VideoJob.findOne({ _id: jobId, userId: req.user!.userId }).lean();
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

router.post('/jobs/:jobId/trim', protect, async (req, res, next) => {
  try {
    const startSeconds = Number(req.body.startSeconds || 0);
    const endSeconds = Number(req.body.endSeconds || 0);
    const job = await VideoJob.findOne({ _id: req.params.jobId, userId: req.user!.userId });

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

router.delete('/jobs/:jobId', protect, async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = await VideoJob.findOne({ _id: jobId, userId: req.user!.userId });
    
    if (!job) {
      res.status(404).json({ message: 'Job not found.' });
      return;
    }

    // Delete associated files if they exist
    if (job.imagePath) {
      try {
        await fs.unlink(job.imagePath);
      } catch {
        // File may not exist, continue anyway
      }
    }
    if (job.output?.video?.path) {
      try {
        await fs.unlink(job.output.video.path);
      } catch {
        // File may not exist, continue anyway
      }
    }
    if (job.output?.preview?.path) {
      try {
        await fs.unlink(job.output.preview.path);
      } catch {
        // File may not exist, continue anyway
      }
    }
    if (job.output?.image?.path) {
      try {
        await fs.unlink(job.output.image.path);
      } catch {
        // File may not exist, continue anyway
      }
    }

    await VideoJob.deleteOne({ _id: jobId });
    res.json({ message: 'Job deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

export default router;
