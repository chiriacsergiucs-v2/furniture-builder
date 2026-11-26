#!/usr/bin/env node
// Runs the `- Command:` checks of a goal file (see SKILL.md) and reports pass/fail.
// Usage: node run-checks.mjs goals/<name>.md [--timeout <minutes>] [--out <file>]
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args.splice(i, 2)[1];
};
const timeoutMin = Number(flag('--timeout') ?? 15);
const outFlag = flag('--out');
const goalPath = args[0];
if (!goalPath || !Number.isFinite(timeoutMin) || timeoutMin <= 0) {
  console.error('Usage: run-checks.mjs goals/<name>.md [--timeout <minutes>] [--out <file>]');
  process.exit(2);
}

/** Parse the numbered list under `## Checks`. */
function parseChecks(markdown) {
  const section = markdown.split(/^## Checks\s*$/m)[1]?.split(/^## /m)[0] ?? '';
  const checks = [];
  let current;
  for (const line of section.split('\n')) {
    const head = line.match(/^\s*\d+\.\s+(?:\*\*)?(C\d+)(?:\*\*)?\s*[:.\-–]?\s*(.*)$/);
    if (head) {
      current = { id: head[1], statement: head[2].trim() };
      checks.push(current);
      continue;
    }
    const field = line.match(/^\s*-\s+(Command|Evidence|Fix agent):\s*(.*)$/);
    if (current && field) {
      const key = field[1] === 'Fix agent' ? 'fixAgent' : field[1].toLowerCase();
      current[key] = field[2].trim().replace(/^`([\s\S]*)`$/, '$1');
    }
  }
  return checks;
}

const name = basename(goalPath, '.md');
const checks = parseChecks(readFileSync(goalPath, 'utf8'));
if (checks.length === 0) {
  console.error(`No checks found under "## Checks" in ${goalPath}`);
  process.exit(2);
}

const results = checks.map((check) => {
  if (!check.command) {
    return {
      id: check.id,
      statement: check.statement,
      command: null,
      exitCode: null,
      pass: null,
      status: 'manual',
      tail: check.evidence ?? '',
    };
  }
  console.error(`[${check.id}] ${check.command}`);
  const run = spawnSync('bash', ['-c', check.command], {
    encoding: 'utf8',
    timeout: timeoutMin * 60_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  const timedOut = run.error?.code === 'ETIMEDOUT';
  const exitCode = run.status ?? (timedOut ? 124 : 1);
  const output = `${run.stdout ?? ''}${run.stderr ?? ''}${timedOut ? `\n(timed out after ${timeoutMin} min)` : ''}`;
  const tail = output.trimEnd().split('\n').slice(-20).join('\n');
  const pass = exitCode === 0;
  return {
    id: check.id,
    statement: check.statement,
    command: check.command,
    exitCode,
    pass,
    status: pass ? 'PASS' : 'FAIL',
    tail,
  };
});

const outPath = outFlag ?? `goals/reports/${name}-checks.json`;
mkdirSync(dirname(outPath), { recursive: true });
const json = results.map(({ status, ...rest }) => rest);
writeFileSync(outPath, `${JSON.stringify(json, null, 2)}\n`);

console.log(JSON.stringify(json, null, 2));
console.log('\n| Check | Statement | Result | Exit |\n| --- | --- | --- | --- |');
for (const r of results) {
  console.log(
    `| ${r.id} | ${r.statement.replace(/\|/g, '\\|')} | ${r.status} | ${r.exitCode ?? '-'} |`,
  );
}
console.log(`\nWrote ${outPath}`);
process.exit(results.some((r) => r.pass === false) ? 1 : 0);
