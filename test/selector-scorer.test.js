'use strict';

const { analyzeSelectors, SELECTOR_SCORES } = require('../lib/selector-scorer');

describe('analyzeSelectors', () => {
  test('data-testid selectors score highest', () => {
    const code = `
      await page.locator('[data-testid="submit"]').click();
      await page.locator('[data-testid="email"]').fill('test@example.com');
    `;
    const result = analyzeSelectors(code);
    expect(result.score).toBeGreaterThan(0);
    expect(result.breakdown.some(b => b.type === 'data-testid')).toBe(true);
  });

  test('getByTestId scores highest', () => {
    const code = `
      await page.getByTestId('submit').click();
      await page.getByTestId('email').fill('test@example.com');
    `;
    const result = analyzeSelectors(code);
    expect(result.score).toBeGreaterThan(0);
    expect(result.breakdown.some(b => b.type === 'getByTestId')).toBe(true);
  });

  test('getByRole with name scores well', () => {
    const code = `
      await page.getByRole('button', { name: 'Submit' }).click();
      await page.getByRole('textbox', { name: 'Email' }).fill('test@example.com');
    `;
    const result = analyzeSelectors(code);
    expect(result.score).toBeGreaterThan(0);
    expect(result.breakdown.some(b => b.type === 'getByRole+name')).toBe(true);
  });

  test('bare getByRole flags issue', () => {
    const code = `
      await page.getByRole('button').click();
      await page.getByRole('textbox').fill('test');
    `;
    const result = analyzeSelectors(code);
    expect(result.issues.some(i => i.includes('bare getByRole'))).toBe(true);
  });

  test('XPath selectors score worst', () => {
    const code = `
      await page.locator('//button[@class="submit"]').click();
      await page.locator('//input[@name="email"]').fill('test');
    `;
    const result = analyzeSelectors(code);
    expect(result.score).toBeLessThan(0);
    expect(result.issues.some(i => i.includes('XPath'))).toBe(true);
  });

  test('nth-child selectors flag fragility', () => {
    const code = `
      await page.locator('li:nth-child(3)').click();
      await page.locator('div:first-child').click();
    `;
    const result = analyzeSelectors(code);
    expect(result.score).toBeLessThan(0);
    expect(result.issues.some(i => i.includes('positional'))).toBe(true);
  });

  test('getByText and getByLabel score okay', () => {
    const code = `
      await page.getByText('Submit').click();
      await page.getByLabel('Email').fill('test@example.com');
    `;
    const result = analyzeSelectors(code);
    expect(result.score).toBeGreaterThan(0);
  });

  test('CSS class selectors are neutral', () => {
    const code = `
      await page.locator('.submit-btn').click();
    `;
    const result = analyzeSelectors(code);
    const cssBreakdown = result.breakdown.find(b => b.type === 'css-class');
    if (cssBreakdown) {
      expect(cssBreakdown.score).toBe(0);
    }
  });

  test('no selectors returns zero total', () => {
    const code = `
      console.log('hello');
    `;
    const result = analyzeSelectors(code);
    expect(result.total).toBe(0);
    expect(result.score).toBe(0);
  });

  test('mixed selectors gives weighted score', () => {
    const code = `
      await page.getByTestId('good-one').click();
      await page.locator('//bad/xpath').click();
      await page.getByRole('button', { name: 'OK' }).click();
    `;
    const result = analyzeSelectors(code);
    // Has both good and bad, so total depends on mix
    expect(result.total).toBeGreaterThanOrEqual(3);
    expect(result.breakdown.length).toBeGreaterThanOrEqual(2);
  });

  test('SELECTOR_SCORES has expected types', () => {
    expect(SELECTOR_SCORES['data-testid']).toBe(3);
    expect(SELECTOR_SCORES['getByTestId']).toBe(3);
    expect(SELECTOR_SCORES['getByRole+name']).toBe(2);
    expect(SELECTOR_SCORES['getByText']).toBe(1);
    expect(SELECTOR_SCORES['xpath']).toBe(-3);
    expect(SELECTOR_SCORES['nth-child']).toBe(-2);
  });
});
