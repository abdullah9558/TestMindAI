import { Request, Response } from 'express';
import pool from '../db/connection.js';
import { generateTestCasesWithAI, analyzeVideoWithAI } from '../services/aiService.js';
import { v4 as uuidv4 } from 'uuid';

interface AuthRequest extends Request {
  userId?: string;
}

export async function generateTestCases(req: AuthRequest, res: Response) {
  try {
    const { projectId, appDescription, perspectives, videoId } = req.body;

    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!projectId || !appDescription) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify project ownership
    const projectResult = await pool.query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, req.userId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Generate test cases using AI
    const testCases = await generateTestCasesWithAI({
      appDescription,
      perspectives: perspectives || ['Functional', 'UI/UX', 'Edge Cases'],
    });

    // Save test cases to database
    const savedTestCases = [];
    for (const testCase of testCases) {
      const id = uuidv4();
      await pool.query(
        `INSERT INTO test_cases 
         (id, project_id, title, description, preconditions, steps, expected_result, 
          severity, priority, test_type, module, tags, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          id,
          projectId,
          testCase.title,
          testCase.title,
          testCase.preconditions,
          JSON.stringify(testCase.steps),
          testCase.expectedResult,
          testCase.severity,
          testCase.priority,
          testCase.testType,
          testCase.module,
          JSON.stringify(testCase.tags),
          req.userId,
        ]
      );

      savedTestCases.push({ id, ...testCase });
    }

    res.json({ success: true, testCases: savedTestCases });
  } catch (error) {
    console.error('Error generating test cases:', error);
    res.status(500).json({ error: 'Failed to generate test cases' });
  }
}

export async function getTestCases(req: AuthRequest, res: Response) {
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
      `SELECT id, title, description, preconditions, steps, expected_result, actual_result,
              status, severity, priority, test_type, module, tags, created_at, updated_at
       FROM test_cases WHERE project_id = $1 ORDER BY created_at DESC`,
      [projectId]
    );

    const testCases = result.rows.map(row => ({
      ...row,
      steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags,
    }));

    res.json(testCases);
  } catch (error) {
    console.error('Error fetching test cases:', error);
    res.status(500).json({ error: 'Failed to fetch test cases' });
  }
}

export async function updateTestCaseStatus(req: AuthRequest, res: Response) {
  try {
    const { testCaseId } = req.params;
    const { status, actualResult } = req.body;

    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      `UPDATE test_cases SET status = $1, actual_result = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING *`,
      [status, actualResult, testCaseId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Test case not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating test case:', error);
    res.status(500).json({ error: 'Failed to update test case' });
  }
}
