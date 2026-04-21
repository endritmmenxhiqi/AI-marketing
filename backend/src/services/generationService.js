const Generation = require('../models/Generation');
const { generateMarketingContent } = require('./aiService');
const { searchPexelsMedia } = require('./mediaService');
const { synthesizeVoiceover } = require('./ttsService');
const { renderGenerationPreview } = require('./renderService');

const normalizeStringArray = (value) => {
  if (!value) return [];

  const items = Array.isArray(value) ? value : String(value).split(',');

  return items
    .map((item) => String(item).trim())
    .filter(Boolean);
};

const buildTitle = ({ platform, style, objective }) => {
  const parts = [platform, style, objective].filter(Boolean);
  const title = parts.join(' • ');
  return title.slice(0, 140);
};

const createGeneration = async (ownerId, payload) => {
  const productDescription = String(payload.productDescription || '').trim();
  const style = String(payload.style || '').trim();
  const platform = String(payload.platform || '').trim();
  const objective = String(payload.objective || '').trim();
  const keywords = normalizeStringArray(payload.keywords);

  if (!productDescription || !style || !platform) {
    const err = new Error('Product description, style, and platform are required');
    err.statusCode = 400;
    throw err;
  }

  const aiOutputs = await generateMarketingContent({
    productDescription,
    keywords,
    style,
    platform,
    objective,
  });

  const media = await searchPexelsMedia({
    productDescription,
    keywords,
    mediaKeywords: aiOutputs.mediaKeywords,
    platform,
  });

  const voice = await synthesizeVoiceover({
    text: aiOutputs.voiceoverScript,
    title: buildTitle({ platform, style, objective }) || productDescription.slice(0, 70),
  });

  const generation = await Generation.create({
    owner: ownerId,
    title: buildTitle({ platform, style, objective }) || productDescription.slice(0, 70),
    productDescription,
    keywords,
    style,
    platform,
    objective,
    outputs: aiOutputs,
    assets: {
      audioUrl: voice.audioUrl || '',
    },
    voice: {
      provider: voice.provider,
      configured: voice.configured,
      voiceId: voice.voiceId,
      generatedAt: voice.generatedAt,
      errorMessage: voice.errorMessage,
    },
    media,
  });

  return generation;
};

const listGenerations = async (ownerId, limit = 10) => {
  const safeLimit = Math.min(Number(limit) || 10, 50);

  const [generations, total, completed] = await Promise.all([
    Generation.find({ owner: ownerId }).sort({ createdAt: -1 }).limit(safeLimit),
    Generation.countDocuments({ owner: ownerId }),
    Generation.countDocuments({ owner: ownerId, status: { $in: ['generated', 'completed'] } }),
  ]);

  return {
    generations,
    meta: {
      total,
      ready: completed,
      platforms: [...new Set(generations.map((item) => item.platform))].length,
    },
  };
};

const getGenerationById = async (ownerId, generationId) => {
  const generation = await Generation.findOne({ _id: generationId, owner: ownerId });

  if (!generation) {
    const err = new Error('Generation not found');
    err.statusCode = 404;
    throw err;
  }

  return generation;
};

const refreshGenerationMedia = async (ownerId, generationId) => {
  const generation = await getGenerationById(ownerId, generationId);

  generation.media = await searchPexelsMedia({
    productDescription: generation.productDescription,
    keywords: generation.keywords,
    mediaKeywords: generation.outputs?.mediaKeywords || [],
    platform: generation.platform,
  });

  await generation.save();

  return generation;
};

const refreshGenerationVoice = async (ownerId, generationId) => {
  const generation = await getGenerationById(ownerId, generationId);

  const voice = await synthesizeVoiceover({
    text: generation.outputs?.voiceoverScript || '',
    title: generation.title || generation.productDescription.slice(0, 70),
  });

  generation.assets = {
    ...generation.assets,
    audioUrl: voice.audioUrl || '',
  };
  generation.voice = {
    provider: voice.provider,
    configured: voice.configured,
    voiceId: voice.voiceId,
    generatedAt: voice.generatedAt,
    errorMessage: voice.errorMessage,
  };

  await generation.save();

  return generation;
};

const renderGenerationPreviewAsset = async (ownerId, generationId) => {
  const generation = await getGenerationById(ownerId, generationId);

  generation.status = 'rendering';
  await generation.save();

  const render = await renderGenerationPreview(generation);

  generation.assets = {
    ...generation.assets,
    previewUrl: render.previewUrl || '',
    videoUrl: render.videoUrl || '',
  };
  generation.render = {
    configured: render.configured,
    renderedAt: render.renderedAt,
    sourceType: render.sourceType,
    errorMessage: render.errorMessage,
  };
  generation.status = render.videoUrl ? 'completed' : 'failed';

  await generation.save();

  return generation;
};

module.exports = {
  createGeneration,
  listGenerations,
  getGenerationById,
  refreshGenerationMedia,
  refreshGenerationVoice,
  renderGenerationPreviewAsset,
};
