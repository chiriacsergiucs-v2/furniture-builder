// Find-it acceptance for the realistic 3D look and rendered pictures (CLAUDE.md R3; ADR-067, ADR-068; N62, N63),
// run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/look-render/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text. Not part of `pnpm test`.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';

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
  // Service workers blocked so every chunk the page loads shows up as a page request.
  const ctx = await browser.newContext({
    viewport: { width, height: phone ? 844 : 900 },
    serviceWorkers: 'block',
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  const remote = [];
  const chunks = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (!['localhost', '127.0.0.1'].includes(u.hostname) && /^https?:$/.test(u.protocol))
      remote.push(r.url());
    if (u.pathname.endsWith('.js')) chunks.push(u.pathname);
  });
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const dlg = page.locator('dialog[open]');
  const closeDialog = async () => {
    await page.keyboard.press('Escape');
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
  };
  const openPiece = async () => {
    await page.getByRole('button', { name: 'New single piece' }).click();
    await dlg.locator('.start-group .row-btn').first().click();
    await page.locator('main.work').waitFor({ state: 'visible' });
  };

  // 1. Bare app → a piece → Settings → "Boards, sheets and saw cut" → Finish: Gloss (ADR-080 moved the boards
  // from the old Materials dialog into Settings).
  await page.goto(url);
  await openPiece();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await dlg.getByRole('heading', { name: /^Settings: / }).waitFor();
  await dlg.getByText('Boards, sheets and saw cut', { exact: true }).click();
  const finish = dlg.getByRole('radiogroup', { name: 'Finish' }).first();
  await finish.waitFor({ timeout: 5000 }).catch(() => {});
  check(
    width,
    '"Finish" visible under Settings › Boards, sheets and saw cut',
    await finish.isVisible(),
  );
  check(
    width,
    'Finish offers Matte · Satin · Gloss',
    (await finish.getByRole('radio').allInnerTexts()).join(' · ') === 'Matte · Satin · Gloss',
  );
  await finish.getByRole('radio', { name: 'Gloss' }).click();
  check(
    width,
    'Gloss chosen',
    (await finish.getByRole('radio', { name: 'Gloss' }).getAttribute('aria-checked')) === 'true',
  );
  check(width, 'no sideways scroll (Settings › Boards)', await noSideScroll());
  await closeDialog();

  // 2. 3D view → Look: Simple · Realistic, default by width.
  const before3d = chunks.length;
  // A phone shows 3D in Build & Preview only (ADR-079), its view controls under "Options" (N82); a desktop picks 3D.
  if (phone) {
    await page.getByRole('radio', { name: /Build & Preview/ }).click();
    await page.locator('.view.three canvas').waitFor({ timeout: 20000 });
    await page.locator('details.view-options > summary').click();
  } else await page.getByRole('radio', { name: '3D' }).click();
  const lookGroup = page.getByRole('radiogroup', { name: 'Look' });
  await lookGroup.waitFor();
  check(width, '"Look" visible in the 3D view', await lookGroup.isVisible());
  const expected = phone ? 'Simple' : 'Realistic';
  check(
    width,
    `Look defaults to ${expected}`,
    (await lookGroup.getByRole('radio', { name: expected }).getAttribute('aria-checked')) ===
      'true',
  );
  await page.waitForTimeout(2500);
  await page
    .locator('.view.three canvas')
    .screenshot({ path: `${out}/look-${expected.toLowerCase()}-${width}.png` });
  const other = phone ? 'Realistic' : 'Simple';
  await lookGroup.getByRole('radio', { name: other }).click();
  await page.waitForTimeout(2500);
  await page
    .locator('.view.three canvas')
    .screenshot({ path: `${out}/look-${other.toLowerCase()}-${width}.png` });
  await lookGroup.getByRole('radio', { name: 'Realistic' }).click();
  await page.waitForTimeout(1500);
  check(
    width,
    'path tracer not loaded before Render',
    !chunks.slice(before3d).some((c) => c.includes('pathtrace')),
  );
  check(width, 'no sideways scroll (3D)', await noSideScroll());

  // 3. Render → "Render a picture" with both sizes.
  await page.getByRole('button', { name: 'Render' }).click();
  await dlg.getByRole('heading', { name: 'Render a picture' }).waitFor();
  check(width, '"Render a picture" opens', true);
  for (const s of ['1920 × 1080', '1280 × 720'])
    check(width, `size ${s} offered`, await dlg.getByRole('radio', { name: s }).isVisible());
  check(width, 'no sideways scroll (Render)', await noSideScroll());

  // On a software GPU (CI containers, cloud sessions) the path tracer blocks the page for long stretches, so every
  // wait during the render gets up to 3 minutes; the default comes back after it.
  page.setDefaultTimeout(180000);
  if (phone) {
    // 4a. Start, then Cancel.
    await dlg.getByRole('radio', { name: '1280 × 720' }).click();
    await dlg.getByRole('button', { name: 'Start' }).click();
    const progress = dlg.getByText(/Rendering… \d+ \/ 256 samples/);
    await progress.waitFor({ timeout: 120000 });
    check(width, '"Rendering… n / 256 samples" shown', await progress.isVisible());
    check(
      width,
      'path tracer loaded after Start',
      chunks.some((c) => c.includes('pathtrace')),
    );
    await dlg.getByRole('button', { name: 'Cancel' }).click();
    await dlg.getByRole('button', { name: 'Start' }).waitFor();
    check(width, 'Cancel stops the render', !(await progress.isVisible()));
  } else {
    // 4b. A whole render at 1280 × 720, then Save PNG.
    await dlg.getByRole('radio', { name: '1280 × 720' }).click();
    await dlg.getByRole('button', { name: 'Start' }).click();
    const progress = dlg.getByText(/Rendering… \d+ \/ 256 samples/);
    await progress.waitFor({ timeout: 120000 });
    const first = await progress.innerText();
    // The first samples wait for the path-tracing shader to compile (10–20 s on a software GPU).
    let later = first;
    for (let i = 0; i < 60 && later === first; i++) {
      await page.waitForTimeout(2000);
      later = (await progress.isVisible()) ? await progress.innerText() : 'done';
    }
    check(width, 'sample count rises', first !== later, `${first} → ${later}`);
    check(
      width,
      'path tracer loaded after Start',
      chunks.some((c) => c.includes('pathtrace')),
    );
    const save = dlg.getByRole('button', { name: 'Save PNG' });
    // Software GPUs (CI containers) take ~25 min for 256 samples at 1280 × 720; a laptop GPU takes seconds.
    await save.waitFor({ timeout: 45 * 60 * 1000 });
    await dlg.locator('.render-canvas').screenshot({ path: `${out}/render-preview-${width}.png` });
    const [download] = await Promise.all([page.waitForEvent('download'), save.click()]);
    const file = `${out}/${download.suggestedFilename()}`;
    await download.saveAs(file);
    const b = readFileSync(file);
    const isPng = b.subarray(1, 4).toString() === 'PNG';
    const w = b.readUInt32BE(16),
      h = b.readUInt32BE(20);
    check(
      width,
      'Save PNG gives a 1280 × 720 PNG named after the design',
      isPng && w === 1280 && h === 720 && download.suggestedFilename().endsWith(' render.png'),
      `${download.suggestedFilename()} ${w}×${h}`,
    );
  }
  await closeDialog();
  page.setDefaultTimeout(30000);

  // 5. The look survives a reload.
  await page.reload();
  check(
    width,
    'Look choice kept after reload',
    (await page.evaluate(() => localStorage.getItem('fb:look'))) === 'realistic',
  );

  check(width, 'no requests leave the device', remote.length === 0, remote.slice(0, 3).join(' '));
  check(width, 'no page errors', errors.length === 0, errors.join(' / '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
