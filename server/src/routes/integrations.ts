import { Router } from 'express';
import { createRepository, disconnectGitHub, getGitHubStatus, uploadVideo, getGitHubRepos, publishProjectToGitHub, pushBugToGitHub, githubOAuthCallback, githubOAuthInitiate, parseTelemetry } from '../controllers/integrationController.js';
import { authMiddleware } from '../middleware/auth.js';
import { uploadVideoMiddleware } from '../middleware/upload.js';

const router = Router();

router.post('/parse-telemetry', authMiddleware, parseTelemetry);
router.post('/:projectId/upload-video', authMiddleware, uploadVideoMiddleware.single('video'), uploadVideo);
router.get('/github/repos', authMiddleware, getGitHubRepos);
router.get('/github/status', authMiddleware, getGitHubStatus);
router.post('/github/repos', authMiddleware, createRepository);
router.post('/github/publish', authMiddleware, publishProjectToGitHub);
router.delete('/github/connection', authMiddleware, disconnectGitHub);
router.post('/github/push-bug', authMiddleware, pushBugToGitHub);
router.get('/github/auth', authMiddleware, githubOAuthInitiate);
router.get('/github/callback', githubOAuthCallback);

export default router;
