import { Request, Response } from 'express';
import pool from '../db/connection.js';
import { generateTestCasesWithAI, analyzeVideoWithAI } from '../services/aiService.js';
import { v4 as uuidv4 } from 'uuid';

interface AuthRequest extends Request {
  userId?: string;
}

export async function generateTestCases(req: AuthRequest, res: Response) {
  try {
    const { projectId, appDescription, perspectives, platform, testCount, videoId } = req.body;
    console.log('POST /test-cases/generate body:', {
      projectId: projectId || null,
      appDescription: appDescription ? (appDescription.length > 200 ? `${appDescription.substring(0,200)}...` : appDescription) : null,
      perspectives,
      platform,
      testCount,
      videoId,
      userId: req.userId || null,
    });

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

    // If videoId provided, fetch video path and analyze it
    let videoAnalysis: string | undefined = undefined;
    if (videoId) {
      const videoRes = await pool.query('SELECT file_path FROM video_recordings WHERE id = $1 AND project_id = $2', [videoId, projectId]);
      if (videoRes.rows.length > 0) {
        const filePath = videoRes.rows[0].file_path;
        try {
          videoAnalysis = await analyzeVideoWithAI(filePath);
        } catch (err) {
          console.warn('Video analysis failed, continuing without video data');
        }
      }
    }

    // Generate test cases using AI (include videoAnalysis if available)
    const testCases = await generateTestCasesWithAI({
      appDescription,
      perspectives: perspectives || ['Functional', 'UI/UX', 'Edge Cases'],
      platform,
      testCount,
      videoAnalysis,
    });

    // Save test cases to database
    const savedTestCases = [];
    for (const testCase of testCases) {
      const id = uuidv4();
      await pool.query(
        `INSERT INTO test_cases 
         (id, project_id, title, description, preconditions, steps, expected_result, 
          severity, priority, test_type, platform, module, tags, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
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
          testCase.platform || platform || 'Web',
          testCase.module,
          JSON.stringify(testCase.tags),
          req.userId,
        ]
      );

      savedTestCases.push({ id, ...testCase, platform: testCase.platform || platform || 'Web' });
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
              status, severity, priority, test_type, platform, module, tags, created_at, updated_at
       FROM test_cases WHERE project_id = $1 ORDER BY created_at DESC`,
      [projectId]
    );

    const testCases = result.rows.map((row: any) => ({
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

export async function createTestCase(req: AuthRequest, res: Response) {
  try {
    const {
      projectId,
      title,
      preconditions,
      steps,
      expectedResult,
      actualResult,
      status,
      severity,
      priority,
      testType,
      platform,
      module,
      tags,
    } = req.body;

    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!projectId || !title) {
      return res.status(400).json({ error: 'Project and title are required' });
    }

    const projectResult = await pool.query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, req.userId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO test_cases
       (id, project_id, title, description, preconditions, steps, expected_result, actual_result,
        status, severity, priority, test_type, platform, module, tags, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        id,
        projectId,
        title,
        title,
        preconditions || '',
        JSON.stringify(Array.isArray(steps) ? steps : []),
        expectedResult || '',
        actualResult || null,
        status || 'pending',
        severity || 'MEDIUM',
        priority || 'P2',
        testType || 'Manual',
        platform || 'Web Application',
        module || 'General',
        JSON.stringify(Array.isArray(tags) ? tags : []),
        req.userId,
      ]
    );

    res.status(201).json({
      ...result.rows[0],
      steps: result.rows[0].steps,
      tags: result.rows[0].tags,
    });
  } catch (error) {
    console.error('Error creating test case:', error);
    res.status(500).json({ error: 'Failed to create test case' });
  }
}

export async function deleteTestCase(req: AuthRequest, res: Response) {
  try {
    const { testCaseId } = req.params;

    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      `DELETE FROM test_cases
       WHERE id = $1
       AND project_id IN (SELECT id FROM projects WHERE user_id = $2)
       RETURNING id`,
      [testCaseId, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Test case not found' });
    }

    res.json({ success: true, id: testCaseId });
  } catch (error) {
    console.error('Error deleting test case:', error);
    res.status(500).json({ error: 'Failed to delete test case' });
  }
}

export async function clearTestCases(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params;

    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      `DELETE FROM test_cases
       WHERE project_id = $1
       AND project_id IN (SELECT id FROM projects WHERE user_id = $2)
       RETURNING id`,
      [projectId, req.userId]
    );

    res.json({ success: true, deleted: result.rows.length });
  } catch (error) {
    console.error('Error clearing test cases:', error);
    res.status(500).json({ error: 'Failed to clear test cases' });
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
