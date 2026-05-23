import { apiCall } from './client';

export async function createProject(data: {
  name: string;
  description?: string;
  appDescription?: string;
  platformType?: string;
}) {
  return apiCall('/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getProjects() {
  return apiCall('/projects');
}

export async function getProjectById(projectId: string) {
  return apiCall(`/projects/${projectId}`);
}

export async function updateProject(
  projectId: string,
  data: {
    name?: string;
    description?: string;
    appDescription?: string;
    platformType?: string;
  }
) {
  return apiCall(`/projects/${projectId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteProject(projectId: string) {
  return apiCall(`/projects/${projectId}`, {
    method: 'DELETE',
  });
}
