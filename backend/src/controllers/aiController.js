const { getChatResponse, generateTTS } = require('../services/aiService');
const https = require('https');

/**
 * Handle POST /api/ai/chat.
 * Expects a "message" and an optional "history" array in the request body.
 */
const fs = require('fs');
const path = require('path');

const chat = async (req, res, next) => {
  try {
    const { message, history: historyStr } = req.body;
    let history = [];
    
    // History might come as a stringified JSON if sent via FormData
    if (historyStr) {
      try {
        history = typeof historyStr === 'string' ? JSON.parse(historyStr) : historyStr;
      } catch (e) {
        console.error('Error parsing history:', e);
      }
    }

    let imageBase64 = null;
    let imagePath = null;

    if (req.file) {
      imagePath = `/uploads/${req.file.filename}`;
      // Convert image to base64 for AI analysis
      const buffer = fs.readFileSync(req.file.path);
      imageBase64 = buffer.toString('base64');
    }

    const aiResponse = await getChatResponse(message, history, imageBase64);

    return res.status(200).json({
      success: true,
      data: aiResponse,
      imagePath: imagePath // Return path to frontend to show in chat
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

/**
 * Proxy/Generate image from Pollinations AI at the backend level.
 * GET /api/ai/image-proxy?prompt=...
 */
const proxyImage = async (req, res, next) => {
  try {
    const { prompt } = req.query;
    if (!prompt) {
      return res.status(400).json({ success: false, message: 'Prompt is required' });
    }

    const safePrompt = encodeURIComponent(prompt);
    const url = `https://image.pollinations.ai/prompt/${safePrompt}?width=800&height=1200&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;

    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        return res.status(500).json({ success: false, message: 'Failed to fetch image from AI provider' });
      }

      // Set headers for image response
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      
      // Pipe the image data directly to the client
      response.pipe(res);
    }).on('error', (err) => {
      console.error('Image Proxy Error:', err);
      res.status(500).json({ success: false, message: 'Internal Server Error fetching image' });
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  chat,
  synthesizeSpeech,
  proxyImage,
};
