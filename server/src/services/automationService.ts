interface AutomationTestCase {
  id: unknown;
  title: unknown;
  steps?: unknown;
  expectedResult?: unknown;
}

export interface GeneratedAutomationFile {
  path: string;
  content: string;
  message: string;
}

const asText = (value: unknown) => String(value ?? '');
const jsString = (value: unknown) => JSON.stringify(asText(value));
const stepsFor = (test: AutomationTestCase) => Array.isArray(test.steps) ? test.steps.map(asText) : [];
const keyFor = (test: AutomationTestCase, suffix: 'TARGET' | 'EXPECTED_RESULT') => {
  const readableTitle = asText(test.title)
    .replace(/^verify\s+that\s+/i, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(word => !['the', 'a', 'an', 'is', 'are', 'to'].includes(word.toLowerCase()))
    .slice(0, 6)
    .join('_')
    .toUpperCase() || 'TEST_CASE';
  return `${readableTitle}_${suffix}`;
};

export function generateAutomationFiles(rawTests: AutomationTestCase[]): GeneratedAutomationFile[] {
  const tests = rawTests.map(test => ({
    ...test,
    title: asText(test.title),
    steps: stepsFor(test),
    expectedResult: asText(test.expectedResult),
  }));
  const locators: Record<string, string> = { BASE_URL: 'https://your-application-url.example' };
  for (const test of tests) {
    locators[keyFor(test, 'TARGET')] = '[data-testid="PASTE_TARGET_TEST_ID_HERE"]';
    locators[keyFor(test, 'EXPECTED_RESULT')] = '[data-testid="PASTE_EXPECTED_RESULT_TEST_ID_HERE"]';
  }

  const playwrightCases = tests.map(test => `test(${jsString(test.title)}, async ({ page }) => {
  // Manual steps from TestMind:
${test.steps.map((step, index) => `  // ${index + 1}. ${step.replace(/\r?\n/g, ' ')}`).join('\n') || '  // No manual steps were supplied.'}
  // Expected: ${test.expectedResult.replace(/\r?\n/g, ' ') || 'Complete the expected-result locator below.'}
  // Locator type: CSS selector. Prefer [data-testid="..."]; otherwise use #unique-id or [name="..."]
  await page.goto(locators.BASE_URL);
  const target = page.locator(locators[${jsString(keyFor(test, 'TARGET'))}]);
  await expect(target).toBeVisible();
  ${/\b(click|tap|select|submit|open)\b/i.test(test.title) ? 'await target.click();' : '// Add an interaction here when this scenario requires one.'}
  await expect(page.locator(locators[${jsString(keyFor(test, 'EXPECTED_RESULT'))}])).toBeVisible();
});`).join('\n\n');

  const cypressCases = tests.map(test => `it(${jsString(test.title)}, () => {
    // Steps: ${test.steps.join(' | ').replace(/\r?\n/g, ' ') || 'No manual steps supplied'}
    // Expected: ${test.expectedResult.replace(/\r?\n/g, ' ') || 'Replace the expected locator'}
    // Locator type: CSS selector. Prefer [data-testid="..."]; otherwise use #unique-id or [name="..."]
    cy.visit(locators.BASE_URL);
    cy.get(locators[${jsString(keyFor(test, 'TARGET'))}]).should('be.visible')${/\b(click|tap|select|submit|open)\b/i.test(test.title) ? ".click()" : ''};
    cy.get(locators[${jsString(keyFor(test, 'EXPECTED_RESULT'))}]).should('be.visible');
  });`).join('\n\n');

  const seleniumCases = tests.map(test => `test(${jsString(test.title)}, async () => {
  // Steps: ${test.steps.join(' | ').replace(/\r?\n/g, ' ') || 'No manual steps supplied'}
  // Expected: ${test.expectedResult.replace(/\r?\n/g, ' ') || 'Replace the expected locator'}
  // Locator type: CSS selector. Prefer [data-testid="..."]; otherwise use #unique-id or [name="..."]
  await driver.get(locators.BASE_URL);
  const target = await driver.wait(until.elementLocated(By.css(locators[${jsString(keyFor(test, 'TARGET'))}])), 10000);
  ${/\b(click|tap|select|submit|open)\b/i.test(test.title) ? 'await target.click();' : 'await driver.wait(until.elementIsVisible(target), 10000);'}
  const expected = await driver.wait(until.elementLocated(By.css(locators[${jsString(keyFor(test, 'EXPECTED_RESULT'))}])), 10000);
  await driver.wait(until.elementIsVisible(expected), 10000);
});`).join('\n\n');

  const readme = `# TestMind automation starter suites

These are executable Playwright, Cypress, and Selenium starter suites generated from the project test cases.

## Before running

1. Open \`locators.json\`.
2. Replace \`BASE_URL\` with the URL of the application under test.
3. Replace every readable \`*_TARGET\` value with the CSS selector for the element the test interacts with.
4. Replace every readable \`*_EXPECTED_RESULT\` value with the CSS selector proving the expected result happened.
5. Review the generated interaction. Tests whose title contains click, tap, select, submit, or open perform a click; other tests check visibility.

Prefer stable selectors in this order: \`[data-testid="..."]\`, \`#unique-id\`, \`[name="..."]\`, then another stable CSS attribute. Avoid generated class names and long DOM paths.

## Run

\`\`\`bash
npm install
npm run test:playwright
npm run test:cypress
npm run test:selenium
\`\`\`

The locator keys are intentionally stable and derived from each TestMind test-case ID. Regeneration will keep the same keys for unchanged cases.
`;

  return [
    { path: 'testmind/automation/locators.json', content: JSON.stringify(locators, null, 2), message: 'Add editable automation locator keys' },
    { path: 'testmind/automation/playwright/generated.spec.js', content: `import { test, expect } from '@playwright/test';\nimport fs from 'node:fs';\nconst locators = JSON.parse(fs.readFileSync(new URL('../locators.json', import.meta.url), 'utf8'));\n\n${playwrightCases}\n`, message: 'Add generated Playwright suite' },
    { path: 'testmind/automation/cypress/e2e/generated.cy.js', content: `import locators from '../../locators.json';\n\ndescribe('TestMind generated suite', () => {\n${cypressCases}\n});\n`, message: 'Add generated Cypress suite' },
    { path: 'testmind/automation/selenium/generated.test.js', content: `import test, { after, before } from 'node:test';\nimport { Builder, By, until } from 'selenium-webdriver';\nimport fs from 'node:fs';\nconst locators = JSON.parse(fs.readFileSync(new URL('../locators.json', import.meta.url), 'utf8'));\nlet driver;\nbefore(async () => { driver = await new Builder().forBrowser(process.env.BROWSER || 'chrome').build(); });\nafter(async () => { if (driver) await driver.quit(); });\n\n${seleniumCases}\n`, message: 'Add generated Selenium suite' },
    { path: 'testmind/automation/package.json', content: JSON.stringify({ private: true, type: 'module', scripts: { 'test:playwright': 'playwright test playwright', 'test:cypress': 'cypress run --spec cypress/e2e/generated.cy.js', 'test:selenium': 'node --test selenium/generated.test.js' }, devDependencies: { '@playwright/test': '^1.52.0', cypress: '^14.3.0', 'selenium-webdriver': '^4.31.0' } }, null, 2), message: 'Add automation runner dependencies' },
    { path: 'testmind/automation/README.md', content: readme, message: 'Document generated automation suites' },
  ];
}
