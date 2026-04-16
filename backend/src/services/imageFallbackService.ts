import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config';
import { MediaCandidate } from '../types';
import { ensureDir, uniqueFile } from '../utils/files';
import { sleep } from '../utils/sleep';

const saveRemoteImage = async (url: string, outputDir: string, label: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Image download failed: ${response.status}`);
  }

  const outputPath = path.join(outputDir, uniqueFile(label, 'png'));
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(outputPath, buffer);
  return outputPath;
};

export const createReplicateStyledImages = async ({
  productImagePath,
  prompt,
  style,
  outputDir
}: {
  productImagePath: string;
  prompt: string;
  style: string;
  outputDir: string;
}) => {
  if (!config.replicateApiToken || !config.replicateModel) {
    return [];
  }

  const imageBuffer = await fs.readFile(productImagePath);
  const imageDataUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;

  const response = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Token ${config.replicateApiToken}`
    },
    body: JSON.stringify({
      model: config.replicateModel,
      input: {
        prompt: `${prompt}. Premium ${style} brand campaign background, product hero composition.`,
        image: imageDataUrl
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Replicate request failed: ${response.status} ${errorText}`);
  }

  const initial = await response.json();
  let prediction = initial;

  while (prediction.status === 'starting' || prediction.status === 'processing') {
    await sleep(config.replicatePollIntervalMs);
    const pollResponse = await fetch(prediction.urls.get, {
      headers: {
        Authorization: `Token ${config.replicateApiToken}`
      }
    });

    if (!pollResponse.ok) {
      throw new Error('Replicate polling failed.');
    }

    prediction = await pollResponse.json();
  }

  if (prediction.status !== 'succeeded') {
    return [];
  }

  await ensureDir(outputDir);

  const outputs = Array.isArray(prediction.output) ? prediction.output : [prediction.output];
  const candidates: MediaCandidate[] = [];

  for (const [index, output] of outputs.slice(0, 3).entries()) {
    const localPath = await saveRemoteImage(String(output), outputDir, `replicate-${index + 1}`);
    candidates.push({
      kind: 'generated-image',
      source: 'replicate',
      url: output,
      width: 1080,
      height: 1920,
      query: prompt,
      localPath
    });
  }

  return candidates;
};

export const createStabilityFallbackImage = async ({
  prompt,
  outputDir
}: {
  prompt: string;
  outputDir: string;
}) => {
  if (!config.stabilityApiKey) {
    return null;
  }

  const formData = new FormData();
  formData.append(
    'text_prompts[0][text]',
    `${prompt}. Vertical advertising background, polished motion graphics energy, premium lighting.`
  );
  formData.append('cfg_scale', '8');
  formData.append('clip_guidance_preset', 'FAST_BLUE');
  formData.append('height', '1536');
  formData.append('width', '1024');
  formData.append('samples', '1');
  formData.append('steps', '30');

  const response = await fetch(
    `https://api.stability.ai/v1/generation/${config.stabilityEngineId}/text-to-image`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.stabilityApiKey}`,
        Accept: 'application/json'
      },
      body: formData
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Stability request failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  const artifact = payload.artifacts?.[0];
  if (!artifact?.base64) {
    return null;
  }

  await ensureDir(outputDir);
  const outputPath = path.join(outputDir, uniqueFile('stability-fallback', 'png'));
  await fs.writeFile(outputPath, Buffer.from(artifact.base64, 'base64'));

  return {
    kind: 'generated-image' as const,
    source: 'stability' as const,
    url: '',
    width: 1024,
    height: 1536,
    query: prompt,
    localPath: outputPath
  };
};
