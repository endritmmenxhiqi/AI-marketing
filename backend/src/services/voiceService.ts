import fs from 'node:fs/promises';
import path from 'node:path';
import ffmpeg from 'fluent-ffmpeg';
import { config } from '../config';
import { CaptionCue, VoiceSegmentResult, WordAlignment } from '../types';
import { getCache, setCache } from './cacheService';
import { mapWithConcurrency } from '../utils/async';
import { ensureDir, fileExists, sha256 } from '../utils/files';

ffmpeg.setFfmpegPath(config.ffmpegPath);
ffmpeg.setFfprobePath(config.ffprobePath);

const DEEPGRAM_TTS_BASE_URL = 'https://api.deepgram.com/v1/speak';

const getDuration = (filePath: string) =>
  new Promise<number>((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (error, data) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(data.format.duration || 0);
    });
  });

const groupWordsIntoCaptions = (words: WordAlignment[]) => {
  const captions: CaptionCue[] = [];
  let current: WordAlignment[] = [];

  const flush = () => {
    if (current.length === 0) return;
    captions.push({
      text: current.map((word) => word.text).join(' '),
      start: current[0].start,
      end: current[current.length - 1].end
    });
    current = [];
  };

  for (const word of words) {
    current.push(word);
    const shouldFlush =
      current.length >= 4 || /[.!?,]$/.test(word.text) || word.end - current[0].start > 1.8;

    if (shouldFlush) {
      flush();
    }
  }

  flush();
  return captions;
};

const estimateAlignment = (text: string, duration: number) => {
  const words = text
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length === 0) {
    return [] as WordAlignment[];
  }

  const step = duration / words.length;

  return words.map((word, index) => ({
    text: word,
    start: Number((index * step).toFixed(3)),
    end: Number(((index + 1) * step).toFixed(3))
  }));
};

const synthesizeSegment = async (text: string, cachePath: string) => {
  const response = await fetch(
    `${DEEPGRAM_TTS_BASE_URL}?model=${encodeURIComponent(config.deepgramTtsModel)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${config.deepgramApiKey}`
      },
      body: JSON.stringify({ text })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Deepgram TTS failed: ${response.status} ${errorText}`);
  }

  await ensureDir(path.dirname(cachePath));
  const audioBuffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(cachePath, audioBuffer);
};

export const generateVoiceSegments = async ({
  texts,
  workingDir
}: {
  texts: string[];
  workingDir: string;
}) => {
  if (!config.deepgramApiKey) {
    throw new Error('DEEPGRAM_API_KEY is missing.');
  }

  await ensureDir(workingDir);
  return mapWithConcurrency(
    texts,
    config.voiceGenerationConcurrency,
    async (text, index): Promise<VoiceSegmentResult> => {
    const hash = sha256(`${config.deepgramTtsModel}:${text}`);
    const cachedAudioPath = path.join(config.cacheDir, 'voice', `${hash}.mp3`);
    const cacheKey = `voice:${hash}`;
    const cached = await getCache<{ alignment: WordAlignment[]; duration: number }>(cacheKey);

    if (!(await fileExists(cachedAudioPath))) {
      await synthesizeSegment(text, cachedAudioPath);
    }

    const outputPath = path.join(workingDir, `voice-segment-${index + 1}.mp3`);
    await fs.copyFile(cachedAudioPath, outputPath);

    let duration = cached?.duration || 0;
    if (!duration) {
      duration = await getDuration(cachedAudioPath);
    }

    const alignment = cached?.alignment?.length
      ? cached.alignment
      : estimateAlignment(text, duration);

    if (!cached?.alignment?.length || !cached?.duration) {
      await setCache(cacheKey, { alignment, duration });
    }

      return {
      text,
      path: outputPath,
      duration,
      alignment,
      captions: groupWordsIntoCaptions(alignment)
      };
    }
  );
};
