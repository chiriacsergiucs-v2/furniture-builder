// Regression run in a real browser, on request only (not in CI): builds the app, serves the production preview and
// runs every browser find-it script (`tools/*/find-it*.mjs`, CLAUDE.md R3) against it, one after the other.
//   pnpm regress                      build, then run every script
//   pnpm regress move-to ar           only scripts whose path contains one of the words
//   pnpm regress --no-build           reuse the existing dist/
//   pnpm regress --jobs=2             run two scripts at a time (default 1; timing-sensitive scripts are safest alone)
//   pnpm regress --list               print the scripts and stop
// Logs and `summary.json` go to `regress-report/` (ignored by git). Exit code 1 when any script fails or times out.
// The browser: see `tools/lib/harness.mjs` (CHROMIUM_PATH, a system Chromium, or Playwright's own install).
import { spawn, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
  createWriteStream,
  existsSync,
} from 'node:fs';
import { join } from 'node:path';

const PORT = 4173;
const URL = `http://localhost:${PORT}/furniture-builder/`;
const REPORT = 'regress-report';
const SCRIPT_TIMEOUT_MS = 5 * 60 * 1000;

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const words = args.filter((a) => !a.startsWith('--'));
const jobs = Math.max(1, Number([...flags].find((f) => f.startsWith('--jobs='))?.slice(7)) || 1);

/** Every browser script: `tools/<area>/find-it*.mjs`, sorted by path. */
function scripts() {
  const found = [];
  for (const area of readdirSync('tools', { withFileTypes: true })) {
    if (!area.isDirectory()) continue;
    for (const f of readdirSync(join('tools', area.name))) {
      if (/^find-it.*\.mjs$/.test(f)) found.push(join('tools', area.name, f));
    }
  }
  return found.sort().filter((p) => words.length === 0 || words.some((w) => p.includes(w)));
}

const list = scripts();
if (flags.has('--list')) {
  console.log(list.join('\n'));
  process.exit(0);
}
if (list.length === 0) {
  console.error(`No script matches: ${words.join(' ')}`);
  process.exit(2);
}

if (!flags.has('--no-build')) {
  console.log('Building (vite build)…');
  const b = spawnSync('pnpm', ['build:ci'], { stdio: 'inherit' });
  if (b.status !== 0) {
    console.error('Build failed; nothing was run.');
    process.exit(2);
  }
} else if (!existsSync('dist/index.html')) {
  console.error('No dist/ found; run without --no-build.');
  process.exit(2);
}

const server = spawn('pnpm', ['exec', 'vite', 'preview', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
});
const stopServer = () => server.kill();
process.on('exit', stopServer);
process.on('SIGINT', () => process.exit(130));

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(URL)).ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}
if (!(await waitForServer())) {
  console.error(`The preview did not answer at ${URL}.`);
  process.exit(2);
}

rmSync(REPORT, { recursive: true, force: true });
mkdirSync(REPORT, { recursive: true });

/** Run one script; resolves with its status, time and log path. */
function run(script) {
  return new Promise((resolve) => {
    const name = script
      .replace(/^tools\//, '')
      .replace(/\//g, '__')
      .replace(/\.mjs$/, '');
    const log = join(REPORT, `${name}.log`);
    const out = createWriteStream(log);
    const started = Date.now();
    const child = spawn('node', [script, URL, join(REPORT, name)], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.pipe(out, { end: false });
    child.stderr.pipe(out, { end: false });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, SCRIPT_TIMEOUT_MS);
    child.on('close', (code) => {
      clearTimeout(timer);
      out.end();
      const status = timedOut ? 'timeout' : code === 0 ? 'pass' : 'fail';
      resolve({ script, status, seconds: Math.round((Date.now() - started) / 100) / 10, log });
    });
  });
}

const results = new Array(list.length);
let next = 0;
let finished = 0;
async function worker() {
  while (next < list.length) {
    const i = next++;
    const r = await run(list[i]);
    results[i] = r;
    finished++;
    console.log(
      `[${finished}/${list.length}] ${r.status.toUpperCase().padEnd(7)} ${r.seconds}s  ${list[i]}`,
    );
  }
}
await Promise.all(Array.from({ length: Math.min(jobs, list.length) }, worker));

const bad = results.filter((r) => r.status !== 'pass');
writeFileSync(join(REPORT, 'summary.json'), JSON.stringify({ url: URL, results }, null, 2));
console.log(`\n${results.length - bad.length}/${results.length} scripts passed.`);
for (const r of bad) console.log(`  ${r.status.toUpperCase()}: ${r.script} → ${r.log}`);
process.exit(bad.length ? 1 : 0);
