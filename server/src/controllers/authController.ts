import { Request, Response } from 'express';
import pool from '../db/connection.js';
import { generateToken } from '../services/authService.js';
import { getGitHubAccessToken, getGitHubUser } from '../services/githubService.js';
import { v4 as uuidv4 } from 'uuid';

interface AuthRequest extends Request {
  userId?: string;
}

export async function githubCallback(req: Request, res: Response) {
  try {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Missing authorization code' });
    }

    // Get access token from GitHub
    const accessToken = await getGitHubAccessToken(code);

    // Get user info from GitHub
    const githubUser = await getGitHubUser(accessToken);

    // Check if user exists in database
    const userResult = await pool.query(
      'SELECT id, email FROM users WHERE github_id = $1',
      [githubUser.id]
    );

    let userId: string;
    let userEmail: string;

    if (userResult.rows.length > 0) {
      // User exists, update token
      userId = userResult.rows[0].id;
      userEmail = userResult.rows[0].email;
      
      await pool.query(
        'UPDATE users SET github_access_token = $1, github_username = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        [accessToken, githubUser.login, userId]
      );
    } else {
      // Create new user
      userId = uuidv4();
      userEmail = githubUser.email || `${githubUser.login}@github.com`;

      await pool.query(
        `INSERT INTO users (id, email, name, github_id, github_username, github_access_token)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, userEmail, githubUser.name || githubUser.login, githubUser.id, githubUser.login, accessToken]
      );
    }

    // Generate JWT token
    const token = generateToken(userId);

    // Redirect to frontend with token
    const redirectUrl = `${process.env.FRONTEND_URL}?token=${token}&userId=${userId}&email=${userEmail}`;
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('GitHub callback error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

export async function getCurrentUser(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      'SELECT id, email, name, github_username FROM users WHERE id = $1',
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user' });
  }
}
