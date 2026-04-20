import { MediaCandidate, ScriptScene } from '../types';
import { config } from '../config';

const TARGET_ASPECT_RATIO = 9 / 16;
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

const isEsportsBrief = (description: string, productCategory: string) => {
  const normalized = `${productCategory} ${description}`.toLowerCase();
  return productCategory === 'gaming-esports' || esportsBriefTokens.some((token) => normalized.includes(token));
};

const normalizeQuery = (value: string) =>
  value
    .replace(/[-_/]+/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 7)
    .join(' ');

const pexelsVideoSearch = async (query: string, orientation: 'portrait' | 'landscape') => {
  const url = new URL('https://api.pexels.com/videos/search');
  url.searchParams.set('query', query);
  url.searchParams.set('per_page', '10');
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
  url.searchParams.set('per_page', '10');
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

  return portraitBonus + resolutionScore - aspectDelta * 2.5;
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
    searchMode === 'perfume-support' ? 'luxury lifestyle' : productCategory.replace(/-/g, ' ');
  const foodSignals = productCategory === 'food-dessert' ? buildFoodSignals(description) : null;
  const perfumeSignals =
    productCategory === 'perfume-fragrance' && searchMode !== 'perfume-support'
      ? buildPerfumeSignals(description)
      : null;
  const fitnessSignals =
    productCategory === 'fitness-wellness' ? buildFitnessSignals(description) : null;
  const footballSignals =
    productCategory === 'sports-football' ? buildFootballSignals(description) : null;
  const esportsSignals = isEsportsBrief(description, productCategory)
    ? buildEsportsSignals(description)
    : null;
  const productTokens = tokenize(description).slice(0, 10);
  const productPhrase = productTokens.slice(0, 4).join(' ');
  const actionHint =
    searchMode === 'perfume-support'
      ? 'well dressed person luxury interior mirror preparation suit details city night'
      : productCategory === 'perfume-fragrance'
      ? 'perfume bottle spray close up luxury interior'
      : productCategory === 'fitness-wellness'
      ? 'person workout movement training'
      : productCategory === 'food-dessert'
        ? 'close up serving texture'
        : productCategory === 'sports-football'
          ? 'soccer match stadium crowd goal celebration'
          : esportsSignals
            ? 'esports arena crowd player pc headset keyboard mouse trophy'
        : '';

  const baseQueries = [
    ...(foodSignals?.anchors || []).flatMap((anchor) => [
      anchor,
      `${anchor} close up`,
      `${anchor} serving`,
      `${anchor} ${scene.visualBrief}`,
      `${anchor} ${scene.headline}`,
      ...scene.pexelsKeywords.map((item) => `${anchor} ${item}`)
    ]),
    ...(perfumeSignals?.anchors || []).flatMap((anchor) => [
      anchor,
      `${anchor} vertical`,
      `${anchor} close up`,
      `${anchor} luxury`,
      `${anchor} ${scene.visualBrief}`,
      ...scene.pexelsKeywords.map((item) => `${anchor} ${item}`)
    ]),
    ...(fitnessSignals?.anchors || []).flatMap((anchor) => [
      anchor,
      `${anchor} vertical`,
      `${anchor} person`,
      `${anchor} action`,
      `${anchor} ${scene.visualBrief}`,
      ...scene.pexelsKeywords.map((item) => `${anchor} ${item}`)
    ]),
    ...(footballSignals?.anchors || []).flatMap((anchor) => [
      anchor,
      `${anchor} vertical`,
      `${anchor} action`,
      `${anchor} crowd`,
      `${anchor} ${scene.visualBrief}`,
      ...scene.pexelsKeywords.map((item) => `${anchor} ${item}`)
    ]),
    ...(esportsSignals?.anchors || []).flatMap((anchor) => [
      anchor,
      `${anchor} vertical`,
      `${anchor} player`,
      `${anchor} stage lights`,
      `${anchor} crowd`,
      `${anchor} ${scene.visualBrief}`,
      ...scene.pexelsKeywords.map((item) => `${anchor} ${item}`)
    ]),
    ...scene.pexelsKeywords.map((item) => `${categoryText} ${item}`),
    ...scene.pexelsKeywords.map((item) => (actionHint ? `${item} ${actionHint}` : item)),
    ...scene.pexelsKeywords,
    `${categoryText} ${scene.headline}`,
    `${categoryText} ${scene.visualBrief}`,
    actionHint ? `${categoryText} ${actionHint}` : '',
    productPhrase ? `${productPhrase} ${scene.visualBrief}` : '',
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
          ...(perfumeSignals?.avoidTerms || []),
          ...(fitnessSignals?.avoidTerms || []),
          ...(footballSignals?.avoidTerms || []),
          ...(esportsSignals?.avoidTerms || [])
        ];

        return avoidTerms.length ? !queryTokens.some((token) => avoidTerms.includes(token)) : true;
      })
  );
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
  const maxResults = 6;

  for (const query of queries) {
    const payloads = await Promise.all([
      pexelsVideoSearch(query, 'portrait'),
      pexelsVideoSearch(query, 'landscape')
    ]);
    const videos = sortByResolution(
      payloads
        .flatMap((payload) => payload.videos || [])
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

    for (const item of videos) {
      if (!seen.has(item.externalId || item.url)) {
        selected.push(item);
        seen.add(item.externalId || item.url);
      }
      if (selected.length >= maxResults) {
        return selected;
      }
    }
  }

  for (const query of queries) {
    const photoPayload = await pexelsPhotoSearch(query, 'portrait');
    const photos = sortByResolution(photoPayload.photos || []).map(
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

    for (const item of photos) {
      if (!seen.has(item.externalId || item.url)) {
        selected.push(item);
        seen.add(item.externalId || item.url);
      }
      if (selected.length >= maxResults) {
        return selected;
      }
    }
  }

  return selected;
};
