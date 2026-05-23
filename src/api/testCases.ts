import { apiCall, API_BASE } from './client';

export async function generateTestCases(data: {
  projectId: string;
  appDescription: string;
  perspectives?: string[];
  videoId?: string;
}) {
  return apiCall('/test-cases/generate', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getTestCases(projectId: string) {
  return apiCall(`/test-cases/${projectId}`);
}

export async function updateTestCaseStatus(
  testCaseId: string,
  data: { status: string; actualResult?: string }
) {
  return apiCall(`/test-cases/${testCaseId}/status`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
