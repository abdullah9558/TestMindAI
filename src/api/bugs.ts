import { apiCall } from './client';

export async function getBugReports(projectId: string) {
  return apiCall(`/bugs/${projectId}`);
}

export async function createBugReport(data: {
  projectId: string;
  testCaseId?: string;
  title: string;
  description?: string;
  steps?: string[];
  expectedResult?: string;
  actualResult?: string;
  severity: string;
  priority: string;
}) {
  return apiCall('/bugs', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateBugReportStatus(
  bugId: string,
  data: { status: string; rcaText?: string; suggestedFix?: string }
) {
  return apiCall(`/bugs/${bugId}/status`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
