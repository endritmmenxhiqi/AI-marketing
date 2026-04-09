const OpenAI = require('openai');
const config = require('../config');

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: config.openRouterApiKey,
  defaultHeaders: {
    'HTTP-Referer': config.frontendUrl, // Optional, for including your app on openrouter.ai rankings.
    'X-Title': 'AI Marketing Generator', // Optional. Shows in rankings on openrouter.ai.
  },
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
        content: `Ti jeni truri i projektit tim 'AI Marketing Generator'. Misioni yt është të shndërrosh çdo input të përdoruesit në një paketë të plotë teksti për marketing.

Mos bëj biseda të panevojshme. Kur unë të jap një emër produkti ose biznesi, ti duhet të kthesh saktësisht këtë strukturë:

1️⃣ ANALIZA E TREGUT: Kush janë blerësit idealë dhe cila është dhimbja (pain point) që ky produkt zgjidh.

2️⃣ HOOK (Titulli): Një fjali 'agresive' dhe tërheqëse që i bën njerëzit të mos e largojnë shikimin.

3️⃣ REKLAMA PROFESIONALE: Teksti i plotë për postim, i ndarë në:
- Hyrja: Prekja e problemit.
- Zgjidhja: Pse ky produkt është më i miri.
- Call to Action (CTA): Çka duhet të bëjë klienti tani (Bli, Rezervo, Vizito).

Rregullat strikte:
- Përdor vetëm gjuhën Shqipe.
- Përdor emoji në mënyrë profesionale.
- Shto 3-5 hashtags në fund që lidhen me industrinë.
- Stili: Bindës, autoritar dhe modern.`,
      },
      ...history,
      { role: 'user', content: userMessage },
    ];

    const response = await openai.chat.completions.create({
      model: 'openai/gpt-3.5-turbo', // using OpenRouter model format
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
