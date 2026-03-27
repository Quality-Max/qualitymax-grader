#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');
const { gradeTest } = require('../lib/grader');

const VERSION = require('../package.json').version;

// ── Colors ──────────────────────────────────────────────────────────────

const color = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  blue:    '\x1b[34m',
  magenta: '\x1b[35m',
  cyan:    '\x1b[36m',
  white:   '\x1b[37m',
  bgRed:   '\x1b[41m',
  bgGreen: '\x1b[42m',
};

function gradeColor(grade) {
  switch (grade) {
    case 'A': return color.green;
    case 'B': return color.cyan;
    case 'C': return color.yellow;
    case 'D': return color.magenta;
    case 'F': return color.red;
    default:  return color.white;
  }
}

// ── CLI Argument Parsing ────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    patterns: [],
    minGrade: 'B',
    json: false,
    verbose: false,
    help: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--json') {
      args.json = true;
    } else if (arg === '--verbose' || arg === '-v') {
      args.verbose = true;
    } else if (arg === '--min-grade') {
      args.minGrade = (argv[++i] || 'B').toUpperCase();
    } else if (arg.startsWith('--min-grade=')) {
      args.minGrade = arg.split('=')[1].toUpperCase();
    } else if (!arg.startsWith('-')) {
      args.patterns.push(arg);
    }
  }

  return args;
}

function showHelp() {
  console.log(`
  ${color.bold}qualitymax-grader${color.reset} v${VERSION}
  ${color.dim}Lighthouse for test quality.${color.reset}

  ${color.bold}Usage:${color.reset}
    qualitymax-grader <glob-patterns...> [options]

  ${color.bold}Examples:${color.reset}
    qualitymax-grader tests/**/*.spec.ts
    qualitymax-grader tests/*.spec.ts --min-grade A --verbose
    qualitymax-grader tests/ --json

  ${color.bold}Options:${color.reset}
    --min-grade <grade>   Minimum passing grade (A/B/C/D/F). Default: B
    --json                Output results as JSON (for CI)
    --verbose, -v         Show per-check breakdown for each file
    --help, -h            Show this help message

  ${color.bold}Grade scale:${color.reset}
    ${color.green}A${color.reset} = 90-100    ${color.cyan}B${color.reset} = 75-89    ${color.yellow}C${color.reset} = 60-74    ${color.magenta}D${color.reset} = 40-59    ${color.red}F${color.reset} = 0-39
`);
}

// ── Grade Comparison ────────────────────────────────────────────────────

const GRADE_ORDER = { A: 5, B: 4, C: 3, D: 2, F: 1 };

function meetsMinGrade(grade, minGrade) {
  return (GRADE_ORDER[grade] || 0) >= (GRADE_ORDER[minGrade] || 0);
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  if (args.patterns.length === 0) {
    showHelp();
    process.exit(1);
  }

  // Resolve file list from glob patterns
  let files = [];
  for (const pattern of args.patterns) {
    const matches = await glob(pattern, { nodir: true });
    files.push(...matches);
  }

  // Deduplicate and sort
  files = [...new Set(files)].sort();

  if (files.length === 0) {
    if (args.json) {
      console.log(JSON.stringify({ error: 'No files matched the given patterns', files: [] }));
    } else {
      console.error(`\n  ${color.red}No files matched the given patterns.${color.reset}\n`);
    }
    process.exit(1);
  }

  // Grade each file
  const results = [];
  for (const file of files) {
    const code = fs.readFileSync(file, 'utf-8');
    const result = gradeTest(code, file);
    result.file = file;
    result.passed = meetsMinGrade(result.grade, args.minGrade);
    results.push(result);
  }

  // JSON output mode
  if (args.json) {
    const totalScore = results.reduce((sum, r) => sum + r.score, 0);
    const avgScore = Math.round(totalScore / results.length);
    const passed = results.filter(r => r.passed).length;
    const failed = results.length - passed;

    const output = {
      version: VERSION,
      minGrade: args.minGrade,
      summary: {
        files: results.length,
        averageScore: avgScore,
        averageGrade: require('../lib/grader').scoreToGrade(avgScore),
        passed,
        failed,
      },
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
    process.exit(failed > 0 ? 1 : 0);
  }

  // ── Pretty Output ──────────────────────────────────────────────────

  console.log(`\n  ${color.bold}qualitymax-grader${color.reset} v${VERSION}\n`);

  let maxFileLen = 0;
  for (const r of results) {
    const displayPath = path.relative(process.cwd(), r.file) || r.file;
    if (displayPath.length > maxFileLen) maxFileLen = displayPath.length;
  }

  for (const r of results) {
    const displayPath = path.relative(process.cwd(), r.file) || r.file;
    const padded = displayPath.padEnd(maxFileLen + 2);
    const gc = gradeColor(r.grade);
    const icon = r.passed ? `${color.green}\u2713${color.reset}` : `${color.red}\u2717${color.reset}`;
    const topIssue = r.issues.length > 0 && !r.passed ? `  ${color.dim}${r.issues[0]}${color.reset}` : '';

    console.log(`  ${padded} ${gc}${color.bold}${r.grade}${color.reset}  ${color.dim}(${r.score}/100)${color.reset}  ${icon}${topIssue}`);

    if (args.verbose) {
      for (const check of r.checks) {
        const checkIcon = check.passed ? `${color.green}\u2713${color.reset}` : `${color.red}\u2717${color.reset}`;
        const pts = check.earned >= 0
          ? `${color.dim}${check.earned}/${check.maxPoints}${color.reset}`
          : `${color.red}${check.earned}${color.reset}`;
        const checkIssue = check.issue ? `  ${color.dim}${check.issue}${color.reset}` : '';
        console.log(`    ${checkIcon} ${check.name} ${pts}${checkIssue}`);
      }
      console.log();
    }
  }

  // Summary
  const totalScore = results.reduce((sum, r) => sum + r.score, 0);
  const avgScore = Math.round(totalScore / results.length);
  const avgGrade = require('../lib/grader').scoreToGrade(avgScore);
  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;

  console.log();
  console.log(`  ${color.bold}Summary:${color.reset} ${results.length} files graded | Average: ${gradeColor(avgGrade)}${avgGrade}${color.reset} (${avgScore}/100) | ${color.green}Passed: ${passed}${color.reset} | ${color.red}Failed: ${failed}${color.reset}`);
  console.log();
  console.log(`  ${color.dim}Fix low grades automatically \u2192${color.reset} ${color.cyan}${color.bold}https://qualitymax.io${color.reset}`);
  console.log();

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
