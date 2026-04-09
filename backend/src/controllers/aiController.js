const { getChatResponse, generateTTS } = require('../services/aiService');

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

/**
 * Handle POST /api/ai/tts.
 * Expects "text" and optional "model" in the request body.
 */
const synthesizeSpeech = async (req, res, next) => {
  try {
    const { text, model } = req.body;

    if (!text) {
      return res.status(400).json({ success: false, message: 'Text is required' });
    }

    const audioBuffer = await generateTTS(text, model);

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length,
    });

    return res.end(audioBuffer);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  chat,
  synthesizeSpeech,
};
