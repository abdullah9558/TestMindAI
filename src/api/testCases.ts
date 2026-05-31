import { apiCall } from './client';

export async function generateTestCases(data: {
  projectId: string;
  appDescription: string;
  perspectives?: string[];
  platform?: string;
  testCount?: number | 'Auto';
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

export async function createTestCase(data: {
  projectId: string;
  title: string;
  preconditions?: string;
  steps?: string[];
  expectedResult?: string;
  actualResult?: string;
  status?: string;
  severity?: string;
  priority?: string;
  testType?: string;
  platform?: string;
  module?: string;
  tags?: string[];
}) {
  return apiCall('/test-cases', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteTestCase(testCaseId: string) {
  return apiCall(`/test-cases/${testCaseId}`, {
    method: 'DELETE',
  });
}

export async function clearTestCases(projectId: string) {
  return apiCall(`/test-cases/project/${projectId}`, {
    method: 'DELETE',
  });
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
