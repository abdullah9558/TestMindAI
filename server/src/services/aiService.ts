import axios from 'axios';

interface TestCaseGenerationInput {
  appDescription: string;
  perspectives: string[];
  videoAnalysis?: string;
}

interface GeneratedTestCase {
  title: string;
  preconditions: string;
  steps: string[];
  expectedResult: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  priority: 'P3' | 'P2' | 'P1' | 'P0';
  testType: string;
  module: string;
  tags: string[];
}

export async function generateTestCasesWithAI(input: TestCaseGenerationInput): Promise<GeneratedTestCase[]> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.warn('GEMINI_API_KEY not set, returning mock test cases');
      return generateMockTestCases(input);
    }

    const prompt = `You are a QA expert. Generate comprehensive test cases for the following application:

Application Description: ${input.appDescription}

Generate test cases focusing on: ${input.perspectives.join(', ')}

${input.videoAnalysis ? `Video Analysis Notes: ${input.videoAnalysis}` : ''}

Generate EXACTLY 5 test cases. For each test case, provide a JSON object with this structure:
{
  "title": "Test case title",
  "preconditions": "What needs to be set up before this test",
  "steps": ["Step 1", "Step 2", "Step 3"],
  "expectedResult": "What should happen",
  "severity": "HIGH",
  "priority": "P1",
  "testType": "Functional",
  "module": "Module name",
  "tags": ["tag1", "tag2"]
}

Return ONLY a JSON array with 5 test cases, no other text.`;

    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
      {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        params: {
          key: apiKey,
        },
      }
    );

    const responseText = response.data.candidates[0].content.parts[0].text;
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
      console.warn('Failed to parse AI response, using mock data');
      return generateMockTestCases(input);
    }

    const testCases: GeneratedTestCase[] = JSON.parse(jsonMatch[0]);
    return testCases;
  } catch (error) {
    console.error('Error generating test cases with AI:', error);
    // Return mock data on error
    return generateMockTestCases(input);
  }
}

function generateMockTestCases(input: TestCaseGenerationInput): GeneratedTestCase[] {
  return [
    {
      title: `Verify core functionality of ${input.appDescription.substring(0, 30)}...`,
      preconditions: 'User is authenticated and system is ready',
      steps: ['Open the application', 'Navigate to main feature', 'Verify functionality'],
      expectedResult: 'Feature works as expected',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Functional',
      module: 'Core',
      tags: ['functional', 'smoke'],
    },
    {
      title: 'Test UI/UX responsiveness on different screen sizes',
      preconditions: 'Application is loaded',
      steps: ['Resize browser window', 'Verify layout adjusts', 'Check element visibility'],
      expectedResult: 'UI is responsive and elements are visible',
      severity: 'MEDIUM',
      priority: 'P2',
      testType: 'UI/UX',
      module: 'Frontend',
      tags: ['responsive', 'ui'],
    },
    {
      title: 'Validate edge cases and error handling',
      preconditions: 'System is initialized',
      steps: ['Input invalid data', 'Submit form', 'Observe error handling'],
      expectedResult: 'System gracefully handles invalid input',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Edge Case',
      module: 'Validation',
      tags: ['edge-case', 'security'],
    },
    {
      title: 'Test API performance under load',
      preconditions: 'API endpoints are accessible',
      steps: ['Send multiple requests', 'Monitor response time', 'Verify accuracy'],
      expectedResult: 'API responds within acceptable time',
      severity: 'MEDIUM',
      priority: 'P2',
      testType: 'Performance',
      module: 'Backend',
      tags: ['performance', 'api'],
    },
    {
      title: 'Verify data persistence and consistency',
      preconditions: 'Database is connected',
      steps: ['Create data', 'Verify storage', 'Retrieve and compare'],
      expectedResult: 'Data is correctly persisted and retrieved',
      severity: 'CRITICAL',
      priority: 'P0',
      testType: 'Data Integrity',
      module: 'Database',
      tags: ['database', 'critical'],
    },
  ];
}

export async function analyzeVideoWithAI(videoPath: string): Promise<string> {
  try {
    // For now, return placeholder analysis
    // In production, you would send the video file to Gemini or use a video analysis service
    const analysis = `Video analysis placeholder. In production, this would contain:
- UI element detection and analysis
- User interaction patterns
- Potential test scenarios
- Edge cases identified
- Performance metrics`;

    return analysis;
  } catch (error) {
    console.error('Error analyzing video with AI:', error);
    throw error;
  }
}
