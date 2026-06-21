import axios from 'axios';
import fs from 'fs';
import path from 'path';

interface TestCaseGenerationInput {
  appDescription: string;
  perspectives: string[];
  platform?: string;
  testCount?: number | 'Auto';
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
  platform?: string;
  tags: string[];
}

export async function generateTestCasesWithAI(input: TestCaseGenerationInput): Promise<GeneratedTestCase[]> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.warn('GEMINI_API_KEY not set, using generic fallback');
    return generateGenericFallback(input);
  }

  const countInstruction = input.testCount === 'Auto'
    ? 'Generate as many high-value test cases as needed. Aim for 30-80 covering all key features and edge cases.'
    : typeof input.testCount === 'number'
    ? `Generate exactly ${input.testCount} distinct test cases.`
    : 'Generate 30-50 comprehensive test cases covering major features and edge cases.';

  const prompt = `You are a senior QA engineer. Generate comprehensive, specific test cases for the application described below.

Application Description:
${input.appDescription}

Platform: ${input.platform || 'Not specified'}
Test Perspectives: ${input.perspectives.join(', ')}
${input.videoAnalysis ? `\nObserved Behavior from Recording:\n${input.videoAnalysis}` : ''}

${countInstruction}

RULES:
1. Test cases MUST be based ONLY on what is described above. Do not invent features.
2. Extract specific features, flows, and modules from the description.
3. Generate tests for: happy paths, error handling, edge cases, validation, security, performance, and UI/UX as applicable.
4. Each test must be concrete and actionable — not generic boilerplate.
5. Module names must reflect actual features from the description (not generic names like "Core" or "Frontend").

Return ONLY a valid JSON array. No markdown. No explanation. No code fences.

Each object must follow this schema exactly:
{
  "title": "Specific test case title tied to a real feature",
  "preconditions": "Exact setup state required",
  "steps": ["Step 1", "Step 2", "..."],
  "expectedResult": "Concrete, verifiable outcome",
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "priority": "P3|P2|P1|P0",
  "testType": "Functional|Integration|Security|Performance|UI/UX|Edge Case|Regression|Stress|Validation",
  "module": "Specific feature module name from the app description",
  "platform": "${input.platform || 'Cross-platform'}",
  "tags": ["tag1", "tag2"]
}`;

  try {
    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent',
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 8192,
        },
      },
      {
        headers: { 'Content-Type': 'application/json' },
        params: { key: apiKey },
        timeout: 60000,
      }
    );

    const responseText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) throw new Error('Empty Gemini response');

    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array in response');

    let testCases: GeneratedTestCase[] = JSON.parse(jsonMatch[0]);

    // Normalize platform
    testCases = testCases.map(tc => ({
      ...tc,
      platform: tc.platform || input.platform || 'Cross-platform',
    }));

    // Trim to count if exact number requested
    if (typeof input.testCount === 'number') {
      testCases = testCases.slice(0, input.testCount);
    }

    return testCases;
  } catch (error: any) {
    console.error('Gemini API error:', error?.response?.data || error?.message);
    return generateGenericFallback(input);
  }
}

export async function analyzeVideoWithAI(videoPath: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return '';

  try {
    const absolutePath = path.resolve(videoPath);
    if (!fs.existsSync(absolutePath)) {
      console.warn('Video file not found:', absolutePath);
      return '';
    }

    const videoBuffer = fs.readFileSync(absolutePath);
    const base64Video = videoBuffer.toString('base64');
    const ext = path.extname(videoPath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
    };
    const mimeType = mimeMap[ext] || 'video/mp4';

    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent',
      {
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Video,
              },
            },
            {
              text: `Analyze this screen recording and extract:
1. All UI screens and flows visible
2. User interactions performed (clicks, inputs, navigation)
3. Features and functionality demonstrated
4. Any errors, bugs, or unexpected behavior observed
5. Edge cases or boundary conditions visible

Be specific and detailed. This analysis will be used to generate test cases.`,
            },
          ],
        }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
      },
      {
        headers: { 'Content-Type': 'application/json' },
        params: { key: apiKey },
        timeout: 120000,
      }
    );

    return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (error: any) {
    console.error('Video analysis error:', error?.response?.data || error?.message);
    return '';
  }
}

function generateGenericFallback(input: TestCaseGenerationInput): GeneratedTestCase[] {
  const platform = input.platform || 'Web';
  const perspectives = input.perspectives || ['Functional'];
  const desc = input.appDescription || 'Application';

  return [
    {
      title: `Verify core functionality loads correctly`,
      preconditions: `User has access to the application. ${desc.substring(0, 100)}`,
      steps: ['Open the application', 'Navigate to the main feature', 'Interact with primary controls', 'Observe output'],
      expectedResult: 'Core feature functions as specified in the requirements',
      severity: 'CRITICAL',
      priority: 'P0',
      testType: 'Functional',
      module: 'Core',
      platform,
      tags: ['smoke', 'critical'],
    },
    {
      title: 'Verify input validation rejects invalid data',
      preconditions: 'Application loaded, input form visible',
      steps: ['Enter invalid/empty data into required fields', 'Submit the form', 'Observe error feedback'],
      expectedResult: 'Validation errors displayed, form submission blocked',
      severity: 'HIGH',
      priority: 'P1',
      testType: 'Validation',
      module: 'Input Handling',
      platform,
      tags: ['validation', 'error-handling'],
    },
    {
      title: 'Verify authentication flow',
      preconditions: 'User has valid credentials',
      steps: ['Navigate to login', 'Enter credentials', 'Submit', 'Verify access granted'],
      expectedResult: 'User authenticated and redirected to authorized area',
      severity: 'CRITICAL',
      priority: 'P0',
      testType: 'Security',
      module: 'Authentication',
      platform,
      tags: ['auth', 'security'],
    },
  ];
}
