const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const config = require('../config');

const DEEPGRAM_API_BASE = 'https://api.deepgram.com/v1';
const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const AUDIO_OUTPUT_DIR = path.join(__dirname, '../../public/generated/audio');

const sanitizeFilename = (value) =>
  String(value || 'voiceover')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'voiceover';

const writeWaveHeader = ({ dataLength, channels = 1, sampleRate = 24000, sampleWidth = 2 }) => {
  const byteRate = sampleRate * channels * sampleWidth;
  const blockAlign = channels * sampleWidth;
  const buffer = Buffer.alloc(44);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(sampleWidth * 8, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataLength, 40);

  return buffer;
};

const buildWaveFile = (pcmBuffer, options = {}) =>
  Buffer.concat([writeWaveHeader({ dataLength: pcmBuffer.length, ...options }), pcmBuffer]);

const persistAudioBuffer = async ({ buffer, extension, title }) => {
  const fileSlug = sanitizeFilename(title);
  const fileName = `${fileSlug}-${crypto.randomUUID()}.${extension}`;

  await fs.mkdir(AUDIO_OUTPUT_DIR, { recursive: true });
  await fs.writeFile(path.join(AUDIO_OUTPUT_DIR, fileName), buffer);

  return `${config.backendUrl}/generated/audio/${fileName}`;
};

const getPreferredProvider = () => {
  const providers = [
    {
      provider: 'deepgram',
      configured: Boolean(config.deepgramApiKey),
      voiceId: config.deepgramTtsModel,
    },
    {
      provider: 'gemini',
      configured: Boolean(config.geminiApiKey),
      voiceId: config.geminiTtsVoice,
    },
    {
      provider: 'elevenlabs',
      configured: Boolean(config.elevenLabsApiKey),
      voiceId: config.elevenLabsVoiceId,
    },
  ];

  return providers.find((provider) => provider.configured) || providers[0];
};

const buildFailedAttempt = ({ provider, configured, voiceId, errorMessage }) => ({
  ok: false,
  provider,
  configured,
  voiceId,
  errorMessage,
});

const synthesizeWithDeepgram = async ({ text, title }) => {
  if (!config.deepgramApiKey) {
    return buildFailedAttempt({
      provider: 'deepgram',
      configured: false,
      voiceId: config.deepgramTtsModel,
      errorMessage: 'DEEPGRAM_API_KEY is missing',
    });
  }

  const url = `${DEEPGRAM_API_BASE}/speak?model=${encodeURIComponent(config.deepgramTtsModel)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Token ${config.deepgramApiKey}`,
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return buildFailedAttempt({
      provider: 'deepgram',
      configured: true,
      voiceId: config.deepgramTtsModel,
      errorMessage: `Deepgram request failed: ${response.status} ${errorText}`,
    });
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  const audioUrl = await persistAudioBuffer({
    buffer: audioBuffer,
    extension: 'mp3',
    title,
  });

  return {
    ok: true,
    provider: 'deepgram',
    configured: true,
    voiceId: config.deepgramTtsModel,
    audioUrl,
  };
};

const synthesizeWithElevenLabs = async ({ text, title }) => {
  if (!config.elevenLabsApiKey) {
    return buildFailedAttempt({
      provider: 'elevenlabs',
      configured: false,
      voiceId: config.elevenLabsVoiceId,
      errorMessage: 'ELEVENLABS_API_KEY is missing',
    });
  }

  const url = `${ELEVENLABS_API_BASE}/text-to-speech/${config.elevenLabsVoiceId}?output_format=mp3_44100_128`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': config.elevenLabsApiKey,
    },
    body: JSON.stringify({
      text,
      model_id: config.elevenLabsModelId,
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.75,
        style: 0.2,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return buildFailedAttempt({
      provider: 'elevenlabs',
      configured: true,
      voiceId: config.elevenLabsVoiceId,
      errorMessage: `ElevenLabs request failed: ${response.status} ${errorText}`,
    });
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  const audioUrl = await persistAudioBuffer({
    buffer: audioBuffer,
    extension: 'mp3',
    title,
  });

  return {
    ok: true,
    provider: 'elevenlabs',
    configured: true,
    voiceId: config.elevenLabsVoiceId,
    audioUrl,
  };
};

const synthesizeWithGemini = async ({ text, title }) => {
  if (!config.geminiApiKey) {
    return buildFailedAttempt({
      provider: 'gemini',
      configured: false,
      voiceId: config.geminiTtsVoice,
      errorMessage: 'GEMINI_API_KEY is missing',
    });
  }

  const url = `${GEMINI_API_BASE}/${config.geminiTtsModel}:generateContent`;
  const prompt = `Say in an upbeat, polished commercial voice: ${text}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': config.geminiApiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: config.geminiTtsVoice,
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return buildFailedAttempt({
      provider: 'gemini',
      configured: true,
      voiceId: config.geminiTtsVoice,
      errorMessage: `Gemini TTS request failed: ${response.status} ${errorText}`,
    });
  }

  const payload = await response.json();
  const base64Audio = payload.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

  if (!base64Audio) {
    return buildFailedAttempt({
      provider: 'gemini',
      configured: true,
      voiceId: config.geminiTtsVoice,
      errorMessage: 'Gemini TTS response did not include audio data',
    });
  }

  const pcmBuffer = Buffer.from(base64Audio, 'base64');
  const waveBuffer = buildWaveFile(pcmBuffer);
  const audioUrl = await persistAudioBuffer({
    buffer: waveBuffer,
    extension: 'wav',
    title,
  });

  return {
    ok: true,
    provider: 'gemini',
    configured: true,
    voiceId: config.geminiTtsVoice,
    audioUrl,
  };
};

const synthesizeVoiceover = async ({ text, title }) => {
  const cleanText = String(text || '').trim();

  if (!cleanText) {
    const preferredProvider = getPreferredProvider();

    return {
      provider: preferredProvider.provider,
      configured: preferredProvider.configured,
      voiceId: preferredProvider.voiceId,
      generatedAt: new Date(),
      errorMessage: 'Voiceover text is empty',
      audioUrl: '',
    };
  }

  try {
    const attempts = [];
    const providers = [
      synthesizeWithDeepgram,
      synthesizeWithGemini,
      synthesizeWithElevenLabs,
    ];

    for (const provider of providers) {
      const result = await provider({ text: cleanText, title });
      attempts.push(result);

      if (result.ok) {
        return {
          provider: result.provider,
          configured: result.configured,
          voiceId: result.voiceId,
          generatedAt: new Date(),
          errorMessage: '',
          audioUrl: result.audioUrl,
        };
      }
    }

    const configuredAttempt = attempts.find((attempt) => attempt.configured);
    const fallbackProvider = configuredAttempt || getPreferredProvider();

    return {
      provider: fallbackProvider.provider,
      configured: attempts.some((attempt) => attempt.configured),
      voiceId: fallbackProvider.voiceId,
      generatedAt: new Date(),
      errorMessage: attempts
        .map((attempt) => attempt.errorMessage)
        .filter(Boolean)
        .join(' | '),
      audioUrl: '',
    };
  } catch (error) {
    const preferredProvider = getPreferredProvider();

    return {
      provider: preferredProvider.provider,
      configured: preferredProvider.configured,
      voiceId: preferredProvider.voiceId,
      generatedAt: new Date(),
      errorMessage: error.message,
      audioUrl: '',
    };
  }
};

module.exports = {
  synthesizeVoiceover,
};
