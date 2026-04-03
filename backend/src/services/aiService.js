const OpenAI = require('openai');
const config = require('../config');

const openai = new OpenAI({
  apiKey: config.openaiApiKey,
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
      model: 'gpt-3.5-turbo', // or gpt-4 if preferred
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

module.exports = {
  getChatResponse,
};
