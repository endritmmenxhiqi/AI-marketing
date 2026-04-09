const express = require('express');
const router = express.Router();
const { chat, synthesizeSpeech } = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');

/**
 * POST /api/ai/chat
 */
router.post('/chat', protect, chat);

/**
 * POST /api/ai/tts
 */
router.post('/tts', protect, synthesizeSpeech);

module.exports = router;
