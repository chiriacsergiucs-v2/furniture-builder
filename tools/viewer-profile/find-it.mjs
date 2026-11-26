// Browser measurement of the 3D viewer on a 20-piece room (G-502, backlog N395, ADR-238): draw calls per rendered frame
// and frame time (requestAnimationFrame deltas), idle and while the view is orbited. A MEASUREMENT, not a budget: it
// asserts only that the numbers were read (non-zero). Draw calls are counted by wrapping the WebGL draw functions before
// the page's scripts run; the view renders on demand, so the idle window draws nothing and the orbit window is the load (no hook in the app), so the count matches renderer.info.render.calls for the main passes.
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/viewer-profile/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Numbers depend on the GPU: a sandbox without one uses software WebGL and reads far slower than a phone or laptop.
import { launchBrowser, previewUrl, outDir, makeChecker } from '../lib/harness.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const url = previewUrl();
const out = outDir();
const PIECES = 20;
const WINDOW_MS = 3000;
mkdirSync(out, { recursive: true });
const browser = await launchBrowser({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const results = [];
const { check } = makeChecker(results);
const width = 1280;
const ctx = await browser.newContext({ viewport: { width, height: 900 } });
await ctx.addInitScript(() => {
  const w = window;
  w.__draws = 0;
  for (const name of ['WebGLRenderingContext', 'WebGL2RenderingContext']) {
    const proto = w[name]?.prototype;
    if (!proto) continue;
    for (const fn of [
      'drawElements',
      'drawArrays',
      'drawElementsInstanced',
      'drawArraysInstanced',
      'drawRangeElements',
    ]) {
      const orig = proto[fn];
      if (!orig) continue;
      proto[fn] = function (...a) {
        w.__draws++;
        return orig.apply(this, a);
      };
    }
  }
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const dlg = page.locator('dialog[open]');
const btn = (name) => page.getByRole('button', { name, exact: true });

await page.goto(url);
await btn('Create a new project').click();
await page.locator('dialog[open] input').fill('Viewer profile');
await dlg.getByRole('button', { name: 'Create project' }).click();
for (let i = 0; i < PIECES; i++) {
  await btn('Add a piece').click();
  await dlg.getByRole('searchbox', { name: 'Search the items' }).fill('Base cabinet');
  await dlg.locator('.start-group .row-btn').first().click();
  await dlg.waitFor({ state: 'detached' }).catch(() => {});
  const place = btn('Place to the right');
  await place.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
  if (await place.isVisible()) await place.click();
  await page.waitForTimeout(100);
}
const count = await page
  .getByRole('button', { name: /^Base cabinet.*, \d+ by \d+ mm$/, includeHidden: true })
  .count();
check(width, `project has ${PIECES} pieces`, count >= PIECES, `${count} listed`);

const three3d = page.getByRole('radio', { name: '3D', exact: true });
if (await three3d.isVisible().catch(() => false)) {
  if ((await three3d.getAttribute('aria-checked')) !== 'true') await three3d.click();
} else {
  await page.getByRole('radio', { name: /Build & Preview|Cut List/ }).click();
  await three3d.click();
}
const canvas = page.locator('.view.three canvas');
await canvas.waitFor({ state: 'visible', timeout: 30000 });
await page.waitForTimeout(2500);

const measure = () =>
  page.evaluate(
    (ms) =>
      new Promise((resolve) => {
        const w = window;
        const frames = [];
        let last = performance.now();
        let lastDraws = w.__draws;
        const start = last;
        const tick = (now) => {
          frames.push({ dt: now - last, draws: w.__draws - lastDraws });
          last = now;
          lastDraws = w.__draws;
          if (now - start < ms) requestAnimationFrame(tick);
          else resolve(frames);
        };
        requestAnimationFrame(tick);
      }),
    WINDOW_MS,
  );
const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] : 0;
};
const summarise = (frames) => {
  const rendered = frames.filter((f) => f.draws > 0);
  const dts = frames.map((f) => f.dt);
  return {
    rafFrames: frames.length,
    renderedFrames: rendered.length,
    frameMsMedian: +pct(dts, 50).toFixed(1),
    frameMsP95: +pct(dts, 95).toFixed(1),
    drawCallsPerRenderedFrameMedian: pct(
      rendered.map((f) => f.draws),
      50,
    ),
    drawCallsPerRenderedFrameMax: rendered.length ? Math.max(...rendered.map((f) => f.draws)) : 0,
  };
};

const idle = summarise(await measure());
// Orbit: drag the empty corner of the canvas in a circle while measuring.
const box = await canvas.boundingBox();
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;
const orbitFrames = measure();
await page.mouse.move(cx, cy);
await page.mouse.down();
const t0 = Date.now();
while (Date.now() - t0 < WINDOW_MS - 200) {
  const a = ((Date.now() - t0) / 600) * Math.PI;
  await page.mouse.move(cx + Math.cos(a) * 150, cy + Math.sin(a) * 60);
}
await page.mouse.up();
const orbit = summarise(await orbitFrames);

const report = {
  pieces: count,
  widthPx: width,
  windowMs: WINDOW_MS,
  renderer: await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
  }),
  idle,
  orbit,
  date: new Date().toISOString(),
};
writeFileSync(`${out}/viewer-profile.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
check(width, 'idle: frame time read', idle.rafFrames > 0 && idle.frameMsMedian > 0);
check(width, 'orbit: frame time read', orbit.rafFrames > 0 && orbit.frameMsMedian > 0);
check(
  width,
  'orbit: draw calls read',
  orbit.drawCallsPerRenderedFrameMax > 0,
  `${orbit.drawCallsPerRenderedFrameMedian} per frame`,
);
check(width, 'no page errors', errors.length === 0, errors.join(' | ').slice(0, 200));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `FAILED ${failed.length}` : `All ${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
