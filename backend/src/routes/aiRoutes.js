const express = require('express');
const router = express.Router();
const {
  chat,
  generate,
  listGenerations,
  getGeneration,
  refreshGenerationMedia,
  refreshGenerationVoice,
  renderGenerationPreview,
} = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');

/**
 * POST /api/ai/chat
 */
router.post('/chat', protect, chat);
router.post('/generate', protect, generate);
router.get('/generations', protect, listGenerations);
router.get('/generations/:id', protect, getGeneration);
router.post('/generations/:id/media', protect, refreshGenerationMedia);
router.post('/generations/:id/voice', protect, refreshGenerationVoice);
router.post('/generations/:id/render', protect, renderGenerationPreview);

module.exports = router;
