#!/usr/bin/env node
// Usage: qualify-leads [path/to/leads.json]
// Reads a JSON array of leads and prints them ranked, with explanations, as JSON.

import { readFile } from 'node:fs/promises';
import { qualifyLeads } from '../src/index.js';

const DEFAULT_INPUT = 'examples/sample-leads.json';

async function main() {
  const inputPath = process.argv[2] ?? DEFAULT_INPUT;

  let leads;
  try {
    leads = JSON.parse(await readFile(inputPath, 'utf8'));
  } catch (err) {
    fail(`Could not read leads from "${inputPath}": ${err.message}`);
  }

  try {
    const result = await qualifyLeads(leads);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (err) {
    fail(`Invalid input in "${inputPath}": ${err.message}`);
  }
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

main();
