'use strict';

const fs = require('fs');
const path = require('path');
const { gradeTest, scoreToGrade } = require('./grader');

const GRADE_ORDER = { A: 5, B: 4, C: 3, D: 2, F: 1 };

function meetsMinGrade(grade, minGrade) {
  return (GRADE_ORDER[grade] || 0) >= (GRADE_ORDER[minGrade] || 0);
}

/**
 * Playwright reporter that grades test files A-F.
 *
 * Usage in playwright.config.ts:
 *   reporter: [['qualitymax-grader/reporter', { minGrade: 'B' }]]
 */
class QualityMaxReporter {
  constructor(options = {}) {
    this.minGrade = options.minGrade || 'B';
    this.verbose = options.verbose || false;
    this.json = options.json || false;
    this.testFiles = new Set();
  }

  /**
   * Collect all test file paths from the suite.
   */
  onBegin(_config, suite) {
    this._collectFiles(suite);
  }

  _collectFiles(suite) {
    if (suite.tests) {
      for (const test of suite.tests) {
        if (test.location && test.location.file) {
          this.testFiles.add(test.location.file);
        }
      }
    }
    if (suite.suites) {
      for (const child of suite.suites) {
        this._collectFiles(child);
      }
    }
  }

  /**
   * Grade all collected test files and output summary.
   */
  onEnd(_result) {
    const files = [...this.testFiles].sort();
    if (files.length === 0) return;

    const results = [];
    let anyFailed = false;

    for (const file of files) {
      let code;
      try {
        code = fs.readFileSync(file, 'utf-8');
      } catch {
        continue;
      }

      const result = gradeTest(code, file);
      result.file = file;
      result.passed = meetsMinGrade(result.grade, this.minGrade);
      if (!result.passed) anyFailed = true;
      results.push(result);
    }

    if (results.length === 0) return;

    const totalScore = results.reduce((sum, r) => sum + r.score, 0);
    const avgScore = Math.round(totalScore / results.length);
    const avgGrade = scoreToGrade(avgScore);
    const passed = results.filter(r => r.passed).length;
    const failed = results.length - passed;

    if (this.json) {
      const output = {
        minGrade: this.minGrade,
        summary: { files: results.length, averageScore: avgScore, averageGrade: avgGrade, passed, failed },
        results: results.map(r => ({
          file: r.file,
          score: r.score,
          grade: r.grade,
          passed: r.passed,
          issues: r.issues,
          checks: r.checks,
        })),
      };
      console.log(JSON.stringify(output, null, 2));
    } else {
      console.log('\n  qualitymax-grader\n');
      for (const r of results) {
        const displayPath = path.relative(process.cwd(), r.file) || r.file;
        const icon = r.passed ? '\u2713' : '\u2717';
        console.log(`  ${displayPath}  ${r.grade}  (${r.score}/100)  ${icon}`);

        if (this.verbose) {
          for (const check of r.checks) {
            const checkIcon = check.passed ? '\u2713' : '\u2717';
            const pts = check.earned >= 0 ? `${check.earned}/${check.maxPoints}` : `${check.earned}`;
            const checkIssue = check.issue ? `  ${check.issue}` : '';
            console.log(`    ${checkIcon} ${check.name} ${pts}${checkIssue}`);
          }
        }
      }
      console.log(`\n  Summary: ${results.length} files | Average: ${avgGrade} (${avgScore}/100) | Passed: ${passed} | Failed: ${failed}\n`);
    }

    if (anyFailed) {
      process.exitCode = 1;
    }
  }
}

module.exports = QualityMaxReporter;
