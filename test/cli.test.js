'use strict';

const { execFileSync } = require('child_process');
const path = require('path');

const CLI = path.resolve(__dirname, '..', 'bin', 'qualitymax-grader.js');
const EXAMPLES = path.resolve(__dirname, '..', 'examples');
const GOOD_TEST = path.join(EXAMPLES, 'good-test.spec.ts');
const BAD_TEST = path.join(EXAMPLES, 'bad-test.spec.ts');

function run(args, opts = {}) {
  try {
    const result = execFileSync(process.execPath, [CLI, ...args], {
      encoding: 'utf-8',
      timeout: 10000,
      ...opts,
    });
    return { stdout: result, exitCode: 0 };
  } catch (err) {
    return { stdout: err.stdout || '', stderr: err.stderr || '', exitCode: err.status };
  }
}

describe('CLI', () => {
  test('--help prints usage and exits 0', () => {
    const { stdout, exitCode } = run(['--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/Usage:/);
    expect(stdout).toMatch(/qualitymax-grader/);
  });

  test('--version prints version and exits 0', () => {
    const pkg = require('../package.json');
    const { stdout, exitCode } = run(['--version']);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe(pkg.version);
  });

  test('no args exits 1', () => {
    const { exitCode } = run([]);
    expect(exitCode).toBe(1);
  });

  test('--json produces valid JSON with expected schema', () => {
    const { stdout, exitCode } = run([GOOD_TEST, '--json']);
    const data = JSON.parse(stdout);
    expect(data).toHaveProperty('version');
    expect(data).toHaveProperty('minGrade');
    expect(data).toHaveProperty('summary');
    expect(data).toHaveProperty('results');
    expect(data.summary).toHaveProperty('files');
    expect(data.summary).toHaveProperty('averageScore');
    expect(data.summary).toHaveProperty('passed');
    expect(data.summary).toHaveProperty('failed');
    expect(Array.isArray(data.results)).toBe(true);
  });

  test('--min-grade A with bad test exits 1', () => {
    const { exitCode } = run([BAD_TEST, '--min-grade', 'A']);
    expect(exitCode).toBe(1);
  });

  test('--min-grade F with any test exits 0', () => {
    const { exitCode } = run([BAD_TEST, '--min-grade', 'F']);
    expect(exitCode).toBe(0);
  });

  test('non-existent glob exits 1', () => {
    const { exitCode } = run(['nonexistent-dir-xyz/**/*.spec.ts']);
    expect(exitCode).toBe(1);
  });

  test('multiple patterns work', () => {
    const { stdout, exitCode } = run([GOOD_TEST, BAD_TEST, '--json']);
    const data = JSON.parse(stdout);
    expect(data.results.length).toBe(2);
  });

  test('--verbose includes check breakdown', () => {
    const { stdout } = run([GOOD_TEST, '--verbose', '--min-grade', 'F']);
    expect(stdout).toMatch(/Has @playwright\/test import/);
    expect(stdout).toMatch(/Has test structure/);
  });

  test('CTA only shows on failures, not when all pass', () => {
    const passing = run([GOOD_TEST, '--min-grade', 'F']);
    expect(passing.stdout).not.toMatch(/qualitymax\.io/);

    const failing = run([BAD_TEST, '--min-grade', 'A']);
    expect(failing.stdout).toMatch(/qualitymax\.io/);
  });
});
