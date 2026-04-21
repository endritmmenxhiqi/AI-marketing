const axios = require('axios');

const apiBaseUrl = (process.env.TEST_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;

const testChat = async () => {
  try {
    if (!email || !password) {
      throw new Error('Set TEST_EMAIL and TEST_PASSWORD before running backend/test-ai.js');
    }

    // 1. Login to get a token
    const loginRes = await axios.post(`${apiBaseUrl}/auth/login`, {
      email,
      password,
    });

    const token = loginRes.data.token;
    console.log('Logged in successfully');

    // 2. Test AI Chat
    const chatRes = await axios.post(`${apiBaseUrl}/ai/chat`, 
      { message: 'Hello! Can you help me with a marketing slogan for a new AI tool?' },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log('AI Response:', chatRes.data.data);
    process.exit(0);
  } catch (error) {
    console.error('Test Failed:', error.response?.data || error.message);
    process.exit(1);
  }
};

testChat();
