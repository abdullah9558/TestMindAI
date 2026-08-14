import { apiCall, setToken } from './client';

export async function getGitHubAuthUrl() {
  const response = await apiCall('/integrations/github/auth');
  return response.url as string;
}

export async function getCurrentUser() {
  return apiCall('/auth/me');
}

export async function updateCurrentUser(data: {
  name: string; jobTitle: string; organization: string; timezone: string;
  defaultPlatform: string; defaultTestCount: string; defaultPerspectives: string[];
}) {
  return apiCall('/auth/me', { method: 'PUT', body: JSON.stringify(data) });
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
