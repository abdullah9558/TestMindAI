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
  forceGemini?: boolean;
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

function splitStoryIntoCoverageChunks(story: string, maxCharacters = 8000): string[] {
  const sections = story.split(/(?=^#{1,3}\s+)/gm).map(section => section.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  for (const section of sections) {
    if (section.length > maxCharacters) {
      if (current) { chunks.push(current); current = ''; }
      const paragraphs = section.split(/\n\s*\n/);
      let part = '';
      for (const paragraph of paragraphs) {
        if (part && part.length + paragraph.length + 2 > maxCharacters) { chunks.push(part); part = ''; }
        part += `${part ? '\n\n' : ''}${paragraph}`;
      }
      if (part) chunks.push(part);
      continue;
    }
    if (current && current.length + section.length + 2 > maxCharacters) { chunks.push(current); current = ''; }
    current += `${current ? '\n\n' : ''}${section}`;
  }
  if (current) chunks.push(current);
  return chunks;
}

function coverageTargetForChunk(chunk: string): number {
  const bullets = (chunk.match(/^\s*[*-]\s+/gm) || []).length;
  const criteria = (chunk.match(/^(?:Given|When|Then|And)\b/gim) || []).length;
  const requirementHeadings = (chunk.match(/^#{2,3}\s+(?:FR-|Acceptance Criterion|Business Rules|Performance|Network|Compatibility|Accessibility|Security|Edge Cases|Failure Handling|User Interface|Audio|Analytics|Definition of Done)/gim) || []).length;
  return Math.min(35, Math.max(10, Math.ceil((bullets + criteria + requirementHeadings * 2) * 0.8)));
}

function uniqueTestCases(testCases: GeneratedTestCase[]): GeneratedTestCase[] {
  return Array.from(new Map(
    testCases.map(testCase => [testCase.title.trim().toLowerCase(), testCase])
  ).values());
}

async function generateVideoCoverageSuite(input: TestCaseGenerationInput): Promise<GeneratedTestCase[]> {
  const perspectives = input.perspectives.length ? input.perspectives : ['Functional Flows', 'UI/UX Checklists', 'Edge Cases'];
  const requestedTotal = input.testCount === 'Auto'
    ? 60
    : typeof input.testCount === 'number'
    ? input.testCount
    : 50;
  // Recording coverage is intentionally broader than the general count selector.
  // Each selected test type receives its own pass so one category cannot consume
  // the model's output budget and crowd out the others.
  const minimumTotal = Math.max(requestedTotal, perspectives.length * 12);
  const casesPerPerspective = Math.max(12, Math.ceil(minimumTotal / perspectives.length));
  const generated: GeneratedTestCase[] = [];

  console.log(`[Video Coverage] Running ${perspectives.length} evidence-grounded passes, targeting ${casesPerPerspective}+ cases per selected test type.`);
  for (let index = 0; index < perspectives.length; index += 2) {
    const batch = perspectives.slice(index, index + 2);
    const results = await Promise.all(batch.map(perspective => generateTestCasesWithAI({
      ...input,
      perspectives: [perspective],
      testCount: casesPerPerspective,
      forceGemini: true,
    })));
    results.forEach(result => generated.push(...result));
  }

  const unique = uniqueTestCases(generated);
  console.log(`[Video Coverage] Merged ${generated.length} generated cases into ${unique.length} unique evidence-grounded cases.`);
  return unique;
}

export async function generateTestCasesWithAI(input: TestCaseGenerationInput): Promise<GeneratedTestCase[]> {
  if (input.videoAnalysis && !input.forceGemini) {
    return generateVideoCoverageSuite(input);
  }

  if (!input.forceGemini && !input.videoAnalysis && input.appDescription.length > 10000) {
    const chunks = splitStoryIntoCoverageChunks(input.appDescription);
    console.log(`[Coverage Engine] Split large story into ${chunks.length} requirement batches.`);
    const generated: GeneratedTestCase[] = [];
    for (let index = 0; index < chunks.length; index += 2) {
      const batch = chunks.slice(index, index + 2);
      const results = await Promise.all(batch.map((chunk, offset) => {
        const batchNumber = index + offset + 1;
        const target = Math.max(coverageTargetForChunk(chunk), input.perspectives.length * 5);
        console.log(`[Coverage Engine] Generating batch ${batchNumber}/${chunks.length}, target ${target}+ cases.`);
        return generateTestCasesWithAI({ ...input, appDescription: chunk, testCount: target, forceGemini: true });
      }));
      results.forEach(result => generated.push(...result));
    }
    const unique = uniqueTestCases(generated);
    console.log(`[Coverage Engine] Merged ${generated.length} cases into ${unique.length} unique cases.`);
    return unique;
  }
  const providerErrors: string[] = [];
  const estimatedSourceTokens = Math.ceil((input.appDescription.length + (input.videoAnalysis?.length || 0)) / 4);
  // Prefer Groq agent
  if (!input.forceGemini && process.env.GROQ_API_KEY && estimatedSourceTokens <= 4500) {
    try {
      return await runTestCaseAgent(input);
    } catch (err) {
      console.error('[Groq Agent] Failed, falling back to Gemini:', err);
      providerErrors.push(`Groq: ${err instanceof Error ? err.message : 'unknown provider error'}`);
    }
  } else if (!input.forceGemini && process.env.GROQ_API_KEY) {
    console.log(`[AI Router] Skipping Groq for large input (~${estimatedSourceTokens} source tokens); using Gemini directly.`);
  }

  // Fallback: Gemini
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(providerErrors.length
      ? `AI generation failed. ${providerErrors.join(' | ')}. Gemini is not configured.`
      : 'AI generation is not configured. Add GROQ_API_KEY or GEMINI_API_KEY.');
  }

  const countInstruction = input.testCount === 'Auto'
    ? 'Generate 50-100 test cases covering every aspect.'
    : typeof input.testCount === 'number'
    ? `Generate at least ${input.testCount} distinct test cases, and add more whenever needed to cover every supported scenario.`
    : 'Generate 50-80 comprehensive test cases.';
  const numericTarget = typeof input.testCount === 'number' ? input.testCount : 50;
  const perTypeMinimum = Math.max(3, Math.floor(numericTarget / Math.max(input.perspectives.length, 1)));

  const prompt = `You are a principal QA architect. Generate an EXHAUSTIVE test suite.

USER STORY:
${input.appDescription}

Platform: ${input.platform || 'Web'}
Perspectives: ${input.perspectives.join(', ')}
${input.videoAnalysis ? `\nScreen Recording Observations:\n${input.videoAnalysis}` : ''}

${countInstruction}

SELECTED TEST TYPE RULES:
- Generate cases for every selected perspective: ${input.perspectives.join(', ')}.
- Generate at least ${perTypeMinimum} cases for each selected perspective in this section when that perspective applies.
- Use only the selected perspectives; do not add unselected test categories.
- Cover every requirement, bullet, rule, acceptance statement, failure condition, and edge case in this supplied section.
- The requested count is a minimum, never a maximum. Generate additional cases whenever coverage requires them.
- Do not stop after covering the first feature components. Continue through the entire supplied section.

${input.videoAnalysis
  ? `VIDEO GROUNDING:
- Use the observation log as the only source of product facts.
- Generate only the requested perspective in this pass: ${input.perspectives.join(', ')}.
- Cover the complete observation log from its earliest timestamp through its final timestamp; do not stop after the first screen or interaction.
- Convert every distinct observed screen, control, action, value, transition, message, loading state, and outcome into coverage when it applies to the selected perspective.
- For each observed interaction, consider the successful behavior, visible state before and after, repeated action, cancellation/back behavior, and a directly supported invalid or interruption variation. Mark variations as inferred.
- Every case must cite its closest source timestamp as [Video evidence 00:12] in the preconditions or first step.
- Use exact visible labels and actions. Never invent an unseen feature merely to reach the requested minimum.`
  : 'STORY GROUNDING: Use only the supplied user-story section. Do not invent product capabilities that are not stated or directly implied by a listed rule.'}

WRITING RULES:
- Cover every distinct requirement, workflow, state, validation, alternate path, and failure scenario supported by the story or video evidence.
- Write for a new manual tester with no technical background.
- Every title must begin exactly with "Verify that" and contain no more than 14 words.
- Use common, everyday words. Do not use QA, engineering, or business jargon.
- Keep the precondition to one short sentence.
- Write 1-5 short numbered steps. Put only one clear user action in each step.
- Start each step with a simple action word such as Open, Click, Type, Select, Scroll, or Check.
- Keep the expected result to one short sentence that says exactly what the user should see.
- Do not combine multiple checks in one test case. Split them into separate test cases.
- Do not add explanations, background details, or implementation terms.

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
      `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-3.6-flash'}:generateContent`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 16384 },
      },
      {
        headers: { 'Content-Type': 'application/json' },
        params: { key: apiKey },
        timeout: Number(process.env.AI_REQUEST_TIMEOUT_MS || 240000),
      }
    );

    const responseText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log('Gemini finish reason:', response.data?.candidates?.[0]?.finishReason);
    console.log('Gemini response length:', responseText?.length);
    if (!responseText) throw new Error('Empty Gemini response');

    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array in response');

    let testCases: GeneratedTestCase[] = JSON.parse(jsonMatch[0]);
    testCases = testCases.map(tc => ({
      ...tc,
      title: normalizeTestCaseTitle(tc.title),
      platform: tc.platform || input.platform || 'Web',
    }));

    if (input.videoAnalysis) {
      const ungrounded = testCases.filter(testCase => !/\b\d{1,2}:\d{2}\b/.test(JSON.stringify(testCase)));
      if (ungrounded.length > 0) {
        throw new Error(`${ungrounded.length} generated cases lacked video timestamp evidence`);
      }
    }

    return testCases;

  } catch (error: any) {
    const message = error?.response?.data?.error?.message || error?.message || 'unknown provider error';
    console.error('Gemini error:', error?.response?.data || error?.message);
    providerErrors.push(`Gemini: ${message}`);
    throw new Error(`AI generation failed. ${providerErrors.join(' | ')}`);
  }
}

export async function analyzeVideoWithAI(videoPath: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is required for video analysis.');

  try {
    const absolutePath = path.resolve(videoPath);
    if (!fs.existsSync(absolutePath)) throw new Error('Uploaded video file was not found.');

    const videoBuffer = fs.readFileSync(absolutePath);
    const base64Video = videoBuffer.toString('base64');
    const ext = path.extname(videoPath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.mp4': 'video/mp4', '.webm': 'video/webm',
      '.mov': 'video/quicktime', '.avi': 'video/x-msvideo',
    };
    const mimeType = mimeMap[ext] || 'video/mp4';

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_VIDEO_MODEL || 'gemini-3.6-flash'}:generateContent`,
      {
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: base64Video } },
            { text: `Analyze this QA screen recording exhaustively from the first frame through the final frame.

Create a chronological evidence inventory. Inspect the full timeline, including quiet intervals, and record every distinct:
- screen, section, modal, menu, tab, form, control, exact visible label, and important displayed value;
- pointer or keyboard action, text entry, selection, scroll, navigation, submission, cancellation, and repeated action;
- state before the action, loading or disabled state, transition, validation message, error, success message, and final outcome;
- responsive, visual, accessibility, interruption, or edge-case risk directly supported by what is visible.

Use granular timestamps throughout the entire recording, preferably at every meaningful change and at least every 2-3 seconds when the visual state changes. Format observations as "OBS-001 | 00:00-00:03 | Screen | Action | Result". End with a coverage inventory listing every observed screen, action, state, message, and outcome exactly once. Clearly label inferred risks as inferred. Do not invent screens, controls, APIs, or product behavior that are not visible.` },
          ],
        }],
        generationConfig: { temperature: 0.15, maxOutputTokens: 8192 },
      },
      { headers: { 'Content-Type': 'application/json' }, params: { key: apiKey }, timeout: Number(process.env.AI_REQUEST_TIMEOUT_MS || 240000) }
    );

    const analysis = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!analysis) throw new Error('Gemini returned no video observations.');
    return analysis;
  } catch (error: any) {
    console.error('Video analysis error:', error?.message);
    throw new Error(error?.response?.data?.error?.message || error?.message || 'Video analysis failed.');
  }
}
