import { API_BASE, apiCall } from './client';

export async function uploadVideo(projectId: string, file: File) {
  const formData = new FormData();
  formData.append('video', file);

  const token = localStorage.getItem('token');
  const headers: HeadersInit = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(
    `${API_BASE}/integrations/${projectId}/upload-video`,
    {
      method: 'POST',
      headers,
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error('Failed to upload video');
  }

  return response.json();
}

export async function getGitHubRepos(): Promise<Array<{ full_name?: string; name?: string }>> {
  return apiCall('/integrations/github/repos');
}

export interface GitHubStatus {
  connected: boolean;
  user?: { login: string; name: string; avatarUrl: string };
}

export async function getGitHubStatus(): Promise<GitHubStatus> {
  return apiCall('/integrations/github/status');
}

export async function createGitHubRepository(data: { projectId: string; name: string; description?: string; private?: boolean }): Promise<{ full_name: string; name: string }> {
  return apiCall('/integrations/github/repos', { method: 'POST', body: JSON.stringify(data) });
}

export async function publishProjectToGitHub(data: { projectId: string; repositoryFullName: string }): Promise<{ success: boolean; pullRequestUrl: string; pullRequestNumber: number; branch: string; logs: string[]; workflowPublished: boolean }> {
  return apiCall('/integrations/github/publish', { method: 'POST', body: JSON.stringify(data) });
}

export async function disconnectGitHub() {
  return apiCall('/integrations/github/connection', { method: 'DELETE' });
}

export async function pushBugToGitHub(data: { bugId: string; repoName: string }) {
  return apiCall('/integrations/github/push-bug', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function parseTelemetry(data: { telemetry: string; timestamp: string }) {
  return apiCall('/integrations/parse-telemetry', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
