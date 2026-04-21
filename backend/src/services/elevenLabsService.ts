import fs from 'node:fs/promises';
import path from 'node:path';
import ffmpeg from 'fluent-ffmpeg';
import { config } from '../config';
import { CaptionCue, VoiceSegmentResult, WordAlignment } from '../types';
import { getCache, setCache } from './cacheService';
import { ensureDir, fileExists, sha256 } from '../utils/files';

ffmpeg.setFfmpegPath(config.ffmpegPath);
ffmpeg.setFfprobePath(config.ffprobePath);

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

const alignAudio = async (audioPath: string, transcript: string) => {
  const fileBuffer = await fs.readFile(audioPath);
  const formData = new FormData();
  formData.append('text', transcript);
  formData.append('file', new Blob([fileBuffer]), path.basename(audioPath));

  const response = await fetch('https://api.elevenlabs.io/v1/forced-alignment', {
    method: 'POST',
    headers: {
      'xi-api-key': config.elevenLabsApiKey
    },
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs forced alignment failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  const words = (payload.words || []).map(
    (word: any): WordAlignment => ({
      text: word.text,
      start: word.start,
      end: word.end
    })
  );

  return words;
};

const synthesizeSegment = async (text: string, cachePath: string) => {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${config.elevenLabsVoiceId}/stream?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': config.elevenLabsApiKey
      },
      body: JSON.stringify({
        text,
        model_id: config.elevenLabsModelId,
        voice_settings: {
          stability: 0.3,
          similarity_boost: 0.85,
          style: 0.25,
          use_speaker_boost: true,
          speed: 1
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs TTS failed: ${response.status} ${errorText}`);
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
  if (!config.elevenLabsApiKey) {
    throw new Error('ELEVENLABS_API_KEY is missing.');
  }

  await ensureDir(workingDir);

  const segments: VoiceSegmentResult[] = [];

  for (const [index, text] of texts.entries()) {
    const hash = sha256(`${config.elevenLabsVoiceId}:${config.elevenLabsModelId}:${text}`);
    const cachedAudioPath = path.join(config.cacheDir, 'voice', `${hash}.mp3`);
    const cacheKey = `voice:${hash}`;
    const cached = await getCache<{ alignment: WordAlignment[]; duration: number }>(cacheKey);

    if (!(await fileExists(cachedAudioPath))) {
      await synthesizeSegment(text, cachedAudioPath);
    }

    const outputPath = path.join(workingDir, `voice-segment-${index + 1}.mp3`);
    await fs.copyFile(cachedAudioPath, outputPath);

    let alignment = cached?.alignment || [];
    let duration = cached?.duration || 0;

    if (!duration) {
      duration = await getDuration(cachedAudioPath);
    }

    if (!alignment.length) {
      try {
        alignment = await alignAudio(cachedAudioPath, text);
      } catch (error) {
        console.warn(`Alignment fallback used for segment ${index + 1}: ${(error as Error).message}`);
        alignment = estimateAlignment(text, duration);
      }
      await setCache(cacheKey, { alignment, duration });
    }

    segments.push({
      text,
      path: outputPath,
      duration,
      alignment,
      captions: groupWordsIntoCaptions(alignment)
    });
  }

  return segments;
};
