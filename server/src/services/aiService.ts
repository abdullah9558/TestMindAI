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

  const prompt = `You are a principal QA architect with 15+ years experience. Your job is to produce an EXHAUSTIVE test suite from the user story or app description below. Leave no stone unturned.

USER STORY / APP DESCRIPTION:
${input.appDescription}

Platform: ${input.platform || 'Not specified'}
Test Perspectives Requested: ${input.perspectives.join(', ')}
${input.videoAnalysis ? `\nObserved Behavior from Recording:\n${input.videoAnalysis}` : ''}

${countInstruction}

MANDATORY COVERAGE CHECKLIST — you MUST generate test cases for EVERY applicable category:

1. FUNCTIONAL
   - Happy path (all valid inputs, expected flows)
   - Each acceptance criterion in the user story verified independently
   - All buttons, links, actions explicitly mentioned
   - CRUD operations if applicable

2. UI / UX
   - Layout correctness, element visibility and alignment
   - Responsive design (mobile, tablet, desktop)
   - Loading states, spinners, skeleton screens
   - Empty states (no data, first-time user)
   - Success/error messages and toasts
   - Placeholder text, labels, tooltips
   - Disabled states and readonly fields
   - Accessibility: keyboard navigation, screen reader, ARIA labels, color contrast

3. VALIDATION & INPUT HANDLING
   - Required fields left empty
   - Min/max length boundaries (exactly at limit, one below, one above)
   - Invalid format inputs (wrong email, special chars, SQL/script injection strings)
   - Whitespace-only inputs
   - Very long strings (1000+ chars)
   - Copy-paste behavior
   - Numeric fields: negative numbers, zero, decimals, letters

4. SECURITY
   - SQL injection attempts in all input fields
   - XSS (script tags in inputs)
   - CSRF protection
   - Unauthorized access (access protected routes without auth)
   - Privilege escalation (normal user accessing admin features)
   - Sensitive data not exposed in URL or console
   - Session expiry behavior
   - Brute force / rate limiting on auth endpoints

5. PERFORMANCE
   - Page/feature load time under normal conditions
   - Load time with slow network (3G simulation)
   - Large dataset rendering (1000+ records)
   - Concurrent users / simultaneous requests
   - Memory leaks on repeated actions
   - API response time within acceptable threshold

6. EDGE CASES
   - First time user (no existing data)
   - Last item deleted (empty state)
   - Simultaneous edits from two sessions
   - Action performed during page load/transition
   - Network drop mid-operation
   - Browser back button after form submit
   - Rapid repeated clicks on submit button
   - Timeout handling

7. INTEGRATION
   - API request/response correctness
   - Correct HTTP status codes returned
   - Error from downstream service handled gracefully
   - Data persists correctly after refresh
   - Cross-feature dependencies work together

8. REGRESSION
   - Existing related features not broken by this change
   - Navigation flows still intact

RULES:
- Every test must be SPECIFIC to the user story above — no generic boilerplate
- Steps must be concrete and executable by a human tester
- Module names must reflect actual features from the description
- Do not repeat the same test with minor wording changes
- Skip categories that genuinely don't apply (e.g. no auth tests if story has no auth)

Return ONLY a valid JSON array. No markdown. No explanation. No code fences.

Each object must follow this schema exactly:
{
  "title": "Specific, descriptive test case title",
  "preconditions": "Exact system state and data setup required",
  "steps": ["Step 1 with specific data", "Step 2", "..."],
  "expectedResult": "Concrete, verifiable, specific outcome",
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "priority": "P3|P2|P1|P0",
  "testType": "Functional|Integration|Security|Performance|UI/UX|Edge Case|Regression|Stress|Validation|Accessibility",
  "module": "Specific feature module name from the user story",
  "platform": "${input.platform || 'Cross-platform'}",
  "tags": ["tag1", "tag2"]
}`;

  try {
    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent',
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 16384,
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
