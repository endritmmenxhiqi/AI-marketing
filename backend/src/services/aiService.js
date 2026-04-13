const OpenAI = require('openai');
const config = require('../config');
const googleTTS = require('google-tts-api');

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: config.openRouterApiKey,
  defaultHeaders: {
    'HTTP-Referer': config.frontendUrl,
    'X-Title': 'AI Marketing Generator',
  },
});

const getChatResponse = async (userMessage, history = [], imageBase64 = null) => {
  try {
    if (imageBase64) console.log('📸 AI po pranon një foto për analizë...');

    let userContent = userMessage;
    if (imageBase64) {
      userContent = [
        { type: "text", text: userMessage || "Analizo këtë foto për marketing." },
        { 
          type: "image_url", 
          image_url: { 
            url: `data:image/jpeg;base64,${imageBase64}` 
          } 
        }
      ];
    }

    const messages = [
      {
        role: 'system',
        content: `MANDATORY: You are a SILENT ROBOTIC TOOL.
NO CONVERSATION. NO "HELLO". NO "THE SCRIPT IS READY".

--- PROCEDURE ---
1. PRODUCT MENTIONED -> OUTPUT SCRIPT ONLY. (Under 30s, match language).
2. PHOTO RECEIVED -> OUTPUT LABELS ONLY:
   "Teksti mbi foto: [Title]"
   "Background Prompt: [Extremely detailed English description of a professional, luxury atmosphere or lifestyle scene (like a marble counter, wooden table, or high-end studio) that perfectly complements the product in the photo. 8k, photorealistic, cinematic lighting, 9:16 format.]"
- These labels are CRITICAL for the automatic generator.

--- RULES ---
- NEVER ASK QUESTIONS. 
- NEVER EXPLAIN WHAT YOU ARE DOING.
- JUST OUTPUT THE RAW DATA.`,
      },
      ...history,
      { role: 'user', content: userContent },
    ];

    const response = await openai.chat.completions.create({
      model: 'openai/gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('AI Service Error:', error);
    throw new Error('Failed to get response from AI assistant');
  }
};

/**
 * Generate Text-to-Speech (TTS) using Google TTS (Albanian Support).
 */
const generateTTS = async (text, lang) => {
  const englishWords = /\b(the|and|is|in|it|to|you|that|this|for|with|my|literally|guys|wait|hey)\b/i;
  let finalLang = 'sq';
  if (englishWords.test(text)) {
    finalLang = 'en';
  }

  try {
    const results = await googleTTS.getAllAudioBase64(text, {
      lang: finalLang,
      slow: false,
      host: 'https://translate.google.com',
      splitPunct: ',.?',
    });

    const buffers = results.map(res => Buffer.from(res.base64, 'base64'));
    return Buffer.concat(buffers);
  } catch (error) {
    console.error('Google TTS Service Error:', error);
    throw new Error('Failed to generate audio from TTS service');
  }
};

module.exports = {
  getChatResponse,
  generateTTS,
};
