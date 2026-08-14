import { Request, Response } from 'express';
import pool from '../db/connection.js';
import { createGitHubBranch, createGitHubRepository, createGitHubIssue, createGitHubPullRequest, getGitHubRepository, getGitHubUser, getGitHubUserRepositories, putGitHubFile, revokeGitHubGrant } from '../services/githubService.js';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { generateToken, verifyToken } from '../services/authService.js';
import { generateAutomationFiles } from '../services/automationService.js';

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

    const [owner, repository] = String(repoName).split('/');
    if (!owner || !repository) return res.status(400).json({ error: 'Select a valid owner/repository.' });
    const gitHubIssue = await createGitHubIssue(
      userResult.rows[0].github_access_token,
      owner,
      repository,
      bug.title,
      `${bug.description}\n\n**Steps:** ${(bug.steps || []).join(', ')}\n\n**Expected:** ${bug.expected_result}\n\n**Actual:** ${bug.actual_result}\n\n**Severity:** ${bug.severity}`
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
  if (!req.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const scope = 'repo workflow read:user user:email';
  const state = generateToken(req.userId);
  const redirectUri = process.env.GITHUB_REDIRECT_URI;
  if (!redirectUri) {
    return res.status(500).json({ error: 'GITHUB_REDIRECT_URI is not configured' });
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
  });
  const redirectUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
  res.json({ url: redirectUrl });
}

async function connectedGitHub(userId: string) {
  const result = await pool.query('SELECT github_access_token, github_username FROM users WHERE id = $1', [userId]);
  return result.rows[0];
}

export async function getGitHubStatus(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });
    const connected = await connectedGitHub(req.userId);
    if (!connected?.github_access_token) return res.json({ connected: false });
    const profile = await getGitHubUser(connected.github_access_token);
    res.json({ connected: true, user: { login: profile.login, name: profile.name || profile.login, avatarUrl: profile.avatar_url } });
  } catch (error) {
    console.error('GitHub status error:', error);
    res.status(502).json({ error: 'GitHub authorization is invalid or expired. Reconnect GitHub.' });
  }
}

export async function createRepository(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });
    const name = String(req.body.name || '').trim();
    if (!/^[A-Za-z0-9._-]{1,100}$/.test(name)) return res.status(400).json({ error: 'Enter a valid repository name.' });
    const connected = await connectedGitHub(req.userId);
    if (!connected?.github_access_token) return res.status(401).json({ error: 'GitHub not connected' });
    const repo = await createGitHubRepository(connected.github_access_token, name, String(req.body.description || 'TestMind AI generated QA assets'), Boolean(req.body.private));
    if (req.body.projectId) {
      await pool.query(
        `INSERT INTO github_repositories (project_id, user_id, repo_id, repo_name, repo_full_name, repo_url)
         SELECT id, $2, $3, $4, $5, $6 FROM projects WHERE id = $1 AND user_id = $2`,
        [req.body.projectId, req.userId, repo.id, repo.name, repo.full_name, repo.html_url]
      );
    }
    res.status(201).json(repo);
  } catch (error: any) {
    console.error('Create GitHub repository error:', error?.response?.data || error);
    res.status(error?.response?.status || 500).json({ error: error?.response?.data?.message || 'Failed to create GitHub repository' });
  }
}

export async function publishProjectToGitHub(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });
    const projectId = String(req.body.projectId || '');
    const repositoryFullName = String(req.body.repositoryFullName || '');
    if (!projectId || !repositoryFullName.includes('/')) return res.status(400).json({ error: 'Project and repository are required.' });
    const connected = await connectedGitHub(req.userId);
    if (!connected?.github_access_token) return res.status(401).json({ error: 'GitHub not connected' });
    const projectResult = await pool.query('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [projectId, req.userId]);
    if (!projectResult.rows.length) return res.status(404).json({ error: 'Project not found' });
    const testsResult = await pool.query(
      `SELECT id, title, description, preconditions, steps, expected_result, severity, priority, test_type, platform, module, tags
       FROM test_cases WHERE project_id = $1 ORDER BY created_at ASC`, [projectId]
    );
    if (!testsResult.rows.length) return res.status(400).json({ error: 'Generate at least one test case before publishing.' });
    const repo = await getGitHubRepository(connected.github_access_token, repositoryFullName);
    if (!repo.permissions?.push) return res.status(403).json({ error: 'Your GitHub account cannot push to this repository.' });
    const base = repo.default_branch || 'main';
    const branch = `testmind/generated-tests-${Date.now()}`;
    await createGitHubBranch(connected.github_access_token, repositoryFullName, branch, base);
    const tests = testsResult.rows.map((row: Record<string, unknown>) => {
      const { expected_result, ...test } = row;
      return { ...test, expectedResult: expected_result };
    });
    const readme = `# TestMind AI QA Assets\n\nGenerated from **${projectResult.rows[0].name}**.\n\n- Test cases: ${tests.length}\n- Automation: Playwright, Cypress, and Selenium\n- Generated: ${new Date().toISOString()}\n\nReview \`testmind/test-cases.json\`, then fill the selector values in \`testmind/automation/locators.json\` before running the automation suites.\n`;
    const workflow = `name: Validate TestMind Assets\n\non:\n  pull_request:\n  push:\n    branches: [${base}]\n\njobs:\n  validate:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Validate generated test cases and automation files\n        run: node -e "const fs=require('fs'); const t=require('./testmind/test-cases.json'); const required=['testmind/automation/locators.json','testmind/automation/playwright/generated.spec.js','testmind/automation/cypress/e2e/generated.cy.js','testmind/automation/selenium/generated.test.js']; if(!Array.isArray(t)||!t.length||required.some(f=>!fs.existsSync(f))) process.exit(1); console.log('Validated',t.length,'test cases and 3 automation suites')"\n`;
    const files = [
      ['testmind/test-cases.json', JSON.stringify(tests, null, 2), 'Add generated TestMind test cases'],
      ['testmind/README.md', readme, 'Document TestMind QA assets'],
      ...generateAutomationFiles(tests).map(file => [file.path, file.content, file.message]),
    ];
    for (const [path, content, message] of files) await putGitHubFile(connected.github_access_token, repositoryFullName, branch, path, content, message);
    let workflowPublished = true;
    try {
      await putGitHubFile(
        connected.github_access_token,
        repositoryFullName,
        branch,
        '.github/workflows/testmind-validate.yml',
        workflow,
        'Add TestMind validation workflow'
      );
    } catch (workflowError: any) {
      const status = workflowError?.response?.status;
      const message = workflowError?.response?.data?.message;
      if (status !== 404 && status !== 403) throw workflowError;
      workflowPublished = false;
      console.warn('GitHub workflow file skipped because the OAuth token lacks workflow permission:', message);
    }
    const prDescription = workflowPublished
      ? `Adds ${tests.length} generated test cases and a validation workflow from TestMind AI.`
      : `Adds ${tests.length} generated test cases from TestMind AI. Re-authorize GitHub before publishing again to also include the validation workflow.`;
    const pr = await createGitHubPullRequest(connected.github_access_token, repositoryFullName, `Add TestMind QA suite (${tests.length} cases)`, prDescription, branch, base);
    res.json({ success: true, pullRequestUrl: pr.html_url, pullRequestNumber: pr.number, branch, logs: [
      `Verified push access to ${repositoryFullName}.`,
      `Created branch ${branch} from ${base}.`,
      `Published ${tests.length} real test cases.`,
      'Published Playwright, Cypress, and Selenium automation suites with editable locator keys.',
      workflowPublished
        ? 'Published documentation and GitHub Actions validation workflow.'
        : 'Published documentation. GitHub Actions workflow was skipped until GitHub is re-authorized with workflow access.',
      `Opened pull request #${pr.number}.`
    ], workflowPublished });
  } catch (error: any) {
    console.error('Publish to GitHub error:', error?.response?.data || error);
    res.status(error?.response?.status || 500).json({ error: error?.response?.data?.message || 'Failed to publish project to GitHub' });
  }
}

export async function disconnectGitHub(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });
    const connected = await connectedGitHub(req.userId);
    if (connected?.github_access_token) {
      try { await revokeGitHubGrant(connected.github_access_token); } catch (error) { console.warn('GitHub grant revocation failed:', error); }
    }
    await pool.query('UPDATE users SET github_access_token = NULL, github_username = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [req.userId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Disconnect GitHub error:', error);
    res.status(500).json({ error: 'Failed to disconnect GitHub' });
  }
}

export async function parseTelemetry(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { telemetry, timestamp } = req.body;
    if (!telemetry || typeof telemetry !== 'string') {
      return res.status(400).json({ error: 'Telemetry text is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
    }

    const prompt = `You are a senior QA telemetry analyst. Analyze the raw browser console, stack trace, network log, or application telemetry below.

Recording timestamp: ${timestamp || 'unknown'}

RAW TELEMETRY:
${telemetry.slice(0, 30000)}

Return ONLY one JSON object with this shape:
{
  "event": "short plain-language event name",
  "type": "specific error or telemetry category",
  "description": "clear explanation of what happened, likely affected area, and the most useful next diagnostic step",
  "status": "info|warning|critical"
}

Rules:
- Base the result only on the supplied telemetry.
- Use critical for crashes, unhandled exceptions, data loss, authentication failures, or server 5xx errors.
- Use warning for recoverable failures, layout problems, slow requests, or suspicious behavior.
- Use info for normal diagnostic events.
- Do not invent filenames, line numbers, requests, or causes not present in the telemetry.`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-3.6-flash'}:generateContent`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          maxOutputTokens: 1200,
        },
      },
      {
        headers: { 'Content-Type': 'application/json' },
        params: { key: apiKey },
        timeout: 45000,
      }
    );

    const raw = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) throw new Error('Gemini returned an empty telemetry analysis');

    const parsed = JSON.parse(raw);
    const allowedStatuses = new Set(['info', 'warning', 'critical']);
    res.json({
      event: String(parsed.event || 'Telemetry analysis'),
      type: String(parsed.type || 'Diagnostic event'),
      description: String(parsed.description || 'Gemini analyzed the supplied telemetry.'),
      status: allowedStatuses.has(parsed.status) ? parsed.status : 'warning',
    });
  } catch (error: any) {
    const message = error?.response?.data?.error?.message || error?.message || 'Failed to parse telemetry';
    console.error('Gemini telemetry parser error:', message);
    res.status(500).json({ error: message });
  }
}

export async function githubOAuthCallback(req: Request, res: Response) {
  const { code, state } = req.query;
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (!code || typeof code !== 'string' || !state || typeof state !== 'string' || !clientId || !clientSecret) {
    return res.redirect(`${frontendUrl}?github_error=missing_params`);
  }

  const statePayload = verifyToken(state);
  if (!statePayload) {
    return res.redirect(`${frontendUrl}?github_error=invalid_state`);
  }

  try {
    // Exchange code for access token
    const tokenRes = await axios.post(
      'https://github.com/login/oauth/access_token',
      { client_id: clientId, client_secret: clientSecret, code, redirect_uri: process.env.GITHUB_REDIRECT_URI },
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
    await pool.query(
      'UPDATE users SET github_access_token = $1, github_username = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [accessToken, githubUsername, statePayload.userId]
    );

    res.redirect(`${frontendUrl}?github_connected=true&github_user=${githubUsername}`);
  } catch (error) {
    console.error('GitHub OAuth callback error:', error);
    res.redirect(`${frontendUrl}?github_error=oauth_failed`);
  }
}
