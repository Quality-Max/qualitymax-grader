'use strict';

const fs = require('fs');
const path = require('path');
const QualityMaxReporter = require('../lib/reporter');

const GOOD_TEST_PATH = path.resolve(__dirname, '..', 'examples', 'good-test.spec.ts');
const BAD_TEST_PATH = path.resolve(__dirname, '..', 'examples', 'bad-test.spec.ts');

function makeSuite(filePaths) {
  return {
    tests: filePaths.map(f => ({ location: { file: f } })),
    suites: [],
  };
}

describe('QualityMaxReporter', () => {
  let originalLog;
  let logOutput;
  let originalExitCode;

  beforeEach(() => {
    originalLog = console.log;
    logOutput = [];
    console.log = (...args) => logOutput.push(args.join(' '));
    originalExitCode = process.exitCode;
  });

  afterEach(() => {
    console.log = originalLog;
    process.exitCode = originalExitCode;
  });

  test('collects test files from suite in onBegin', () => {
    const reporter = new QualityMaxReporter();
    const suite = makeSuite([GOOD_TEST_PATH, BAD_TEST_PATH]);
    reporter.onBegin({}, suite);
    expect(reporter.testFiles.size).toBe(2);
    expect(reporter.testFiles.has(GOOD_TEST_PATH)).toBe(true);
    expect(reporter.testFiles.has(BAD_TEST_PATH)).toBe(true);
  });

  test('collects files from nested suites', () => {
    const reporter = new QualityMaxReporter();
    const suite = {
      tests: [{ location: { file: GOOD_TEST_PATH } }],
      suites: [{
        tests: [{ location: { file: BAD_TEST_PATH } }],
        suites: [],
      }],
    };
    reporter.onBegin({}, suite);
    expect(reporter.testFiles.size).toBe(2);
  });

  test('onEnd grades files and outputs summary', () => {
    const reporter = new QualityMaxReporter({ minGrade: 'F' });
    reporter.testFiles = new Set([GOOD_TEST_PATH]);
    reporter.onEnd({});
    const output = logOutput.join('\n');
    expect(output).toMatch(/good-test\.spec\.ts/);
    expect(output).toMatch(/Summary/);
  });

  test('onEnd sets process.exitCode = 1 when files fail min-grade', () => {
    const reporter = new QualityMaxReporter({ minGrade: 'A' });
    reporter.testFiles = new Set([BAD_TEST_PATH]);
    reporter.onEnd({});
    expect(process.exitCode).toBe(1);
  });

  test('json mode outputs valid JSON', () => {
    const reporter = new QualityMaxReporter({ minGrade: 'F', json: true });
    reporter.testFiles = new Set([GOOD_TEST_PATH]);
    reporter.onEnd({});
    const jsonStr = logOutput.join('\n');
    const data = JSON.parse(jsonStr);
    expect(data).toHaveProperty('summary');
    expect(data).toHaveProperty('results');
    expect(data.results.length).toBe(1);
  });

  test('handles empty suite gracefully', () => {
    const reporter = new QualityMaxReporter();
    reporter.onBegin({}, { tests: [], suites: [] });
    reporter.onEnd({});
    expect(logOutput.length).toBe(0);
  });

  test('accepts minGrade option', () => {
    const reporter = new QualityMaxReporter({ minGrade: 'C' });
    expect(reporter.minGrade).toBe('C');
  });

  test('defaults minGrade to B', () => {
    const reporter = new QualityMaxReporter();
    expect(reporter.minGrade).toBe('B');
  });
});
