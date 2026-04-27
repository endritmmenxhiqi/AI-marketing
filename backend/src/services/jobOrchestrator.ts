import fs from 'node:fs/promises';
import path from 'node:path';
import { VideoJob } from '../models/VideoJob';
import { ScriptScene, SceneRenderPlan, MediaCandidate } from '../types';
import { publishJobProgress } from './jobProgressService';
import { generateScriptPackage } from './openAiService';
import { findSceneMedia } from './pexelsService';
import { createReplicateStyledImages, createStabilityFallbackImage } from './imageFallbackService';
import { downloadToFile } from './downloadService';
import { generateVoiceSegments } from './voiceService';
import { renderMarketingVideo } from './renderService';
import { uploadAsset } from './storageService';
import { selectBackgroundMusic } from './musicService';
import { config } from '../config';
import { mapWithConcurrency } from '../utils/async';
import { ensureDir, relativeFrom } from '../utils/files';
import { mergeJobMetadata } from '../utils/jobMetadata';

const TARGET_ASPECT_RATIO = 9 / 16;
const genericQueryTokens = new Set([
  'abstract',
  'background',
  'branding',
  'business',
  'corporate',
  'digital',
  'generic',
  'innovation',
  'marketing',
  'media',
  'office',
  'success',
  'technology'
]);
const querySignatureNoiseTokens = new Set([
  ...genericQueryTokens,
  'action',
  'atmosphere',
  'cinematic',
  'close',
  'crowd',
  'detail',
  'details',
  'dramatic',
  'elegant',
  'exterior',
  'hero',
  'high',
  'interior',
  'lifestyle',
  'lighting',
  'luxury',
  'macro',
  'modern',
  'motion',
  'person',
  'people',
  'portrait',
  'premium',
  'ready',
  'resolution',
  'scene',
  'shot',
  'slow',
  'vertical',
  'video',
  'wide'
]);
const foodMismatchTokens = new Set(['cake', 'cream', 'cupcake', 'frosting', 'icing', 'whipped']);
const beverageMismatchTokens = new Set([
  'beer',
  'breakfast',
  'coffee',
  'cocktail',
  'dessert',
  'meal',
  'office',
  'smoothie',
  'wine'
]);
const perfumeMismatchTokens = new Set([
  'app',
  'computer',
  'dessert',
  'food',
  'gaming',
  'gym',
  'kitchen',
  'laptop',
  'office',
  'pet',
  'podcast',
  'skincare',
  'smartphone',
  'workout'
]);
const homeLifestyleMismatchTokens = new Set([
  'apartment',
  'basement',
  'business',
  'car',
  'conference',
  'desk',
  'hotel',
  'meeting',
  'office',
  'podcast',
  'showroom',
  'small',
  'warehouse',
  'worker'
]);
const fitnessMismatchTokens = new Set(['conversation', 'desk', 'interview', 'meeting', 'office', 'podcast', 'talking']);
const fashionMismatchTokens = new Set([
  'balloon',
  'bridal',
  'business',
  'car',
  'conference',
  'desk',
  'engagement',
  'hotel',
  'meeting',
  'office',
  'podcast',
  'proposal',
  'showroom',
  'valentine',
  'wedding'
]);
const footballMismatchTokens = new Set(['nfl', 'touchdown', 'quarterback', 'superbowl', 'helmet', 'american']);
const esportsMismatchTokens = new Set([
  'business',
  'coding',
  'conference',
  'console',
  'controller',
  'office',
  'phone',
  'programming',
  'smartphone',
  'vr'
]);
const esportsBriefTokens = [
  'counter strike',
  'counter-strike',
  'cs2',
  'esports',
  'e sports',
  'gaming tournament',
  'major finals'
];
const perfumeProductSceneTokens = new Set([
  'atomizer',
  'bottle',
  'cap',
  'closeup',
  'close',
  'flacon',
  'fragrance',
  'mist',
  'package',
  'packaging',
  'perfume',
  'product',
  'spray',
  'scent'
]);
const perfumeLifestyleFallbackTerms = [
  'luxury interior',
  'mirror preparation',
  'well dressed man',
  'elegant woman',
  'suit details',
  'city night'
];
type MediaStrategy = {
  anchors: string[];
  avoidTokens: string[];
  preferStillImages: boolean;
  requireAnchorMatch: boolean;
  minimumVideoDurationRatio: number;
  minimumVideoSeconds: number;
  useHeroUploadForFirstScene: boolean;
  useHeroUploadForLastScene: boolean;
};

type JobPerformanceTimings = {
  scriptMs?: number;
  voiceMs?: number;
  mediaMs?: number;
  renderMs?: number;
  uploadMs?: number;
};

type PreparedSceneMedia = {
  scene: ScriptScene;
  mediaSearchScene: ScriptScene;
  productImagePath: string;
  style: string;
  productCategory: string;
  description: string;
  sceneDir: string;
  allowStyleTransfer: boolean;
  targetDuration: number;
  sceneIndex: number;
  sceneCount: number;
  strategy: MediaStrategy;
  candidates: MediaCandidate[];
  fixedMedia?: MediaCandidate;
};

type MediaSelectionState = {
  usedMediaKeys: Set<string>;
  usedQuerySignatures: string[][];
  usedCreatorKeys: Map<string, number>;
};

const isEsportsBrief = (description: string, productCategory: string) => {
  const normalized = `${productCategory} ${description}`.toLowerCase();
  return productCategory === 'gaming-esports' || esportsBriefTokens.some((token) => normalized.includes(token));
};

const tokenize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);

const createUploadFallback = (
  productImagePath: string,
  reason = 'Used the uploaded product image because stock matches were weak or off-brief.'
): MediaCandidate => ({
  kind: 'image',
  source: 'upload',
  url: '',
  width: 1080,
  height: 1920,
  query: 'uploaded product image',
  localPath: productImagePath,
  selectionScore: 0,
  selectionReason: reason
});

const isPerfumeUploadLocked = (productCategory: string, productImagePath: string) =>
  productCategory === 'perfume-fragrance' && Boolean(productImagePath);

const selectProductImageForScene = ({
  primaryImagePath,
  secondaryImagePath,
  sceneIndex,
  sceneCount
}: {
  primaryImagePath: string;
  secondaryImagePath: string;
  sceneIndex: number;
  sceneCount: number;
}) => {
  if (secondaryImagePath && sceneIndex === sceneCount - 1) {
    return secondaryImagePath;
  }

  return primaryImagePath || secondaryImagePath;
};

const isPerfumeProductScene = (scene: ScriptScene) => {
  const sceneTokens = tokenize(
    [scene.headline, scene.visualBrief, ...(scene.onScreenText || []), ...(scene.pexelsKeywords || [])].join(' ')
  );

  return sceneTokens.some((token) => perfumeProductSceneTokens.has(token));
};

const sanitizePerfumeSupportText = (value: string) =>
  value
    .split(/\s+/)
    .filter((part) => !perfumeProductSceneTokens.has(part.toLowerCase().replace(/[^a-z0-9-]/g, '')))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

const buildPerfumeSupportScene = (scene: ScriptScene): ScriptScene => {
  const filteredKeywords = scene.pexelsKeywords.filter((keyword) => {
    const keywordTokens = tokenize(keyword);
    return keywordTokens.length ? !keywordTokens.some((token) => perfumeProductSceneTokens.has(token)) : false;
  });

  const supportKeywords = Array.from(
    new Set([...filteredKeywords, ...perfumeLifestyleFallbackTerms])
  ).slice(0, 6);

  const headline = sanitizePerfumeSupportText(scene.headline) || 'Luxury fragrance lifestyle';
  const visualBrief =
    sanitizePerfumeSupportText(scene.visualBrief) ||
    'Elegant lifestyle support scene in a luxury interior with refined styling and confident presence.';

  return {
    ...scene,
    headline,
    visualBrief,
    pexelsKeywords: supportKeywords
  };
};

const buildMediaStrategy = (description: string, productCategory: string): MediaStrategy => {
  const descriptionTokens = Array.from(new Set(tokenize(description)));

  if (productCategory === 'food-dessert' && (descriptionTokens.includes('baklava') || descriptionTokens.includes('bakllava'))) {
    return {
      anchors: ['baklava', 'pistachio', 'pastry', 'turkish'],
      avoidTokens: Array.from(foodMismatchTokens),
      preferStillImages: true,
      requireAnchorMatch: true,
      minimumVideoDurationRatio: 0.95,
      minimumVideoSeconds: 6,
      useHeroUploadForFirstScene: true,
      useHeroUploadForLastScene: true
    };
  }

  if (productCategory === 'food-dessert') {
    const layeredDessertBrief = descriptionTokens.some((token) =>
      ['cake', 'cream', 'creamy', 'layer', 'layers', 'layered', 'mousse', 'slice'].includes(token)
    );

    return {
      anchors: Array.from(
        new Set([
          ...descriptionTokens.filter((token) =>
            [
              'cake',
              'cream',
              'creamy',
              'dessert',
              'layer',
              'layers',
              'layered',
              'mousse',
              'pastry',
              'pistachio',
              'slice',
              'sweet',
              'texture'
            ].includes(token)
          ),
          ...(layeredDessertBrief ? ['cake', 'layered', 'dessert'] : ['dessert'])
        ])
      ),
      avoidTokens: [],
      preferStillImages: layeredDessertBrief,
      requireAnchorMatch: true,
      minimumVideoDurationRatio: 0.8,
      minimumVideoSeconds: 5,
      useHeroUploadForFirstScene: true,
      useHeroUploadForLastScene: layeredDessertBrief
    };
  }

  if (productCategory === 'beverages-energy-drinks') {
    return {
      anchors: descriptionTokens.filter((token) =>
        ['beverage', 'can', 'cold', 'condensation', 'drink', 'energy', 'fizz', 'ice', 'refreshment'].includes(token)
      ),
      avoidTokens: Array.from(beverageMismatchTokens),
      preferStillImages: false,
      requireAnchorMatch: false,
      minimumVideoDurationRatio: 0.82,
      minimumVideoSeconds: 4,
      useHeroUploadForFirstScene: true,
      useHeroUploadForLastScene: true
    };
  }

  if (productCategory === 'perfume-fragrance') {
    return {
      anchors: Array.from(
        new Set([
          ...descriptionTokens.filter((token) =>
            [
              'perfume',
              'fragrance',
              'cologne',
              'scent',
              'bottle',
              'spray',
              'luxury',
              'masculine',
              'feminine',
              'grooming',
              'elegant'
            ].includes(token)
          ),
          'perfume',
          'fragrance',
          'bottle',
          'spray',
          'luxury'
        ])
      ),
      avoidTokens: Array.from(perfumeMismatchTokens),
      preferStillImages: false,
      requireAnchorMatch: false,
      minimumVideoDurationRatio: 0.78,
      minimumVideoSeconds: 4,
      useHeroUploadForFirstScene: true,
      useHeroUploadForLastScene: true
    };
  }

  if (productCategory === 'fitness-wellness') {
    return {
      anchors: descriptionTokens.filter((token) =>
        ['fitness', 'home', 'workout', 'training', 'exercise', 'stronger', 'program', 'progress'].includes(token)
      ),
      avoidTokens: Array.from(fitnessMismatchTokens),
      preferStillImages: false,
      requireAnchorMatch: false,
      minimumVideoDurationRatio: 0.82,
      minimumVideoSeconds: 5,
      useHeroUploadForFirstScene: true,
      useHeroUploadForLastScene: false
    };
  }

  if (productCategory === 'fashion-accessories') {
    const footwearBrief = descriptionTokens.some((token) =>
      ['footwear', 'run', 'running', 'shoe', 'shoes', 'sneaker', 'sneakers', 'trainer', 'trainers'].includes(token)
    );

    return {
      anchors: Array.from(
        new Set([
          ...descriptionTokens.filter((token) =>
            [
              'accessory',
              'athletic',
              'fashion',
              'footwear',
              'laces',
              'luxury',
              'outfit',
              'run',
              'running',
              'shoe',
              'shoes',
              'sneaker',
              'sneakers',
              'streetwear',
              'style',
              'trainer',
              'trainers',
              'walking'
            ].includes(token)
          ),
          ...(footwearBrief ? ['sneaker', 'shoe', 'footwear'] : ['fashion', 'style', 'accessory'])
        ])
      ),
      avoidTokens: Array.from(fashionMismatchTokens),
      preferStillImages: false,
      requireAnchorMatch: footwearBrief,
      minimumVideoDurationRatio: 0.82,
      minimumVideoSeconds: 4,
      useHeroUploadForFirstScene: true,
      useHeroUploadForLastScene: true
    };
  }

  if (productCategory === 'home-lifestyle') {
    return {
      anchors: Array.from(
        new Set([
          ...descriptionTokens.filter((token) =>
            [
              'architecture',
              'estate',
              'exterior',
              'field',
              'football',
              'garden',
              'grass',
              'gym',
              'home',
              'house',
              'interior',
              'lifestyle',
              'lawn',
              'luxury',
              'mansion',
              'pitch',
              'premium',
              'property',
              'real',
              'soccer',
              'villa'
            ].includes(token)
          ),
          'luxury',
          'villa',
          'estate',
          'mansion',
          'interior'
        ])
      ),
      avoidTokens: Array.from(homeLifestyleMismatchTokens),
      preferStillImages: false,
      requireAnchorMatch: true,
      minimumVideoDurationRatio: 0.82,
      minimumVideoSeconds: 5,
      useHeroUploadForFirstScene: false,
      useHeroUploadForLastScene: false
    };
  }

  if (productCategory === 'sports-football') {
    const anchors = Array.from(
      new Set([
        ...descriptionTokens.filter((token) =>
          [
            'soccer',
            'football',
            'match',
            'stadium',
            'fans',
            'crowd',
            'goal',
            'celebration',
            'highlights',
            'kickoff',
            'dribble',
            'tackle',
            'referee',
            'rivalry'
          ].includes(token)
        ),
        'soccer',
        'stadium',
        'goal',
        'fans'
      ])
    );

    return {
      anchors,
      avoidTokens: Array.from(footballMismatchTokens),
      preferStillImages: false,
      requireAnchorMatch: false,
      minimumVideoDurationRatio: 0.82,
      minimumVideoSeconds: 4,
      useHeroUploadForFirstScene: true,
      useHeroUploadForLastScene: false
    };
  }

  if (isEsportsBrief(description, productCategory)) {
    return {
      anchors: descriptionTokens.filter((token) =>
        [
          'arena',
          'crowd',
          'esports',
          'gaming',
          'headset',
          'keyboard',
          'major',
          'mouse',
          'player',
          'stage',
          'tournament',
          'trophy'
        ].includes(token)
      ),
      avoidTokens: Array.from(esportsMismatchTokens),
      preferStillImages: false,
      requireAnchorMatch: false,
      minimumVideoDurationRatio: 0.8,
      minimumVideoSeconds: 4,
      useHeroUploadForFirstScene: true,
      useHeroUploadForLastScene: false
    };
  }

  return {
    anchors: descriptionTokens.slice(0, 6),
    avoidTokens: [],
    preferStillImages: false,
    requireAnchorMatch: false,
    minimumVideoDurationRatio: 0.75,
    minimumVideoSeconds: 4,
    useHeroUploadForFirstScene: true,
    useHeroUploadForLastScene: false
  };
};

const scoreCandidate = ({
  candidate,
  scene,
  productCategory,
  targetDuration,
  description,
  strategy
}: {
  candidate: MediaCandidate;
  scene: ScriptScene;
  productCategory: string;
  targetDuration: number;
  description: string;
  strategy: MediaStrategy;
}) => {
  const sceneTokens = Array.from(
    new Set(
      tokenize(
        [
          scene.headline,
          scene.visualBrief,
          ...(scene.onScreenText || []),
          ...(scene.pexelsKeywords || [])
        ].join(' ')
      )
    )
  );
  const categoryTokens = Array.from(new Set(tokenize(productCategory.replace(/-/g, ' '))));
  const queryTokens = Array.from(new Set(tokenize(candidate.query)));
  const descriptionTokens = Array.from(new Set(tokenize(description)));
  const anchorTokens = strategy.anchors.length ? strategy.anchors : descriptionTokens.slice(0, 6);
  const matchedSceneTokens = sceneTokens.filter((token) => queryTokens.includes(token)).length;
  const matchedCategoryTokens = categoryTokens.filter((token) => queryTokens.includes(token)).length;
  const matchedAnchorTokens = anchorTokens.filter((token) => queryTokens.includes(token)).length;
  const genericPenalty = queryTokens.filter((token) => genericQueryTokens.has(token)).length;
  const mismatchPenalty = queryTokens.filter(
    (token) => strategy.avoidTokens.includes(token) && !descriptionTokens.includes(token)
  ).length;
  const aspect = candidate.width / Math.max(candidate.height, 1);
  const aspectScore = Math.max(0, 2.6 - Math.abs(aspect - TARGET_ASPECT_RATIO) * 4.5);
  const pixelCount = candidate.width * candidate.height;
  const resolutionScore =
    pixelCount >= 3840 * 2160
      ? 2.7
      : pixelCount >= 2560 * 1440
        ? 2.1
        : pixelCount >= 1080 * 1920
      ? 1.5
      : pixelCount >= 720 * 1280
        ? 1
        : 0.4;

  let score =
    matchedSceneTokens * 0.9 +
    matchedCategoryTokens * 0.6 +
    matchedAnchorTokens * 1.35 +
    aspectScore +
    resolutionScore;

  if (candidate.kind === 'video') {
    score += 1.8;

    if (candidate.duration) {
      if (candidate.duration >= targetDuration + 1) {
        score += 2.6;
      } else if (candidate.duration >= targetDuration * strategy.minimumVideoDurationRatio) {
        score += 1.4;
      } else {
        score -= Math.min((targetDuration - candidate.duration) * 1.7, 4.8);
      }

      if (candidate.duration < strategy.minimumVideoSeconds) {
        score -= 3.2;
      }
    } else {
      score -= 0.8;
    }
  } else {
    score += strategy.preferStillImages ? 1.2 : -0.7;
  }

  score -= genericPenalty * 0.35;
  score -= mismatchPenalty * 2.2;
  if (strategy.requireAnchorMatch && matchedAnchorTokens === 0) {
    score -= 3.4;
  }

  return Number(score.toFixed(2));
};

const shouldPreferImageOverVideo = ({
  bestCandidate,
  imageCandidate,
  targetDuration,
  strategy,
  description
}: {
  bestCandidate: MediaCandidate;
  imageCandidate?: MediaCandidate;
  targetDuration: number;
  strategy: MediaStrategy;
  description: string;
}) => {
  if (bestCandidate.kind !== 'video') {
    return false;
  }

  const descriptionTokens = Array.from(new Set(tokenize(description)));
  const queryTokens = Array.from(new Set(tokenize(bestCandidate.query)));
  const matchedAnchorTokens = strategy.anchors.filter((token) => queryTokens.includes(token)).length;
  const durationTooShort =
    typeof bestCandidate.duration === 'number' &&
    bestCandidate.duration <
      Math.max(targetDuration * strategy.minimumVideoDurationRatio, strategy.minimumVideoSeconds);
  const mismatchedSubject = queryTokens.some(
    (token) => strategy.avoidTokens.includes(token) && !descriptionTokens.includes(token)
  );

  if (strategy.preferStillImages && (durationTooShort || mismatchedSubject || matchedAnchorTokens === 0)) {
    return Boolean(imageCandidate);
  }

  return false;
};

const buildSelectionReason = ({
  candidate,
  score,
  targetDuration
}: {
  candidate: MediaCandidate;
  score: number;
  targetDuration: number;
}) => {
  if (candidate.kind === 'video') {
    const pixelCount = candidate.width * candidate.height;
    const qualityDescriptor =
      pixelCount >= 3840 * 2160
        ? 'ultra-high-resolution'
        : pixelCount >= 2560 * 1440
          ? 'high-resolution'
          : 'scene-ready';

    if ((candidate.duration || 0) >= targetDuration) {
      return `Selected a ${qualityDescriptor} video match with better vertical framing and enough duration for the ${targetDuration.toFixed(1)}s scene.`;
    }

    return `Selected the strongest ${qualityDescriptor} video match and will hold the ending frame instead of looping it. Score ${score.toFixed(1)}.`;
  }

  return `Selected a still image because it matched the brief better than the available video clips. Score ${score.toFixed(1)}.`;
};

const estimateVoiceDurationSeconds = (text: string) => {
  const words = text
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean).length;

  return Math.max(3.2, Number((words * 0.42).toFixed(2)));
};

const buildQuerySignature = (value: string) =>
  Array.from(new Set(tokenize(value).filter((token) => !querySignatureNoiseTokens.has(token)))).slice(0, 8);

const extractCreatorKey = (candidate: MediaCandidate) =>
  String(candidate.attribution || '')
    .toLowerCase()
    .replace(/^pexels\s*\/\s*/i, '')
    .trim();

const jaccardSimilarity = (left: string[], right: string[]) => {
  if (!left.length || !right.length) {
    return 0;
  }

  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const intersection = [...leftSet].filter((token) => rightSet.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
};

const scoreDiversityAdjustment = ({
  candidate,
  selectionState
}: {
  candidate: MediaCandidate;
  selectionState: MediaSelectionState;
}) => {
  const signature = buildQuerySignature(candidate.query);
  const maxSimilarity = selectionState.usedQuerySignatures.reduce((highest, priorSignature) => {
    return Math.max(highest, jaccardSimilarity(signature, priorSignature));
  }, 0);

  let adjustment = 0;
  if (maxSimilarity >= 0.8) {
    adjustment -= 3.2;
  } else if (maxSimilarity >= 0.62) {
    adjustment -= 1.9;
  } else if (maxSimilarity >= 0.45) {
    adjustment -= 0.9;
  } else if (selectionState.usedQuerySignatures.length > 0 && maxSimilarity <= 0.2) {
    adjustment += 0.55;
  }

  const creatorKey = extractCreatorKey(candidate);
  if (creatorKey && selectionState.usedCreatorKeys.has(creatorKey)) {
    adjustment -= 0.65;
  }

  return Number(adjustment.toFixed(2));
};

const getMaxSignatureSimilarity = ({
  signature,
  selectionState
}: {
  signature: string[];
  selectionState: MediaSelectionState;
}) =>
  selectionState.usedQuerySignatures.reduce((highest, priorSignature) => {
    return Math.max(highest, jaccardSimilarity(signature, priorSignature));
  }, 0);

const shouldSkipNearDuplicateOption = ({
  option,
  ranked,
  selectionState
}: {
  option: { candidate: MediaCandidate; score: number };
  ranked: Array<{ candidate: MediaCandidate; score: number }>;
  selectionState: MediaSelectionState;
}) => {
  if (!selectionState.usedQuerySignatures.length) {
    return false;
  }

  const signature = buildQuerySignature(option.candidate.query);
  if (!signature.length) {
    return false;
  }

  const maxSimilarity = getMaxSignatureSimilarity({
    signature,
    selectionState
  });
  if (maxSimilarity < 0.78) {
    return false;
  }

  const bestDistinctAlternative = ranked.find((candidateOption) => {
    if (candidateOption.candidate.externalId === option.candidate.externalId) {
      return false;
    }

    const alternativeSignature = buildQuerySignature(candidateOption.candidate.query);
    if (!alternativeSignature.length) {
      return false;
    }

    return (
      getMaxSignatureSimilarity({
        signature: alternativeSignature,
        selectionState
      }) <= 0.42
    );
  });

  if (!bestDistinctAlternative) {
    return false;
  }

  const scoreGap = Number((option.score - bestDistinctAlternative.score).toFixed(2));
  return maxSimilarity >= 0.9 ? scoreGap < 2.4 : scoreGap < 1.15;
};

const reserveSelection = (selectionState: MediaSelectionState, candidate: MediaCandidate) => {
  const mediaKey = candidate.externalId || candidate.url;
  if (!mediaKey) {
    return () => undefined;
  }

  if (selectionState.usedMediaKeys.has(mediaKey)) {
    return null;
  }

  selectionState.usedMediaKeys.add(mediaKey);
  const signature = buildQuerySignature(candidate.query);
  const creatorKey = extractCreatorKey(candidate);
  selectionState.usedQuerySignatures.push(signature);
  if (creatorKey) {
    selectionState.usedCreatorKeys.set(creatorKey, (selectionState.usedCreatorKeys.get(creatorKey) || 0) + 1);
  }

  return () => {
    selectionState.usedMediaKeys.delete(mediaKey);
    const signatureIndex = selectionState.usedQuerySignatures.findIndex(
      (item) => item.join('|') === signature.join('|')
    );
    if (signatureIndex >= 0) {
      selectionState.usedQuerySignatures.splice(signatureIndex, 1);
    }
    if (creatorKey) {
      const nextCount = (selectionState.usedCreatorKeys.get(creatorKey) || 1) - 1;
      if (nextCount <= 0) {
        selectionState.usedCreatorKeys.delete(creatorKey);
      } else {
        selectionState.usedCreatorKeys.set(creatorKey, nextCount);
      }
    }
  };
};

const registerFixedMediaSelection = (selectionState: MediaSelectionState, media: MediaCandidate) => {
  const mediaKey = media.externalId || media.url;
  if (mediaKey) {
    selectionState.usedMediaKeys.add(mediaKey);
  }

  const signature = buildQuerySignature(media.query);
  if (signature.length) {
    selectionState.usedQuerySignatures.push(signature);
  }

  const creatorKey = extractCreatorKey(media);
  if (creatorKey) {
    selectionState.usedCreatorKeys.set(creatorKey, (selectionState.usedCreatorKeys.get(creatorKey) || 0) + 1);
  }
};

const prepareSceneMedia = async ({
  scene,
  productImagePath,
  style,
  productCategory,
  description,
  sceneDir,
  allowStyleTransfer,
  targetDuration,
  sceneIndex,
  sceneCount,
}: {
  scene: ScriptScene;
  productImagePath: string;
  style: string;
  productCategory: string;
  description: string;
  sceneDir: string;
  allowStyleTransfer: boolean;
  targetDuration: number;
  sceneIndex: number;
  sceneCount: number;
}): Promise<PreparedSceneMedia> => {
  const strategy = buildMediaStrategy(description, productCategory);
  const perfumeUploadLocked = isPerfumeUploadLocked(productCategory, productImagePath);
  const perfumeProductScene = perfumeUploadLocked && isPerfumeProductScene(scene);
  if (
    productImagePath &&
    ((strategy.useHeroUploadForFirstScene && sceneIndex === 0) ||
      (strategy.useHeroUploadForLastScene && sceneIndex === sceneCount - 1))
  ) {
    return {
      scene,
      mediaSearchScene: scene,
      productImagePath,
      style,
      productCategory,
      description,
      sceneDir,
      allowStyleTransfer,
      targetDuration,
      sceneIndex,
      sceneCount,
      strategy,
      candidates: [],
      fixedMedia: createUploadFallback(
        productImagePath,
        sceneIndex === 0
          ? 'Used the uploaded product image to open with a product-faithful hero scene.'
          : 'Used the uploaded product image to close with a clear product-and-CTA hero shot.'
      )
    };
  }

  if (perfumeProductScene) {
    return {
      scene,
      mediaSearchScene: scene,
      productImagePath,
      style,
      productCategory,
      description,
      sceneDir,
      allowStyleTransfer,
      targetDuration,
      sceneIndex,
      sceneCount,
      strategy,
      candidates: [],
      fixedMedia: createUploadFallback(
        productImagePath,
        'Locked this perfume product scene to the uploaded bottle so competing fragrance products never replace it.'
      )
    };
  }

  const mediaSearchScene =
    perfumeUploadLocked && !perfumeProductScene ? buildPerfumeSupportScene(scene) : scene;
  const searchMode =
    perfumeUploadLocked && !perfumeProductScene ? 'perfume-support' : 'default';
  const candidates = await findSceneMedia(mediaSearchScene, productCategory, description, searchMode);

  return {
    scene,
    mediaSearchScene,
    productImagePath,
    style,
    productCategory,
    description,
    sceneDir,
    allowStyleTransfer,
    targetDuration,
    sceneIndex,
    sceneCount,
    strategy,
    candidates
  };
};

const finalizePreparedMedia = async (
  prepared: PreparedSceneMedia,
  selectionState: MediaSelectionState
): Promise<MediaCandidate> => {
  const {
    scene,
    mediaSearchScene,
    productImagePath,
    style,
    productCategory,
    description,
    sceneDir,
    allowStyleTransfer,
    targetDuration,
    strategy,
    candidates,
    fixedMedia
  } = prepared;

  if (fixedMedia) {
    registerFixedMediaSelection(selectionState, fixedMedia);
    return fixedMedia;
  }

  if (candidates.length >= 1) {
    const ranked = [...candidates]
      .filter((candidate) => !selectionState.usedMediaKeys.has(candidate.externalId || candidate.url))
      .map((candidate) => {
        const baseScore = scoreCandidate({
          candidate,
          scene: mediaSearchScene,
          productCategory,
          targetDuration,
          description,
          strategy
        });
        const diversityAdjustment = scoreDiversityAdjustment({
          candidate,
          selectionState
        });

        return {
          candidate,
          baseScore,
          diversityAdjustment,
          score: Number((baseScore + diversityAdjustment).toFixed(2))
        };
      })
      .sort((left, right) => right.score - left.score);

    const imageOption = ranked.find((item) => item.candidate.kind !== 'video');
    const best = ranked[0];
    const preferred =
      best &&
      imageOption &&
      shouldPreferImageOverVideo({
        bestCandidate: best.candidate,
        imageCandidate: imageOption.candidate,
        targetDuration,
        strategy,
        description
      })
        ? imageOption
        : best;

    const rankedSelections =
      preferred && best && preferred.candidate.externalId !== best.candidate.externalId
        ? [preferred, ...ranked.filter((item) => item.candidate.externalId !== preferred.candidate.externalId)]
        : ranked;

    for (const option of rankedSelections) {
      if (option.score < 4.4 && productImagePath) {
        continue;
      }
      if (shouldSkipNearDuplicateOption({ option, ranked: rankedSelections, selectionState })) {
        continue;
      }

      const selected = option.candidate;
      const releaseReservation = reserveSelection(selectionState, selected);
      if (releaseReservation === null) {
        continue;
      }

      try {
        const extension = selected.kind === 'video' ? 'mp4' : 'jpg';
        const localPath = await downloadToFile({
          url: selected.url,
          outputDir: sceneDir,
          label: `${scene.sceneNumber}-${selected.kind}`,
          extension
        });

        return {
          ...selected,
          localPath,
          selectionScore: option.score,
          selectionReason: buildSelectionReason({
            candidate: selected,
            score: option.score,
            targetDuration
          })
        } satisfies MediaCandidate;
      } catch (error) {
        releaseReservation?.();
        if (option === rankedSelections[rankedSelections.length - 1]) {
          throw error;
        }
      }
    }

    if (!productImagePath && best) {
      for (const option of ranked) {
        if (shouldSkipNearDuplicateOption({ option, ranked, selectionState })) {
          continue;
        }

        const selected = option.candidate;
        const releaseReservation = reserveSelection(selectionState, selected);
        if (releaseReservation === null) {
          continue;
        }

        try {
          const extension = selected.kind === 'video' ? 'mp4' : 'jpg';
          const localPath = await downloadToFile({
            url: selected.url,
            outputDir: sceneDir,
            label: `${scene.sceneNumber}-${selected.kind}`,
            extension
          });

          return {
            ...selected,
            localPath,
            selectionScore: option.score,
            selectionReason:
              option.score >= 0
                ? 'Used the strongest stock match because no product image was uploaded for this scene.'
                : 'Used the least-wrong stock match because no product image was uploaded for this scene.'
          } satisfies MediaCandidate;
        } catch (error) {
          releaseReservation?.();
          if (option === ranked[ranked.length - 1]) {
            throw error;
          }
        }
      }
    }
  }

  if (allowStyleTransfer && productImagePath && candidates.length === 0) {
    const replicate = await createReplicateStyledImages({
      productImagePath,
      prompt: scene.imagePrompt,
      style,
      outputDir: sceneDir
    });

    if (replicate[0]) {
      return {
        ...replicate[0],
        selectionReason:
          'Used experimental style-transfer fallback because no stock media matched this scene.'
      };
    }

    const stability = await createStabilityFallbackImage({
      prompt: scene.imagePrompt,
      outputDir: sceneDir
    });

    if (stability) {
      return {
        ...stability,
        selectionReason:
          'Used experimental image fallback because no stock media matched this scene.'
      };
    }
  }

  if (!productImagePath) {
    const stability = await createStabilityFallbackImage({
      prompt: scene.imagePrompt,
      outputDir: sceneDir
    });

    if (stability) {
      return {
        ...stability,
        selectionReason:
          'Used generated fallback imagery because no product image was uploaded and stock matches were weak.'
      };
    }
    throw new Error(
      'No usable media was found for this scene. Add a product image or refine the description with more visual detail.'
    );
  }

  return createUploadFallback(productImagePath);
};

export const processVideoJob = async (jobId: string) => {
  const videoJob = await VideoJob.findById(jobId);
  if (!videoJob) {
    throw new Error(`Job ${jobId} was not found.`);
  }

  const jobDir = path.join(config.workingDir, String(videoJob._id));
  await ensureDir(jobDir);
  const jobStartedAt = Date.now();
  const phaseTimings: JobPerformanceTimings = {};

  await publishJobProgress(String(videoJob._id), {
    status: 'processing',
    stage: 'writing-script',
    progress: 10,
    message: 'Writing a conversion-focused script...'
  });

  const scriptStartedAt = Date.now();
  const script = await generateScriptPackage(
    videoJob.description,
    videoJob.style,
    videoJob.productCategory || 'general-product'
  );
  phaseTimings.scriptMs = Date.now() - scriptStartedAt;
  videoJob.script = script;
  videoJob.metadata = mergeJobMetadata(videoJob.metadata, {
    jobFolder: jobDir,
    sceneCount: script.scenes.length,
    startedAt: new Date()
  });
  await videoJob.save();

  await publishJobProgress(String(videoJob._id), {
    status: 'processing',
    stage: 'generating-voice',
    progress: 34,
    message: 'Generating voice and sourcing premium media in parallel...'
  });

  let completedMediaSelections = 0;
  const estimatedDurations = script.scenes.map((scene) => estimateVoiceDurationSeconds(scene.voiceover));

  const voiceStartedAt = Date.now();
  const voicePromise = generateVoiceSegments({
    texts: script.scenes.map((scene) => scene.voiceover),
    workingDir: path.join(jobDir, 'voice')
  }).then((segments) => {
    phaseTimings.voiceMs = Date.now() - voiceStartedAt;
    return segments;
  });

  const mediaStartedAt = Date.now();
  const primaryImagePath = videoJob.imagePath || '';
  const secondaryImagePath = videoJob.secondaryImagePath || '';
  const mediaPromise = mapWithConcurrency(
    script.scenes,
    config.mediaSelectionConcurrency,
    async (scene, index) => {
      const sceneDir = path.join(jobDir, `scene-${scene.sceneNumber}`);
      const prepared = await prepareSceneMedia({
        scene,
        productImagePath: selectProductImageForScene({
          primaryImagePath,
          secondaryImagePath,
          sceneIndex: index,
          sceneCount: script.scenes.length
        }),
        style: videoJob.style,
        productCategory: videoJob.productCategory || 'general-product',
        description: videoJob.description,
        sceneDir,
        allowStyleTransfer: videoJob.enableStyleTransfer,
        targetDuration: estimatedDurations[index],
        sceneIndex: index,
        sceneCount: script.scenes.length
      });

      completedMediaSelections += 1;
      await publishJobProgress(String(videoJob._id), {
        status: 'processing',
        stage: 'finding-media',
        progress: Math.min(60, 36 + Math.round((completedMediaSelections / script.scenes.length) * 24)),
        message: `Scanning premium media options ${completedMediaSelections}/${script.scenes.length} while voice timing finishes...`
      });

      return prepared;
    }
  ).then(async (preparedScenes) => {
    const selectionState: MediaSelectionState = {
      usedMediaKeys: new Set<string>(),
      usedQuerySignatures: [],
      usedCreatorKeys: new Map<string, number>()
    };
    const orderedPreparedScenes = [...preparedScenes].sort((left, right) => left.sceneIndex - right.sceneIndex);
    const mediaSelections: MediaCandidate[] = [];

    for (const [index, prepared] of orderedPreparedScenes.entries()) {
      mediaSelections.push(await finalizePreparedMedia(prepared, selectionState));
      await publishJobProgress(String(videoJob._id), {
        status: 'processing',
        stage: 'finding-media',
        progress: Math.min(70, 60 + Math.round(((index + 1) / orderedPreparedScenes.length) * 10)),
        message: `Selecting unique high-quality media ${index + 1}/${orderedPreparedScenes.length} for the final cut...`
      });
    }

    phaseTimings.mediaMs = Date.now() - mediaStartedAt;
    return mediaSelections;
  });

  const [voiceSegments, mediaSelections] = await Promise.all([voicePromise, mediaPromise]);
  const plans: SceneRenderPlan[] = script.scenes.map((scene, index) => ({
    index,
    scene,
    media: mediaSelections[index],
    voice: voiceSegments[index],
    totalDuration: voiceSegments[index].duration
  }));

  videoJob.script = {
    ...script,
    scenes: script.scenes.map((scene, index) => ({
      ...scene,
      media: plans[index].media,
      voicePath: plans[index].voice.path,
      voiceDuration: plans[index].voice.duration,
      alignment: plans[index].voice.alignment,
      captions: plans[index].voice.captions
    }))
  };
  await videoJob.save();

  await publishJobProgress(String(videoJob._id), {
    status: 'processing',
    stage: 'rendering-video',
    progress: 72,
    message: 'Rendering scenes in parallel for the final master...'
  });

  const renderStartedAt = Date.now();
  const music = await selectBackgroundMusic();
  const rendered = await renderMarketingVideo({
    plans,
    productImagePath: videoJob.imagePath || '',
    jobDir,
    musicPath: music.path,
    onSceneRendered: async ({ completedScenes, totalScenes }) => {
      await publishJobProgress(String(videoJob._id), {
        status: 'processing',
        stage: 'rendering-video',
        progress: Math.min(84, 72 + Math.round((completedScenes / totalScenes) * 12)),
        message: `Rendering scene stack ${completedScenes}/${totalScenes}...`
      });
    },
    onPhaseChange: async ({ phase }) => {
      if (phase === 'concatenating-scenes') {
        await publishJobProgress(String(videoJob._id), {
          status: 'processing',
          stage: 'rendering-video',
          progress: 87,
          message: 'Assembling the rendered scene sequence...'
        });
        return;
      }

      if (phase === 'mixing-audio') {
        await publishJobProgress(String(videoJob._id), {
          status: 'processing',
          stage: 'rendering-video',
          progress: 91,
          message: 'Mixing voiceover and soundtrack...'
        });
        return;
      }

      await publishJobProgress(String(videoJob._id), {
        status: 'processing',
        stage: 'rendering-video',
        progress: 95,
        message: 'Finalizing the master export...'
      });
    }
  });
  phaseTimings.renderMs = Date.now() - renderStartedAt;

  await publishJobProgress(String(videoJob._id), {
    status: 'processing',
    stage: 'uploading-assets',
    progress: 97,
    message: 'Uploading final assets...'
  });

  const uploadStartedAt = Date.now();
  const [videoAsset, voiceAsset, sceneAssets] = await Promise.all([
    uploadAsset(
      rendered.outputPath,
      `${videoJob._id}/final/${path.basename(rendered.outputPath)}`
    ),
    uploadAsset(
      rendered.voicePath,
      `${videoJob._id}/audio/${path.basename(rendered.voicePath)}`
    ),
    Promise.all(
      rendered.scenePaths.map((scenePath, index) =>
        uploadAsset(scenePath, `${videoJob._id}/scenes/scene-${index + 1}.mp4`)
      )
    )
  ]);
  phaseTimings.uploadMs = Date.now() - uploadStartedAt;
  const videoAssetWithLocalPath = {
    ...videoAsset,
    localPath: videoAsset.localPath || rendered.outputPath
  };

  videoJob.output = {
    video: videoAssetWithLocalPath,
    preview: videoAssetWithLocalPath,
    voiceover: voiceAsset,
    sceneFiles: sceneAssets,
    trim: videoJob.output?.trim
  };
  videoJob.metadata = mergeJobMetadata(videoJob.metadata, {
    durationSeconds: rendered.durationSeconds,
    musicSource: music.source,
    performance: {
      totalElapsedMs: Date.now() - jobStartedAt,
      targetElapsedMs: 120_000,
      phaseDurations: phaseTimings,
      concurrency: {
        voiceGeneration: config.voiceGenerationConcurrency,
        mediaSelection: config.mediaSelectionConcurrency,
        sceneRendering: config.renderSceneConcurrency
      }
    },
    completedAt: new Date()
  });
  videoJob.status = 'completed';
  videoJob.stage = 'completed';
  videoJob.progress = 100;
  videoJob.message = 'Video ready to preview and export.';
  await videoJob.save();

  await publishJobProgress(String(videoJob._id), {
    status: 'completed',
    stage: 'completed',
    progress: 100,
    message: 'Video ready to preview and export.',
    videoUrl: videoAsset.url,
    previewUrl: videoAsset.url
  });

  const manifestPath = path.join(jobDir, 'manifest.json');
  await fs.writeFile(
    manifestPath,
    JSON.stringify(
      {
        videoUrl: videoAsset.url,
        voiceUrl: voiceAsset.url,
        localVideoPath: relativeFrom(config.rootDir, rendered.outputPath),
        performance: videoJob.metadata?.performance
      },
      null,
      2
    )
  );

  return videoJob;
};
