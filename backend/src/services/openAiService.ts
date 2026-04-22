import { ScriptPackage } from '../types';
import { config } from '../config';
import { getCache, setCache } from './cacheService';
import { sha256 } from '../utils/files';

const blockedKeywordTokens = new Set([
  'abstract',
  'background',
  'branding',
  'business',
  'campaign',
  'corporate',
  'digital',
  'generic',
  'innovation',
  'marketing',
  'media',
  'office',
  'social',
  'strategy',
  'success',
  'template',
  'technology',
  'viral'
]);

const SCRIPT_PROMPT_VERSION = 'v5';
const CONTENT_PACKAGE_PROMPT_VERSION = 'v1';
const openAiChatCompletionsUrl = `${config.openAiBaseUrl}/chat/completions`;

const getOpenAiHeaders = () => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.openAiApiKey}`
  };

  if (config.openAiBaseUrl.includes('openrouter.ai')) {
    if (config.openAiSiteUrl) {
      headers['HTTP-Referer'] = config.openAiSiteUrl;
    }

    if (config.openAiAppName) {
      headers['X-Title'] = config.openAiAppName;
    }
  }

  return headers;
};

const scriptSchema = {
  name: 'marketing_video_script',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'hook', 'cta', 'hashtags', 'musicMood', 'scenes', 'contentPackage'],
    properties: {
      title: { type: 'string' },
      hook: { type: 'string' },
      cta: { type: 'string' },
      hashtags: {
        type: 'array',
        items: { type: 'string' },
        minItems: 4,
        maxItems: 8,
      },
      musicMood: { type: 'string' },
      contentPackage: {
        type: 'object',
        additionalProperties: false,
        required: ['socialCaption', 'hashtagSuggestions', 'thumbnailText', 'shortAdCopy'],
        properties: {
          socialCaption: { type: 'string' },
          hashtagSuggestions: {
            type: 'array',
            items: { type: 'string' },
            minItems: 4,
            maxItems: 10
          },
          thumbnailText: { type: 'string' },
          shortAdCopy: { type: 'string' }
        }
      },
      scenes: {
        type: 'array',
        minItems: 4,
        maxItems: 6,
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'sceneNumber',
            'headline',
            'voiceover',
            'onScreenText',
            'pexelsKeywords',
            'visualBrief',
            'imagePrompt'
          ],
          properties: {
            sceneNumber: { type: 'integer' },
            headline: { type: 'string' },
            voiceover: { type: 'string' },
            onScreenText: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
              maxItems: 3
            },
            pexelsKeywords: {
              type: 'array',
              items: { type: 'string' },
              minItems: 2,
              maxItems: 4
            },
            visualBrief: { type: 'string' },
            imagePrompt: { type: 'string' }
          }
        }
      }
    }
  }
} as const;

const parseJson = (content: string) => {
  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('OpenAI response did not contain JSON.');
  }

  return JSON.parse(content.slice(firstBrace, lastBrace + 1));
};

const normalizeLine = (value: string) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeKeyword = (value: string) =>
  normalizeLine(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !blockedKeywordTokens.has(token))
    .join(' ');

const normalizeScriptPackage = (payload: ScriptPackage) => {
  const scenes = (payload.scenes || [])
    .slice(0, 6)
    .map((scene, index) => ({
      sceneNumber: Number(scene.sceneNumber || index + 1),
      headline: normalizeLine(scene.headline),
      voiceover: normalizeLine(scene.voiceover),
      onScreenText: (scene.onScreenText || [])
        .map(normalizeLine)
        .filter(Boolean)
        .slice(0, 3),
      pexelsKeywords: Array.from(
        new Set(
          (scene.pexelsKeywords || [])
            .map(normalizeKeyword)
            .filter(Boolean)
        )
      ).slice(0, 4),
      visualBrief: normalizeLine(scene.visualBrief),
      imagePrompt: normalizeLine(scene.imagePrompt)
    }))
    .filter((scene) => scene.headline && scene.voiceover)
    .sort((left, right) => left.sceneNumber - right.sceneNumber)
    .map((scene, index) => ({
      ...scene,
      sceneNumber: index + 1,
      pexelsKeywords:
        scene.pexelsKeywords.length >= 2
          ? scene.pexelsKeywords
          : Array.from(
              new Set(
                [scene.headline, scene.visualBrief]
                  .map(normalizeKeyword)
                  .filter(Boolean)
              )
            ).slice(0, 3)
    }));

  if (scenes.length < 4) {
    throw new Error('OpenAI script response did not contain enough usable scenes (minimum 4 required).');
  }

  const contentPackage = payload.contentPackage || {
    socialCaption: '',
    hashtagSuggestions: [],
    thumbnailText: '',
    shortAdCopy: ''
  };

  return {
    title: normalizeLine(payload.title),
    hook: normalizeLine(payload.hook),
    cta: normalizeLine(payload.cta),
    hashtags: Array.from(
      new Set(
        (payload.hashtags || [])
          .map((tag) => normalizeLine(tag).replace(/\s+/g, ''))
          .filter(Boolean)
      )
    ).slice(0, 8),
    musicMood: normalizeLine(payload.musicMood),
    scenes,
    contentPackage: {
      socialCaption: normalizeLine(contentPackage.socialCaption),
      hashtagSuggestions: Array.from(
        new Set(
          (contentPackage.hashtagSuggestions || [])
            .map((tag) => normalizeLine(tag).replace(/\s+/g, ''))
            .filter(Boolean)
        )
      ).slice(0, 10),
      thumbnailText: normalizeLine(contentPackage.thumbnailText),
      shortAdCopy: normalizeLine(contentPackage.shortAdCopy)
    }
  } satisfies ScriptPackage;
};

export const generateScriptPackage = async (
  description: string,
  style: string,
  productCategory: string
) => {
  const cacheKey = `script:${SCRIPT_PROMPT_VERSION}:${CONTENT_PACKAGE_PROMPT_VERSION}:${sha256(`${style}:${productCategory}:${description}`)}`;
  const cached = await getCache<ScriptPackage>(cacheKey);
  if (cached) return cached;

  if (!config.openAiApiKey) {
    throw new Error('OPENAI_API_KEY is missing.');
  }

  const categoryGuidance =
    productCategory === 'food-dessert'
      ? [
          'For food and dessert ads, prioritize appetite appeal, texture, ingredients, authenticity, and craving.',
          'If the product is a specific named dessert, keep every scene visually and verbally loyal to that exact dessert.',
          'Do not drift into generic cakes, cupcakes, frosting, whipped cream, or unrelated bakery prep unless the brief explicitly describes those.',
          'Usage occasions like gifting, guests, or after-dinner can support the message, but the product itself must stay the visual star.'
        ].join(' ')
      : productCategory === 'fitness-wellness'
        ? [
            'For fitness and wellness ads, prioritize visible movement, training, progress, energy, confidence, and action.',
            'Prefer scenes of people actively working out, training at home, tracking progress, or feeling stronger.',
            'Avoid passive talking-head scenes, generic socializing, meetings, interviews, or equipment-only footage unless the brief explicitly asks for it.',
            'If the offer is a program or membership, the visuals should still show the transformation journey, not abstract community filler.'
          ].join(' ')
        : productCategory === 'sports-football'
          ? [
              'For football/soccer hype videos, prioritize match energy: stadium lights, crowd chants, kickoff, dribbling, tackles, saves, goal celebrations, and fast momentum shifts.',
              'Use Pexels keywords that clearly indicate soccer (e.g., "soccer match", "football stadium", "soccer fans", "goal celebration") to avoid American football footage.',
              'Avoid logos, identifiable players, or team-specific trademarks in visuals; keep it generic match atmosphere and action.'
            ].join(' ')
        : '';

  const response = await fetch(openAiChatCompletionsUrl, {
    method: 'POST',
    headers: getOpenAiHeaders(),
    body: JSON.stringify({
      model: config.openAiModel,
      temperature: 0.55,
      response_format: {
        type: 'json_schema',
        json_schema: scriptSchema
      },
      messages: [
        {
          role: 'system',
          content:
            [
              'You are an elite direct-response creative strategist for short-form ecommerce ads.',
              'Write like a senior performance marketer, not a generic assistant.',
              'Every response is for a real product advertisement designed to convert on TikTok, Reels, or Shorts.',
              'Use buyer psychology: hook, pain/desire, product mechanism, proof, offer, CTA.',
              'Scenes must feel filmable and specific, with visuals that can be searched on stock sites.',
              'Never rely on vague stock concepts like innovation, success, social media, marketing, business meeting, abstract background, or generic lifestyle filler unless the product literally requires them.',
              'Voiceover should sound human, persuasive, concise, and purchase-intent driven.',
              categoryGuidance
            ].join(' ')
        },
        {
          role: 'user',
          content: [
            `Product description: ${description}`,
            `Creative style: ${style}`,
            `Product category: ${productCategory}`,
            'Return a script package for a 30-45 second 9:16 marketing video with exactly 4-6 scenes.',
            'Target a total runtime of 30-45 seconds. Do NOT produce videos shorter than 28 seconds.',
            'This tool is for marketing creatives only. Treat the input as a product advertisement brief.',
            'Always use exactly 4 scenes minimum, preferring 5 scenes for richer storytelling.',
            'Also generate a contentPackage object with socialCaption, hashtagSuggestions, thumbnailText, and shortAdCopy.',
            'socialCaption should be 1-2 punchy sentences that work as a post caption.',
            'hashtagSuggestions should be 4-10 relevant, high-intent hashtags.',
            'thumbnailText should be very short, ideally 3-6 words, and thumbnail friendly.',
            'shortAdCopy should be a compact promotional blurb of roughly 40-70 words.',
            'Infer the likely buyer, core problem, desired outcome, offer, and CTA from the brief when needed.',
            'Scene 1 should be a hard hook or pattern interrupt — make it impossible to scroll past.',
            'Scene 2 should introduce the product and the core problem it solves.',
            'Scene 3 should show transformation, benefits, or social proof.',
            'Scene 4+ should build desire and land on a clear CTA or offer.',
            'Voiceover must sound natural, persuasive, specific, and purchase-intent driven, not generic.',
            'Each scene voiceover should be 18-28 words — long enough to tell the story but punchy enough to convert. Do not write fewer than 15 words per scene.',
            'On-screen text should highlight claims, benefits, urgency, or offer language that fits a real ad.',
            'Pexels keywords must describe visible subjects, actions, locations, or product-adjacent moments someone could actually search for.',
            'Prefer product-adjacent lifestyle, hands using product, routines, closeups, textures, packaging moments, and outcome visuals.',
            'Avoid abstract stock terms and avoid unrelated objects, animals, scenery, or random tech footage.',
            'Spread the story across all scenes — do not cram everything into scene 1 and phone in the rest.',
            'Treat wrong-product visuals as a failure. If the product is baklava, do not suggest cake, frosting, whipped cream, cupcakes, or unrelated dessert prep.',
            'For food products, prioritize closeups, serving, slicing, plating, ingredients, and authentic product textures before secondary lifestyle context.',
            'For fitness products, favor workout, home training, stretching, sweating, coaching, progress checks, and strong post-workout confidence over talking or standing around.',
            'imagePrompt must stay truthful to the product category and should never invent irrelevant content.'
          ].join('\n')
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI response did not include any content.');
  }

  const parsed = normalizeScriptPackage(parseJson(content) as ScriptPackage);
  await setCache(cacheKey, parsed);
  return parsed;
};
