import { Router } from 'express';
import {
  clearTestCases,
  createTestCase,
  deleteTestCase,
  generateTestCases,
  getTestCases,
  updateTestCaseStatus,
} from '../controllers/testCaseController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.post('/generate', authMiddleware, generateTestCases);
router.post('/', authMiddleware, createTestCase);
router.get('/:projectId', authMiddleware, getTestCases);
router.delete('/project/:projectId', authMiddleware, clearTestCases);
router.put('/:testCaseId/status', authMiddleware, updateTestCaseStatus);
router.delete('/:testCaseId', authMiddleware, deleteTestCase);

export default router;
