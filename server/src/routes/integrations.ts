import { Router } from 'express';
import { uploadVideo, getGitHubRepos, pushBugToGitHub } from '../controllers/integrationController.js';
import { authMiddleware } from '../middleware/auth.js';
import { uploadVideoMiddleware } from '../middleware/upload.js';

const router = Router();

router.post('/:projectId/upload-video', authMiddleware, uploadVideoMiddleware.single('video'), uploadVideo);
router.get('/github/repos', authMiddleware, getGitHubRepos);
router.post('/github/push-bug', authMiddleware, pushBugToGitHub);

export default router;
