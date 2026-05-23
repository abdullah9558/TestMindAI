import { Router } from 'express';
import { generateTestCases, getTestCases, updateTestCaseStatus } from '../controllers/testCaseController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.post('/generate', authMiddleware, generateTestCases);
router.get('/:projectId', authMiddleware, getTestCases);
router.put('/:testCaseId/status', authMiddleware, updateTestCaseStatus);

export default router;
