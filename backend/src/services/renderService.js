const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const { spawn } = require('child_process');
const config = require('../config');

const GENERATED_ROOT = path.join(__dirname, '../../public/generated');
const VIDEO_OUTPUT_DIR = path.join(GENERATED_ROOT, 'video');
const TEMP_OUTPUT_DIR = path.join(GENERATED_ROOT, 'temp');

const sanitizeFilename = (value) =>
  String(value || 'preview')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'preview';

const normalizeOverlayText = (value) =>
  String(value || '')
    .replace(/^[^\p{L}\p{N}]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

const escapeDrawtext = (value) =>
  String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/,/g, '\\,')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/%/g, '\\%');

const escapeFilterPath = (value) =>
  String(value || '')
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'");

const downloadToFile = async (url, targetPath) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download media: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(targetPath, buffer);
};

const runFfmpeg = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn(config.ffmpegPath, args, {
      windowsHide: true,
    });

    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr || `ffmpeg exited with code ${code}`));
      }
    });
  });

const estimateDuration = (voiceoverScript, audioExists) => {
  if (audioExists) return 20;

  const words = String(voiceoverScript || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return Math.min(Math.max(Math.ceil(words / 2.5), 8), 20);
};

const pickSource = (generation) => {
  const firstVideo = generation.media?.videos?.[0];
  if (firstVideo?.url) {
    return { type: 'video', url: firstVideo.url };
  }

  const firstPhoto = generation.media?.photos?.[0];
  if (firstPhoto?.thumbnailUrl) {
    return { type: 'image', url: firstPhoto.thumbnailUrl };
  }

  return null;
};

const buildFilterChain = (generation) => {
  const headingText =
    normalizeOverlayText(generation.outputs?.onScreenText?.[0]) ||
    normalizeOverlayText(generation.title) ||
    'AI Marketing';
  const subheadingText =
    normalizeOverlayText(generation.outputs?.callToAction) ||
    normalizeOverlayText(generation.outputs?.caption);
  const heading = escapeDrawtext(headingText);
  const subheading = escapeDrawtext(subheadingText);
  const fontPath = escapeFilterPath(config.ffmpegFontPath);

  return [
    '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p,eq=brightness=-0.03:saturation=1.05[bg]',
    `[bg]drawbox=x=0:y=0:w=iw:h=300:color=black@0.35:t=fill,drawbox=x=0:y=ih-260:w=iw:h=260:color=black@0.45:t=fill[boxed]`,
    `[boxed]drawtext=fontfile='${fontPath}':text='${heading}':fontcolor=white:fontsize=72:line_spacing=12:x=60:y=120:box=0,drawtext=fontfile='${fontPath}':text='${subheading}':fontcolor=white:fontsize=42:line_spacing=10:x=60:y=h-210:box=0[outv]`,
  ].join(';');
};

const renderGenerationPreview = async (generation) => {
  const source = pickSource(generation);

  if (!source) {
    return {
      configured: Boolean(config.ffmpegPath),
      renderedAt: new Date(),
      sourceType: '',
      errorMessage: 'No stock media available for preview rendering',
      videoUrl: '',
      previewUrl: '',
    };
  }

  await fs.mkdir(VIDEO_OUTPUT_DIR, { recursive: true });
  await fs.mkdir(TEMP_OUTPUT_DIR, { recursive: true });

  const sourceExt = source.type === 'video' ? '.mp4' : '.jpg';
  const sourceFileName = `${sanitizeFilename(generation.title)}-${crypto.randomUUID()}${sourceExt}`;
  const sourcePath = path.join(TEMP_OUTPUT_DIR, sourceFileName);
  const outputFileName = `${sanitizeFilename(generation.title)}-${crypto.randomUUID()}.mp4`;
  const outputPath = path.join(VIDEO_OUTPUT_DIR, outputFileName);

  try {
    await downloadToFile(source.url, sourcePath);
  } catch (error) {
    return {
      configured: false,
      renderedAt: new Date(),
      sourceType: source.type,
      errorMessage: error.message,
      videoUrl: '',
      previewUrl: '',
    };
  }

  const hasAudio = Boolean(generation.assets?.audioUrl);
  const audioPath = hasAudio
    ? path.join(__dirname, '../../public', generation.assets.audioUrl.replace(`${config.backendUrl}/`, '').replace(/\//g, path.sep))
    : '';

  const duration = estimateDuration(generation.outputs?.voiceoverScript, hasAudio);
  const args = [];

  if (source.type === 'image') {
    args.push('-loop', '1', '-t', String(duration));
  } else {
    args.push('-stream_loop', '-1');
  }

  args.push('-i', sourcePath);

  if (hasAudio) {
    args.push('-i', audioPath);
  }

  args.push(
    '-filter_complex',
    buildFilterChain(generation),
    '-map',
    '[outv]'
  );

  if (hasAudio) {
    args.push('-map', '1:a', '-shortest');
  } else {
    args.push('-t', String(duration));
  }

  args.push(
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-pix_fmt',
    'yuv420p'
  );

  if (hasAudio) {
    args.push('-c:a', 'aac', '-b:a', '192k');
  }

  args.push('-movflags', '+faststart', '-y', outputPath);

  try {
    await runFfmpeg(args);

    return {
      configured: true,
      renderedAt: new Date(),
      sourceType: source.type,
      errorMessage: '',
      videoUrl: `${config.backendUrl}/generated/video/${outputFileName}`,
      previewUrl: `${config.backendUrl}/generated/video/${outputFileName}`,
    };
  } catch (error) {
    return {
      configured: false,
      renderedAt: new Date(),
      sourceType: source.type,
      errorMessage: error.message.includes('ENOENT')
        ? 'FFmpeg is not installed or FFMPEG_PATH is incorrect'
        : error.message,
      videoUrl: '',
      previewUrl: '',
    };
  } finally {
    await fs.unlink(sourcePath).catch(() => {});
  }
};

module.exports = {
  renderGenerationPreview,
};
