import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = fileURLToPath(new URL('..', import.meta.url));
const cli = fileURLToPath(new URL('../bin/qualify-leads.js', import.meta.url));

test('CLI prints the sample leads as ranked JSON', async () => {
  const { stdout } = await run(process.execPath, [cli, 'examples/sample-leads.json'], { cwd: root });
  const output = JSON.parse(stdout);
  assert.equal(output.count, output.leads.length);
  assert.ok(output.count >= 5, 'sample file should contain several leads');
  const scores = output.leads.filter((l) => l.tier !== 'disqualified').map((l) => l.score);
  assert.deepEqual([...scores].sort((a, b) => b - a), scores);
  for (const lead of output.leads) {
    assert.ok(lead.priorityReason, `${lead.id} needs a priority reason`);
  }
});

test('CLI defaults to examples/sample-leads.json when no path is given', async () => {
  const { stdout } = await run(process.execPath, [cli], { cwd: root });
  assert.ok(JSON.parse(stdout).count >= 5);
});

test('CLI output matches the committed examples/sample-output.json', async () => {
  const { stdout } = await run(process.execPath, [cli, 'examples/sample-leads.json'], { cwd: root });
  const expected = await readFile(new URL('../examples/sample-output.json', import.meta.url), 'utf8');
  assert.deepEqual(JSON.parse(stdout), JSON.parse(expected));
});

test('CLI exits with code 1 and a readable message for a missing file', async () => {
  await assert.rejects(run(process.execPath, [cli, 'does-not-exist.json'], { cwd: root }), (err) => {
    assert.equal(err.code, 1);
    assert.match(err.stderr, /could not read/i);
    return true;
  });
});

test('CLI exits with code 1 when the file is not an array of leads', async () => {
  await assert.rejects(run(process.execPath, [cli, 'package.json'], { cwd: root }), (err) => {
    assert.equal(err.code, 1);
    assert.match(err.stderr, /array of leads/i);
    return true;
  });
});
