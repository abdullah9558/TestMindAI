
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

function normalizeTestCaseTitle(title: string): string {
  const cleaned = (title || 'expected behavior works').trim().replace(/[.!]+$/, '');
  if (/^verify that\s+/i.test(cleaned)) {
    return `Verify that ${cleaned.replace(/^verify that\s+/i, '')}`;
  }
  const sentence = cleaned.replace(/^verify\s+/i, '');
  return `Verify that ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`;
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

RULES: Generate as many test cases as needed to cover every requirement and supported scenario. Never stop early. No duplicates. Every title must begin exactly with "Verify that". Use short, plain-language titles, preconditions, steps, and expected results that a non-technical tester can understand. Put one action in each step. No summaries. JSON only.`;

const VIDEO_SYSTEM_PROMPT = `You are a QA analyst converting a timestamped screen-recording observation log into executable test cases.

GROUNDING RULES:
- Treat the video observation log as the only source of product facts.
- Generate tests only for screens, controls, labels, values, actions, transitions, messages, and outcomes explicitly observed.
- Respect only the testing perspectives requested by the user.
- Do not add authentication, APIs, databases, security attacks, forms, navigation, performance, accessibility, or other features unless directly visible in the log.
- Each test case must include a source timestamp such as [Video evidence 00:12] in its preconditions or first step.
- Use exact visible UI labels and concrete actions rather than generic phrases.
- Negative and edge tests are allowed only when they are a direct variation of an observed interaction; label them as inferred.
- If the observation log lacks enough evidence, generate fewer cases. Never fill the requested count with invented coverage.
- Cover every distinct screen, action, state change, message, outcome, and directly supported alternate or failure scenario in the observation log.
- Every title must be one short, plain-language sentence beginning exactly with "Verify that".
- Keep preconditions, steps, and expected results short, concrete, and understandable to a non-technical tester.
- Each step must describe one action only. Avoid jargon and implementation details.

Return ONLY a raw JSON array. Each item must contain title, preconditions, steps, expectedResult, severity, priority, testType, module, platform, and tags.`;

export async function runTestCaseAgent(input: TestCaseGenerationInput): Promise<GeneratedTestCase[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const groq = new Groq({ apiKey });

  const countInstruction = input.testCount === 'Auto'
    ? 'Generate 50-100 test cases — cover every aspect thoroughly.'
    : typeof input.testCount === 'number'
    ? `Generate at least ${input.testCount} test cases, and generate more whenever needed to cover every supported scenario.`
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

  const evidenceRules = input.videoAnalysis
    ? '\n\nVIDEO EVIDENCE RULES: Generate cases from the timestamped observations above. Use exact visible labels, actions, values, and outcomes. Include the relevant timestamp in each video-derived case tags or steps. Do not invent screens or capabilities not observed in the recording; clearly label inferred negative or edge tests.'
    : '';
  const userMessage = JSON.stringify(metadata, null, 2) + evidenceRules;
  const systemPrompt = input.videoAnalysis ? VIDEO_SYSTEM_PROMPT : SYSTEM_PROMPT;
  const estimatedInputTokens = Math.ceil((systemPrompt.length + userMessage.length) / 4);
  if (estimatedInputTokens > 6000) {
    throw new Error('Input is too large for the Groq 8,000 TPM tier; routing to Gemini.');
  }
  const safeOutputTokens = Math.max(1200, Math.min(6000, 7600 - estimatedInputTokens));

  // One bounded Groq attempt. Invalid output falls back to Gemini rather than
  // growing the conversation beyond the on-demand TPM limit.
  let attempts = 0;
  let messages: Groq.Chat.ChatCompletionMessageParam[] = [
    { role: 'user', content: userMessage }
  ];

  while (attempts < 1) {
    attempts++;
    console.log(`[Agent] Attempt ${attempts}...`);

    const response = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 0.3,
      max_tokens: safeOutputTokens,
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
        title: normalizeTestCaseTitle(tc.title),
        platform: tc.platform || input.platform || 'Web',
      }));

      if (input.videoAnalysis) {
        const ungrounded = normalized.filter(testCase =>
          !/\b\d{1,2}:\d{2}\b/.test(JSON.stringify(testCase))
        );
        if (ungrounded.length > 0) {
          throw new Error(`${ungrounded.length} generated cases lacked video timestamp evidence`);
        }
      }

      console.log(`[Agent] Generated ${normalized.length} test cases`);
      return normalized;

    } catch (parseErr) {
      console.warn(`[Agent] Parse failed attempt ${attempts}:`, parseErr);
      
      if (attempts < 1) {
        // Self-correction prompt
        messages.push({
          role: 'user',
          content: `Your response could not be parsed as a JSON array. Fix it. Output ONLY the raw JSON array starting with [ and ending with ]. No text before or after.`
        });
      }
    }
  }

  throw new Error('Groq did not produce valid JSON within its safe token budget');
}

