// Drag performance of the 3D view on a phone (user report 2026-11-26: orbiting the 3D view on an Android phone lags).
// Opens a new chest of drawers at 390 × 844, shows the 3D view, and measures four runs: idle (no input) and a 3-second
// scripted orbit drag on the canvas, each with 4× CPU throttling and without. Per run it reports the page's
// requestAnimationFrame rate (fps), the long tasks (PerformanceObserver 'longtask', > 50 ms) and the longest one, and
// the main-thread busy time from a CPU profile (ms per frame), so main-thread cost can be told apart from GPU cost.
// Headless Chromium draws WebGL with SwiftShader (software, on the CPU, in the GPU process, which CDP throttling does
// not slow down), so absolute fps is pessimistic next to a real phone GPU. Asserts nothing; on demand only.
//   pnpm build:ci && pnpm preview &  node tools/mobile-middle/drag-perf.mjs [url] [3D|Both] [--json] [--assert] [--profile <file>]
// `--assert` exits 1 unless the throttled (4×) drag averages at least 50 fps with no long task over 50 ms.
// `--profile <file>` saves the CPU profile of the throttled drag (.cpuprofile, opens in Chrome DevTools) and prints the
// top self-time functions.
import { writeFileSync } from 'node:fs';
import { launchBrowser, PREVIEW_URL } from '../lib/harness.mjs';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const option = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const profileOut = option('--profile');
const positional = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--profile');
const url = positional[0] ?? PREVIEW_URL;
const view = positional[1] ?? '3D';
const json = flag('--json');
const DRAG_MS = 3000;
const IDLE_MS = 2000;

const browser = await launchBrowser({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
await page.goto(url);
await page.getByRole('button', { name: 'New single piece' }).click();
await page
  .locator('dialog[open]')
  .getByRole('button', { name: /Chest of drawers/ })
  .first()
  .click();
await page.locator('main.work').waitFor();
const hints = page.getByRole('dialog', { name: 'Getting started' });
if (await hints.isVisible().catch(() => false))
  await hints.getByRole('button', { name: 'Skip' }).click();
await page.getByRole('radio', { name: view }).click();
await page.waitForTimeout(3000);
const box = await page.locator('canvas').first().boundingBox();
if (!box) throw new Error('No 3D canvas found');
const cdp = await ctx.newCDPSession(page);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 200 });

/** Main-thread busy time (ms) of a profile: every sample that is not idle, program or GC-free waiting. */
function busyMs(profile) {
  const idle = new Set(
    profile.nodes.filter((n) => n.callFrame.functionName === '(idle)').map((n) => n.id),
  );
  let busy = 0;
  profile.samples.forEach((id, i) => {
    if (!idle.has(id)) busy += profile.timeDeltas[i] ?? 0;
  });
  return busy / 1000;
}

/** The top self-time functions of a profile: name, url:line and ms. */
function topSelf(profile, n = 25) {
  const byId = new Map(profile.nodes.map((nd) => [nd.id, nd]));
  const self = new Map();
  profile.samples.forEach((id, i) => {
    self.set(id, (self.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0));
  });
  const agg = new Map();
  for (const [id, us] of self) {
    const f = byId.get(id).callFrame;
    const key = `${f.functionName || '(anonymous)'} ${f.url.split('/').pop()}:${f.lineNumber + 1}:${f.columnNumber + 1}`;
    agg.set(key, (agg.get(key) ?? 0) + us);
  }
  return [...agg]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, us]) => ({ name, ms: +(us / 1000).toFixed(1) }));
}

async function run({ throttle, drag }) {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.__lt = [];
    window.__obs?.disconnect();
    window.__obs = new PerformanceObserver((l) =>
      l.getEntries().forEach((e) => window.__lt.push(e.duration)),
    );
    window.__obs.observe({ type: 'longtask' });
    window.__f = 0;
    window.__run = true;
    const tick = () => {
      if (!window.__run) return;
      window.__f++;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.__t0 = performance.now();
  });
  await cdp.send('Profiler.start');
  let moves = 0;
  if (drag) {
    const cx = box.x + box.width / 2,
      cy = box.y + box.height / 2;
    await page.mouse.move(cx - 60, cy);
    await page.mouse.down();
    const t0 = Date.now();
    while (Date.now() - t0 < DRAG_MS) {
      moves++;
      await page.mouse.move(cx - 60 + ((moves * 4) % 120), cy + Math.sin(moves / 10) * 20);
    }
    await page.mouse.up();
  } else {
    await page.waitForTimeout(IDLE_MS);
  }
  const { profile } = await cdp.send('Profiler.stop');
  const r = await page.evaluate(() => {
    window.__run = false;
    const dt = performance.now() - window.__t0;
    return {
      frames: window.__f,
      ms: Math.round(dt),
      longTasks: window.__lt.length,
      maxLongTask: Math.round(Math.max(0, ...window.__lt)),
    };
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  // Let damping settle so the next run starts still.
  await page.waitForTimeout(1500);
  const busy = busyMs(profile);
  return {
    run: `${drag ? 'drag' : 'idle'} ${throttle}x`,
    fps: +((r.frames * 1000) / r.ms).toFixed(1),
    longTasks: r.longTasks,
    maxLongTask: r.maxLongTask,
    mainBusyPct: Math.round((100 * busy) / r.ms),
    mainMsPerFrame: r.frames ? +(busy / r.frames).toFixed(1) : null,
    moves,
    profile,
  };
}

const results = [];
for (const throttle of [4, 1])
  for (const drag of [false, true]) results.push(await run({ throttle, drag }));
await browser.close();

const dragged = results.find((r) => r.run === 'drag 4x');
const top = topSelf(dragged.profile);
if (profileOut) writeFileSync(profileOut, JSON.stringify(dragged.profile));
const rows = results.map(({ profile: _p, ...r }) => r);
const target = { fps: 50, maxLongTask: 50 };
const met = dragged.fps >= target.fps && dragged.maxLongTask <= target.maxLongTask;
if (json) {
  console.log(JSON.stringify({ url, view, target, met, runs: rows, topSelfDrag4x: top }, null, 2));
} else {
  console.log(`3D drag performance, ${view} view, 390 × 844, ${url}`);
  console.table(rows);
  console.log('Top self time, drag 4x:');
  for (const t of top) console.log(`  ${String(t.ms).padStart(7)} ms  ${t.name}`);
  console.log(
    `Target (drag 4x ≥ ${target.fps} fps, no long task over ${target.maxLongTask} ms): ${met ? 'met' : 'not met'}`,
  );
}
if (flag('--assert') && !met) process.exit(1);
