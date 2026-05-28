import { Request, Response } from 'express';
import pool from '../db/connection.js';
import { v4 as uuidv4 } from 'uuid';

interface AuthRequest extends Request {
  userId?: string;
}

export async function getBugReports(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params;

    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify project ownership
    const projectResult = await pool.query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, req.userId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const result = await pool.query(
      `SELECT id, title, description, steps, expected_result, actual_result, severity, 
              priority, status, github_issue_url, rca_text, suggested_fix, created_at
       FROM bug_reports WHERE project_id = $1 ORDER BY created_at DESC`,
      [projectId]
    );

    const bugReports = result.rows.map((row: any) => ({
      ...row,
      steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps,
    }));

    res.json(bugReports);
  } catch (error) {
    console.error('Error fetching bug reports:', error);
    res.status(500).json({ error: 'Failed to fetch bug reports' });
  }
}

export async function createBugReport(req: AuthRequest, res: Response) {
  try {
    const { projectId, testCaseId, title, description, steps, expectedResult, actualResult, severity, priority } =
      req.body;

    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!projectId || !title) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const id = uuidv4();

    const result = await pool.query(
      `INSERT INTO bug_reports 
       (id, project_id, test_case_id, title, description, steps, expected_result, actual_result, severity, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [id, projectId, testCaseId || null, title, description, JSON.stringify(steps || []), expectedResult, actualResult, severity, priority]
    );

    res.status(201).json({
      ...result.rows[0],
      steps: steps || [],
    });
  } catch (error) {
    console.error('Error creating bug report:', error);
    res.status(500).json({ error: 'Failed to create bug report' });
  }
}

export async function updateBugReportStatus(req: AuthRequest, res: Response) {
  try {
    const { bugId } = req.params;
    const { status, rcaText, suggestedFix } = req.body;

    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      `UPDATE bug_reports SET status = $1, rca_text = $2, suggested_fix = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 RETURNING *`,
      [status, rcaText, suggestedFix, bugId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bug report not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating bug report:', error);
    res.status(500).json({ error: 'Failed to update bug report' });
  }
}
