const express = require('express');
const router = express.Router();
const { chat, synthesizeSpeech, proxyImage } = require('../controllers/aiController');
const { autoFixImage } = require('../controllers/imageEditorController');
const { protect } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');

// Configure Multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'src/uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

/**
 * POST /api/ai/chat
 * Support for multipart/form-data for image uploads
 */
router.post('/chat', protect, upload.single('image'), chat);

/**
 * POST /api/ai/tts
 */
router.post('/tts', protect, synthesizeSpeech);

/**
 * GET /api/ai/image-proxy
 */
router.get('/image-proxy', proxyImage);

/**
 * POST /api/ai/auto-fix
 */
router.post('/auto-fix', protect, autoFixImage);

module.exports = router;
