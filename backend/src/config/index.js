const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000,
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  openaiApiKey: process.env.OPENAI_API_KEY,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  email: {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || 'noreply@ai-marketing.com',
  },
};

// Simple validation to ensure critical keys are present
const requiredKeys = ['MONGODB_URI', 'JWT_SECRET', 'OPENAI_API_KEY'];
requiredKeys.forEach((key) => {
  if (!process.env[key]) {
    console.warn(`⚠️ Warning: ${key} environment variable is missing!`);
  }
});

module.exports = config;
