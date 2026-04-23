import { MediaCandidate, ScriptScene } from '../types';
import { config } from '../config';

const TARGET_ASPECT_RATIO = 9 / 16;
const PEXELS_VIDEO_RESULTS_PER_QUERY = 14;
const PEXELS_PHOTO_RESULTS_PER_QUERY = 12;
const MAX_SELECTED_RESULTS = 10;
const HIGH_QUALITY_VIDEO_PIXELS = 1920 * 1080;
const ULTRA_QUALITY_VIDEO_PIXELS = 2560 * 1440;
const foodAvoidTerms = new Set([
  'cake',
  'cream',
  'cupcake',
  'frosting',
  'icing',
  'shllag',
  'torte',
  'whipped'
]);
const fitnessAvoidTerms = new Set([
  'conversation',
  'desk',
  'interview',
  'meeting',
  'office',
  'podcast',
  'seminar',
  'talking'
]);
const beverageAvoidTerms = new Set([
  'beer',
  'coffee',
  'cocktail',
  'dessert',
  'meal',
  'office',
  'smoothie',
  'wine'
]);
const perfumeAvoidTerms = new Set([
  'app',
  'computer',
  'dessert',
  'food',
  'gaming',
  'gym',
  'kitchen',
  'laptop',
  'meeting',
  'office',
  'pet',
  'podcast',
  'skincare',
  'smartphone',
  'workout'
]);
const homeLifestyleAvoidTerms = new Set([
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
const fashionAvoidTerms = new Set([
  'balloon',
  'bridal',
  'business',
  'car',
  'conference',
  'desk',
  'engagement',
  'meeting',
  'office',
  'podcast',
  'proposal',
  'showroom',
  'valentine',
  'wedding'
]);
const esportsAvoidTerms = new Set([
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
const queryFocusNoiseTokens = new Set([
  'action',
  'ad',
  'brand',
  'branding',
  'campaign',
  'cinematic',
  'close',
  'detail',
  'dramatic',
  'hero',
  'lifestyle',
  'luxury',
  'marketing',
  'premium',
  'scene',
  'shot',
  'vertical'
]);

const isEsportsBrief = (description: string, productCategory: string) => {
  const normalized = `${productCategory} ${description}`.toLowerCase();
  return productCategory === 'gaming-esports' || esportsBriefTokens.some((token) => normalized.includes(token));
};

const normalizeQuery = (value: string) =>
  (() => {
    const tokens = Array.from(
      new Set(
        value
          .toLowerCase()
          .replace(/[-_/]+/g, ' ')
          .replace(/[^\w\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .split(' ')
          .filter(Boolean)
      )
    );

    if (tokens.length <= 10) {
      return tokens.join(' ');
    }

    return [...tokens.slice(0, 5), ...tokens.slice(-5)].join(' ');
  })();

const buildSceneFocusTokens = ({
  scene,
  description,
  productCategory
}: {
  scene: ScriptScene;
  description: string;
  productCategory: string;
}) => {
  const categoryTokens = new Set(tokenize(productCategory.replace(/-/g, ' ')));
  const descriptionTokens = tokenize(description).slice(0, 10);
  const sceneTokens = tokenize(
    [scene.headline, scene.visualBrief, ...(scene.onScreenText || []), ...(scene.pexelsKeywords || [])].join(' ')
  );

  return unique(
    [...sceneTokens, ...descriptionTokens].filter(
      (token) => !categoryTokens.has(token) && !queryFocusNoiseTokens.has(token)
    )
  ).slice(0, 8);
};

const expandAnchors = ({
  anchors,
  focusPhrase,
  leadKeyword
}: {
  anchors: string[];
  focusPhrase: string;
  leadKeyword: string;
}) =>
  anchors.slice(0, 4).flatMap((anchor) => [
    anchor,
    focusPhrase ? `${anchor} ${focusPhrase}` : '',
    leadKeyword ? `${anchor} ${leadKeyword}` : ''
  ]);

const pexelsVideoSearch = async (query: string, orientation: 'portrait' | 'landscape') => {
  const url = new URL('https://api.pexels.com/videos/search');
  url.searchParams.set('query', query);
  url.searchParams.set('per_page', String(PEXELS_VIDEO_RESULTS_PER_QUERY));
  url.searchParams.set('orientation', orientation);
  url.searchParams.set('size', 'large');

  const response = await fetch(url, {
    headers: {
      Authorization: config.pexelsApiKey
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Pexels video search failed: ${response.status} ${errorText}`);
  }

  return response.json();
};

const pexelsPhotoSearch = async (query: string, orientation: 'portrait' | 'landscape' = 'portrait') => {
  const url = new URL('https://api.pexels.com/v1/search');
  url.searchParams.set('query', query);
  url.searchParams.set('per_page', String(PEXELS_PHOTO_RESULTS_PER_QUERY));
  url.searchParams.set('orientation', orientation);

  const response = await fetch(url, {
    headers: {
      Authorization: config.pexelsApiKey
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Pexels photo search failed: ${response.status} ${errorText}`);
  }

  return response.json();
};

const sortByResolution = <T extends { width: number; height: number }>(items: T[]) =>
  [...items].sort((a, b) => b.width * b.height - a.width * a.height);

const scoreVideoFile = (file: { width: number; height: number }) => {
  const aspect = file.width / Math.max(file.height, 1);
  const aspectDelta = Math.abs(aspect - TARGET_ASPECT_RATIO);
  const portraitBonus = file.height >= file.width ? 1.5 : 0;
  const resolutionScore = (file.width * file.height) / 1_000_000;
  const pixelCount = file.width * file.height;
  const qualityBonus =
    pixelCount >= ULTRA_QUALITY_VIDEO_PIXELS
      ? 2.4
      : pixelCount >= HIGH_QUALITY_VIDEO_PIXELS
        ? 1.5
        : pixelCount >= 720 * 1280
          ? 0.8
          : 0;

  return portraitBonus + resolutionScore + qualityBonus - aspectDelta * 2.5;
};

const sortVideoFiles = (
  items: Array<{ width: number; height: number; link: string; file_type: string }>
) => [...items].sort((a, b) => scoreVideoFile(b) - scoreVideoFile(a));

type VideoMediaCandidate = MediaCandidate & {
  kind: 'video';
  source: 'pexels';
};

const tokenize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);

const unique = (items: string[]) => Array.from(new Set(items.filter(Boolean)));
const sceneCameraHints = (scene: ScriptScene) => {
  const combinedTokens = tokenize(
    [scene.headline, scene.visualBrief, ...(scene.onScreenText || []), ...(scene.pexelsKeywords || [])].join(' ')
  );
  const hints = [
    scene.sceneNumber === 1 ? 'hero shot vertical' : '',
    scene.sceneNumber === 1 ? 'dramatic close up' : '',
    scene.sceneNumber === 2 ? 'hands using product' : '',
    scene.sceneNumber >= 3 ? 'lifestyle action vertical' : '',
    combinedTokens.some((token) => ['bottle', 'dessert', 'package', 'perfume', 'product', 'serum'].includes(token))
      ? 'macro detail close up'
      : '',
    combinedTokens.some((token) => ['footwear', 'shoe', 'shoes', 'sneaker', 'sneakers', 'trainer', 'trainers'].includes(token))
      ? 'shoe detail close up'
      : '',
    combinedTokens.some((token) => ['beverage', 'can', 'drink', 'energy', 'ice'].includes(token))
      ? 'cold can close up'
      : '',
    combinedTokens.some((token) => ['apply', 'hold', 'serve', 'spray', 'use', 'using'].includes(token))
      ? 'hands in action'
      : '',
    combinedTokens.some((token) => ['crowd', 'stadium', 'tournament'].includes(token))
      ? 'wide atmosphere crowd'
      : '',
    combinedTokens.some((token) => ['glow', 'luxury', 'premium'].includes(token))
      ? 'premium cinematic lighting'
      : '',
    combinedTokens.some((token) => ['fitness', 'training', 'workout'].includes(token))
      ? 'movement training vertical'
      : '',
    combinedTokens.some((token) => ['architecture', 'estate', 'house', 'interior', 'mansion', 'property', 'villa'].includes(token))
      ? 'luxury architecture vertical'
      : '',
    combinedTokens.some((token) => ['field', 'football', 'garden', 'grass', 'lawn', 'soccer'].includes(token))
      ? 'estate grounds aerial'
      : '',
    combinedTokens.some((token) => ['gym', 'training', 'workout'].includes(token))
      ? 'private gym interior'
      : ''
  ];

  return unique(hints);
};

const buildFoodSignals = (description: string) => {
  const normalized = description.toLowerCase();

  if (normalized.includes('baklava')) {
    return {
      anchors: unique([
        'baklava',
        'pistachio baklava',
        'turkish baklava',
        'baklava dessert',
        'baklava serving',
        'pistachio pastry'
      ]),
      avoidTerms: Array.from(foodAvoidTerms)
    };
  }

  return {
    anchors: [] as string[],
    avoidTerms: [] as string[]
  };
};

const buildFitnessSignals = (description: string) => {
  const normalized = description.toLowerCase();
  const anchors = unique([
    normalized.includes('home') ? 'home workout' : '',
    normalized.includes('program') ? 'fitness program workout' : '',
    'fitness workout',
    'exercise at home',
    'personal training workout',
    'fitness transformation',
    'workout motivation',
    'stronger body workout'
  ]);

  return {
    anchors,
    avoidTerms: Array.from(fitnessAvoidTerms)
  };
};

const buildBeverageSignals = (description: string) => {
  const normalized = description.toLowerCase();
  const anchors = unique([
    'energy drink can',
    'cold drink can',
    'iced beverage close up',
    'energy drink pouring',
    'cold can condensation',
    'drink can in hand',
    normalized.includes('night') || normalized.includes('nightlife') ? 'nightlife drink party' : '',
    normalized.includes('gym') || normalized.includes('workout') ? 'energy drink gym' : '',
    normalized.includes('drive') || normalized.includes('driving') ? 'night driving drink' : '',
    normalized.includes('glass') ? 'drink on ice glass' : '',
    normalized.includes('gold') ? 'gold drink can' : '',
    normalized.includes('blue') ? 'blue can beverage' : ''
  ]);

  return {
    anchors,
    avoidTerms: Array.from(beverageAvoidTerms)
  };
};

const buildPerfumeSignals = (description: string) => {
  const normalized = description.toLowerCase();
  const anchors = unique([
    'perfume bottle luxury',
    'fragrance bottle close up',
    'perfume spray slow motion',
    'luxury fragrance product',
    'mens perfume luxury',
    'womens perfume luxury',
    normalized.includes('men') || normalized.includes('masculine') ? 'well dressed man perfume' : '',
    normalized.includes('women') || normalized.includes('feminine') ? 'elegant woman perfume' : '',
    normalized.includes('gold') ? 'gold perfume bottle luxury' : '',
    normalized.includes('black') ? 'black perfume bottle luxury' : '',
    normalized.includes('vanity') ? 'perfume vanity close up' : '',
    normalized.includes('spray') ? 'perfume spray close up' : ''
  ]);

  return {
    anchors,
    avoidTerms: Array.from(perfumeAvoidTerms)
  };
};

const buildHomeLifestyleSignals = (description: string, scene: ScriptScene) => {
  const normalized = `${description} ${scene.headline} ${scene.visualBrief} ${scene.pexelsKeywords.join(' ')}`.toLowerCase();
  const anchors = unique([
    'luxury villa exterior',
    'modern mansion exterior',
    'luxury estate aerial',
    'high end home interior',
    'architectural detail luxury home',
    normalized.includes('pool') ? 'luxury villa pool garden' : '',
    normalized.includes('interior') || normalized.includes('living') ? 'premium living room mansion' : '',
    normalized.includes('architecture') || normalized.includes('design') ? 'modern architecture house detail' : '',
    normalized.includes('gym') || normalized.includes('training') || normalized.includes('workout')
      ? 'private home gym luxury'
      : '',
    normalized.includes('gym') || normalized.includes('training') || normalized.includes('workout')
      ? 'luxury mansion gym interior'
      : '',
    normalized.includes('football') || normalized.includes('soccer') || normalized.includes('field') || normalized.includes('pitch')
      ? 'private football field estate'
      : '',
    normalized.includes('football') || normalized.includes('soccer') || normalized.includes('field') || normalized.includes('pitch')
      ? 'soccer field behind mansion'
      : '',
    normalized.includes('football') || normalized.includes('soccer') || normalized.includes('field') || normalized.includes('pitch')
      ? 'estate lawn aerial'
      : '',
    normalized.includes('garden') || normalized.includes('landscape') ? 'luxury estate garden' : ''
  ]);

  return {
    anchors,
    avoidTerms: Array.from(homeLifestyleAvoidTerms)
  };
};

const buildFashionSignals = (description: string, scene: ScriptScene) => {
  const normalized = `${description} ${scene.headline} ${scene.visualBrief} ${scene.pexelsKeywords.join(' ')}`.toLowerCase();
  const footwearBrief = ['footwear', 'shoe', 'shoes', 'sneaker', 'sneakers', 'trainer', 'trainers'].some((token) =>
    normalized.includes(token)
  );
  const anchors = unique([
    footwearBrief ? 'sneaker close up' : 'fashion detail close up',
    footwearBrief ? 'tying sneakers close up' : 'street style fashion',
    footwearBrief ? 'walking in sneakers city' : 'luxury fashion editorial',
    footwearBrief ? 'running shoes city' : 'premium accessory close up',
    footwearBrief ? 'streetwear sneakers outfit' : '',
    normalized.includes('black') ? 'black sneakers fashion' : '',
    normalized.includes('white') ? 'white sneakers fashion' : '',
    normalized.includes('run') || normalized.includes('running') ? 'athlete sneakers running' : '',
    normalized.includes('walk') || normalized.includes('walking') ? 'walking sneakers street style' : '',
    normalized.includes('city') || normalized.includes('urban') ? 'urban sneaker fashion' : ''
  ]);

  return {
    anchors,
    avoidTerms: Array.from(fashionAvoidTerms)
  };
};

const footballAvoidTerms = new Set([
  'nfl',
  'touchdown',
  'quarterback',
  'superbowl',
  'helmet',
  'american'
]);

const buildFootballSignals = (description: string) => {
  const normalized = description.toLowerCase();
  const anchors = unique([
    'soccer match',
    'football stadium',
    'soccer fans',
    'goal celebration',
    'soccer highlights',
    normalized.includes('stadium') ? 'soccer stadium crowd' : '',
    normalized.includes('fans') ? 'soccer fans cheering' : ''
  ]);

  return {
    anchors,
    avoidTerms: Array.from(footballAvoidTerms)
  };
};

const buildEsportsSignals = (description: string) => {
  const normalized = description.toLowerCase();
  const anchors = unique([
    'esports tournament',
    'gaming tournament stage',
    'pro gamer pc',
    'gaming arena crowd',
    'esports trophy celebration',
    'keyboard mouse close up',
    normalized.includes('crowd') ? 'esports crowd cheering' : '',
    normalized.includes('arena') ? 'gaming arena lights' : '',
    normalized.includes('player') ? 'esports player pc' : '',
    normalized.includes('trophy') ? 'championship trophy celebration' : ''
  ]);

  return {
    anchors,
    avoidTerms: Array.from(esportsAvoidTerms)
  };
};

const buildSearchQueries = ({
  scene,
  productCategory,
  description,
  searchMode = 'default'
}: {
  scene: ScriptScene;
  productCategory: string;
  description: string;
  searchMode?: 'default' | 'perfume-support';
}) => {
  const categoryText =
    searchMode === 'perfume-support'
      ? 'luxury lifestyle'
      : productCategory === 'home-lifestyle'
        ? 'luxury home real estate'
        : productCategory.replace(/-/g, ' ');
  const foodSignals = productCategory === 'food-dessert' ? buildFoodSignals(description) : null;
  const beverageSignals =
    productCategory === 'beverages-energy-drinks' ? buildBeverageSignals(description) : null;
  const perfumeSignals =
    productCategory === 'perfume-fragrance' && searchMode !== 'perfume-support'
      ? buildPerfumeSignals(description)
      : null;
  const fitnessSignals =
    productCategory === 'fitness-wellness' ? buildFitnessSignals(description) : null;
  const fashionSignals =
    productCategory === 'fashion-accessories' ? buildFashionSignals(description, scene) : null;
  const homeLifestyleSignals =
    productCategory === 'home-lifestyle' ? buildHomeLifestyleSignals(description, scene) : null;
  const footballSignals =
    productCategory === 'sports-football' ? buildFootballSignals(description) : null;
  const esportsSignals = isEsportsBrief(description, productCategory)
    ? buildEsportsSignals(description)
    : null;
  const productTokens = tokenize(description).slice(0, 10);
  const productPhrase = productTokens.slice(0, 4).join(' ');
  const leadKeyword = scene.pexelsKeywords[0] || '';
  const focusPhrase = buildSceneFocusTokens({
    scene,
    description,
    productCategory
  }).join(' ');
  const cameraHints = sceneCameraHints(scene);
  const actionHint =
    searchMode === 'perfume-support'
      ? 'well dressed person luxury interior mirror preparation suit details city night'
      : productCategory === 'beverages-energy-drinks'
      ? 'cold can ice condensation pour nightlife energy drink'
      : productCategory === 'perfume-fragrance'
      ? 'perfume bottle spray close up luxury interior'
      : productCategory === 'fitness-wellness'
      ? 'person workout movement training'
      : productCategory === 'fashion-accessories'
      ? 'sneaker close up walking city streetwear fashion footwear motion'
      : productCategory === 'home-lifestyle'
        ? 'luxury mansion estate exterior interior gym football field aerial'
      : productCategory === 'food-dessert'
        ? 'close up serving texture'
        : productCategory === 'sports-football'
          ? 'soccer match stadium crowd goal celebration'
          : esportsSignals
            ? 'esports arena crowd player pc headset keyboard mouse trophy'
        : '';
  const anchorQueries = [
    ...expandAnchors({
      anchors: foodSignals?.anchors || [],
      focusPhrase,
      leadKeyword
    }),
    ...expandAnchors({
      anchors: beverageSignals?.anchors || [],
      focusPhrase,
      leadKeyword
    }),
    ...expandAnchors({
      anchors: perfumeSignals?.anchors || [],
      focusPhrase,
      leadKeyword
    }),
    ...expandAnchors({
      anchors: fitnessSignals?.anchors || [],
      focusPhrase,
      leadKeyword
    }),
    ...expandAnchors({
      anchors: fashionSignals?.anchors || [],
      focusPhrase,
      leadKeyword
    }),
    ...expandAnchors({
      anchors: homeLifestyleSignals?.anchors || [],
      focusPhrase,
      leadKeyword
    }),
    ...expandAnchors({
      anchors: footballSignals?.anchors || [],
      focusPhrase,
      leadKeyword
    }),
    ...expandAnchors({
      anchors: esportsSignals?.anchors || [],
      focusPhrase,
      leadKeyword
    })
  ];

  const baseQueries = [
    ...scene.pexelsKeywords,
    ...scene.onScreenText,
    scene.visualBrief,
    scene.headline,
    focusPhrase,
    focusPhrase ? `${categoryText} ${focusPhrase}` : '',
    ...scene.pexelsKeywords.map((item) => (focusPhrase ? `${item} ${focusPhrase}` : item)),
    ...scene.pexelsKeywords.map((item) => `${categoryText} ${item}`),
    ...cameraHints.flatMap((hint) => scene.pexelsKeywords.map((item) => `${item} ${hint}`)),
    ...cameraHints.map((hint) => (focusPhrase ? `${focusPhrase} ${hint}` : `${scene.visualBrief} ${hint}`)),
    ...cameraHints.map((hint) => `${categoryText} ${hint}`),
    ...scene.pexelsKeywords.map((item) => (actionHint ? `${item} ${actionHint}` : item)),
    `${categoryText} ${scene.headline}`,
    `${categoryText} ${scene.visualBrief}`,
    actionHint ? `${categoryText} ${actionHint}` : '',
    focusPhrase && actionHint ? `${focusPhrase} ${actionHint}` : '',
    productPhrase ? `${productPhrase} ${focusPhrase || scene.visualBrief}` : '',
    ...anchorQueries,
    scene.visualBrief,
    scene.headline
  ];

  return unique(
    baseQueries
      .map(normalizeQuery)
      .filter(Boolean)
      .filter((query) => {
        const queryTokens = tokenize(query);

        const avoidTerms = [
          ...(foodSignals?.avoidTerms || []),
          ...(beverageSignals?.avoidTerms || []),
          ...(perfumeSignals?.avoidTerms || []),
          ...(fitnessSignals?.avoidTerms || []),
          ...(fashionSignals?.avoidTerms || []),
          ...(homeLifestyleSignals?.avoidTerms || []),
          ...(footballSignals?.avoidTerms || []),
          ...(esportsSignals?.avoidTerms || [])
        ];

        return avoidTerms.length ? !queryTokens.some((token) => avoidTerms.includes(token)) : true;
      })
  ).slice(0, Math.max(1, config.maxMediaQueriesPerScene));
};

export const findSceneMedia = async (
  scene: ScriptScene,
  productCategory: string,
  description: string,
  searchMode: 'default' | 'perfume-support' = 'default'
) => {
  if (!config.pexelsApiKey) {
    return [];
  }

  const queries = buildSearchQueries({
    scene,
    productCategory,
    description,
    searchMode
  });

  const selected: MediaCandidate[] = [];
  const seen = new Set<string>();
  const maxResults = MAX_SELECTED_RESULTS;
  const videoBatchSize = Math.max(1, config.mediaSearchBatchSize);

  const collectUnique = (items: MediaCandidate[]) => {
    for (const item of items) {
      if (!seen.has(item.externalId || item.url)) {
        selected.push(item);
        seen.add(item.externalId || item.url);
      }
      if (selected.length >= maxResults) {
        return true;
      }
    }

    return false;
  };

  const toVideoCandidates = (query: string, payloads: any[]) =>
    sortByResolution(
      payloads
        .flatMap((payload) => payload?.videos || [])
        .reduce<VideoMediaCandidate[]>((items, video: any) => {
          const bestFile = sortVideoFiles(
            (video.video_files || []) as Array<{
              width: number;
              height: number;
              link: string;
              file_type: string;
            }>
          ).find((file: any) => file.file_type === 'video/mp4');

          if (!bestFile?.link) {
            return items;
          }

          const pixelCount = bestFile.width * bestFile.height;
          if (pixelCount < 720 * 1280 && video.duration && video.duration < 4) {
            return items;
          }

          items.push({
            kind: 'video',
            source: 'pexels',
            externalId: String(video.id),
            url: bestFile.link,
            thumbnailUrl: video.image,
            width: bestFile.width,
            height: bestFile.height,
            duration: video.duration,
            attribution: `Pexels / ${video.user?.name || 'creator'}`,
            query
          });
          return items;
        }, [])
    );

  for (let start = 0; start < queries.length; start += videoBatchSize) {
    const batch = queries.slice(start, start + videoBatchSize);
    const videoResults = await Promise.all(
      batch.map(async (query) => {
        const payloads = await Promise.allSettled([
          pexelsVideoSearch(query, 'portrait'),
          pexelsVideoSearch(query, 'landscape')
        ]);

        return toVideoCandidates(
          query,
          payloads
            .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
            .map((result) => result.value)
        );
      })
    );

    for (const videos of videoResults) {
      if (collectUnique(videos)) {
        return selected;
      }
    }
  }

  for (let start = 0; start < queries.length; start += videoBatchSize) {
    const batch = queries.slice(start, start + videoBatchSize);
    const photoResults = await Promise.all(
      batch.map(async (query) => {
        try {
          const photoPayload = await pexelsPhotoSearch(query, 'portrait');
          return sortByResolution(photoPayload.photos || []).map(
            (photo: any): MediaCandidate => ({
              kind: 'image',
              source: 'pexels',
              externalId: String(photo.id),
              url: photo.src?.original || photo.src?.large2x || photo.src?.large,
              thumbnailUrl: photo.src?.medium,
              width: photo.width,
              height: photo.height,
              attribution: `Pexels / ${photo.photographer || 'creator'}`,
              query
            })
          );
        } catch {
          return [];
        }
      })
    );

    for (const photos of photoResults) {
      if (collectUnique(photos)) {
        return selected;
      }
    }
  }

  return selected;
};
