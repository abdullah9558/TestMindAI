
function mapSeverity(s: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  const v = (s || '').toLowerCase();
  if (v === 'critical') return 'CRITICAL';
  if (v === 'major' || v === 'high') return 'HIGH';
  if (v === 'minor' || v === 'low') return 'LOW';
  return 'MEDIUM';
}

function mapPriority(p: string): 'P0' | 'P1' | 'P2' | 'P3' {
  const v = (p || '').toLowerCase();
  if (v === 'high' || v === 'p0') return 'P0';
  if (v === 'p1') return 'P1';
  if (v === 'low' || v === 'p3') return 'P3';
  return 'P2';
}

function extractModule(title: string): string {
  const parts = title.split(/[-–:]/);
  return parts.length > 1 ? parts[0].trim() : 'General';
}

import Groq from 'groq-sdk';

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

const SYSTEM_PROMPT = `You are TestMind AI, an Enterprise QA Architect and Multi-Agent Testing System.

Internally behave as a team of specialized QA experts: Business Analyst, QA Architect, Manual Tester, Automation Engineer, API Tester, Security Tester, Performance Engineer, Database Tester, Accessibility Specialist, UI/UX Tester.

STEP 1 - REQUIREMENT ANALYSIS: Extract all functional requirements, user roles, permissions, business rules, input/output fields, workflows, state transitions, dependencies, API interactions, DB operations, security requirements, performance requirements, validation rules, error conditions, edge cases, and implied requirements.

STEP 2 - TEST DESIGN: Generate exhaustive test cases covering:
- Functional: happy paths, alternate paths, negative scenarios, business rules, CRUD, RBAC
- Validation: required/optional fields, data types, length, format, BVA, equivalence partitioning
- API: request/response validation, auth, headers, query params, pagination, sorting, filtering, rate limiting, all HTTP status codes (200/201/204/400/401/403/404/405/409/422/429/500/502/503/504)
- Security: auth, authorization, session management, JWT, token expiry, privilege escalation, broken access control, IDOR, SQLi, NoSQLi, XSS, CSRF, file upload, sensitive data exposure
- UI: layout, alignment, responsiveness, navigation, error messages, form validation, browser/mobile compatibility
- Database: data persistence, integrity, duplicates, update/delete, transactions, audit logging
- Performance: load, stress, spike, volume, concurrency
- Accessibility: keyboard nav, screen reader, focus management, color contrast, WCAG
- Edge Cases: duplicate actions, session expiry, network interruptions, concurrent updates, race conditions

STEP 3 - COVERAGE AUDIT: Re-read the requirement. Find missing scenarios, rules, validations, security gaps, API gaps, accessibility gaps. Generate additional test cases for anything missed.

OUTPUT: Return ONLY valid JSON in this exact format:
{
  "coverageSummary": {
    "requirementsIdentified": <number>,
    "businessRulesIdentified": <number>,
    "testCasesGenerated": <number>,
    "coverageAssessment": "High | Medium | Low"
  },
  "testCases": [
    {
      "id": "TC-001",
      "title": "",
      "category": "",
      "priority": "High | Medium | Low",
      "severity": "Critical | Major | Minor",
      "preconditions": [],
      "testData": [],
      "steps": [],
      "expectedResult": ""
    }
  ],
  "coverageGaps": [],
  "assumptions": []
}

RULES: Generate as many test cases as needed. Never stop early. No duplicates. No summaries. JSON only.`;

export async function runTestCaseAgent(input: TestCaseGenerationInput): Promise<GeneratedTestCase[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const groq = new Groq({ apiKey });

  const countInstruction = input.testCount === 'Auto'
    ? 'Generate 50-100 test cases — cover every aspect thoroughly.'
    : typeof input.testCount === 'number'
    ? `Generate exactly ${input.testCount} test cases. Pick the highest value ones.`
    : 'Generate 50-80 test cases.';

  const metadata = {
    projectType: input.platform === 'Mobile' ? 'Mobile Application' : 'Web Application',
    requirementType: 'User Story',
    applicationDomain: 'SaaS',
    testDepth: 'Exhaustive',
    platform: input.platform || 'Web',
    perspectives: input.perspectives,
    includeApiTests: true,
    includeSecurityTests: true,
    includePerformanceTests: true,
    includeAccessibilityTests: true,
    targetTestCount: input.testCount,
    videoAnalysis: input.videoAnalysis || null,
    requirement: input.appDescription,
  };

  const userMessage = JSON.stringify(metadata, null, 2);

  // Agent loop — up to 3 attempts with self-correction
  let attempts = 0;
  let messages: Groq.Chat.ChatCompletionMessageParam[] = [
    { role: 'user', content: userMessage }
  ];

  while (attempts < 3) {
    attempts++;
    console.log(`[Agent] Attempt ${attempts}...`);

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages
      ],
      temperature: 0.3,
      max_tokens: 8000,
    });

    const raw = response.choices[0]?.message?.content || '';
    console.log(`[Agent] Response length: ${raw.length}, finish: ${response.choices[0]?.finish_reason}`);

    messages.push({ role: 'assistant', content: raw });

    // Try parse
    try {
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON array found');
      
      const parsed: GeneratedTestCase[] = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Empty array');

      // Normalize
      const normalized = parsed.map(tc => ({
        ...tc,
        platform: tc.platform || input.platform || 'Web',
      }));

      console.log(`[Agent] Generated ${normalized.length} test cases`);
      return typeof input.testCount === 'number'
        ? normalized.slice(0, input.testCount)
        : normalized;

    } catch (parseErr) {
      console.warn(`[Agent] Parse failed attempt ${attempts}:`, parseErr);
      
      if (attempts < 3) {
        // Self-correction prompt
        messages.push({
          role: 'user',
          content: `Your response could not be parsed as a JSON array. Fix it. Output ONLY the raw JSON array starting with [ and ending with ]. No text before or after.`
        });
      }
    }
  }

  throw new Error('Agent failed to produce valid JSON after 3 attempts');
}

export async function generateTestScript(
  testCase: {
    title: string;
    preconditions: string;
    steps: string[];
    expectedResult: string;
    module: string;
    tags?: string[];
  },
  language: 'Playwright' | 'Cypress' | 'Selenium'
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const groq = new Groq({ apiKey });

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: `You are a senior test automation engineer. Generate a complete, runnable ${language} test script. Use realistic selectors based on context. Output ONLY the code, no explanation, no markdown fences.`
      },
      {
        role: 'user',
        content: `Generate a ${language} test script for this test case:

Title: ${testCase.title}
Module: ${testCase.module}
Preconditions: ${testCase.preconditions}
Steps:
${testCase.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}
Expected Result: ${testCase.expectedResult}

Write complete, working ${language} code with realistic selectors inferred from the steps.`
      }
    ],
    temperature: 0.2,
    max_tokens: 2000,
  });

  return response.choices[0]?.message?.content || '';
}
