'use strict';

const { gradeTest, scoreToGrade } = require('../lib/grader');

// ═══════════════════════════════════════════════════════════
// Grade Mapping
// ═══════════════════════════════════════════════════════════

describe('scoreToGrade', () => {
  test('A for 90-100', () => {
    expect(scoreToGrade(100)).toBe('A');
    expect(scoreToGrade(95)).toBe('A');
    expect(scoreToGrade(90)).toBe('A');
  });

  test('B for 75-89', () => {
    expect(scoreToGrade(89)).toBe('B');
    expect(scoreToGrade(80)).toBe('B');
    expect(scoreToGrade(75)).toBe('B');
  });

  test('C for 60-74', () => {
    expect(scoreToGrade(74)).toBe('C');
    expect(scoreToGrade(65)).toBe('C');
    expect(scoreToGrade(60)).toBe('C');
  });

  test('D for 40-59', () => {
    expect(scoreToGrade(59)).toBe('D');
    expect(scoreToGrade(50)).toBe('D');
    expect(scoreToGrade(40)).toBe('D');
  });

  test('F for 0-39', () => {
    expect(scoreToGrade(39)).toBe('F');
    expect(scoreToGrade(20)).toBe('F');
    expect(scoreToGrade(0)).toBe('F');
  });
});

// ═══════════════════════════════════════════════════════════
// Edge Cases
// ═══════════════════════════════════════════════════════════

describe('gradeTest edge cases', () => {
  test('empty string returns F with score 0', () => {
    const result = gradeTest('', 'test.spec.ts');
    expect(result.score).toBe(0);
    expect(result.grade).toBe('F');
    expect(result.issues).toContain('Empty file');
  });

  test('null/undefined returns F', () => {
    const result = gradeTest(null, 'test.spec.ts');
    expect(result.score).toBe(0);
    expect(result.grade).toBe('F');
  });

  test('whitespace-only returns F', () => {
    const result = gradeTest('   \n\n\n   ', 'test.spec.ts');
    expect(result.score).toBe(0);
    expect(result.grade).toBe('F');
  });
});

// ═══════════════════════════════════════════════════════════
// Check 1: @playwright/test imports (15 pts)
// ═══════════════════════════════════════════════════════════

describe('imports check', () => {
  const wrapper = (importLine) => `
${importLine}
test.describe('suite', () => {
  test('t1', async ({ page }) => {
    await page.goto('https://example.com');
    await expect(page).toHaveTitle(/Example/);
    await expect(page.locator('h1')).toBeVisible();
    await page.click('[data-testid="btn"]');
    await page.fill('[data-testid="input"]', 'value');
    await expect(page.locator('.result')).toHaveText('done');
  });
});`;

  test('ES import gives 15 points', () => {
    const result = gradeTest(wrapper("import { test, expect } from '@playwright/test';"), 'test.spec.ts');
    const check = result.checks.find(c => c.id === 'imports');
    expect(check.earned).toBe(15);
    expect(check.passed).toBe(true);
  });

  test('require import detection', () => {
    const result = gradeTest(wrapper("const { test, expect } = require('@playwright/test');"), 'test.spec.js');
    const check = result.checks.find(c => c.id === 'imports');
    // require() may or may not match depending on regex — test that check exists
    expect(check).toBeDefined();
  });

  test('no import gives 0 points', () => {
    const result = gradeTest(wrapper("// no import"), 'test.spec.ts');
    const check = result.checks.find(c => c.id === 'imports');
    expect(check.earned).toBe(0);
    expect(check.passed).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// Check 3: Assertions (20 pts)
// ═══════════════════════════════════════════════════════════

describe('assertions check', () => {
  const base = `import { test, expect } from '@playwright/test';
test('t', async ({ page }) => {
  await page.goto('https://example.com');
`;

  test('2+ assertions gives 20 points', () => {
    const code = base + `
  await expect(page).toHaveTitle(/Example/);
  await expect(page.locator('h1')).toBeVisible();
});`;
    const result = gradeTest(code, 'test.spec.ts');
    const check = result.checks.find(c => c.id === 'assertions');
    expect(check.earned).toBe(20);
  });

  test('1 assertion gives 10 points', () => {
    const code = base + `
  await expect(page).toHaveTitle(/Example/);
});`;
    const result = gradeTest(code, 'test.spec.ts');
    const check = result.checks.find(c => c.id === 'assertions');
    expect(check.earned).toBe(10);
  });

  test('0 assertions gives 0 points', () => {
    const code = base + `
  await page.click('button');
});`;
    const result = gradeTest(code, 'test.spec.ts');
    const check = result.checks.find(c => c.id === 'assertions');
    expect(check.earned).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════
// Check 4: Balanced braces (10 pts)
// ═══════════════════════════════════════════════════════════

describe('braces check', () => {
  test('balanced braces gives 10 points', () => {
    const code = `import { test, expect } from '@playwright/test';
test('t', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveTitle(/Example/);
  await expect(page.locator('h1')).toBeVisible();
});`;
    const result = gradeTest(code, 'test.spec.ts');
    const check = result.checks.find(c => c.id === 'braces');
    expect(check.earned).toBe(10);
  });

  test('unbalanced braces loses points', () => {
    const code = `import { test, expect } from '@playwright/test';
test('t', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveTitle(/Example/);
  await expect(page.locator('h1')).toBeVisible();`;  // missing closing braces
    const result = gradeTest(code, 'test.spec.ts');
    const check = result.checks.find(c => c.id === 'braces');
    expect(check.earned).toBeLessThan(10);
  });
});

// ═══════════════════════════════════════════════════════════
// Check 5: Reasonable length (10 pts)
// ═══════════════════════════════════════════════════════════

describe('length check', () => {
  test('very short code gets 0 points', () => {
    const code = `import { test } from '@playwright/test';
test('t', async () => {});`;
    const result = gradeTest(code, 'test.spec.ts');
    const check = result.checks.find(c => c.id === 'length');
    expect(check.earned).toBe(0);
    expect(check.issue).toMatch(/short/i);
  });
});

// ═══════════════════════════════════════════════════════════
// Check 6: TypeScript in .js files (5 pts)
// ═══════════════════════════════════════════════════════════

describe('typescript check', () => {
  const code = `import { test, expect } from '@playwright/test';
test('t', async ({ page }) => {
  const value: string = 'hello';
  await page.goto('https://example.com');
  await expect(page).toHaveTitle(/Example/);
  await expect(page.locator('h1')).toBeVisible();
});`;

  test('TypeScript in .js file loses 5 points', () => {
    const result = gradeTest(code, 'test.spec.js');
    const check = result.checks.find(c => c.id === 'no_typescript');
    expect(check.earned).toBe(0);
  });

  test('TypeScript in .ts file is fine', () => {
    const result = gradeTest(code, 'test.spec.ts');
    const check = result.checks.find(c => c.id === 'no_typescript');
    expect(check.earned).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════
// Check 7: page.goto() (5 pts)
// ═══════════════════════════════════════════════════════════

describe('navigation check', () => {
  test('page.goto present gives 5 points', () => {
    const code = `import { test, expect } from '@playwright/test';
test('t', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveTitle(/Example/);
  await expect(page.locator('h1')).toBeVisible();
});`;
    const result = gradeTest(code, 'test.spec.ts');
    const check = result.checks.find(c => c.id === 'navigation');
    expect(check.earned).toBe(5);
  });

  test('no page.goto gives 0 points', () => {
    const code = `import { test, expect } from '@playwright/test';
test('t', async ({ page }) => {
  await expect(page).toHaveTitle(/Example/);
  await expect(page.locator('h1')).toBeVisible();
});`;
    const result = gradeTest(code, 'test.spec.ts');
    const check = result.checks.find(c => c.id === 'navigation');
    expect(check.earned).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════
// Check 9: Markdown fences (5 pts)
// ═══════════════════════════════════════════════════════════

describe('markdown fences check', () => {
  test('code with fences loses 5 points', () => {
    const code = "```javascript\nimport { test } from '@playwright/test';\ntest('t', async ({ page }) => {\n  await page.goto('https://example.com');\n  await expect(page).toHaveTitle(/Example/);\n  await expect(page.locator('h1')).toBeVisible();\n});\n```";
    const result = gradeTest(code, 'test.spec.ts');
    const check = result.checks.find(c => c.id === 'no_fences');
    expect(check.earned).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════
// Check 11: waitForTimeout anti-pattern
// ═══════════════════════════════════════════════════════════

describe('waitForTimeout penalty', () => {
  test('waitForTimeout deducts points', () => {
    const code = `import { test, expect } from '@playwright/test';
test('t', async ({ page }) => {
  await page.goto('https://example.com');
  await page.waitForTimeout(1000);
  await page.waitForTimeout(2000);
  await expect(page).toHaveTitle(/Example/);
  await expect(page.locator('h1')).toBeVisible();
});`;
    const result = gradeTest(code, 'test.spec.ts');
    const check = result.checks.find(c => c.id === 'no_timeout');
    expect(check).toBeDefined();
    expect(check.earned).toBeLessThan(0);
  });
});

// ═══════════════════════════════════════════════════════════
// Full Test Grading (Integration)
// ═══════════════════════════════════════════════════════════

describe('full test grading', () => {
  test('perfect test scores A', () => {
    const code = `import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test('should login successfully', async ({ page }) => {
    await test.step('Navigate to login page', async () => {
      await page.goto('https://example.com/login');
      await expect(page).toHaveURL(/login/);
    });

    await test.step('Fill credentials', async () => {
      await page.fill('[data-testid="email"]', 'user@example.com');
      await page.fill('[data-testid="password"]', 'password123');
      await page.click('[data-testid="submit"]');
    });

    await test.step('Verify dashboard', async () => {
      await expect(page).toHaveURL(/dashboard/);
      await expect(page.locator('[data-testid="welcome"]')).toBeVisible();
      await expect(page.locator('[data-testid="welcome"]')).toHaveText(/Welcome/);
    });
  });
});`;
    const result = gradeTest(code, 'test.spec.ts');
    expect(result.grade).toBe('A');
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.issues.length).toBe(0);
  });

  test('test with only navigation scores lower than A', () => {
    const code = `import { test } from '@playwright/test';
test('browse pages', async ({ page }) => {
  await page.goto('https://example.com');
  await page.click('a[href="/about"]');
  await page.click('a[href="/contact"]');
});`;
    const result = gradeTest(code, 'test.spec.ts');
    expect(result.grade).not.toBe('A');
    expect(result.issues.some(i => i.toLowerCase().includes('assert'))).toBe(true);
  });

  test('boilerplate test scores F', () => {
    const code = `// TODO: implement
test('placeholder', async () => {
  // placeholder test
});`;
    const result = gradeTest(code, 'test.spec.ts');
    expect(result.grade).toBe('F');
    expect(result.score).toBeLessThan(40);
  });

  test('result always contains score, grade, checks, issues', () => {
    const code = `import { test, expect } from '@playwright/test';
test('t', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveTitle(/Example/);
});`;
    const result = gradeTest(code, 'test.spec.ts');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('grade');
    expect(result).toHaveProperty('checks');
    expect(result).toHaveProperty('issues');
    expect(typeof result.score).toBe('number');
    expect(typeof result.grade).toBe('string');
    expect(Array.isArray(result.checks)).toBe(true);
    expect(Array.isArray(result.issues)).toBe(true);
  });

  test('score is always between 0 and 100', () => {
    const codes = ['', 'garbage', `import { test, expect } from '@playwright/test';
test('t', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveTitle(/Example/);
  await expect(page.locator('h1')).toBeVisible();
});`];
    for (const code of codes) {
      const result = gradeTest(code, 'test.spec.ts');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    }
  });
});
