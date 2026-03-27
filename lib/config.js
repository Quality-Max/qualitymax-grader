'use strict';

const fs = require('fs');
const path = require('path');

const CONFIG_FILENAME = '.qualitymaxrc.json';

const DEFAULTS = {
  minGrade: 'B',
  checks: {},
  ignore: [],
};

/**
 * Walk up from cwd looking for .qualitymaxrc.json.
 * Returns merged config with defaults.
 *
 * @param {string} cwd - Starting directory
 * @returns {{ minGrade: string, checks: object, ignore: string[] }}
 */
function loadConfig(cwd) {
  let dir = path.resolve(cwd);
  const root = path.parse(dir).root;

  while (dir !== root) {
    const configPath = path.join(dir, CONFIG_FILENAME);
    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          minGrade: parsed.minGrade || DEFAULTS.minGrade,
          checks: { ...DEFAULTS.checks, ...parsed.checks },
          ignore: parsed.ignore || DEFAULTS.ignore,
        };
      } catch (err) {
        // Malformed config — fall through to defaults
        return { ...DEFAULTS };
      }
    }
    dir = path.dirname(dir);
  }

  return { ...DEFAULTS };
}

/**
 * Check if a file path matches any of the ignore patterns.
 * Supports simple glob patterns with ** and *.
 *
 * @param {string} filePath - File path to check
 * @param {string[]} ignorePatterns - Array of glob-like patterns
 * @returns {boolean}
 */
function shouldIgnore(filePath, ignorePatterns) {
  if (!ignorePatterns || ignorePatterns.length === 0) return false;

  const normalized = filePath.replace(/\\/g, '/');

  for (const pattern of ignorePatterns) {
    const regexStr = pattern
      .replace(/\\/g, '/')
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '{{GLOBSTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/\{\{GLOBSTAR\}\}/g, '.*');
    const regex = new RegExp(regexStr);
    if (regex.test(normalized)) return true;
  }

  return false;
}

module.exports = { loadConfig, shouldIgnore, DEFAULTS, CONFIG_FILENAME };
