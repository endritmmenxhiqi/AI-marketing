import fs from 'node:fs/promises';
import path from 'node:path';
import ffmpeg, { FfmpegCommand } from 'fluent-ffmpeg';
import { config } from '../config';
import { CaptionCue, SceneRenderPlan } from '../types';
import { mapWithConcurrency } from '../utils/async';
import { ensureDir } from '../utils/files';

ffmpeg.setFfmpegPath(config.ffmpegPath);
ffmpeg.setFfprobePath(config.ffprobePath);

const CAPTION_TEXT_Y = 1418;
const CAPTION_TEXT_COLOR = '0x0f172a';
const CAPTION_BOX_COLOR = 'white@0.74';
const CAPTION_BORDER_COLOR = 'white@0.86';
const CAPTION_SHADOW_COLOR = 'black@0.18';
const TARGET_ASPECT_RATIO = 9 / 16;
const OUTPUT_FPS = Math.max(12, Math.min(config.ffmpegOutputFps, 30));
const SCENE_TAIL_SECONDS = Math.max(0.08, Math.min(config.sceneTailSeconds, 0.45));
const ENCODE_THREADS = Math.max(1, config.ffmpegThreads);

const probeDuration = (filePath: string) =>
  new Promise<number>((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (error, data) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(data.format.duration || 0);
    });
  });

const getSceneDuration = (plan: SceneRenderPlan) => plan.voice.duration + SCENE_TAIL_SECONDS;

const runCommand = (command: FfmpegCommand, outputPath: string) =>
  new Promise<string>((resolve, reject) => {
    const stderr: string[] = [];

    command
      .on('stderr', (line) => {
        stderr.push(line);
      })
      .on('end', () => resolve(outputPath))
      .on('error', (error) => {
        const detail = stderr.slice(-12).join('\n').trim();
        reject(new Error(detail ? `${error.message}\n${detail}` : error.message));
      })
      .save(outputPath);
  });

const writeConcatListFile = async (paths: string[], outputPath: string) => {
  const fileBody = paths.map((filePath) => `file '${filePath.replace(/'/g, "'\\''")}'`).join('\n');
  await fs.writeFile(outputPath, fileBody, 'utf8');
};

const escapeText = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'").replace(/,/g, '\\,');

const escapeFilterPath = (value: string) =>
  value.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");

const writeFilterTextFile = async ({
  jobDir,
  sceneIndex,
  label,
  text
}: {
  jobDir: string;
  sceneIndex: number;
  label: string;
  text: string;
}) => {
  const textPath = path.join(jobDir, `scene-${sceneIndex + 1}-${label}.txt`);
  await fs.writeFile(textPath, text, 'utf8');
  return escapeFilterPath(textPath);
};

const buildCaptionFilters = async ({
  captions,
  inputLabel,
  jobDir,
  sceneIndex
}: {
  captions: CaptionCue[];
  inputLabel: string;
  jobDir: string;
  sceneIndex: number;
}) => {
  const filters: string[] = [];

  for (const [index, caption] of captions.entries()) {
    const start = caption.start.toFixed(2);
    const end = caption.end.toFixed(2);
    const enableExpression = `between(t\\,${start}\\,${end})`;
    const textLabel = `captext${index}`;
    const previousLabel = index === 0 ? inputLabel : `captext${index - 1}`;
    const captionFile = await writeFilterTextFile({
      jobDir,
      sceneIndex,
      label: `caption-${index}`,
      text: caption.text
    });

    filters.push(
      `[${previousLabel}]drawtext=fontfile='${escapeFilterPath(
        config.ffmpegFontPath
      )}':textfile='${captionFile}':reload=0:fontsize=54:fontcolor=${CAPTION_TEXT_COLOR}:line_spacing=12:borderw=2:bordercolor=${CAPTION_BORDER_COLOR}:box=1:boxcolor=${CAPTION_BOX_COLOR}:boxborderw=22:shadowcolor=${CAPTION_SHADOW_COLOR}:shadowx=0:shadowy=6:x=(w-text_w)/2:y=${CAPTION_TEXT_Y}:enable='${enableExpression}'[${textLabel}]`
    );
  }

  return filters;
};

const createSceneClip = async ({
  plan,
  jobDir,
  productImagePath,
  isLast
}: {
  plan: SceneRenderPlan;
  jobDir: string;
  productImagePath: string;
  isLast: boolean;
}) => {
  const outputPath = path.join(jobDir, `scene-${plan.index + 1}.mp4`);
  const sceneDuration = getSceneDuration(plan); // breathing room after voiceover ends
  const command = ffmpeg();
  const mediaDuration =
    plan.media.kind === 'video'
      ? plan.media.duration || (await probeDuration(plan.media.localPath!))
      : 0;

  if (plan.media.kind === 'video') {
    command.input(plan.media.localPath!).inputOptions(['-stream_loop -1']);
  } else {
    command.input(plan.media.localPath!).inputOptions(['-loop 1']);
  }

  const sourcePrep = (() => {
    if (plan.media.kind !== 'video') {
      const frameCount = Math.ceil(sceneDuration * OUTPUT_FPS);
      const variants = [
        `scale=1220:2180:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.00075,1.12)':d=${frameCount}:s=1080x1920,fps=${OUTPUT_FPS}`,
        `scale=1260:2240:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.00055,1.08)':x='(iw-iw/zoom)*min(on/${Math.max(
          frameCount,
          1
        )},1)':y='(ih-ih/zoom)*0.18':d=${frameCount}:s=1080x1920,fps=${OUTPUT_FPS}`,
        `scale=1260:2240:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.00055,1.09)':x='(iw-iw/zoom)*0.12':y='(ih-ih/zoom)*min(on/${Math.max(
          frameCount,
          1
        )},1)':d=${frameCount}:s=1080x1920,fps=${OUTPUT_FPS}`,
        `scale=1220:2180:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='if(lte(on,1),1.02,max(1.02,zoom-0.00018))':d=${frameCount}:s=1080x1920,fps=${OUTPUT_FPS}`
      ];

      return `[0:v]${variants[plan.index % variants.length]}[bg0]`;
    }

    const trimStart =
      mediaDuration > sceneDuration + 1 ? Math.max((mediaDuration - sceneDuration) * 0.35, 0) : 0;
    const mediaAspect = (plan.media.width || 1080) / Math.max(plan.media.height || 1920, 1);
    const isWideClip = mediaAspect > TARGET_ASPECT_RATIO + 0.12;

    const preparedInput = `[0:v]trim=start=${trimStart.toFixed(2)}:duration=${sceneDuration.toFixed(
      2
    )},setpts=PTS-STARTPTS,fps=${OUTPUT_FPS}`;

    if (isWideClip) {
      return `${preparedInput},split=2[widebg][widefg];[widebg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=10:4,eq=contrast=1.02:saturation=0.90[widebgfill];[widefg]scale=1080:1920:force_original_aspect_ratio=decrease,setsar=1,eq=contrast=1.08:saturation=1.05[widefgfit];[widebgfill][widefgfit]overlay=(W-w)/2:(H-h)/2[bg0]`;
    }

    return `${preparedInput},scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,eq=contrast=1.08:saturation=1.08[bg0]`;
  })();

  const filters = [sourcePrep];
  // Keep the scene visuals clean by rendering only the timed bottom captions.
  filters.push(
    ...(await buildCaptionFilters({
      captions: plan.voice.captions,
      inputLabel: 'bg0',
      jobDir,
      sceneIndex: plan.index
    }))
  );

  const contentLabel = plan.voice.captions.length ? `captext${plan.voice.captions.length - 1}` : 'bg0';
  const finalLabel = `sceneout${plan.index}`;
  const fadeInDuration = 0.16;
  const fadeOutDuration = 0.22;
  const fadeOutStart = Math.max(sceneDuration - fadeOutDuration, 0).toFixed(2);

  filters.push(
    `[${contentLabel}]fade=t=in:st=0:d=${fadeInDuration},fade=t=out:st=${fadeOutStart}:d=${fadeOutDuration}[${finalLabel}]`
  );

  command
    .complexFilter(filters)
    .outputOptions([
      '-map',
      `[${finalLabel}]`,
      '-an',
      '-t',
      sceneDuration.toFixed(2),
      '-r',
      String(OUTPUT_FPS),
      '-pix_fmt',
      'yuv420p',
      '-threads',
      String(ENCODE_THREADS),
      '-movflags',
      '+faststart',
      '-preset',
      'ultrafast',
      '-crf',
      '23'
    ])
    .videoCodec('libx264');

  return runCommand(command, outputPath);
};

const concatVoiceSegments = async (voicePaths: string[], jobDir: string) => {
  const listPath = path.join(jobDir, 'voice-concat.txt');
  const outputPath = path.join(jobDir, 'voiceover.mp3');
  await writeConcatListFile(voicePaths, listPath);

  const command = ffmpeg()
    .input(listPath)
    .inputOptions(['-f concat', '-safe 0'])
    .outputOptions(['-c copy']);

  return runCommand(command, outputPath);
};

const concatSceneClips = async ({
  scenePaths,
  jobDir
}: {
  scenePaths: string[];
  jobDir: string;
}) => {
  const listPath = path.join(jobDir, 'scene-concat.txt');
  const outputPath = path.join(jobDir, 'scene-stack.mp4');
  await writeConcatListFile(scenePaths, listPath);

  const command = ffmpeg()
    .input(listPath)
    .inputOptions(['-f concat', '-safe 0'])
    .outputOptions(['-c copy', '-movflags +faststart']);

  return runCommand(command, outputPath);
};

const mixFinalAudio = async ({
  voicePath,
  musicPath,
  durationSeconds,
  outputPath
}: {
  voicePath: string;
  musicPath: string;
  durationSeconds: number;
  outputPath: string;
}) => {
  const command = ffmpeg();
  command.input(voicePath);
  if (musicPath) {
    command.input(musicPath).inputOptions(['-stream_loop -1']);
  }

  const filters: string[] = [];
  const voiceInputIndex = 0;
  filters.push(`[${voiceInputIndex}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=1[voice]`);

  if (musicPath) {
    const musicInputIndex = 1;
    filters.push(
      `[${musicInputIndex}:a]aformat=sample_rates=44100:channel_layouts=stereo,atrim=0:${durationSeconds.toFixed(
        2
      )},volume=0.22,afade=t=in:st=0:d=1.2,afade=t=out:st=${Math.max(
        durationSeconds - 1.5,
        0
      ).toFixed(2)}:d=1.5[music]`
    );
    filters.push(
      `[music][voice]sidechaincompress=threshold=0.015:ratio=10:attack=15:release=320[ducked]`
    );
    filters.push(`[ducked][voice]amix=inputs=2:weights='1 1':normalize=0[aout]`);
  }

  command
    .complexFilter(filters)
    .outputOptions([
      '-map',
      musicPath ? '[aout]' : '[voice]',
      '-t',
      durationSeconds.toFixed(2),
      '-movflags',
      '+faststart',
      '-b:a',
      '192k'
    ])
    .audioCodec('aac');

  return runCommand(command, outputPath);
};

const muxFinalVideo = async ({
  stackedVideoPath,
  audioPath,
  outputPath
}: {
  stackedVideoPath: string;
  audioPath: string;
  outputPath: string;
}) => {
  const command = ffmpeg()
    .input(stackedVideoPath)
    .input(audioPath)
    .outputOptions([
      '-map',
      '0:v:0',
      '-map',
      '1:a:0',
      '-c:v',
      'copy',
      '-c:a',
      'copy',
      '-shortest',
      '-movflags',
      '+faststart'
    ]);

  return runCommand(command, outputPath);
};

export const trimVideo = async ({
  sourcePath,
  startSeconds,
  endSeconds,
  outputPath
}: {
  sourcePath: string;
  startSeconds: number;
  endSeconds: number;
  outputPath: string;
}) => {
  await ensureDir(path.dirname(outputPath));

  const durationSeconds = await probeDuration(sourcePath).catch(() => 0);
  const safeStart = Math.max(0, Number(startSeconds) || 0);
  const rawEnd = Number(endSeconds) || 0;
  const safeEnd = rawEnd > 0 ? rawEnd : durationSeconds;
  const boundedEnd =
    durationSeconds > 0 && Number.isFinite(durationSeconds)
      ? Math.min(safeEnd, durationSeconds)
      : safeEnd;

  if (!boundedEnd || !Number.isFinite(boundedEnd) || boundedEnd <= safeStart) {
    throw new Error('Invalid trim range.');
  }

  const command = ffmpeg(sourcePath).outputOptions([
    '-ss',
    safeStart.toFixed(2),
    '-to',
    boundedEnd.toFixed(2),
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-crf',
    '23',
    '-threads',
    String(ENCODE_THREADS),
    '-c:a',
    'aac',
    '-movflags',
    '+faststart'
  ]);

  await runCommand(command, outputPath);
  return { outputPath, startSeconds: safeStart, endSeconds: boundedEnd };
};

export const renderMarketingVideo = async ({
  plans,
  productImagePath,
  jobDir,
  musicPath,
  onSceneRendered,
  onPhaseChange
}: {
  plans: SceneRenderPlan[];
  productImagePath: string;
  jobDir: string;
  musicPath: string;
  onSceneRendered?: (payload: { completedScenes: number; totalScenes: number }) => Promise<void> | void;
  onPhaseChange?: (
    payload: { phase: 'concatenating-scenes' | 'mixing-audio' | 'muxing-master' }
  ) => Promise<void> | void;
}) => {
  await ensureDir(jobDir);

  let completedScenes = 0;
  const scenePathEntries = await mapWithConcurrency(
    plans,
    config.renderSceneConcurrency,
    async (plan, index) => {
      const scenePath = await createSceneClip({
        plan,
        jobDir,
        productImagePath,
        isLast: index === plans.length - 1
      });

      completedScenes += 1;
      await onSceneRendered?.({
        completedScenes,
        totalScenes: plans.length
      });

      return { index, scenePath };
    }
  );
  const scenePaths = scenePathEntries
    .sort((left, right) => left.index - right.index)
    .map((entry) => entry.scenePath);

  await onPhaseChange?.({ phase: 'concatenating-scenes' });
  const stackedVideoPath = await concatSceneClips({
    scenePaths,
    jobDir
  });

  const voicePath = await concatVoiceSegments(
    plans.map((plan) => plan.voice.path),
    jobDir
  );

  const durationSeconds = plans.reduce((sum, plan) => sum + getSceneDuration(plan), 0);
  const mixedAudioPath = path.join(jobDir, 'final-audio.m4a');

  await onPhaseChange?.({ phase: 'mixing-audio' });
  await mixFinalAudio({
    voicePath,
    musicPath,
    durationSeconds,
    outputPath: mixedAudioPath
  });

  const outputPath = path.join(jobDir, 'final-video.mp4');

  await onPhaseChange?.({ phase: 'muxing-master' });
  await muxFinalVideo({
    stackedVideoPath,
    audioPath: mixedAudioPath,
    outputPath
  });

  const finalDurationSeconds = await probeDuration(outputPath).catch(() => durationSeconds);

  return {
    voicePath,
    outputPath,
    scenePaths,
    durationSeconds: finalDurationSeconds
  };
};
