import 'dotenv/config';
import { config } from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';

config({ path: path.resolve('backend/.env') });

async function testServices() {
  console.log('--- ENV VALIDATION START ---');

  // 1. MongoDB
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) throw new Error('MONGODB_URI missing');
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ MongoDB: Connected successfully');
    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ MongoDB:', err.message);
  }

  // 2. OpenAI / OpenRouter
  try {
    const key = process.env.OPENAI_API_KEY;
    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    if (!key) throw new Error('OPENAI_API_KEY missing');
    
    const res = await fetch(`${baseUrl}/models`, {
      headers: { 'Authorization': `Bearer ${key}` }
    });
    
    if (res.ok) {
        console.log('✅ OpenAI (OpenRouter): API Key is valid');
    } else {
        const data = await res.json().catch(() => ({}));
        console.error('❌ OpenAI (OpenRouter):', res.status, data.error?.message || 'Invalid Key');
    }
  } catch (err) {
    console.error('❌ OpenAI (OpenRouter):', err.message);
  }

  // 3. Pexels
  try {
    const key = process.env.PEXELS_API_KEY;
    if (!key) throw new Error('PEXELS_API_KEY missing');
    
    const res = await fetch('https://api.pexels.com/v1/search?query=marketing&per_page=1', {
      headers: { 'Authorization': key.trim() }
    });
    
    if (res.ok) {
        console.log('✅ Pexels: API Key is valid');
    } else {
        console.error('❌ Pexels:', res.status, 'Invalid Key');
    }
  } catch (err) {
    console.error('❌ Pexels:', err.message);
  }

  // 4. Deepgram
  try {
    const key = process.env.DEEPGRAM_API_KEY;
    if (!key) throw new Error('DEEPGRAM_API_KEY missing');
    
    const res = await fetch('https://api.deepgram.com/v1/projects', {
      headers: { 'Authorization': `Token ${key.trim()}` }
    });
    
    if (res.ok) {
        console.log('✅ Deepgram: API Key is valid');
    } else {
        const data = await res.json().catch(() => ({}));
        console.error('❌ Deepgram:', res.status, data.err_msg || 'Invalid Key');
    }
  } catch (err) {
    console.error('❌ Deepgram:', err.message);
  }

  console.log('--- ENV VALIDATION END ---');
  process.exit(0);
}

testServices();
