// Regression run in a real browser, on request only (not in CI): builds the app, serves the production preview and
// runs every browser find-it script (`tools/*/find-it*.mjs`, CLAUDE.md R3) against it, one after the other.
//   pnpm regress                      build, then run every script
//   pnpm regress move-to ar           only scripts whose path contains one of the words
//   pnpm regress --no-build           reuse the existing dist/
//   pnpm regress --jobs=2             run two scripts at a time (default 1; timing-sensitive scripts are safest alone)
//   pnpm regress --list               print the scripts and stop
// Every failing check is printed the moment its script reports it (`  x <script>: <check>`) and appended to
// `regress-report/failures.txt`, so you can start fixing while the run goes on. Logs, `failures.txt` and `summary.json`
// go to `regress-report/` (ignored by git). Exit code 1 when any script fails or times out.
// A script whose header gives `VITE_SUPABASE_URL=<url> VITE_SUPABASE_ANON_KEY=<key>` needs a build with a test backend:
// it is built into `dist-online/` with those values and served on its own port; every other script uses the plain build.
// The browser: see `tools/lib/harness.mjs` (CHROMIUM_PATH, a system Chromium, or Playwright's own install).
import { spawn, spawnSync } from 'node:child_process';
import {
  appendFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  createWriteStream,
  existsSync,
} from 'node:fs';
import { join } from 'node:path';

const PORT = 4173;
const ONLINE_PORT = 4174;
const URL = `http://localhost:${PORT}/furniture-builder/`;
const ONLINE_URL = `http://localhost:${ONLINE_PORT}/furniture-builder/`;
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

/** The test backend a script's header asks for (`VITE_SUPABASE_URL=… VITE_SUPABASE_ANON_KEY=…`), or null. */
function backendOf(script) {
  const head = readFileSync(script, 'utf8').split('\n').slice(0, 25).join('\n');
  const m = head.match(/VITE_SUPABASE_URL=(\S+)\s+VITE_SUPABASE_ANON_KEY=(\S+)/);
  return m ? { VITE_SUPABASE_URL: m[1], VITE_SUPABASE_ANON_KEY: m[2] } : null;
}

const list = scripts();
const onlineScripts = list.filter((p) => backendOf(p));
const ONLINE_ENV = onlineScripts.length ? backendOf(onlineScripts[0]) : null;
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
  if (ONLINE_ENV) {
    console.log('Building the test-backend build into dist-online/ (vite build)…');
    const o = spawnSync('pnpm', ['exec', 'vite', 'build', '--outDir', 'dist-online'], {
      stdio: 'inherit',
      env: { ...process.env, ...ONLINE_ENV },
    });
    if (o.status !== 0) {
      console.error('Test-backend build failed; nothing was run.');
      process.exit(2);
    }
  }
} else if (
  !existsSync('dist/index.html') ||
  (ONLINE_ENV && !existsSync('dist-online/index.html'))
) {
  console.error('No dist/ (or dist-online/) found; run without --no-build.');
  process.exit(2);
}

const server = spawn('pnpm', ['exec', 'vite', 'preview', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
});
const onlineServer = ONLINE_ENV
  ? spawn(
      'pnpm',
      [
        'exec',
        'vite',
        'preview',
        '--outDir',
        'dist-online',
        '--port',
        String(ONLINE_PORT),
        '--strictPort',
      ],
      { stdio: 'ignore' },
    )
  : null;
const stopServer = () => {
  server.kill();
  onlineServer?.kill();
};
process.on('exit', stopServer);
process.on('SIGINT', () => process.exit(130));

async function waitForServer(url) {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}
if (!(await waitForServer(URL))) {
  console.error(`The preview did not answer at ${URL}.`);
  process.exit(2);
}
if (onlineServer && !(await waitForServer(ONLINE_URL))) {
  console.error(`The test-backend preview did not answer at ${ONLINE_URL}.`);
  process.exit(2);
}

rmSync(REPORT, { recursive: true, force: true });
mkdirSync(REPORT, { recursive: true });

const failuresFile = join(REPORT, 'failures.txt');
/** Print and record one failing item the moment it is found. */
function found(script, text) {
  const line = `  x ${script}: ${text}`;
  console.log(line);
  appendFileSync(failuresFile, line + '\n');
}
/** Call `onLine` for every complete line of a stream. */
function lines(stream, onLine) {
  let rest = '';
  stream.on('data', (chunk) => {
    rest += chunk.toString();
    const parts = rest.split('\n');
    rest = parts.pop() ?? '';
    for (const l of parts) onLine(l);
  });
  stream.on('end', () => rest && onLine(rest));
}

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
    const child = spawn(
      'node',
      [script, backendOf(script) ? ONLINE_URL : URL, join(REPORT, name)],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    child.stdout.pipe(out, { end: false });
    child.stderr.pipe(out, { end: false });
    let named = 0;
    let firstError = '';
    lines(child.stdout, (l) => {
      if (l.startsWith('FAIL')) {
        named++;
        found(script, l.slice(4).trim());
      }
    });
    lines(child.stderr, (l) => {
      if (!firstError && /Error|Timeout|timeout/.test(l)) firstError = l.trim();
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, SCRIPT_TIMEOUT_MS);
    child.on('close', (code) => {
      clearTimeout(timer);
      out.end();
      const status = timedOut ? 'timeout' : code === 0 ? 'pass' : 'fail';
      if (status !== 'pass' && (named === 0 || firstError)) {
        found(
          script,
          status === 'timeout'
            ? `no result in ${SCRIPT_TIMEOUT_MS / 1000} s`
            : firstError || `exited with code ${code}`,
        );
      }
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
