import { Request, Response } from 'express';
import pool from '../db/connection.js';
import { v4 as uuidv4 } from 'uuid';

interface AuthRequest extends Request {
  userId?: string;
}

export async function createProject(req: AuthRequest, res: Response) {
  try {
    const { name, description, appDescription, platformType } = req.body;

    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const id = uuidv4();

    const result = await pool.query(
      `INSERT INTO projects (id, user_id, name, description, app_description, platform_type)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, req.userId, name, description, appDescription, platformType]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
}

export async function getProjects(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      `SELECT id, name, description, app_description, platform_type, created_at, updated_at
       FROM projects WHERE user_id = $1 ORDER BY updated_at DESC`,
      [req.userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
}

export async function getProjectById(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params;

    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      `SELECT * FROM projects WHERE id = $1 AND user_id = $2`,
      [projectId, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
}

export async function updateProject(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params;
    const { name, description, appDescription, platformType } = req.body;

    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      `UPDATE projects SET name = $1, description = $2, app_description = $3, 
       platform_type = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND user_id = $6 RETURNING *`,
      [name, description, appDescription, platformType, projectId, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
}

export async function deleteProject(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params;

    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      'DELETE FROM projects WHERE id = $1 AND user_id = $2 RETURNING id',
      [projectId, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ success: true, id: projectId });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
}
