import { Router } from 'express';
import { uploadVideo, getGitHubRepos, pushBugToGitHub, githubOAuthCallback, githubOAuthInitiate } from '../controllers/integrationController.js';
import { authMiddleware } from '../middleware/auth.js';
import { uploadVideoMiddleware } from '../middleware/upload.js';

const router = Router();

router.post('/:projectId/upload-video', authMiddleware, uploadVideoMiddleware.single('video'), uploadVideo);
router.get('/github/repos', authMiddleware, getGitHubRepos);
router.post('/github/push-bug', authMiddleware, pushBugToGitHub);
router.get('/github/auth', authMiddleware, githubOAuthInitiate);
router.get('/github/callback', githubOAuthCallback);

export default router;
