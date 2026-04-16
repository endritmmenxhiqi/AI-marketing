// Entry point for backend services (AI, Video, TTS)
const authService = require('./authService');
const emailService = require('./emailService');
const aiService = require('./aiService');
const generationService = require('./generationService');
const mediaService = require('./mediaService');
const ttsService = require('./ttsService');
const renderService = require('./renderService');

module.exports = {
  ...authService,
  ...emailService,
  ...aiService,
  ...generationService,
  ...mediaService,
  ...ttsService,
  ...renderService,
};
