'use strict';

/**
 * Core grading logic for Playwright test files.
 * Ported from QualityMax Python services/fanatical/scorer.py
 *
 * Returns a score 0-100 with letter grade A-F and per-check breakdown.
 */

const { analyzeSelectors } = require('./selector-scorer');

/**
 * Map numeric score to letter grade.
 * A = 90-100, B = 75-89, C = 60-74, D = 40-59, F = 0-39
 */
function scoreToGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

/**
 * One-line fix suggestions for each check ID.
 */
const SUGGESTIONS = {
  imports: "Add: import { test, expect } from '@playwright/test';",
  assertions: "Add: await expect(page.locator('...')).toBeVisible();",
  no_timeout: "Replace with: await page.waitForSelector('.element');",
  no_test_only: "Remove .only before committing",
  no_test_skip: "Remove .skip or add a comment explaining why",
  no_pause: "Remove page.pause() before committing",
  no_debugger: "Remove debugger statement",
  navigation: "Add: await page.goto('https://your-app.com');",
  steps: "Wrap actions in: await test.step('Step name', async () => { ... });",
  no_fences: "Remove ``` markdown fences -- save as raw .ts/.js file",
};

/**
 * Grade a single Playwright test file.
 *
 * @param {string} code - File contents
 * @param {string} filePath - File path (used for .js vs .ts detection)
 * @param {object} [options] - Optional config: { checks: { checkId: { enabled: false } } }
 * @returns {{ score: number, grade: string, checks: Array, issues: string[] }}
 */
function gradeTest(code, filePath, options) {
  const opts = options || {};
  const checkConfig = opts.checks || {};

  // Helper: returns true if a check is disabled via config
  function isCheckDisabled(checkId) {
    return checkConfig[checkId] && checkConfig[checkId].enabled === false;
  }

  if (!code || !code.trim()) {
    return {
      score: 0,
      grade: 'F',
      checks: [{ id: 'empty', name: 'Non-empty file', maxPoints: 0, earned: 0, passed: false, issue: 'Empty file', suggestion: null }],
      issues: ['Empty file'],
    };
  }

  let total = 0;
  const issues = [];
  const checks = [];

  // --- 1. Has proper @playwright/test imports (15 pts) ---
  const hasTestImport =
    /import\s+.*(?:test|expect).*from\s+['"]@playwright\/test['"]/.test(code) ||
    /require\s*\(\s*['"]@playwright\/test['"]\s*\)/.test(code);
  {
    const earned = hasTestImport ? 15 : 0;
    const issue = hasTestImport ? null : 'Missing @playwright/test import';
    if (issue) issues.push(issue);
    total += earned;
    checks.push({ id: 'imports', name: 'Has @playwright/test import', maxPoints: 15, earned, passed: hasTestImport, issue });
  }

  // --- 2. Has test()/test.describe() structure (15 pts) ---
  const hasTestStructure = code.includes('test.describe(') || /test\s*\(/.test(code);
  {
    const earned = hasTestStructure ? 15 : 0;
    const issue = hasTestStructure ? null : 'Missing test() or test.describe() block';
    if (issue) issues.push(issue);
    total += earned;
    checks.push({ id: 'structure', name: 'Has test structure', maxPoints: 15, earned, passed: hasTestStructure, issue });
  }

  // --- 3. Has assertions via expect() (20 pts) ---
  {
    const assertionMatches = code.match(/expect\s*\(/g);
    const assertionCount = assertionMatches ? assertionMatches.length : 0;
    let earned, issue;
    if (assertionCount >= 2) {
      earned = 20;
      issue = null;
    } else if (assertionCount === 1) {
      earned = 10;
      issue = 'Only 1 assertion (minimum 2 recommended)';
      issues.push(issue);
    } else {
      earned = 0;
      issue = 'No assertions found (expect() calls)';
      issues.push(issue);
    }
    total += earned;
    checks.push({ id: 'assertions', name: 'Has assertions', maxPoints: 20, earned, passed: assertionCount >= 2, issue });
  }

  // --- 4. Balanced braces (10 pts) ---
  {
    const openBraces = (code.match(/{/g) || []).length;
    const closeBraces = (code.match(/}/g) || []).length;
    let earned, issue;
    if (openBraces === closeBraces && openBraces > 0) {
      earned = 10;
      issue = null;
    } else if (Math.abs(openBraces - closeBraces) <= 1) {
      earned = 5;
      issue = `Slightly unbalanced braces (${openBraces} open, ${closeBraces} close)`;
      issues.push(issue);
    } else {
      earned = 0;
      issue = `Unbalanced braces (${openBraces} open, ${closeBraces} close)`;
      issues.push(issue);
    }
    total += earned;
    checks.push({ id: 'braces', name: 'Balanced braces', maxPoints: 10, earned, passed: earned === 10, issue });
  }

  // --- 5. Reasonable length 10-300 lines (10 pts) ---
  {
    const lineCount = code.trim().split('\n').length;
    let earned, issue;
    if (lineCount >= 10 && lineCount <= 300) {
      earned = 10;
      issue = null;
    } else if (lineCount < 10) {
      earned = 0;
      issue = `Very short (${lineCount} lines -- possibly truncated)`;
      issues.push(issue);
    } else {
      earned = 5;
      issue = `Very long (${lineCount} lines)`;
      issues.push(issue);
    }
    total += earned;
    checks.push({ id: 'length', name: 'Reasonable length', maxPoints: 10, earned, passed: earned === 10, issue });
  }

  // --- 6. No TypeScript syntax in .js files (5 pts) ---
  {
    const isJsFile = filePath && filePath.endsWith('.js');
    let earned = 5;
    let issue = null;
    if (isJsFile) {
      const tsPatterns = [/:\s*string\b/, /:\s*number\b/, /:\s*boolean\b/, /\w+<\w+>/, /interface\s+\w+/];
      const hasTypeScript = tsPatterns.some(p => p.test(code));
      if (hasTypeScript) {
        earned = 0;
        issue = 'TypeScript syntax detected in .js file';
        issues.push(issue);
      }
    }
    total += earned;
    checks.push({ id: 'no_typescript', name: 'No TypeScript syntax in .js', maxPoints: 5, earned, passed: earned === 5, issue });
  }

  // --- 7. Uses page.goto() navigation (5 pts) ---
  if (!isCheckDisabled('navigation')) {
    const hasGoto = code.includes('page.goto(');
    const earned = hasGoto ? 5 : 0;
    const issue = hasGoto ? null : 'Missing page.goto() -- test does not navigate to a URL';
    if (issue) issues.push(issue);
    total += earned;
    checks.push({ id: 'navigation', name: 'Uses page.goto()', maxPoints: 5, earned, passed: hasGoto, issue });
  }

  // --- 8. Has test.step() blocks (5 pts) ---
  if (!isCheckDisabled('steps')) {
    const stepMatches = code.match(/test\.step\s*\(/g);
    const stepCount = stepMatches ? stepMatches.length : 0;
    let earned;
    if (stepCount >= 2) earned = 5;
    else if (stepCount === 1) earned = 3;
    else earned = 0;
    const issue = stepCount >= 2 ? null : (stepCount === 0 ? 'No test.step() blocks -- add steps for readability' : 'Only 1 test.step() block');
    if (stepCount === 0) issues.push(issue);
    total += earned;
    checks.push({ id: 'steps', name: 'Has test.step() blocks', maxPoints: 5, earned, passed: stepCount >= 2, issue });
  }

  // --- 9. No markdown fences (5 pts) ---
  {
    const hasFences = code.includes('```');
    const earned = hasFences ? 0 : 5;
    const issue = hasFences ? 'Contains markdown fences (should be raw code only)' : null;
    if (issue) issues.push(issue);
    total += earned;
    checks.push({ id: 'no_fences', name: 'No markdown fences', maxPoints: 5, earned, passed: !hasFences, issue });
  }

  // --- 10. Meaningful action count (10 pts) ---
  {
    // Find test body (after first test( or test.describe( call)
    const testBodyMatch = code.match(/test\s*\([^)]*,\s*async\s*\(/);
    const testBody = testBodyMatch ? code.slice(testBodyMatch.index) : code;
    const actionMatches = testBody.match(/await\s+(?:page\.\w+\(|expect\()/g);
    const actionCount = actionMatches ? actionMatches.length : 0;
    let earned, issue;
    if (actionCount >= 6) {
      earned = 10;
      issue = null;
    } else if (actionCount >= 3) {
      earned = 5;
      issue = `Few meaningful actions (${actionCount})`;
      issues.push(issue);
    } else {
      earned = 0;
      issue = `Very few actions (${actionCount} -- likely incomplete)`;
      issues.push(issue);
    }
    total += earned;
    checks.push({ id: 'actions', name: 'Meaningful actions', maxPoints: 10, earned, passed: actionCount >= 6, issue });
  }

  // --- 11. waitForTimeout anti-pattern (-2 pts each, max -5) ---
  {
    const timeoutMatches = code.match(/page\.waitForTimeout\s*\(/g);
    const timeoutCount = timeoutMatches ? timeoutMatches.length : 0;
    if (timeoutCount > 0) {
      const penalty = Math.min(5, timeoutCount * 2);
      total -= penalty;
      const issue = `Uses waitForTimeout (${timeoutCount}x) -- flaky anti-pattern, use waitForSelector/waitForURL instead (-${penalty}pts)`;
      issues.push(issue);
      checks.push({ id: 'no_timeout', name: 'No waitForTimeout', maxPoints: 0, earned: -penalty, passed: false, issue });
    }
  }

  // --- 14. test.only() detection (-10 pts hard penalty) ---
  {
    const onlyMatches = code.match(/test\.only\s*\(/g);
    const onlyCount = onlyMatches ? onlyMatches.length : 0;
    if (onlyCount > 0) {
      const penalty = 10;
      total -= penalty;
      const issue = `Uses test.only() (${onlyCount}x) -- committed .only breaks CI for everyone (-${penalty}pts)`;
      issues.push(issue);
      checks.push({ id: 'no_test_only', name: 'No test.only()', maxPoints: 0, earned: -penalty, passed: false, issue });
    }
  }

  // --- 15. test.skip() detection (-1 pt warning) ---
  {
    const skipMatches = code.match(/test\.skip\s*\(/g);
    const skipCount = skipMatches ? skipMatches.length : 0;
    if (skipCount > 0) {
      const penalty = 1;
      total -= penalty;
      const issue = `Uses test.skip() (${skipCount}x) -- skipped tests reduce coverage (-${penalty}pt)`;
      issues.push(issue);
      checks.push({ id: 'no_test_skip', name: 'No test.skip()', maxPoints: 0, earned: -penalty, passed: false, issue });
    }
  }

  // --- 16. page.pause() detection (-2 pts each, max -5) ---
  {
    const pauseMatches = code.match(/page\.pause\s*\(/g);
    const pauseCount = pauseMatches ? pauseMatches.length : 0;
    if (pauseCount > 0) {
      const penalty = Math.min(5, pauseCount * 2);
      total -= penalty;
      const issue = `Uses page.pause() (${pauseCount}x) -- debug statement left in test (-${penalty}pts)`;
      issues.push(issue);
      checks.push({ id: 'no_pause', name: 'No page.pause()', maxPoints: 0, earned: -penalty, passed: false, issue });
    }
  }

  // --- 17. debugger statement detection (-2 pts each, max -5) ---
  {
    const debuggerMatches = code.match(/\bdebugger\b/g);
    const debuggerCount = debuggerMatches ? debuggerMatches.length : 0;
    if (debuggerCount > 0) {
      const penalty = Math.min(5, debuggerCount * 2);
      total -= penalty;
      const issue = `Uses debugger statement (${debuggerCount}x) -- debug statement left in test (-${penalty}pts)`;
      issues.push(issue);
      checks.push({ id: 'no_debugger', name: 'No debugger statements', maxPoints: 0, earned: -penalty, passed: false, issue });
    }
  }

  // --- 12. Selector stability (bonus/penalty from selector-scorer) ---
  {
    const selectorResult = analyzeSelectors(code);
    if (selectorResult.total > 0) {
      // Normalize: if average selector score > 1, add bonus; if < 0, add penalty
      const avgScore = selectorResult.score / selectorResult.total;
      let selectorPoints = 0;
      let issue = null;
      if (avgScore >= 2) {
        selectorPoints = 5;
        issue = null;
      } else if (avgScore >= 1) {
        selectorPoints = 3;
        issue = null;
      } else if (avgScore >= 0) {
        selectorPoints = 0;
        issue = 'Selectors could be more stable -- prefer data-testid or getByRole with name';
      } else {
        selectorPoints = -3;
        issue = 'Fragile selectors detected (XPath, nth-child) -- use data-testid or getByRole';
        issues.push(issue);
      }
      total += selectorPoints;
      checks.push({
        id: 'selectors',
        name: 'Selector stability',
        maxPoints: 5,
        earned: selectorPoints,
        passed: selectorPoints >= 0,
        issue,
      });

      // Add selector-specific issues
      for (const sIssue of selectorResult.issues) {
        issues.push(sIssue);
      }
    }
  }

  // --- 13. Garbage selectors: bare tag locators ---
  {
    const garbageLocator = /page\.locator\(\s*['"](?:role=\w+|[a-z][a-z0-6]*)[']\s*\)/g;
    const garbageGetByRole = /page\.getByRole\(\s*['"][^'"]+['"]\s*\)/g;

    const testBodyMatch = code.match(/test\s*\([^)]*,\s*async\s*\(/);
    const testBody = testBodyMatch ? code.slice(testBodyMatch.index) : code;

    const garbageLocatorHits = testBody.match(garbageLocator) || [];
    const garbageRoleHits = testBody.match(garbageGetByRole) || [];
    const totalGarbage = garbageLocatorHits.length + garbageRoleHits.length;

    if (totalGarbage >= 2) {
      const penalty = Math.min(10, totalGarbage * 3);
      total -= penalty;
      const issue = `${totalGarbage} bare tag/role locator(s) without qualifier (-${penalty}pts)`;
      issues.push(issue);
      checks.push({ id: 'garbage_selectors', name: 'No garbage selectors', maxPoints: 0, earned: -penalty, passed: false, issue });
    }
  }

  // Cap at 0-100
  total = Math.max(0, Math.min(100, total));

  // Add suggestion field to each check
  for (const check of checks) {
    check.suggestion = SUGGESTIONS[check.id] || null;
  }

  return {
    score: total,
    grade: scoreToGrade(total),
    checks,
    issues,
  };
}

module.exports = { gradeTest, scoreToGrade, analyzeSelectors, SUGGESTIONS };
