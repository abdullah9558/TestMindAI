import axios from 'axios';

interface GitHubUser {
  id: number;
  login: string;
  name: string;
  avatar_url: string;
  email?: string;
}

interface GitHubRepository {
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
  description: string
): Promise<GitHubRepository> {
  try {
    const response = await axios.post(
      'https://api.github.com/user/repos',
      {
        name: repoName,
        description,
        private: false,
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
