const OpenAI = require('openai');
const config = require('../config');

const openai = new OpenAI({
  apiKey: config.openaiApiKey,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': config.frontendUrl || 'http://localhost:5173',
    'X-Title': 'AI Marketing Studio',
  }
});

/**
 * Get AI chat response.
 * @param {string} userMessage - The user's input message.
 * @param {Array} history - Previous message history.
 * @returns {Promise<string>} AI response content.
 */
const getChatResponse = async (userMessage, history = []) => {
  try {
    const messages = [
      {
        role: 'system',
        content: `You are an expert AI Marketing Assistant. Your goal is to help the user create, optimize, and manage marketing campaigns. 
        Be professional, creative, and concise. Provide actionable advice and high-quality marketing copy.`,
      },
      ...history,
      { role: 'user', content: userMessage },
    ];

    const response = await openai.chat.completions.create({
      model: config.openaiModel,
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

const extractJson = (text) => {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1] : trimmed;

  return JSON.parse(candidate);
};

const normalizeMarketingOutput = (payload) => ({
  caption: String(payload.caption || '').trim(),
  hashtags: Array.isArray(payload.hashtags)
    ? payload.hashtags.map((item) => String(item).trim()).filter(Boolean)
    : [],
  voiceoverScript: String(payload.voiceoverScript || '').trim(),
  onScreenText: Array.isArray(payload.onScreenText)
    ? payload.onScreenText.map((item) => String(item).trim()).filter(Boolean)
    : [],
  visualDirection: String(payload.visualDirection || '').trim(),
  mediaKeywords: Array.isArray(payload.mediaKeywords)
    ? payload.mediaKeywords.map((item) => String(item).trim()).filter(Boolean)
    : [],
  callToAction: String(payload.callToAction || '').trim(),
});

const generateMarketingContent = async ({
  productDescription,
  keywords = [],
  style,
  platform,
  objective = '',
}) => {
  try {
    const systemPrompt = [
      'You are an expert AI marketing strategist for short-form social video.',
      'Return only valid JSON with these keys:',
      'caption, hashtags, voiceoverScript, onScreenText, visualDirection, mediaKeywords, callToAction.',
      'caption and callToAction must be strings.',
      'hashtags, onScreenText, and mediaKeywords must be arrays of strings.',
      'voiceoverScript and visualDirection must be strings.',
      'Make the content practical for short-form video marketing.',
    ].join(' ');

    const userPrompt = JSON.stringify(
      {
        productDescription,
        keywords,
        style,
        platform,
        objective,
      },
      null,
      2
    );

    const response = await openai.chat.completions.create({
      model: config.openaiModel,
      temperature: 0.8,
      max_tokens: 900,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Generate short-form marketing content based on this brief:\n${userPrompt}`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content || '{}';
    const parsed = extractJson(text);

    return normalizeMarketingOutput(parsed);
  } catch (error) {
    console.error('AI Generation Error:', error);
    throw new Error('Failed to generate marketing content');
  }
};

module.exports = {
  getChatResponse,
  generateMarketingContent,
};
