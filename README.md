# qualitymax-grader

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**Lighthouse for test quality.** Grade your Playwright tests A-F with a single command.

## Live Example

Actual grading output from the included example files:

| File | Grade | Score | Key Issues |
|---|---|---|---|
| good-test.spec.ts | A | 100/100 | None |
| mediocre-test.spec.ts | B | 88/100 | waitForTimeout, no test.step() |
| bad-test.spec.ts | D | 53/100 | No imports, no assertions, waitForTimeout, fragile selectors |
| empty-test.spec.ts | F | 35/100 | No imports, no assertions, too short, no navigation |

```
$ qualitymax-grader examples/*.spec.ts --verbose

  qualitymax-grader v0.2.0

  examples/bad-test.spec.ts        D  (53/100)  ✗  Missing @playwright/test import
    ✗ Has @playwright/test import 0/15  Missing @playwright/test import
       ^ Add: import { test, expect } from '@playwright/test';
    ✓ Has test structure 15/15
    ✗ Has assertions 0/20  No assertions found (expect() calls)
       ^ Add: await expect(page.locator('...')).toBeVisible();
    ✓ Balanced braces 10/10
    ✓ Reasonable length 10/10
    ✓ No TypeScript syntax in .js 5/5
    ✓ Uses page.goto() 5/5
    ✗ Has test.step() blocks 0/5  No test.step() blocks -- add steps for readability
       ^ Wrap actions in: await test.step('Step name', async () => { ... });
    ✓ No markdown fences 5/5
    ✓ Meaningful actions 10/10
    ✗ No waitForTimeout -4  Uses waitForTimeout (2x) -- flaky anti-pattern
    ✗ Selector stability -3  Fragile selectors detected (XPath, nth-child)

  examples/empty-test.spec.ts      F  (35/100)  ✗  Missing @playwright/test import
    ✗ Has @playwright/test import 0/15
    ✓ Has test structure 15/15
    ✗ Has assertions 0/20
    ✗ Reasonable length 0/10  Very short (5 lines)
    ✗ Uses page.goto() 0/5
    ✗ Has test.step() blocks 0/5
    ✗ Meaningful actions 0/10

  examples/good-test.spec.ts       A  (100/100)  ✓
    ✓ Has @playwright/test import 15/15
    ✓ Has test structure 15/15
    ✓ Has assertions 20/20
    ✓ Balanced braces 10/10
    ✓ Reasonable length 10/10
    ✓ No TypeScript syntax in .js 5/5
    ✓ Uses page.goto() 5/5
    ✓ Has test.step() blocks 5/5
    ✓ No markdown fences 5/5
    ✓ Meaningful actions 10/10
    ✓ Selector stability 5/5

  examples/mediocre-test.spec.ts   B  (88/100)  ✓
    ✓ Has @playwright/test import 15/15
    ✓ Has test structure 15/15
    ✗ Has assertions 10/20  Only 1 assertion (minimum 2 recommended)
    ✓ Balanced braces 10/10
    ✓ Reasonable length 10/10
    ✓ No TypeScript syntax in .js 5/5
    ✓ Uses page.goto() 5/5
    ✗ Has test.step() blocks 0/5  No test.step() blocks
    ✓ No markdown fences 5/5
    ✓ Meaningful actions 10/10
    ✗ No waitForTimeout -2  Uses waitForTimeout (1x)
    ✓ Selector stability 5/5

  Summary: 4 files graded | Average: C (69/100) | Passed: 2 | Failed: 2
```

## Quick Start

```bash
npx qualitymax-grader tests/**/*.spec.ts
```

## Example Output

```
  qualitymax-grader v0.2.0

  tests/login.spec.ts          A  (92/100)  ✓
  tests/checkout.spec.ts       D  (38/100)  ✗ no assertions, only navigation
  tests/search.spec.ts         B  (78/100)  ✓
  tests/dashboard.spec.ts      F  (12/100)  ✗ empty boilerplate

  Summary: 4 files graded | Average: C (55/100) | Passed: 2 | Failed: 2

  Fix low grades automatically → https://qualitymax.io
```

## What It Checks

| Check | Points | Description |
|-------|--------|-------------|
| `@playwright/test` import | 15 | Has proper `import { test, expect }` |
| Test structure | 15 | Uses `test()` or `test.describe()` |
| Assertions | 20 | Has `expect()` calls (0 for none, 10 for 1, 20 for 2+) |
| Balanced braces | 10 | `{` and `}` counts match |
| Reasonable length | 10 | Between 10-300 lines |
| No TypeScript in .js | 5 | No type annotations in plain JS files |
| Navigation | 5 | Uses `page.goto()` to navigate |
| Step blocks | 5 | Uses `test.step()` for readability |
| No markdown fences | 5 | Raw code, no ` ``` ` wrappers |
| Meaningful actions | 10 | Sufficient `page.*` and `expect()` calls |
| No `waitForTimeout` | -2/ea | Anti-pattern penalty (max -5) |
| Selector stability | +5/-3 | Bonus for `data-testid`, penalty for XPath/nth-child |
| No garbage selectors | -3/ea | Bare `getByRole()` without name qualifier |

### Grade Scale

| Grade | Score Range |
|-------|-------------|
| **A** | 90 - 100 |
| **B** | 75 - 89 |
| **C** | 60 - 74 |
| **D** | 40 - 59 |
| **F** | 0 - 39 |

## CLI Options

```
--min-grade <grade>   Minimum passing grade (A/B/C/D/F). Default: B
--format <fmt>        Output format: text (default), json, junit, sarif
--json                Alias for --format json
--verbose, -v         Show per-check breakdown for each file
--fix                 Show fix suggestions for each failing file
--help, -h            Show help
```

### Output Formats

```bash
# Default pretty text
qualitymax-grader tests/**/*.spec.ts

# JSON (for CI scripting)
qualitymax-grader tests/**/*.spec.ts --json

# JUnit XML (for CI test report integrations)
qualitymax-grader tests/**/*.spec.ts --format junit > grade-report.xml

# SARIF v2.1.0 (for GitHub Code Scanning / IDE integration)
qualitymax-grader tests/**/*.spec.ts --format sarif > grade-report.sarif
```

## CI Integration

### GitHub Action (Reusable)

```yaml
- uses: Quality-Max/qualitymax-grader@v0
  with:
    test-dir: 'tests/**/*.spec.ts'
    min-grade: 'B'
```

The action installs the grader, runs it against your test files, and fails the step if any test falls below the minimum grade.

### GitHub Actions (Manual Setup)

```yaml
name: Test Quality Gate

on: [push, pull_request]

jobs:
  grade:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Grade Playwright tests
        run: npx qualitymax-grader tests/**/*.spec.ts --min-grade B

      - name: Upload grade report (JUnit)
        if: always()
        run: npx qualitymax-grader tests/**/*.spec.ts --format junit > test-grades.xml

      - name: Upload SARIF to GitHub Code Scanning
        if: always()
        run: |
          npx qualitymax-grader tests/**/*.spec.ts --format sarif > test-grades.sarif

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-grades
          path: |
            test-grades.xml
            test-grades.sarif
```

The CLI exits with code 1 if any test falls below `--min-grade`, failing your CI pipeline.

## Library Usage

```js
const { gradeTest, scoreToGrade, analyzeSelectors } = require('qualitymax-grader');

const code = fs.readFileSync('test.spec.ts', 'utf-8');
const result = gradeTest(code, 'test.spec.ts');
// result: { score, grade, checks, issues }

console.log(result.grade); // 'A'
console.log(result.score); // 95
console.log(result.checks); // [{ id, name, maxPoints, earned, passed, issue, suggestion }]
```

You can also pass options to disable specific checks:

```js
const result = gradeTest(code, 'test.spec.ts', {
  checks: {
    steps: { enabled: false },
    navigation: { enabled: false },
  },
});
```

## Playwright Reporter

Add the reporter to your `playwright.config.ts`:

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [
    ['qualitymax-grader/reporter', { minGrade: 'B' }],
  ],
});
```

Options:
- `minGrade` - Minimum grade to pass (default: `'B'`)
- `verbose` - Show per-check breakdown (default: `false`)
- `json` - Output JSON instead of pretty text (default: `false`)

## Configuration

Create a `.qualitymaxrc.json` file in your project root (or any parent directory):

```json
{
  "minGrade": "B",
  "checks": {
    "steps": { "enabled": false },
    "navigation": { "enabled": false }
  },
  "ignore": ["**/generated/**"]
}
```

- **`minGrade`** - Default minimum grade (CLI `--min-grade` overrides this)
- **`checks`** - Disable specific checks by setting `enabled: false`
- **`ignore`** - Glob patterns for files to skip

The grader walks up from the current directory looking for `.qualitymaxrc.json`, similar to how ESLint finds its config.

## Selector Stability Scoring

Selectors are scored by reliability:

| Selector Pattern | Score | Stability |
|-----------------|-------|-----------|
| `getByRole` with `name` | +3 | Best |
| `data-testid`, `data-test` | +2 | Good |
| `getByText`, `getByLabel` | +1 | Okay |
| CSS class selector | 0 | Neutral |
| `nth-child`, `:first-child` | -2 | Fragile |
| XPath | -3 | Worst |

---

**Want to auto-fix low grades?** Let AI rewrite your tests with stable selectors, proper assertions, and step blocks.

[qualitymax.io](https://qualitymax.io)

## License

Apache 2.0 - see [LICENSE](LICENSE)
