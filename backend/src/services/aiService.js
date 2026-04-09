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
        content: `You are a Voiceover script generator.
CRITICAL RULE 1: YOU MUST MATCH THE USER'S LANGUAGE EXACTLY.
CRITICAL RULE 2: TTS READY OUTPUT ONLY! NO labels, tags, brackets, or meta-text. OUTPUT ONLY THE RAW SPOKEN WORDS.

--- HYPER-REALISM RULES (ALL LANGUAGES) ---
The script MUST NOT sound like a polished ad. It must sound like a RAW, UNEDITED voice note sent by a real person on WhatsApp or a super casual vlog.
1. Stutters & Hesitations: Add imperfections (e.g., "I- I genuinely...", "Wait, uh...", "S- shikoo").
2. Sighs & Laughs: Add small natural sounds as words (e.g., "haha", "uff").
3. Extreme Slang: Use street talk. Break all formal grammar rules. Make it messy and completely imperfect.

--- IF THE USER SPEAKS ENGLISH ---
Act like a real person sending a spontaneous voice memo. 
Keep it under 20 seconds. Use "listen, guys...", "Wait, no...", "Literally..."

--- IF THE USER SPEAKS ALBANIAN ---
Make it sound like super unfiltered street Albanian.
You MUST write the text using a phonetic Italian hacking strategy to force English TTS models to pronounce Albanian correctly. DO NOT write standard Albanian.
1. Replace letters: GJ -> XHY, Ë -> remove completely or use ('), SH -> SHH, Q -> CH.
2. Stretch vowels ALOT to sound realistic and sluggish (e.g., 'Eeeeeej', 'shuuum').
3. Use Italian spelling rules: 'shum mire' instead of 'shumë mirë'.
4. Stuttering phonetic example: "Uhh... d-deexhjo... un' s'e besoj dot."
Keep it under 20 seconds. WARNING: Do NOT write meta-labels! Output ONLY the raw phonetic words to be spoken!`,
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

/**
 * Generate Text-to-Speech (TTS) using Deepgram.
 * @param {string} text - The text to speak.
 * @param {string} model - The Deepgram voice model (e.g. 'aura-asteria-en').
 * @returns {Promise<Buffer>} The audio file buffer.
 */
const generateTTS = async (text, model = 'aura-asteria-en') => {
  if (!config.deepgramApiKey) {
    throw new Error('Deepgram API key is not configured');
  }

  try {
    const response = await fetch(`https://api.deepgram.com/v1/speak?model=${model}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${config.deepgramApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Deepgram TTS Error:', errText);
      throw new Error(`Failed to generate TTS: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('Deepgram Service Error:', error);
    throw new Error('Failed to generate audio from AI service');
  }
};

module.exports = {
  getChatResponse,
  generateTTS,
};
