#!/usr/bin/env node
'use strict';

/**
 * Benchmark script: grades Playwright tests from popular open-source repos.
 *
 * Usage: node scripts/benchmark.js
 *
 * Clones each repo shallow, finds *.spec.ts files, grades them, and outputs CSV.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { glob } = require('glob');
const { gradeTest, scoreToGrade } = require('../lib/grader');

const REPOS = [
  { name: 'playwright',    url: 'https://github.com/microsoft/playwright.git',       testGlob: 'tests/**/*.spec.ts' },
  { name: 'supabase',      url: 'https://github.com/supabase/supabase.git',          testGlob: '**/*.spec.ts' },
  { name: 'cal.com',       url: 'https://github.com/calcom/cal.com.git',             testGlob: '**/*.spec.ts' },
  { name: 'twenty',        url: 'https://github.com/twentyhq/twenty.git',            testGlob: '**/*.spec.ts' },
  { name: 'documenso',     url: 'https://github.com/documenso/documenso.git',        testGlob: '**/*.spec.ts' },
  { name: 'formbricks',    url: 'https://github.com/formbricks/formbricks.git',      testGlob: '**/*.spec.ts' },
  { name: 'maybe-finance', url: 'https://github.com/maybe-finance/maybe.git',        testGlob: '**/*.spec.ts' },
  { name: 'papermark',     url: 'https://github.com/mfts/papermark.git',             testGlob: '**/*.spec.ts' },
  { name: 'trigger-dev',   url: 'https://github.com/triggerdotdev/trigger.dev.git',  testGlob: '**/*.spec.ts' },
  { name: 'infisical',     url: 'https://github.com/Infisical/infisical.git',        testGlob: '**/*.spec.ts' },
];

const WORK_DIR = path.join(require('os').tmpdir(), 'qualitymax-benchmark');
const MAX_FILES = 50; // Cap per repo to keep runtime reasonable

async function benchmarkRepo(repo) {
  const repoDir = path.join(WORK_DIR, repo.name);
  const result = { name: repo.name, files: 0, avgScore: 0, avgGrade: 'N/A', topIssues: '' };

  try {
    // Clone shallow if not already present
    if (!fs.existsSync(repoDir)) {
      console.error(`  Cloning ${repo.name}...`);
      execSync(`git clone --depth 1 --filter=blob:none --sparse "${repo.url}" "${repoDir}"`, {
        stdio: 'pipe',
        timeout: 60000,
      });
      // Sparse checkout only test files
      try {
        execSync(`cd "${repoDir}" && git sparse-checkout set --no-cone '*.spec.ts'`, {
          stdio: 'pipe',
          timeout: 30000,
        });
      } catch {
        // sparse checkout may fail on older git; fall back to full clone
      }
    }

    // Find spec files
    let files = await glob(repo.testGlob, { cwd: repoDir, nodir: true, absolute: true });

    if (files.length === 0) {
      console.error(`  No test files found in ${repo.name}`);
      return result;
    }

    // Cap file count
    if (files.length > MAX_FILES) {
      files = files.slice(0, MAX_FILES);
    }

    console.error(`  Grading ${files.length} files in ${repo.name}...`);

    // Grade each file
    const issueCounts = {};
    let totalScore = 0;

    for (const file of files) {
      try {
        const code = fs.readFileSync(file, 'utf-8');
        const grade = gradeTest(code, file);
        totalScore += grade.score;

        for (const issue of grade.issues) {
          // Normalize issue text to group similar ones
          const key = issue.replace(/\(\d+x?\)/, '').replace(/\(-?\d+pts?\)/, '').trim();
          issueCounts[key] = (issueCounts[key] || 0) + 1;
        }
      } catch {
        // Skip files that can't be read
      }
    }

    result.files = files.length;
    result.avgScore = Math.round(totalScore / files.length);
    result.avgGrade = scoreToGrade(result.avgScore);

    // Top 3 issues
    const sortedIssues = Object.entries(issueCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([issue, count]) => `${issue} (${count}x)`)
      .join('; ');
    result.topIssues = sortedIssues || 'None';

  } catch (err) {
    console.error(`  Error with ${repo.name}: ${err.message}`);
    result.topIssues = `Error: ${err.message.slice(0, 80)}`;
  }

  return result;
}

async function main() {
  // Ensure work directory exists
  if (!fs.existsSync(WORK_DIR)) {
    fs.mkdirSync(WORK_DIR, { recursive: true });
  }

  console.error(`\nQualityMax Grader Benchmark`);
  console.error(`Working directory: ${WORK_DIR}\n`);

  // CSV header
  console.log('repo,files,avg_score,avg_grade,top_issues');

  for (const repo of REPOS) {
    const result = await benchmarkRepo(repo);
    const escapedIssues = `"${result.topIssues.replace(/"/g, '""')}"`;
    console.log(`${result.name},${result.files},${result.avgScore},${result.avgGrade},${escapedIssues}`);
  }

  console.error('\nBenchmark complete.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
