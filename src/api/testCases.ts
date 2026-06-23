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

export async function generateScriptAPI(testCase: object, language: string, token: string): Promise<string> {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/test-cases/generate-script`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ testCase, language }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Script generation failed');
  return data.script;
}
