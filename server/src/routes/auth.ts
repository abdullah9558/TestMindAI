import { Router } from 'express';
import { createDevSession, githubCallback, getCurrentUser, updateCurrentUser } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/github/callback', githubCallback);
router.get('/me', authMiddleware, getCurrentUser);
router.put('/me', authMiddleware, updateCurrentUser);
router.post('/dev-session', createDevSession);

export default router;
