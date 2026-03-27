'use strict';

/**
 * Output formatters for qualitymax-grader.
 * Converts grade results to JUnit XML and SARIF v2.1.0 formats.
 */

/**
 * Escape XML special characters.
 */
function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Convert grade results to JUnit XML format.
 *
 * @param {{ minGrade: string, summary: object, results: Array }} data - Full grader output
 * @returns {string} JUnit XML string
 */
function toJUnit(data) {
  const { summary, results } = data;
  const lines = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<testsuites name="qualitymax-grader" tests="${summary.files}" failures="${summary.failed}" time="0">`);
  lines.push(`  <testsuite name="test-quality" tests="${summary.files}" failures="${summary.failed}">`);

  for (const r of results) {
    const name = escapeXml(r.file);
    lines.push(`    <testcase name="${name}" classname="qualitymax-grader" time="0">`);

    if (!r.passed) {
      const message = escapeXml(`Grade ${r.grade} (${r.score}/100) below minimum`);
      const details = r.issues.map(i => escapeXml(i)).join('\n');
      lines.push(`      <failure message="${message}">${details}</failure>`);
    }

    // Always include grade info as a property
    lines.push('      <properties>');
    lines.push(`        <property name="grade" value="${escapeXml(r.grade)}" />`);
    lines.push(`        <property name="score" value="${r.score}" />`);
    lines.push('      </properties>');

    lines.push('    </testcase>');
  }

  lines.push('  </testsuite>');
  lines.push('</testsuites>');

  return lines.join('\n');
}

/**
 * Convert grade results to SARIF v2.1.0 format.
 *
 * @param {{ version: string, minGrade: string, summary: object, results: Array }} data - Full grader output
 * @returns {string} SARIF JSON string
 */
function toSarif(data) {
  const { results } = data;
  const toolVersion = data.version || '0.2.0';

  // Collect all unique rule IDs from all results
  const ruleMap = new Map();
  for (const r of results) {
    for (const check of (r.checks || [])) {
      if (!check.passed && !ruleMap.has(check.id)) {
        ruleMap.set(check.id, {
          id: check.id,
          shortDescription: { text: check.name },
          helpUri: 'https://github.com/Quality-Max/qualitymax-grader#what-it-checks',
          properties: {
            maxPoints: check.maxPoints,
          },
        });
      }
    }
  }

  const sarifResults = [];
  for (const r of results) {
    for (const check of (r.checks || [])) {
      if (!check.passed) {
        const result = {
          ruleId: check.id,
          level: check.earned < 0 ? 'error' : 'warning',
          message: {
            text: check.issue || check.name,
          },
          locations: [
            {
              physicalLocation: {
                artifactLocation: {
                  uri: r.file,
                },
              },
            },
          ],
          properties: {
            grade: r.grade,
            score: r.score,
            earned: check.earned,
            maxPoints: check.maxPoints,
          },
        };
        if (check.suggestion) {
          result.fixes = [
            {
              description: { text: check.suggestion },
            },
          ];
        }
        sarifResults.push(result);
      }
    }
  }

  const sarif = {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'qualitymax-grader',
            semanticVersion: toolVersion,
            informationUri: 'https://github.com/Quality-Max/qualitymax-grader',
            rules: [...ruleMap.values()],
          },
        },
        results: sarifResults,
      },
    ],
  };

  return JSON.stringify(sarif, null, 2);
}

module.exports = { toJUnit, toSarif };
