import fs from 'node:fs/promises';
import path from 'node:path';
import { PhotoJob } from '../models/PhotoJob';
import { config } from '../config';
import { ensureDir, uniqueFile } from '../utils/files';
import { sleep } from '../utils/sleep';
import { publishJobProgress } from './jobProgressService';

// Default professional marketing model if none configured
const DEFAULT_SDXL_MODEL = 'stability-ai/sdxl:39ed52f2a78e9340f5e1c1aa9222406f77ad345c81d3656c80d7d91e1349f051';

const saveRemoteImage = async (url: string, outputDir: string, label: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Image download failed: ${response.status}`);
  const extension = url.split('.').pop()?.split('?')[0] || 'png';
  const outputPath = path.join(outputDir, uniqueFile(label, extension));
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(outputPath, buffer);
  return outputPath;
};

const generatePhotoDesignPrompt = async (description: string, style: string, category: string) => {
  const prompt = `Act as a high-end commercial photographer and art director. 
  Generate a professional "Visual Brief" and "AI Image Prompt" for a marketing photo of a product.
  
  Product: ${description}
  Category: ${category}
  Creative Style: ${style}
  
  Requirements:
  - Focus on premium background, exquisite lighting, and cinematic composition.
  - Do NOT include text, prices, or buttons.
  - Describe the product hero placement.
  
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
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) throw new Error('OpenRouter prompt generation failed.');
  const data = await response.json();
  const content = JSON.parse(data.choices[0].message.content);
  return content.imagePrompt as string;
};

export const processPhotoJob = async (jobId: string) => {
  const job = await PhotoJob.findById(jobId);
  if (!job) throw new Error(`Job ${jobId} not found.`);

  const jobDir = path.join(config.workingDir, `photo-${job._id}`);
  await ensureDir(jobDir);
  job.metadata = { ...(job.metadata || {}), jobFolder: jobDir, startedAt: new Date() };

  try {
    await publishJobProgress(jobId, { status: 'processing', stage: 'writing-brief', progress: 20, message: 'Designing the marketing concept...' });
    
    // 1. Generate Prompt
    const enhancedPrompt = await generatePhotoDesignPrompt(job.description, job.style, job.productCategory);
    job.prompt = enhancedPrompt;
    await job.save();

    await publishJobProgress(jobId, { status: 'processing', stage: 'generating-design', progress: 50, message: 'AI is rendering your marketing photo...' });

    // 2. Call Replicate
    const model = config.replicateModel || DEFAULT_SDXL_MODEL;
    let input: any = {
      prompt: `${enhancedPrompt}. Professional commercial photography, advertising style, ${job.style} mood, 8k resolution.`,
      negative_prompt: 'text, watermark, logo, blurry, low quality, price tag, buttons, distorted',
      num_outputs: 3,
      guidance_scale: 7.5,
      num_inference_steps: 50,
    };

    if (job.source === 'upload' && job.imagePath) {
      const imageBuffer = await fs.readFile(job.imagePath);
      input.image = `data:image/png;base64,${imageBuffer.toString('base64')}`;
      input.prompt = `Commercial redesign of this product: ${input.prompt}`;
      input.prompt_strength = 0.65; // Keep product fidelity but redesign background
    }

    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${config.replicateApiToken}`
      },
      body: JSON.stringify({ model, input })
    });

    if (!response.ok) throw new Error(`Replicate failed: ${await response.text()}`);
    let prediction = await response.json();

    while (prediction.status === 'starting' || prediction.status === 'processing') {
      await sleep(1500);
      const poll = await fetch(prediction.urls.get, {
        headers: { Authorization: `Token ${config.replicateApiToken}` }
      });
      prediction = await poll.json();
    }

    if (prediction.status !== 'succeeded') throw new Error(`Design generation failed with status: ${prediction.status}`);

    // 3. Save variants
    await publishJobProgress(jobId, { status: 'processing', stage: 'uploading-assets', progress: 90, message: 'Finalizing your designs...' });
    
    const outputUrls = Array.isArray(prediction.output) ? prediction.output : [prediction.output];
    const variants = [];
    for (const [i, url] of outputUrls.slice(0, 3).entries()) {
      const localPath = await saveRemoteImage(url, jobDir, `variant-${i + 1}`);
      variants.push({ url, localPath, provider: 'replicate', key: `photo/${job._id}/variant-${i + 1}.png` });
    }

    job.output = { ...job.output, variants };
    job.status = 'completed';
    job.stage = 'completed';
    job.progress = 100;
    job.message = 'Marketing designs are ready!';
    job.metadata.completedAt = new Date();
    await job.save();

    await publishJobProgress(jobId, {
      status: 'completed',
      stage: 'completed',
      progress: 100,
      message: 'Marketing designs are ready!',
      variants: job.output.variants
    });

  } catch (error: any) {
    job.status = 'failed';
    job.stage = 'failed';
    job.error = error.message;
    job.metadata.failedAt = new Date();
    await job.save();
    throw error;
  }
};
