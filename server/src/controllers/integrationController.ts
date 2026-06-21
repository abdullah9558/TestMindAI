import { Request, Response } from 'express';
import pool from '../db/connection.js';
import { createGitHubRepository, createGitHubIssue, getGitHubUserRepositories } from '../services/githubService.js';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

interface AuthRequest extends Request {
  userId?: string;
  file?: Express.Multer.File;
}

export async function uploadVideo(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params;

    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const id = uuidv4();

    const result = await pool.query(
      `INSERT INTO video_recordings (id, project_id, file_name, file_path, file_size, mime_type)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, projectId, req.file.originalname, req.file.path, req.file.size, req.file.mimetype]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error uploading video:', error);
    res.status(500).json({ error: 'Failed to upload video' });
  }
}

export async function getGitHubRepos(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user's GitHub access token
    const userResult = await pool.query(
      'SELECT github_access_token FROM users WHERE id = $1',
      [req.userId]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].github_access_token) {
      return res.status(401).json({ error: 'GitHub not connected' });
    }

    const repos = await getGitHubUserRepositories(userResult.rows[0].github_access_token);
    res.json(repos);
  } catch (error) {
    console.error('Error fetching GitHub repos:', error);
    res.status(500).json({ error: 'Failed to fetch GitHub repositories' });
  }
}

export async function pushBugToGitHub(req: AuthRequest, res: Response) {
  try {
    const { bugId, repoName } = req.body;

    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get bug details
    const bugResult = await pool.query('SELECT * FROM bug_reports WHERE id = $1', [bugId]);

    if (bugResult.rows.length === 0) {
      return res.status(404).json({ error: 'Bug not found' });
    }

    const bug = bugResult.rows[0];

    // Get user's GitHub info
    const userResult = await pool.query(
      'SELECT github_username, github_access_token FROM users WHERE id = $1',
      [req.userId]
    );

    if (!userResult.rows[0].github_access_token) {
      return res.status(401).json({ error: 'GitHub not connected' });
    }

    const gitHubIssue = await createGitHubIssue(
      userResult.rows[0].github_access_token,
      userResult.rows[0].github_username,
      repoName,
      bug.title,
      `${bug.description}\n\n**Steps:** ${bug.steps.join(', ')}\n\n**Expected:** ${bug.expected_result}\n\n**Actual:** ${bug.actual_result}\n\n**Severity:** ${bug.severity}`
    );

    // Update bug with GitHub issue URL
    await pool.query(
      'UPDATE bug_reports SET github_issue_url = $1 WHERE id = $2',
      [gitHubIssue.html_url, bugId]
    );

    res.json({ success: true, issueUrl: gitHubIssue.html_url });
  } catch (error) {
    console.error('Error pushing bug to GitHub:', error);
    res.status(500).json({ error: 'Failed to push bug to GitHub' });
  }
}

export async function githubOAuthInitiate(req: AuthRequest, res: Response) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'GitHub OAuth not configured' });
  }
  const scope = 'repo user';
  const state = req.userId || 'anonymous';
  const redirectUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=${encodeURIComponent(scope)}&state=${state}`;
  res.json({ url: redirectUrl });
}

export async function githubOAuthCallback(req: Request, res: Response) {
  const { code, state: userId } = req.query;
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (!code || !clientId || !clientSecret) {
    return res.redirect(`${frontendUrl}?github_error=missing_params`);
  }

  try {
    // Exchange code for access token
    const tokenRes = await axios.post(
      'https://github.com/login/oauth/access_token',
      { client_id: clientId, client_secret: clientSecret, code },
      { headers: { Accept: 'application/json' } }
    );

    const accessToken = tokenRes.data.access_token;
    if (!accessToken) {
      return res.redirect(`${frontendUrl}?github_error=no_token`);
    }

    // Get GitHub user info
    const userRes = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const githubUsername = userRes.data.login;

    // Save token to user record
    if (userId && userId !== 'anonymous') {
      await pool.query(
        'UPDATE users SET github_access_token = $1, github_username = $2 WHERE id = $3',
        [accessToken, githubUsername, userId]
      );
    }

    res.redirect(`${frontendUrl}?github_connected=true&github_user=${githubUsername}`);
  } catch (error) {
    console.error('GitHub OAuth callback error:', error);
    res.redirect(`${frontendUrl}?github_error=oauth_failed`);
  }
}
