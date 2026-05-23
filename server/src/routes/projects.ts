import { Router } from 'express';
import {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
} from '../controllers/projectController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.post('/', authMiddleware, createProject);
router.get('/', authMiddleware, getProjects);
router.get('/:projectId', authMiddleware, getProjectById);
router.put('/:projectId', authMiddleware, updateProject);
router.delete('/:projectId', authMiddleware, deleteProject);

export default router;
