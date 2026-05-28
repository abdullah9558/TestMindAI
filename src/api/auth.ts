import { apiCall, setToken } from './client';

export async function getGitHubAuthUrl() {
  const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
  if (!clientId || clientId === 'your_github_client_id') {
    throw new Error('GitHub OAuth is not configured. Set VITE_GITHUB_CLIENT_ID in .env.local and GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET in server/.env.');
  }

  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const redirectUri = `${apiBase}/auth/github/callback`;
  return `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo,read:user`;
}

export async function getCurrentUser() {
  return apiCall('/auth/me');
}

export async function createDevSession() {
  const session = await apiCall('/auth/dev-session', {
    method: 'POST',
    skipAuth: true,
  });
  setToken(session.token);
  return session;
}

export async function logout() {
  localStorage.removeItem('token');
  window.location.href = '/';
}
