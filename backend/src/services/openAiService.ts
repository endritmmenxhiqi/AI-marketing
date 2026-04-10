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

const SCRIPT_PROMPT_VERSION = 'v3';

const scriptSchema = {
  name: 'marketing_video_script',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'hook', 'cta', 'hashtags', 'musicMood', 'scenes'],
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
      scenes: {
        type: 'array',
        minItems: 3,
        maxItems: 5,
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
    .slice(0, 5)
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

  if (scenes.length < 3) {
    throw new Error('OpenAI script response did not contain enough usable scenes.');
  }

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
    scenes
  } satisfies ScriptPackage;
};

export const generateScriptPackage = async (
  description: string,
  style: string,
  productCategory: string
) => {
  const cacheKey = `script:${SCRIPT_PROMPT_VERSION}:${sha256(`${style}:${productCategory}:${description}`)}`;
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
        : '';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openAiApiKey}`
    },
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
            'Return a script package for a 15-30 second 9:16 marketing video.',
            'Default to a tight 16-22 second total runtime unless the brief clearly needs longer.',
            'This tool is for marketing creatives only. Treat the input as a product advertisement brief.',
            'Use 4 scenes whenever possible, otherwise 3-5 scenes.',
            'Infer the likely buyer, core problem, desired outcome, offer, and CTA from the brief when needed.',
            'Scene 1 should be a hard hook or pattern interrupt.',
            'Middle scenes should show product use, transformation, benefits, or proof.',
            'Final scene should land on a clear CTA or offer.',
            'Voiceover must sound natural, persuasive, specific, and purchase-intent driven, not generic.',
            'Keep each scene voiceover tight, usually 8-16 words, so the cut stays punchy and scene lengths do not drag.',
            'On-screen text should highlight claims, benefits, urgency, or offer language that fits a real ad.',
            'Pexels keywords must describe visible subjects, actions, locations, or product-adjacent moments someone could actually search for.',
            'Prefer product-adjacent lifestyle, hands using product, routines, closeups, textures, packaging moments, and outcome visuals.',
            'Avoid abstract stock terms and avoid unrelated objects, animals, scenery, or random tech footage.',
            'Avoid scene ideas that would force one stock clip to carry 8-10 seconds by itself.',
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
