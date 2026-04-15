import fs from 'node:fs/promises';
import path from 'node:path';
import ffmpeg, { FfmpegCommand } from 'fluent-ffmpeg';
import { config } from '../config';
import { CaptionCue, SceneRenderPlan } from '../types';
import { ensureDir, fileExists } from '../utils/files';

ffmpeg.setFfmpegPath(config.ffmpegPath);
ffmpeg.setFfprobePath(config.ffprobePath);

const CAPTION_BOX_Y = 1360;
const CAPTION_BOX_HEIGHT = 260;
const TARGET_ASPECT_RATIO = 9 / 16;
const PRODUCT_POSITIONS = [
  { x: 624, y: 120 },
  { x: 600, y: 152 },
  { x: 642, y: 168 },
  { x: 586, y: 136 }
];

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
  jobDir,
  sceneIndex
}: {
  captions: CaptionCue[];
  jobDir: string;
  sceneIndex: number;
}) => {
  const filters: string[] = [];

  for (const [index, caption] of captions.entries()) {
    const start = caption.start.toFixed(2);
    const end = caption.end.toFixed(2);
    const enableExpression = `between(t\\,${start}\\,${end})`;
    const shadowLabel = `capshadow${index}`;
    const boxLabel = `capbox${index}`;
    const textLabel = `captext${index}`;
    const inputLabel = index === 0 ? 'topline' : `captext${index - 1}`;
    const captionFile = await writeFilterTextFile({
      jobDir,
      sceneIndex,
      label: `caption-${index}`,
      text: caption.text
    });

    filters.push(
      `[${inputLabel}]drawbox=x=74:y=${CAPTION_BOX_Y + 12}:w=932:h=${CAPTION_BOX_HEIGHT}:color=black@0.20:t=fill:enable='${enableExpression}'[${shadowLabel}]`
    );
    filters.push(
      `[${shadowLabel}]drawbox=x=60:y=${CAPTION_BOX_Y}:w=960:h=${CAPTION_BOX_HEIGHT}:color=white@0.12:t=fill:enable='${enableExpression}'[${boxLabel}]`
    );
    filters.push(
      `[${boxLabel}]drawtext=fontfile='${escapeFilterPath(
        config.ffmpegFontPath
      )}':textfile='${captionFile}':reload=0:fontsize=54:fontcolor=white:line_spacing=12:shadowcolor=black@0.65:shadowx=0:shadowy=12:x=(w-text_w)/2:y=${CAPTION_BOX_Y + 58}:enable='${enableExpression}'[${textLabel}]`
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
  const sceneDuration = plan.voice.duration + 0.45; // breathing room after voiceover ends
  const command = ffmpeg();
  const hasProductImage = Boolean(productImagePath) && (await fileExists(productImagePath));
  const headlineFile = await writeFilterTextFile({
    jobDir,
    sceneIndex: plan.index,
    label: 'headline',
    text: plan.scene.headline
  });
  const mediaDuration =
    plan.media.kind === 'video'
      ? plan.media.duration || (await probeDuration(plan.media.localPath!))
      : 0;
  const productPosition = PRODUCT_POSITIONS[plan.index % PRODUCT_POSITIONS.length];

  if (plan.media.kind === 'video') {
    command.input(plan.media.localPath!);
  } else {
    command.input(plan.media.localPath!).inputOptions(['-loop 1']);
  }
  if (hasProductImage) {
    command.input(productImagePath);
  }

  const sourcePrep = (() => {
    if (plan.media.kind !== 'video') {
      const frameCount = Math.ceil(sceneDuration * 30);
      const variants = [
        `scale=1300:2300:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0009,1.14)':d=${frameCount}:s=1080x1920,fps=30`,
        `scale=1360:2360:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0007,1.10)':x='(iw-iw/zoom)*min(on/${Math.max(
          frameCount,
          1
        )},1)':y='(ih-ih/zoom)*0.18':d=${frameCount}:s=1080x1920,fps=30`,
        `scale=1360:2360:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0007,1.11)':x='(iw-iw/zoom)*0.12':y='(ih-ih/zoom)*min(on/${Math.max(
          frameCount,
          1
        )},1)':d=${frameCount}:s=1080x1920,fps=30`,
        `scale=1300:2300:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='if(lte(on,1),1.02,max(1.02,zoom-0.00025))':d=${frameCount}:s=1080x1920,fps=30`
      ];

      return `[0:v]${variants[plan.index % variants.length]}[bg0]`;
    }

    const trimStart =
      mediaDuration > sceneDuration + 1 ? Math.max((mediaDuration - sceneDuration) * 0.35, 0) : 0;
    const playableDuration = mediaDuration > trimStart ? mediaDuration - trimStart : 0;
    const trimmedDuration =
      playableDuration > 0 ? Math.min(playableDuration, sceneDuration) : sceneDuration;
    const holdDuration = Math.max(sceneDuration - trimmedDuration, 0.05);
    const mediaAspect = (plan.media.width || 1080) / Math.max(plan.media.height || 1920, 1);
    const isWideClip = mediaAspect > TARGET_ASPECT_RATIO + 0.12;

    const preparedInput = `[0:v]trim=start=${trimStart.toFixed(2)}:duration=${trimmedDuration.toFixed(
      2
    )},setpts=PTS-STARTPTS,fps=30,tpad=stop_mode=clone:stop_duration=${holdDuration.toFixed(
      2
    )},trim=duration=${sceneDuration.toFixed(2)},setpts=PTS-STARTPTS`;

    if (isWideClip) {
      return `${preparedInput},split=2[widebg][widefg];[widebg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=18:8,eq=contrast=1.02:saturation=0.90[widebgfill];[widefg]scale=1080:1920:force_original_aspect_ratio=decrease,setsar=1,eq=contrast=1.08:saturation=1.05[widefgfit];[widebgfill][widefgfit]overlay=(W-w)/2:(H-h)/2[bg0]`;
    }

    return `${preparedInput},scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,eq=contrast=1.08:saturation=1.08[bg0]`;
  })();

  const filters = [sourcePrep];
  // Note: We removed the hardcoded floating overlay because it looked
  // bad with non-transparent JPEGs. The app now relies entirely on 
  // useHeroUploadForFirstScene/LastScene to display product images respectfully
  // as the full background with cinematic zoom effects.
  
  filters.push(`[bg0]drawbox=x=40:y=80:w=1000:h=420:color=black@0.16:t=fill[stage0]`);

  filters.push(
    `[stage0]drawbox=x=56:y=88:w=468:h=114:color=black@0.20:t=fill[stage1]`,
    `[stage1]drawtext=fontfile='${escapeFilterPath(
      config.ffmpegFontPath
    )}':textfile='${headlineFile}':reload=0:fontsize=34:fontcolor=white:shadowcolor=black@0.7:shadowx=0:shadowy=10:x=84:y=120[topline]`,
    ...(await buildCaptionFilters({
      captions: plan.voice.captions,
      jobDir,
      sceneIndex: plan.index
    }))
  );

  const contentLabel = plan.voice.captions.length ? `captext${plan.voice.captions.length - 1}` : 'topline';
  const finalLabel = `sceneout${plan.index}`;
  const fadeOutStart = Math.max(sceneDuration - 0.3, 0).toFixed(2);

  filters.push(
    `[${contentLabel}]fade=t=in:st=0:d=0.2,fade=t=out:st=${fadeOutStart}:d=0.3[${finalLabel}]`
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
      '30',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-preset',
      'veryfast',
      '-crf',
      '23'
    ])
    .videoCodec('libx264');

  return runCommand(command, outputPath);
};

const concatVoiceSegments = async (voicePaths: string[], jobDir: string) => {
  const listPath = path.join(jobDir, 'voice-concat.txt');
  const outputPath = path.join(jobDir, 'voiceover.mp3');
  const fileBody = voicePaths.map((voicePath) => `file '${voicePath.replace(/'/g, "'\\''")}'`).join('\n');
  await fs.writeFile(listPath, fileBody);

  const command = ffmpeg()
    .input(listPath)
    .inputOptions(['-f concat', '-safe 0'])
    .outputOptions(['-c copy']);

  return runCommand(command, outputPath);
};

const assembleFinalVideo = async ({
  scenePaths,
  voicePath,
  musicPath,
  durationSeconds,
  outputPath
}: {
  scenePaths: string[];
  voicePath: string;
  musicPath: string;
  durationSeconds: number;
  outputPath: string;
}) => {
  const command = ffmpeg();
  scenePaths.forEach((scenePath) => command.input(scenePath));
  command.input(voicePath);
  if (musicPath) {
    command.input(musicPath).inputOptions(['-stream_loop -1']);
  }

  const filters: string[] = [];
  scenePaths.forEach((_, index) => {
    filters.push(`[${index}:v]setpts=PTS-STARTPTS,format=yuv420p[v${index}]`);
  });
  const currentLabel = 'vcat';
  filters.push(`${scenePaths.map((_, index) => `[v${index}]`).join('')}concat=n=${scenePaths.length}:v=1:a=0[${currentLabel}]`);

  const voiceInputIndex = scenePaths.length;
  filters.push(`[${voiceInputIndex}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=1[voice]`);

  if (musicPath) {
    const musicInputIndex = scenePaths.length + 1;
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
      `[${currentLabel}]`,
      '-map',
      musicPath ? '[aout]' : '[voice]',
      '-movflags',
      '+faststart',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      '-pix_fmt',
      'yuv420p',
      '-r',
      '30'
    ])
    .videoCodec('libx264')
    .audioCodec('aac');

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
    'veryfast',
    '-crf',
    '23',
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
  musicPath
}: {
  plans: SceneRenderPlan[];
  productImagePath: string;
  jobDir: string;
  musicPath: string;
}) => {
  await ensureDir(jobDir);

  const scenePaths: string[] = [];
  for (const [index, plan] of plans.entries()) {
    scenePaths.push(
      await createSceneClip({
        plan,
        jobDir,
        productImagePath,
        isLast: index === plans.length - 1
      })
    );
  }

  const voicePath = await concatVoiceSegments(
    plans.map((plan) => plan.voice.path),
    jobDir
  );

  const durationSeconds = plans.reduce((sum, plan) => sum + plan.voice.duration, 0);
  const outputPath = path.join(jobDir, 'final-video.mp4');

  await assembleFinalVideo({
    scenePaths,
    voicePath,
    musicPath,
    durationSeconds,
    outputPath
  });

  return {
    voicePath,
    outputPath,
    scenePaths,
    durationSeconds
  };
};
