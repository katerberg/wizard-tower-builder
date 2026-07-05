#!/usr/bin/env node
/**
 * Print ESLint JSON results in a readable form. Avoids the stylish formatter,
 * which requires Node 20+ (util.styleText).
 */
import { readFileSync } from 'node:fs';

const input = readFileSync(0, 'utf8').trim();
if (!input) {
  process.exit(0);
}

const results = JSON.parse(input);
let errorCount = 0;

for (const file of results) {
  for (const message of file.messages) {
    if (message.severity !== 2) continue;
    errorCount += 1;
    const location = `${file.filePath}:${message.line}:${message.column}`;
    process.stderr.write(`${location}  ${message.message}  (${message.ruleId})\n`);
  }
}

if (errorCount > 0) {
  process.stderr.write(`\n✖ ${errorCount} error(s)\n`);
  process.exit(1);
}
