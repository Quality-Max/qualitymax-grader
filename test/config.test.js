'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { loadConfig, shouldIgnore, DEFAULTS, CONFIG_FILENAME } = require('../lib/config');

describe('loadConfig', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qmg-config-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns defaults when no config file exists', () => {
    const config = loadConfig(tmpDir);
    expect(config.minGrade).toBe('B');
    expect(config.checks).toEqual({});
    expect(config.ignore).toEqual([]);
  });

  test('loads config from current directory', () => {
    const configData = {
      minGrade: 'A',
      checks: { steps: { enabled: false } },
      ignore: ['**/generated/**'],
    };
    fs.writeFileSync(path.join(tmpDir, CONFIG_FILENAME), JSON.stringify(configData));
    const config = loadConfig(tmpDir);
    expect(config.minGrade).toBe('A');
    expect(config.checks.steps.enabled).toBe(false);
    expect(config.ignore).toEqual(['**/generated/**']);
  });

  test('walks up to find config in parent directory', () => {
    const subDir = path.join(tmpDir, 'sub', 'deep');
    fs.mkdirSync(subDir, { recursive: true });
    const configData = { minGrade: 'C' };
    fs.writeFileSync(path.join(tmpDir, CONFIG_FILENAME), JSON.stringify(configData));
    const config = loadConfig(subDir);
    expect(config.minGrade).toBe('C');
  });

  test('handles malformed JSON gracefully', () => {
    fs.writeFileSync(path.join(tmpDir, CONFIG_FILENAME), '{ broken json');
    const config = loadConfig(tmpDir);
    expect(config.minGrade).toBe(DEFAULTS.minGrade);
  });

  test('merges partial config with defaults', () => {
    fs.writeFileSync(path.join(tmpDir, CONFIG_FILENAME), JSON.stringify({ minGrade: 'D' }));
    const config = loadConfig(tmpDir);
    expect(config.minGrade).toBe('D');
    expect(config.checks).toEqual({});
    expect(config.ignore).toEqual([]);
  });
});

describe('shouldIgnore', () => {
  test('returns false for empty patterns', () => {
    expect(shouldIgnore('test.spec.ts', [])).toBe(false);
  });

  test('matches double-star glob patterns', () => {
    expect(shouldIgnore('src/generated/test.spec.ts', ['**/generated/**'])).toBe(true);
  });

  test('does not match unrelated paths', () => {
    expect(shouldIgnore('src/tests/login.spec.ts', ['**/generated/**'])).toBe(false);
  });

  test('matches simple wildcard patterns', () => {
    expect(shouldIgnore('output/report.html', ['output/*.html'])).toBe(true);
  });

  test('returns false when patterns is null/undefined', () => {
    expect(shouldIgnore('test.spec.ts', null)).toBe(false);
    expect(shouldIgnore('test.spec.ts', undefined)).toBe(false);
  });
});
