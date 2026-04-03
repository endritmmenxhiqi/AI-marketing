const axios = require('axios');

const testChat = async () => {
  try {
    // 1. Login to get a token
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'nebihifatlind@gmail.com', // Using the user's email from logs
      password: 'password123' // Assuming a common test password or one previously used
    });

    const token = loginRes.data.token;
    console.log('Logged in successfully');

    // 2. Test AI Chat
    const chatRes = await axios.post('http://localhost:5000/api/ai/chat', 
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
