const express = require('express');
const router = express.Router();
const { chat } = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');

/**
 * POST /api/ai/chat
 */
router.post('/chat', protect, chat);

module.exports = router;
