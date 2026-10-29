// Find-it acceptance for ADR-121 (backlog N122): 3D drawn on demand, the review pack, typed rotation and mirroring a
// selection, against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/rotate-pack/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// From the bare app, by visible text, at 1280 and 390 px. Not part of `pnpm test`.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4173/furniture-builder/';
const out = process.argv[3] ?? 'dist-acceptance';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const results = [];
const check = (width, name, ok, detail = '') => {
  results.push({ width, name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${width}px ${name}${detail ? ` — ${detail}` : ''}`);
};

for (const width of [1280, 390]) {
  const phone = width < 500;
  const ctx = await browser.newContext({
    viewport: { width, height: phone ? 844 : 900 },
    hasTouch: phone,
    isMobile: phone,
    acceptDownloads: true,
  });
  // Count WebGL draw calls, to tell whether the 3D view keeps drawing while nothing changes.
  await ctx.addInitScript(() => {
    window.__draws = 0;
    for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext])
      for (const k of ['drawElements', 'drawArrays']) {
        const f = C?.prototype[k];
        if (f)
          C.prototype[k] = function (...a) {
            window.__draws++;
            return f.apply(this, a);
          };
      }
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const shot = (name) => page.screenshot({ path: `${out}/rotate-pack-${name}-${width}.png` });
  const dlg = page.locator('dialog[open]');
  const click = async (loc) => {
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    await loc.click({ timeout: 3000 }).catch(() => loc.dispatchEvent('click'));
  };
  const btn = (name, exact = true) => page.getByRole('button', { name, exact });
  const plan = page.getByRole('figure', { name: /Room plan, seen from above/ });
  const pieces = plan.locator('g.plan-piece');
  const sheet = async (open) => {
    const peek = page.locator('.sheet-peek');
    if (!(await peek.isVisible().catch(() => false))) return;
    if (((await peek.getAttribute('aria-expanded')) === 'true') !== open) await peek.click();
    await page.waitForTimeout(250);
  };
  const addPiece = async (query) => {
    await sheet(true);
    await click(btn('Add a piece'));
    await dlg.getByRole('searchbox', { name: 'Search the items' }).fill(query);
    await dlg.locator('.start-group .row-btn').first().click();
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
    const place = btn('Place to the right');
    await place.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
    if (await place.isVisible()) await click(place);
    await page.waitForTimeout(150);
    await sheet(false);
  };
  const tap = async (i) => {
    const b = await pieces.nth(i).boundingBox();
    if (phone) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(200);
  };
  const draws = () => page.evaluate(() => window.__draws);

  // 1. Bare app → new project → three pieces.
  await page.goto(url);
  await click(btn('Create a new project'));
  await page.locator('dialog[open] input').fill(`Angles ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  for (const q of ['Base cabinet', 'Base cabinet', 'Chest']) await addPiece(q);
  const planRadio = page.getByRole('radio', { name: '2D' });
  if (await planRadio.isVisible().catch(() => false)) await planRadio.click();
  check(width, 'three pieces on the plan', (await pieces.count()) === 3, `${await pieces.count()}`);

  // 2. Rotation (°) 30 on the first piece: drawn turned on the plan, the overlap is reported.
  await page.keyboard.press('Escape');
  await tap(0);
  await sheet(true);
  const pos = page.locator('details.group > summary', { hasText: /^Position$/ }).first();
  await pos.scrollIntoViewIfNeeded().catch(() => {});
  if (!(await pos.evaluate((s) => s.parentElement.open).catch(() => true))) await click(pos);
  const rot = page.getByLabel('Rotation (°)', { exact: true });
  check(width, '"Rotation (°)" on the selected-piece card', await rot.isVisible());
  await rot.fill('30');
  await rot.press('Enter');
  await page.waitForTimeout(300);
  check(width, 'Rotation (°) reads 30', (await rot.inputValue()) === '30');
  // The card's Position group names the overlap the turned piece now makes.
  check(
    width,
    'its overlap with the next piece is an error on the card',
    await page
      .getByText(/overlap by \d+ mm in the room/)
      .first()
      .isVisible()
      .catch(() => false),
  );
  await shot('rotation-field');
  await sheet(false);
  check(
    width,
    'the turned piece is drawn turned on the plan',
    (await pieces.nth(0).locator('polygon').count()) === 1,
  );
  await shot('rotation-plan');

  // 3. 3D: drawn on demand — once it has settled, no draws while idle; it draws again on orbit.
  // (A phone shows the 3D view under Build & Preview; a computer has the 3D view switch.)
  if (phone) await page.getByRole('radio', { name: /Build & Preview/ }).click();
  else await page.getByRole('radio', { name: '3D', exact: true }).click();
  const canvas = page.locator('.view.three canvas');
  await canvas.waitFor({ state: 'visible', timeout: 20000 });
  // Settled: the first 1.5 s window without a draw, within 15 s (loading, saving and the light arriving draw).
  let settled = false;
  for (let i = 0; i < 10 && !settled; i++) {
    const a = await draws();
    await page.waitForTimeout(1500);
    settled = (await draws()) === a;
  }
  check(width, 'the 3D view settles', settled);
  const d0 = await draws();
  await page.waitForTimeout(3000);
  const d1 = await draws();
  check(width, 'idle 3D view draws nothing', d1 === d0, `${d1 - d0} draws in 3 s`);
  const cb = await canvas.boundingBox();
  const cx = cb.x + cb.width / 2,
    cy = cb.y + cb.height / 2;
  if (phone) {
    await page.touchscreen.tap(cx, cy);
  } else {
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 80, cy + 10, { steps: 6 });
    await page.mouse.up();
  }
  await page.waitForTimeout(500);
  check(width, 'orbiting or tapping draws again', (await draws()) > d1);
  await shot('3d');
  if (phone) await page.getByRole('radio', { name: /Compose/ }).click();
  else await planRadio.click();
  await page.waitForTimeout(300);

  // 4. Select all three → Mirror: positions mirror, the turned piece's turn becomes 330°.
  if (phone) {
    const sel = plan.getByRole('checkbox', { name: 'Select', exact: true });
    await page.keyboard.press('Escape');
    await click(sel);
    for (const i of [0, 1, 2]) await tap(i);
    await sheet(true);
  } else {
    await pieces.nth(0).focus();
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(200);
  }
  const mirror = page.getByRole('button', { name: /^Mirror the selection/ });
  check(width, '"Mirror" acts on the selection', await mirror.isVisible());
  const before = await pieces.evaluateAll((gs) => gs.map((g) => g.getBoundingClientRect().x));
  await click(mirror);
  await page.waitForTimeout(300);
  const after = await pieces.evaluateAll((gs) => gs.map((g) => g.getBoundingClientRect().x));
  check(
    width,
    'Mirror swaps the outer pieces',
    after[0] > before[0] && after[2] < before[2],
    JSON.stringify({ before, after }),
  );
  await shot('mirrored');
  await sheet(false);

  // 5. ⋯ More → Hand to a professional… → the pack's files and Download .zip.
  await page.keyboard.press('Escape');
  await page.locator('details.more > summary').click();
  const hand = page.getByRole('button', { name: /Hand to a professional/ });
  check(width, '"Hand to a professional…" in the ⋯ menu', await hand.isVisible());
  await click(hand);
  await page.waitForTimeout(1200);
  const files = await dlg.locator('.pack-files li').count();
  check(width, 'the pack lists five files', files === 5, `${files}`);
  const dl = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
  await click(dlg.getByRole('button', { name: 'Download .zip' }));
  const got = await dl;
  check(width, 'Download .zip saves a .zip', !!got && got.suggestedFilename().endsWith('.zip'));
  await shot('review-pack');

  check(
    width,
    'no sideways scroll',
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  );
  check(width, 'no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
