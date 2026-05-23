import { Router } from 'express';
import { githubCallback, getCurrentUser } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/github/callback', githubCallback);
router.get('/me', authMiddleware, getCurrentUser);

export default router;
