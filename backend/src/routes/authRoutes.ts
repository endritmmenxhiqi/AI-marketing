import express from 'express';
import { requireAuth } from '../auth';
import { forgotPassword, getMe, login, register, resetPassword } from '../controllers/authController';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);
router.get('/me', requireAuth, getMe);

export default router;
