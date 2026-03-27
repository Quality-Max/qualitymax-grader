'use strict';

const { toJUnit, toSarif } = require('../lib/formatters');

// ═══════════════════════════════════════════════════════════
// Test data fixtures
// ═══════════════════════════════════════════════════════════

function makeSampleData() {
  return {
    version: '0.2.0',
    minGrade: 'B',
    summary: {
      files: 2,
      averageScore: 75,
      averageGrade: 'B',
      passed: 1,
      failed: 1,
    },
    results: [
      {
        file: 'tests/good.spec.ts',
        score: 95,
        grade: 'A',
        passed: true,
        issues: [],
        checks: [
          { id: 'imports', name: 'Has @playwright/test import', maxPoints: 15, earned: 15, passed: true, issue: null, suggestion: null },
          { id: 'assertions', name: 'Has assertions', maxPoints: 20, earned: 20, passed: true, issue: null, suggestion: null },
        ],
      },
      {
        file: 'tests/bad.spec.ts',
        score: 55,
        grade: 'D',
        passed: false,
        issues: ['Missing @playwright/test import', 'No assertions found'],
        checks: [
          { id: 'imports', name: 'Has @playwright/test import', maxPoints: 15, earned: 0, passed: false, issue: 'Missing @playwright/test import', suggestion: "Add: import { test, expect } from '@playwright/test';" },
          { id: 'assertions', name: 'Has assertions', maxPoints: 20, earned: 0, passed: false, issue: 'No assertions found', suggestion: "Add: await expect(page.locator('...')).toBeVisible();" },
          { id: 'no_timeout', name: 'No waitForTimeout', maxPoints: 0, earned: -4, passed: false, issue: 'Uses waitForTimeout (2x)', suggestion: "Replace with: await page.waitForSelector('.element');" },
        ],
      },
    ],
  };
}

// ═══════════════════════════════════════════════════════════
// JUnit XML
// ═══════════════════════════════════════════════════════════

describe('toJUnit', () => {
  test('generates valid XML structure', () => {
    const data = makeSampleData();
    const xml = toJUnit(data);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<testsuites');
    expect(xml).toContain('</testsuites>');
    expect(xml).toContain('<testsuite');
    expect(xml).toContain('</testsuite>');
  });

  test('includes correct test counts', () => {
    const data = makeSampleData();
    const xml = toJUnit(data);

    expect(xml).toContain('tests="2"');
    expect(xml).toContain('failures="1"');
  });

  test('passing test has no failure element', () => {
    const data = makeSampleData();
    const xml = toJUnit(data);

    // The good test should have a testcase without failure
    const goodStart = xml.indexOf('tests/good.spec.ts');
    const goodEnd = xml.indexOf('</testcase>', goodStart);
    const goodBlock = xml.slice(goodStart, goodEnd);
    expect(goodBlock).not.toContain('<failure');
  });

  test('failing test has failure element with issues', () => {
    const data = makeSampleData();
    const xml = toJUnit(data);

    expect(xml).toContain('<failure');
    expect(xml).toContain('Grade D (55/100) below minimum');
    expect(xml).toContain('Missing @playwright/test import');
  });

  test('includes grade and score properties', () => {
    const data = makeSampleData();
    const xml = toJUnit(data);

    expect(xml).toContain('<property name="grade" value="A"');
    expect(xml).toContain('<property name="score" value="95"');
    expect(xml).toContain('<property name="grade" value="D"');
    expect(xml).toContain('<property name="score" value="55"');
  });

  test('escapes XML special characters in file names', () => {
    const data = makeSampleData();
    data.results[0].file = 'tests/<special>&"test.spec.ts';
    const xml = toJUnit(data);

    expect(xml).toContain('&lt;special&gt;&amp;&quot;test.spec.ts');
    expect(xml).not.toContain('<special>');
  });

  test('handles empty results', () => {
    const data = {
      minGrade: 'B',
      summary: { files: 0, averageScore: 0, averageGrade: 'F', passed: 0, failed: 0 },
      results: [],
    };
    const xml = toJUnit(data);

    expect(xml).toContain('tests="0"');
    expect(xml).toContain('failures="0"');
  });
});

// ═══════════════════════════════════════════════════════════
// SARIF v2.1.0
// ═══════════════════════════════════════════════════════════

describe('toSarif', () => {
  test('generates valid SARIF v2.1.0 JSON', () => {
    const data = makeSampleData();
    const json = toSarif(data);
    const sarif = JSON.parse(json);

    expect(sarif.version).toBe('2.1.0');
    expect(sarif.$schema).toContain('sarif-schema-2.1.0');
    expect(sarif.runs).toHaveLength(1);
  });

  test('includes tool driver info', () => {
    const data = makeSampleData();
    const sarif = JSON.parse(toSarif(data));
    const driver = sarif.runs[0].tool.driver;

    expect(driver.name).toBe('qualitymax-grader');
    expect(driver.semanticVersion).toBe('0.2.0');
    expect(driver.informationUri).toContain('qualitymax-grader');
  });

  test('only includes failing checks as results', () => {
    const data = makeSampleData();
    const sarif = JSON.parse(toSarif(data));
    const results = sarif.runs[0].results;

    // Only failing checks: imports, assertions, no_timeout from bad.spec.ts
    expect(results.length).toBe(3);
    expect(results.every(r => r.ruleId)).toBe(true);
  });

  test('results have correct rule IDs', () => {
    const data = makeSampleData();
    const sarif = JSON.parse(toSarif(data));
    const ruleIds = sarif.runs[0].results.map(r => r.ruleId);

    expect(ruleIds).toContain('imports');
    expect(ruleIds).toContain('assertions');
    expect(ruleIds).toContain('no_timeout');
  });

  test('penalty checks have error level', () => {
    const data = makeSampleData();
    const sarif = JSON.parse(toSarif(data));
    const timeoutResult = sarif.runs[0].results.find(r => r.ruleId === 'no_timeout');

    expect(timeoutResult.level).toBe('error');
  });

  test('non-penalty failing checks have warning level', () => {
    const data = makeSampleData();
    const sarif = JSON.parse(toSarif(data));
    const importResult = sarif.runs[0].results.find(r => r.ruleId === 'imports');

    expect(importResult.level).toBe('warning');
  });

  test('results include file location', () => {
    const data = makeSampleData();
    const sarif = JSON.parse(toSarif(data));
    const result = sarif.runs[0].results[0];

    expect(result.locations[0].physicalLocation.artifactLocation.uri).toBe('tests/bad.spec.ts');
  });

  test('results with suggestions include fixes', () => {
    const data = makeSampleData();
    const sarif = JSON.parse(toSarif(data));
    const importResult = sarif.runs[0].results.find(r => r.ruleId === 'imports');

    expect(importResult.fixes).toBeDefined();
    expect(importResult.fixes[0].description.text).toContain('import');
  });

  test('rules array contains unique failing check definitions', () => {
    const data = makeSampleData();
    const sarif = JSON.parse(toSarif(data));
    const rules = sarif.runs[0].tool.driver.rules;

    expect(rules.length).toBe(3); // imports, assertions, no_timeout
    const ruleIds = rules.map(r => r.id);
    expect(new Set(ruleIds).size).toBe(ruleIds.length); // all unique
  });

  test('handles all-passing results', () => {
    const data = makeSampleData();
    data.results = [data.results[0]]; // keep only passing result
    data.summary.files = 1;
    data.summary.failed = 0;
    data.summary.passed = 1;

    const sarif = JSON.parse(toSarif(data));
    expect(sarif.runs[0].results).toHaveLength(0);
    expect(sarif.runs[0].tool.driver.rules).toHaveLength(0);
  });
});
