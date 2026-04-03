// Entry point for backend services (AI, Video, TTS)
const authService = require('./authService');
const emailService = require('./emailService');

module.exports = {
  ...authService,
  ...emailService,
};
