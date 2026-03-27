'use strict';

/**
 * Selector stability analysis for Playwright test code.
 * Scores selector patterns by reliability — stable selectors score higher.
 *
 * Ported from QualityMax Python selector_scorer.py
 */

const SELECTOR_SCORES = {
  // Best: semantic role with name qualifier
  'getByRole+name': 3,

  // Good: explicit test identifiers
  'data-testid':  2,
  'data-test':    2,
  'getByTestId':  2,

  // Okay: text-based locators
  'getByText':        1,
  'getByLabel':       1,
  'getByPlaceholder': 1,
  'getByTitle':       1,
  'getByAltText':     1,

  // Neutral: CSS class selectors
  'css-class':    0,
  'css-id':       0,

  // Fragile: positional selectors
  'nth-child':   -2,
  'first-child': -2,
  'nth':         -2,

  // Worst: XPath
  'xpath':       -3,
};

/**
 * Patterns to detect selector types in Playwright code.
 * Order matters: more specific patterns first.
 */
const SELECTOR_PATTERNS = [
  { pattern: /getByTestId\s*\(/g,                                        type: 'getByTestId' },
  { pattern: /\[data-testid=/g,                                          type: 'data-testid' },
  { pattern: /\[data-test=/g,                                            type: 'data-test' },
  { pattern: /getByRole\s*\([^)]+,\s*\{[^}]*name\s*:/g,                 type: 'getByRole+name' },
  { pattern: /getByRole\s*\(\s*['"][^'"]+['"]\s*\)/g,                    type: 'getByRole-bare' },
  { pattern: /getByText\s*\(/g,                                          type: 'getByText' },
  { pattern: /getByLabel\s*\(/g,                                         type: 'getByLabel' },
  { pattern: /getByPlaceholder\s*\(/g,                                   type: 'getByPlaceholder' },
  { pattern: /getByTitle\s*\(/g,                                         type: 'getByTitle' },
  { pattern: /getByAltText\s*\(/g,                                       type: 'getByAltText' },
  { pattern: /:nth-child\(\d+\)/g,                                       type: 'nth-child' },
  { pattern: /:first-child/g,                                            type: 'first-child' },
  { pattern: /\.nth\(\d+\)/g,                                            type: 'nth' },
  { pattern: /\.first\(\)/g,                                             type: 'nth' },
  { pattern: /locator\s*\(\s*['"]\/\//g,                                  type: 'xpath' },
  { pattern: /locator\s*\(\s*['"]\.[\w-]+['"]\s*\)/g,                   type: 'css-class' },
  { pattern: /locator\s*\(\s*['"]#[\w-]+['"]\s*\)/g,                    type: 'css-id' },
];

/**
 * Analyze selector stability in a Playwright test file.
 *
 * @param {string} code - The test file source code
 * @returns {{ score: number, total: number, breakdown: Array<{type: string, count: number, score: number}>, issues: string[] }}
 */
function analyzeSelectors(code) {
  const counts = {};
  const issues = [];

  for (const { pattern, type } of SELECTOR_PATTERNS) {
    // Reset regex lastIndex for global patterns
    const re = new RegExp(pattern.source, pattern.flags);
    const matches = code.match(re);
    if (matches && matches.length > 0) {
      counts[type] = (counts[type] || 0) + matches.length;
    }
  }

  // Calculate total score
  let totalScore = 0;
  let totalSelectors = 0;
  const breakdown = [];

  for (const [type, count] of Object.entries(counts)) {
    const scorePerSelector = SELECTOR_SCORES[type] ?? 0;
    const typeScore = scorePerSelector * count;
    totalScore += typeScore;
    totalSelectors += count;
    breakdown.push({ type, count, score: typeScore });

    // Flag issues
    if (type === 'getByRole-bare' && count > 0) {
      issues.push(`${count}x bare getByRole() without name qualifier -- fragile`);
    }
    if (type === 'xpath' && count > 0) {
      issues.push(`${count}x XPath selector -- prefer data-testid or getByRole`);
    }
    if ((type === 'nth-child' || type === 'first-child' || type === 'nth') && count > 0) {
      issues.push(`${count}x positional selector (${type}) -- breaks when DOM order changes`);
    }
  }

  // Sort breakdown by score descending
  breakdown.sort((a, b) => b.score - a.score);

  return {
    score: totalScore,
    total: totalSelectors,
    breakdown,
    issues,
  };
}

module.exports = { analyzeSelectors, SELECTOR_SCORES };
