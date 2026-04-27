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

  const esportsBrief = isEsportsBrief(description, productCategory);
  const categoryGuidance =
    productCategory === 'beverages-energy-drinks'
      ? [
          'For beverages and energy drink ads, prioritize ice-cold refreshment, can or bottle hero shots, condensation, pouring, fizz, flavor cues, nightlife energy, gym momentum, driving focus, and social lifestyle moments.',
          'The drink package must stay central: use closeups of the can or bottle, hand-held product moments, cracked-open pours, glass serves, and cold texture details before drifting into generic lifestyle filler.',
          'Prefer visible drink-adjacent visuals that stock sites can actually return: energy drink can, cold beverage can, iced drink close up, pouring drink, bar counter drink, party lighting, driving at night, gym energy, and friend hangout scenes.',
          'Avoid unrelated food prep, coffee shop filler, cocktails with the wrong product focus, office stock, abstract party lights without the product, and random lifestyle shots that do not support refreshment or energy.',
          'If the user uploads a specific can or bottle, treat that package as the hero product and build supporting scenes around it rather than replacing it with a different drink brand.'
        ].join(' ')
      : productCategory === 'food-dessert'
      ? [
          'For food and dessert ads, prioritize appetite appeal, texture, ingredients, authenticity, and craving.',
          'If the product is a specific named dessert, keep every scene visually and verbally loyal to that exact dessert.',
          'Do not drift into generic cakes, cupcakes, frosting, whipped cream, or unrelated bakery prep unless the brief explicitly describes those.',
          'Usage occasions like gifting, guests, or after-dinner can support the message, but the product itself must stay the visual star.'
        ].join(' ')
      : productCategory === 'perfume-fragrance'
        ? [
            'For perfume and fragrance ads, prioritize elegant product shots, perfume spray, bottle closeups, refined grooming moments, luxury interior lighting, and confident premium lifestyle scenes.',
            'Prefer visible fragrance-adjacent visuals that stock sites can actually return: perfume bottle on vanity, spray mist, dressed up man or woman, mirror prep, luxury room, and fashion detail closeups.',
            'When the user uploads a specific perfume bottle, treat that product as sacred: supporting scenes can show lifestyle, grooming, fashion, and luxury environments, but they must not imply or introduce different competing fragrance bottles.',
            'Avoid drifting into generic beauty tutorial footage, makeup-only scenes, spa filler, random skincare application, office scenes, tech product shots, or unrelated lifestyle clips unless the brief explicitly asks for them.',
            'The fragrance bottle, packaging, ritual, and premium identity should stay central to the story.'
          ].join(' ')
      : productCategory === 'home-lifestyle'
        ? [
            'For home and lifestyle ads, treat the offer like a premium real-estate, architecture, interior-design, or luxury-home campaign.',
            'Prioritize mansion or villa exteriors, estate grounds, aerial property reveals, architectural details, premium interiors, landscaped amenities, luxury home gym scenes, and visible football or soccer field visuals when mentioned.',
            'Every premium amenity named in the voiceover must also be visibly present in that same scene through the visualBrief and Pexels keywords.',
            'Prefer stock-searchable visuals such as luxury villa exterior, modern mansion aerial, private home gym luxury, football field behind house, estate garden, premium living room, and architectural closeups.',
            'Avoid generic rich lifestyle filler, supercars, hotel lobbies, office footage, cheap apartment interiors, basement gyms, construction worker footage, or random people-only scenes unless the brief explicitly asks for them.'
          ].join(' ')
      : productCategory === 'fitness-wellness'
        ? [
            'For fitness and wellness ads, prioritize visible movement, training, progress, energy, confidence, and action.',
            'Prefer scenes of people actively working out, training at home, tracking progress, or feeling stronger.',
            'Avoid passive talking-head scenes, generic socializing, meetings, interviews, or equipment-only footage unless the brief explicitly asks for it.',
            'If the offer is a program or membership, the visuals should still show the transformation journey, not abstract community filler.'
          ].join(' ')
      : productCategory === 'fashion-accessories'
        ? [
            'For fashion and accessories ads, prioritize the wearable product itself, styling detail, texture, movement, confidence, and premium editorial framing.',
            'For sneaker and shoe briefs, keep the footwear central in every scene through visible laces, sole, side profile, walking, running, footwork, or hands adjusting the shoes.',
            'Prefer stock-searchable fashion visuals such as sneaker close up, tying sneakers, walking in sneakers, street style shoes, running shoes city, fashion detail close up, and athlete footwear motion.',
            'Avoid drifting into generic luxury lifestyle filler, cars, balloons, romance scenes, weddings, office footage, random interiors, or people-only footage where the accessory is not clearly visible.',
            'If the product is footwear, do not let the story become about the car, the building, or the model alone. The shoe must stay visually obvious.'
          ].join(' ')
        : productCategory === 'sports-football'
          ? [
              'For football/soccer hype videos, prioritize match energy: stadium lights, crowd chants, kickoff, dribbling, tackles, saves, goal celebrations, and fast momentum shifts.',
              'Use Pexels keywords that clearly indicate soccer (e.g., "soccer match", "football stadium", "soccer fans", "goal celebration") to avoid American football footage.',
              'Avoid logos, identifiable players, or team-specific trademarks in visuals; keep it generic match atmosphere and action.'
            ].join(' ')
        : esportsBrief
          ? [
              'For esports and Counter-Strike style promos, prioritize arena-tournament energy: player walkouts, focused gamers at PCs, headset comms, keyboard and mouse closeups, crowd eruptions, stage lights, trophy moments, and big-screen match atmosphere.',
              'Use Pexels keywords that clearly describe visible esports footage such as "esports tournament", "gaming tournament stage", "pro gamer pc", "gaming arena crowd", "keyboard mouse close up", and "trophy celebration".',
              'Avoid drifting into generic tech product shots, coding desks, office work, server rooms, mobile gaming, console controllers, or abstract RGB gadget footage unless the brief explicitly asks for them.',
              'Do not promise official Counter-Strike majors footage, team logos, or branded tournament assets. Keep the visuals generic, premium, and clearly esports-driven.'
            ].join(' ')
        : '';

  const repairInstruction = [
    'The previous draft was invalid because it did not contain enough usable scenes.',
    'Return exactly 5 complete scenes now.',
    'Every scene must include a non-empty headline, 18-28 word voiceover, 1-3 onScreenText lines, 2-4 concrete Pexels keywords, visualBrief, and imagePrompt.',
    'Do not summarize the ad as one scene. Split the story into hook, product/problem, benefit, proof/desire, and CTA.'
  ].join('\n');
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openAiApiKey}`
    },
    body: JSON.stringify({
      model: config.openAiModel,
      temperature: attempt === 0 ? 0.55 : 0.35,
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
            'Any named amenity, room, object, or feature in the voiceover must also appear in that scene visualBrief and Pexels keywords.',
            'Do not mention football fields, private gyms, pools, cars, skyline views, or other hero amenities unless the scene is clearly designed to show them.',
            'Avoid abstract stock terms and avoid unrelated objects, animals, scenery, or random tech footage.',
            'Spread the story across all scenes — do not cram everything into scene 1 and phone in the rest.',
            'Treat wrong-product visuals as a failure. If the product is baklava, do not suggest cake, frosting, whipped cream, cupcakes, or unrelated dessert prep.',
            'For beverage products, prioritize condensation, pours, cold texture, can or bottle closeups, hand-held drink moments, nightlife or active lifestyle usage, and crisp refreshment visuals.',
            'For food products, prioritize closeups, serving, slicing, plating, ingredients, and authentic product textures before secondary lifestyle context.',
            'For fitness products, favor workout, home training, stretching, sweating, coaching, progress checks, and strong post-workout confidence over talking or standing around.',
            'imagePrompt must stay truthful to the product category and should never invent irrelevant content.'
          ].join('\n') + (attempt === 0 ? '' : `\n\n${repairInstruction}`)
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

    try {
      const parsed = normalizeScriptPackage(parseJson(content) as ScriptPackage);
      await setCache(cacheKey, parsed);
      return parsed;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : '';
      if (attempt === 0 && message.includes('enough usable scenes')) {
        continue;
      }

      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('OpenAI script response was invalid.');
};
