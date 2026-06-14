import { Router } from 'express';
import { getBugReports, createBugReport, updateBugReportStatus } from '../controllers/bugController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/:projectId', authMiddleware, getBugReports);
router.post('/', authMiddleware, createBugReport);
router.put('/:bugId/status', authMiddleware, updateBugReportStatus);

export default router;
