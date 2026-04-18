import fs from 'node:fs/promises';
import path from 'node:path';
import { PhotoJob } from '../models/PhotoJob';
import { config } from '../config';
import { ensureDir, uniqueFile } from '../utils/files';
import { sleep } from '../utils/sleep';
import { publishJobProgress } from './jobProgressService';

// AI Horde Constants (Anonymous Mode)
const HORDE_API_URL = 'https://aihorde.net/api/v2';
const HORDE_ANONYMOUS_KEY = '0000000000';

/**
 * Downloads a remote image with retry logic for network resilience.
 */
const saveRemoteImage = async (url: string, outputDir: string, label: string, retries = 3): Promise<string> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[PhotoJob] Download attempt ${attempt}/${retries} for ${label}: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
         throw new Error(`Server returned ${response.status} ${response.statusText}`);
      }
      const extension = 'png';
      const outputPath = path.join(outputDir, uniqueFile(label, extension));
      const buffer = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(outputPath, buffer);
      return outputPath;
    } catch (err: any) {
      console.warn(`[PhotoJob] Download attempt ${attempt} failed: ${err.message}`);
      if (attempt === retries) throw err;
      // Wait before retrying (backoff)
      await sleep(2000 * attempt);
    }
  }
  throw new Error('All download attempts failed.');
};

const generatePhotoDesignPrompt = async (description: string, style: string, category: string, isRedesign: boolean) => {
  const prompt = `Act as a high-end commercial photographer and art director. 
  Generate a professional "Visual Brief" and "AI Image Prompt" for a marketing photo.
  Product: ${description}
  Category: ${category}
  Creative Style: ${style}
  Task: ${isRedesign ? 'Redesign environment while keeping product recognizable.' : 'Create fresh marketing photo.'}
  Requirements: 8k commercial photography, premium lighting, cinematic composition. NO TEXT.
  Return ONLY a JSON object with the key: "imagePrompt".`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openAiApiKey}`,
    },
    body: JSON.stringify({
      model: config.openAiModel,
      messages: [{ role: 'system', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 800
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenRouter Error:', errorText);
    throw new Error('Art Direction failed (Check OpenRouter credits).');
  }
  
  const data = await response.json();
  const content = JSON.parse(data.choices[0].message.content);
  return content.imagePrompt as string;
};

const generateWithAIHorde = async (prompt: string, sourceImageBase64: string, modelType: string) => {
  const response = await fetch(`${HORDE_API_URL}/generate/async`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: HORDE_ANONYMOUS_KEY },
    body: JSON.stringify({
      prompt: `${prompt}, professional commercial photography, 8k, masterpiece, highly detailed`,
      source_image: sourceImageBase64,
      source_processing: 'img2img',
      params: { n: 3, steps: 20, denoising_strength: 0.6, cfg_scale: 7.5, width: 512, height: 512, sampler_name: 'k_euler_a' },
      models: modelType === 'sdxl' ? ['SDXL_1.0'] : ['stable_diffusion']
    })
  });

  if (!response.ok) throw new Error(`AI Horde rejected: ${await response.text()}`);
  const { id } = await response.json();

  let finished = false;
  let attempts = 0;
  while (!finished && attempts < 120) {
    await sleep(3000);
    const checkRes = await fetch(`${HORDE_API_URL}/generate/check/${id}`);
    const checkData = await checkRes.json();
    if (checkData.done) { finished = true; break; }
    attempts++;
  }

  if (!finished) throw new Error('AI Horde task timed out.');

  const statusRes = await fetch(`${HORDE_API_URL}/generate/status/${id}`);
  const statusData = await statusRes.json();
  if (statusData.faulted) throw new Error('AI Horde job failed during processing.');
  
  return statusData.generations.map((g: any) => g.img);
};

export const processPhotoJob = async (jobId: string) => {
  const job = await PhotoJob.findById(jobId);
  if (!job) return;

  const jobDir = path.join(config.workingDir, `photo-${job._id}`);
  await ensureDir(jobDir);
  job.metadata = { ...(job.metadata || {}), jobFolder: jobDir, startedAt: new Date() };

  try {
    const isRedesign = job.source === 'upload' && !!job.imagePath;
    await publishJobProgress(jobId, { status: 'processing', stage: 'writing-brief', progress: 10, message: 'Step 1: Analyzing and Art Direction...' });
    
    // 1. Generate Art Direction
    const enhancedPrompt = await generatePhotoDesignPrompt(job.description, job.style, job.productCategory, isRedesign);
    job.prompt = enhancedPrompt;
    await job.save();

    await publishJobProgress(jobId, { status: 'processing', stage: 'generating-design', progress: 40, message: 'Step 2: AI Painting (Retries enabled)...' });

    let variants = [];

    if (isRedesign) {
      const imageBuffer = await fs.readFile(job.imagePath);
      const base64 = imageBuffer.toString('base64');
      const outputImages = await generateWithAIHorde(enhancedPrompt, base64, 'sd');
      
      for (const [i, imgUrl] of outputImages.entries()) {
        try {
          const localPath = await saveRemoteImage(imgUrl, jobDir, `variant-${i + 1}`);
          const fileName = path.basename(localPath);
          variants.push({ 
            url: `${config.backendUrl}/storage/work/photo-${job._id}/${fileName}`, 
            localPath, 
            provider: 'aihorde', 
            key: `photo/${job._id}/${fileName}` 
          });
        } catch (err: any) {
          console.error(`[PhotoJob] Failing variant ${i+1}:`, err.message);
        }
      }
    } else {
      for (let i = 0; i < 3; i++) {
        const seed = Math.floor(Math.random() * 100000);
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?seed=${seed}&width=1024&height=1024&nologo=true`;
        try {
          const localPath = await saveRemoteImage(url, jobDir, `variant-${i + 1}`);
          const fileName = path.basename(localPath);
          variants.push({ 
            url: `${config.backendUrl}/storage/work/photo-${job._id}/${fileName}`, 
            localPath, 
            provider: 'pollinations', 
            key: `photo/${job._id}/${fileName}` 
          });
        } catch (err: any) {
          console.error(`[PhotoJob] Failing variant ${i+1}:`, err.message);
        }
      }
    }

    if (variants.length === 0) {
      throw new Error('Connection Issue: Failed to download images from AI engine. Please check your internet connection.');
    }

    job.output = { ...job.output, variants };
    job.status = 'completed';
    job.progress = 100;
    job.message = 'Success! Professional photos are ready.';
    await job.save();

    await publishJobProgress(jobId, {
      status: 'completed',
      progress: 100,
      message: 'Success! Professional photos are ready.',
      variants: job.output.variants
    });

  } catch (error: any) {
    console.error('Photo Orchestrator Failure:', error.message);
    job.status = 'failed';
    job.error = error.message;
    await job.save();
    await publishJobProgress(jobId, { status: 'failed', progress: 0, message: `Error: ${error.message}` });
  }
};
