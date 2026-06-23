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

const SYSTEM_PROMPT = `You are a principal QA architect agent. Your sole job is to generate exhaustive, specific, executable test cases from a user story.

You think step by step:
1. Parse the user story — extract every feature, flow, actor, and constraint
2. Identify all testable behaviors per feature
3. For each behavior, generate test cases across ALL applicable dimensions:
   - Functional (happy path, each acceptance criterion)
   - UI/UX (layout, states, responsive, empty states, loading)
   - Validation (required fields, boundary values, invalid formats, XSS/SQLi strings)
   - Security (auth bypass, privilege escalation, CSRF, sensitive data exposure)
   - Performance (load time, large data, concurrent requests)
   - Edge Cases (network drop, rapid clicks, empty state, back button, session expiry)
   - Integration (API correctness, data persistence, cross-feature)
   - Accessibility (keyboard nav, ARIA, contrast)
4. Output ONLY a raw JSON array — no markdown, no explanation, no code fences

Each test case object schema:
{
  "title": "specific title tied to real feature",
  "preconditions": "exact setup required",
  "steps": ["concrete step with specific data"],
  "expectedResult": "verifiable outcome",
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "priority": "P3|P2|P1|P0",
  "testType": "Functional|UI/UX|Validation|Security|Performance|Edge Case|Integration|Accessibility|Regression",
  "module": "exact feature module from user story",
  "platform": "platform",
  "tags": ["tag"]
}`;

export async function runTestCaseAgent(input: TestCaseGenerationInput): Promise<GeneratedTestCase[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const groq = new Groq({ apiKey });

  const countInstruction = input.testCount === 'Auto'
    ? 'Generate 50-100 test cases — cover every aspect thoroughly.'
    : typeof input.testCount === 'number'
    ? `Generate exactly ${input.testCount} test cases. Pick the highest value ones.`
    : 'Generate 50-80 test cases.';

  const userMessage = `USER STORY:
${input.appDescription}

Platform: ${input.platform || 'Web'}
Perspectives: ${input.perspectives.join(', ')}
${input.videoAnalysis ? `\nScreen Recording Observations:\n${input.videoAnalysis}` : ''}

${countInstruction}

Think through every feature, every flow, every edge case. Then output the JSON array.`;

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
