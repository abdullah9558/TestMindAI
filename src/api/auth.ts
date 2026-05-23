import { apiCall } from './client';

export async function getGitHubAuthUrl() {
  const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
  const redirectUri = `${window.location.origin}/auth/callback`;
  return `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=repo,read:user`;
}

export async function getCurrentUser() {
  return apiCall('/auth/me');
}

export async function logout() {
  localStorage.removeItem('token');
  window.location.href = '/';
}
