import { completePhotoJob } from './api';

// Extend the global Window type for Puter
declare global {
  interface Window {
    puter?: {
      ai: {
        txt2img: (prompt: string, testMode?: boolean) => Promise<HTMLImageElement>;
      };
    };
  }
}

/**
 * Generates an image using Puter.js (browser-side, free, no API key needed).
 * Returns the generated image as a Blob.
 */
const generateWithPuter = async (prompt: string): Promise<Blob> => {
  if (!window.puter?.ai?.txt2img) {
    throw new Error('Puter.js is not loaded. Check your internet connection and reload the page.');
  }

  console.log('[Puter] Generating image with prompt:', prompt.slice(0, 80) + '...');

  // Puter returns an HTMLImageElement with a blob src
  const imgElement = await window.puter.ai.txt2img(prompt, false);

  // Fetch the blob from the src URL
  const response = await fetch(imgElement.src);
  if (!response.ok) {
    throw new Error('Failed to fetch generated image from Puter.');
  }

  return response.blob();
};

/**
 * Handles the full Puter image generation flow for a photo job.
 * Called when the backend emits the 'pending-image-generation' stage.
 */
export const handlePuterImageGeneration = async (
  jobId: string,
  imagePrompt: string,
  onProgress?: (message: string) => void
): Promise<void> => {
  onProgress?.('Generating image with Puter AI...');

  const blob = await generateWithPuter(imagePrompt);

  onProgress?.('Image generated — uploading to server...');

  await completePhotoJob(jobId, blob);

  onProgress?.('Done!');
};
