import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateAutomationFiles } from './automationService.js';

describe('generateAutomationFiles', () => {
  const files = generateAutomationFiles([{
    id: 'tc-1',
    title: 'Verify that clicking Sign In opens the dashboard',
    steps: ['Open the login page', 'Click Sign In'],
    expectedResult: 'The dashboard is visible',
  }]);

  it('generates all supported framework assets', () => {
    const paths = files.map(file => file.path);
    for (const expectedPath of [
      'testmind/automation/locators.json',
      'testmind/automation/playwright/generated.spec.js',
      'testmind/automation/cypress/e2e/generated.cy.js',
      'testmind/automation/selenium/generated.test.js',
    ]) {
      assert.ok(paths.includes(expectedPath));
    }
  });

  it('uses readable editable locator keys', () => {
    const locatorFile = files.find(file => file.path.endsWith('locators.json'));
    assert.ok(locatorFile);
    const locators = JSON.parse(locatorFile!.content);
    assert.match(locators.CLICKING_SIGN_IN_OPENS_DASHBOARD_TARGET, /PASTE_TARGET_TEST_ID_HERE/);
    assert.match(locators.CLICKING_SIGN_IN_OPENS_DASHBOARD_EXPECTED_RESULT, /PASTE_EXPECTED_RESULT_TEST_ID_HERE/);
  });

  it('produces framework code with the test title', () => {
    for (const file of files.filter(file => /generated\.(spec|cy|test)\.js$/.test(file.path))) {
      assert.match(file.content, /Verify that clicking Sign In opens the dashboard/);
    }
  });
});
