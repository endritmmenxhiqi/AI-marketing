import 'dotenv/config';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve('backend/.env') });

async function testTTS() {
  const key = process.env.DEEPGRAM_API_KEY?.trim();
  const model = process.env.DEEPGRAM_TTS_MODEL?.trim();
  const text = 'Hello, this is a test of the deepgram tts system.';

  console.log(`Testing Deepgram TTS with model: "${model}"`);

  if (!key) {
    console.error('❌ DEEPGRAM_API_KEY missing');
    return;
  }

  try {
    const res = await fetch(`https://api.deepgram.com/v1/speak?model=${encodeURIComponent(model)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${key}`
      },
      body: JSON.stringify({ text })
    });

    if (res.ok) {
      console.log('✅ Deepgram TTS: Success! Received audio data.');
    } else {
      const errorText = await res.text();
      console.error(`❌ Deepgram TTS: Failed with status ${res.status}`);
      console.error(`Error Body: ${errorText}`);
    }
  } catch (err) {
    console.error(`❌ Error during fetch: ${err.message}`);
  }
}

testTTS();
