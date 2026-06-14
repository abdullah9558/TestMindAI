import { apiCall } from './client';

export async function uploadVideo(projectId: string, file: File) {
  const formData = new FormData();
  formData.append('video', file);

  const token = localStorage.getItem('token');
  const headers: HeadersInit = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(
    `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/integrations/${projectId}/upload-video`,
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

export async function getGitHubRepos() {
  return apiCall('/integrations/github/repos');
}

export async function pushBugToGitHub(data: { bugId: string; repoName: string }) {
  return apiCall('/integrations/github/push-bug', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
