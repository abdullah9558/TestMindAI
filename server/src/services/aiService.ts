import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { runTestCaseAgent } from './agentService.js';

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
  // Prefer Groq agent
  if (process.env.GROQ_API_KEY) {
    try {
      return await runTestCaseAgent(input);
    } catch (err) {
      console.error('[Groq Agent] Failed, falling back to Gemini:', err);
    }
  }

  // Fallback: Gemini
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('No GROQ_API_KEY or GEMINI_API_KEY set');
    return generateGenericFallback(input);
  }

  const countInstruction = input.testCount === 'Auto'
    ? 'Generate 50-100 test cases covering every aspect.'
    : typeof input.testCount === 'number'
    ? `Generate exactly ${input.testCount} distinct test cases.`
    : 'Generate 50-80 comprehensive test cases.';

  const prompt = `You are a principal QA architect. Generate an EXHAUSTIVE test suite.

USER STORY:
${input.appDescription}

Platform: ${input.platform || 'Web'}
Perspectives: ${input.perspectives.join(', ')}
${input.videoAnalysis ? `\nScreen Recording Observations:\n${input.videoAnalysis}` : ''}

${countInstruction}

Cover: Functional, UI/UX, Validation, Security (XSS/SQLi/auth bypass), Performance, Edge Cases, Integration, Accessibility.

Return ONLY raw JSON array. No markdown. No explanation.

Schema:
{
  "title": "specific title",
  "preconditions": "exact setup",
  "steps": ["step with specific data"],
  "expectedResult": "verifiable outcome",
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "priority": "P3|P2|P1|P0",
  "testType": "Functional|UI/UX|Validation|Security|Performance|Edge Case|Integration|Accessibility",
  "module": "feature module from user story",
  "platform": "${input.platform || 'Web'}",
  "tags": ["tag"]
}`;

  try {
    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 16384 },
      },
      {
        headers: { 'Content-Type': 'application/json' },
        params: { key: apiKey },
        timeout: 60000,
      }
    );

    const responseText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log('Gemini finish reason:', response.data?.candidates?.[0]?.finishReason);
    console.log('Gemini response length:', responseText?.length);
    if (!responseText) throw new Error('Empty Gemini response');

    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array in response');

    let testCases: GeneratedTestCase[] = JSON.parse(jsonMatch[0]);
    testCases = testCases.map(tc => ({ ...tc, platform: tc.platform || input.platform || 'Web' }));

    if (typeof input.testCount === 'number') testCases = testCases.slice(0, input.testCount);
    return testCases;

  } catch (error: any) {
    console.error('Gemini error:', error?.response?.data || error?.message);
    return generateGenericFallback(input);
  }
}

export async function analyzeVideoWithAI(videoPath: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return '';

  try {
    const absolutePath = path.resolve(videoPath);
    if (!fs.existsSync(absolutePath)) return '';

    const videoBuffer = fs.readFileSync(absolutePath);
    const base64Video = videoBuffer.toString('base64');
    const ext = path.extname(videoPath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.mp4': 'video/mp4', '.webm': 'video/webm',
      '.mov': 'video/quicktime', '.avi': 'video/x-msvideo',
    };
    const mimeType = mimeMap[ext] || 'video/mp4';

    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: base64Video } },
            { text: `Analyze this screen recording. Extract: all UI screens/flows, user interactions, features demonstrated, any errors or bugs, edge cases visible. Be specific — output feeds test case generation.` },
          ],
        }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
      },
      { headers: { 'Content-Type': 'application/json' }, params: { key: apiKey }, timeout: 120000 }
    );

    return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (error: any) {
    console.error('Video analysis error:', error?.message);
    return '';
  }
}

function generateGenericFallback(input: TestCaseGenerationInput): GeneratedTestCase[] {
  const platform = input.platform || 'Web';
  return [
    {
      title: 'Verify core functionality loads correctly',
      preconditions: 'User has access to the application',
      steps: ['Open the application', 'Navigate to the main feature', 'Interact with primary controls'],
      expectedResult: 'Core feature functions as specified',
      severity: 'CRITICAL', priority: 'P0', testType: 'Functional',
      module: 'Core', platform, tags: ['smoke', 'critical'],
    },
    {
      title: 'Verify input validation rejects invalid data',
      preconditions: 'Application loaded, input form visible',
      steps: ['Enter invalid/empty data', 'Submit the form', 'Observe error feedback'],
      expectedResult: 'Validation errors displayed, submission blocked',
      severity: 'HIGH', priority: 'P1', testType: 'Validation',
      module: 'Input Handling', platform, tags: ['validation'],
    },
    {
      title: 'Verify authentication flow',
      preconditions: 'User has valid credentials',
      steps: ['Navigate to login', 'Enter credentials', 'Submit'],
      expectedResult: 'User authenticated and redirected',
      severity: 'CRITICAL', priority: 'P0', testType: 'Security',
      module: 'Authentication', platform, tags: ['auth'],
    },
  ];
}
