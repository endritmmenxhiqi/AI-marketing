const { getChatResponse } = require('../services/aiService');
const {
  createGeneration,
  listGenerations,
  getGenerationById,
  refreshGenerationMedia,
  refreshGenerationVoice,
  renderGenerationPreviewAsset,
} = require('../services/generationService');

/**
 * Handle POST /api/ai/chat.
 * Expects a "message" and an optional "history" array in the request body.
 */
const chat = async (req, res, next) => {
  try {
    const { message, history } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const aiResponse = await getChatResponse(message, history);

    return res.status(200).json({
      success: true,
      data: aiResponse,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  chat,
  generate: async (req, res, next) => {
    try {
      const generation = await createGeneration(req.user.userId, req.body);

      return res.status(201).json({
        success: true,
        data: generation,
      });
    } catch (error) {
      return next(error);
    }
  },
  listGenerations: async (req, res, next) => {
    try {
      const { generations, meta } = await listGenerations(req.user.userId, req.query.limit);

      return res.status(200).json({
        success: true,
        data: generations,
        meta,
      });
    } catch (error) {
      return next(error);
    }
  },
  getGeneration: async (req, res, next) => {
    try {
      const generation = await getGenerationById(req.user.userId, req.params.id);

      return res.status(200).json({
        success: true,
        data: generation,
      });
    } catch (error) {
      return next(error);
    }
  },
  refreshGenerationMedia: async (req, res, next) => {
    try {
      const generation = await refreshGenerationMedia(req.user.userId, req.params.id);

      return res.status(200).json({
        success: true,
        data: generation,
      });
    } catch (error) {
      return next(error);
    }
  },
  refreshGenerationVoice: async (req, res, next) => {
    try {
      const generation = await refreshGenerationVoice(req.user.userId, req.params.id);

      return res.status(200).json({
        success: true,
        data: generation,
      });
    } catch (error) {
      return next(error);
    }
  },
  renderGenerationPreview: async (req, res, next) => {
    try {
      const generation = await renderGenerationPreviewAsset(req.user.userId, req.params.id);

      return res.status(200).json({
        success: true,
        data: generation,
      });
    } catch (error) {
      return next(error);
    }
  },
};
