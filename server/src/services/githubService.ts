import axios from 'axios';

export interface GitHubUser {
  id: number;
  login: string;
  name: string;
  avatar_url: string;
  email?: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description?: string;
  private: boolean;
}

export async function getGitHubAccessToken(code: string): Promise<string> {
  try {
    const response = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GITHUB_REDIRECT_URI,
      },
      {
        headers: { Accept: 'application/json' },
      }
    );

    if (response.data.error) {
      throw new Error(response.data.error_description);
    }

    return response.data.access_token;
  } catch (error) {
    console.error('Error getting GitHub access token:', error);
    throw error;
  }
}

export async function getGitHubUser(accessToken: string): Promise<GitHubUser> {
  try {
    const response = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `token ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    return response.data;
  } catch (error) {
    console.error('Error getting GitHub user:', error);
    throw error;
  }
}

export async function getGitHubUserRepositories(accessToken: string): Promise<GitHubRepository[]> {
  try {
    const response = await axios.get('https://api.github.com/user/repos', {
      headers: {
        Authorization: `token ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
      params: {
        per_page: 100,
        sort: 'updated',
        direction: 'desc',
      },
    });

    return response.data;
  } catch (error) {
    console.error('Error getting GitHub repositories:', error);
    throw error;
  }
}

export async function createGitHubRepository(
  accessToken: string,
  repoName: string,
  description: string,
  isPrivate = false
): Promise<GitHubRepository> {
  try {
    const response = await axios.post(
      'https://api.github.com/user/repos',
      {
        name: repoName,
        description,
        private: isPrivate,
        auto_init: true,
      },
      {
        headers: {
          Authorization: `token ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error creating GitHub repository:', error);
    throw error;
  }
}

export async function createGitHubIssue(
  accessToken: string,
  owner: string,
  repo: string,
  title: string,
  body: string
): Promise<any> {
  try {
    const response = await axios.post(
      `https://api.github.com/repos/${owner}/${repo}/issues`,
      {
        title,
        body,
        labels: ['bug', 'testmind-ai'],
      },
      {
        headers: {
          Authorization: `token ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error creating GitHub issue:', error);
    throw error;
  }
}

const githubHeaders = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
});

export async function getGitHubRepository(accessToken: string, fullName: string) {
  const response = await axios.get(`https://api.github.com/repos/${fullName}`, {
    headers: githubHeaders(accessToken),
  });
  return response.data;
}

export async function createGitHubBranch(
  accessToken: string,
  fullName: string,
  branchName: string,
  fromBranch: string
) {
  const source = await axios.get(
    `https://api.github.com/repos/${fullName}/git/ref/heads/${encodeURIComponent(fromBranch)}`,
    { headers: githubHeaders(accessToken) }
  );
  await axios.post(
    `https://api.github.com/repos/${fullName}/git/refs`,
    { ref: `refs/heads/${branchName}`, sha: source.data.object.sha },
    { headers: githubHeaders(accessToken) }
  );
}

export async function putGitHubFile(
  accessToken: string,
  fullName: string,
  branch: string,
  filePath: string,
  content: string,
  message: string
) {
  const response = await axios.put(
    `https://api.github.com/repos/${fullName}/contents/${filePath.split('/').map(encodeURIComponent).join('/')}`,
    {
      message,
      branch,
      content: Buffer.from(content, 'utf8').toString('base64'),
    },
    { headers: githubHeaders(accessToken) }
  );
  return response.data;
}

export async function createGitHubPullRequest(
  accessToken: string,
  fullName: string,
  title: string,
  body: string,
  head: string,
  base: string
) {
  const response = await axios.post(
    `https://api.github.com/repos/${fullName}/pulls`,
    { title, body, head, base },
    { headers: githubHeaders(accessToken) }
  );
  return response.data;
}

export async function revokeGitHubGrant(accessToken: string) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return;

  await axios.delete(`https://api.github.com/applications/${clientId}/grant`, {
    auth: { username: clientId, password: clientSecret },
    data: { access_token: accessToken },
    headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
  });
}
