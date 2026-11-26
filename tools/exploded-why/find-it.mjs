// Find-it acceptance for G-522 (audit F-04), run against a production build:
//   pnpm build:ci && pnpm preview &  node tools/exploded-why/find-it.mjs [url] [out dir]
// A project with one base cabinet in the real 3D view, Exploded 3D on: the line "Turn off Exploded 3D to move pieces" is
// visible beside the disabled Move button, the tool row keeps its layout and nothing overflows the page sideways.
// Not part of `pnpm test`.
import { launchBrowser, previewUrl, outDir, makeChecker } from '../lib/harness.mjs';
import { goBuild } from '../lib/steps.mjs';
import { mkdirSync } from 'node:fs';

const url = previewUrl();
const out = outDir();
mkdirSync(out, { recursive: true });
const browser = await launchBrowser();
const results = [];
const { check } = makeChecker(results);
const SIZES = [
  { width: 390, height: 812, phone: true },
  { width: 1280, height: 900, phone: false },
];

for (const { width, height, phone } of SIZES) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    hasTouch: phone,
    isMobile: phone,
    serviceWorkers: 'block',
  });
  // The sheet editor holds the 3D toolbar under test; the canvas editor is the phone default since ADR-290 (catch-up
  // 2026-11-26), so this script turns it off and skips the first-run hints, as the other scripts do.
  await ctx.addInitScript(() => {
    localStorage.setItem('fb:canvasEditor', 'off');
    localStorage.setItem('fb:canvas-coach', 'done');
  });
  const page = await ctx.newPage();
  const dlg = page.locator('dialog[open]');
  const btn = (name, exact = true) => page.getByRole('button', { name, exact });
  const sheet = async (open) => {
    const peek = page.locator('.sheet-peek');
    if (!(await peek.isVisible().catch(() => false))) return;
    if (((await peek.getAttribute('aria-expanded')) === 'true') !== open) await peek.click();
    await page.waitForTimeout(200);
  };
  await page.goto(url);
  await btn('Create a new project').click();
  await page.locator('dialog[open] input').fill(`Exploded why ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await sheet(true);
  await btn('Add a piece').click();
  await dlg.getByRole('searchbox', { name: 'Search the items' }).fill('Base cabinet');
  await dlg.locator('.start-group .row-btn').first().click();
  await dlg.waitFor({ state: 'detached' }).catch(() => {});
  const place = btn('Place to the right');
  await place.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
  if (await place.isVisible()) await place.click();
  // A room with a picture on Wall 1, so "Adjust wall picture" shows too.
  await sheet(true);
  await btn('Add the room').click();
  await sheet(true);
  const photo = Buffer.from(
    (
      await page.evaluate(() => {
        const c = document.createElement('canvas');
        c.width = 80;
        c.height = 60;
        const x = c.getContext('2d');
        x.fillStyle = '#4682a0';
        x.fillRect(0, 0, 80, 60);
        return c.toDataURL('image/png');
      })
    ).split(',')[1],
    'base64',
  );
  const roomFold = page.locator('details.room-fold');
  if ((await roomFold.count()) && !(await roomFold.evaluate((el) => el.open)))
    await roomFold.locator('> summary').click();
  const bg1 = page.getByLabel('Wall 1 background', { exact: true });
  await bg1.scrollIntoViewIfNeeded();
  await bg1.selectOption({ label: 'Picture' });
  await page
    .getByLabel('Add a picture for Wall 1')
    .setInputFiles({ name: 'wall.png', mimeType: 'image/png', buffer: photo });
  await page.getByRole('img', { name: 'Picture on Wall 1' }).waitFor({ timeout: 8000 });
  if (phone) {
    await sheet(false);
    await goBuild(page);
  }
  const r = page.getByRole('radio', { name: '3D', exact: true });
  if ((await r.getAttribute('aria-checked')) !== 'true') await r.click();
  const tools = page.getByRole('toolbar', { name: 'Place pieces in 3D' });
  await tools.waitFor({ state: 'visible', timeout: 30000 });
  const webgl = await page.evaluate(() => {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  });
  console.log(`INFO ${width}px WebGL ${webgl ? 'available' : 'missing'}`);
  // Exploded 3D lives in the view options; on a phone behind the Options button.
  const exploded = page.getByRole('checkbox', { name: 'Exploded 3D' });
  if (!(await exploded.isVisible().catch(() => false))) {
    await page.locator('details.view-options > summary').first().click();
  }
  await exploded.check();
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(800);
  const move = tools.getByRole('button', { name: 'Move', exact: true });
  const why = tools.getByText('Turn off Exploded 3D to move pieces', { exact: true });
  check(width, 'Move is disabled', await move.isDisabled());
  const adjust = tools.getByRole('button', { name: 'Adjust wall picture', exact: true });
  const why2 = tools.getByText('Turn off Exploded 3D to adjust a wall picture', { exact: true });
  check(width, 'Adjust wall picture is disabled', await adjust.isDisabled());
  const ab = await why2.boundingBox();
  // The row scrolls sideways on a phone: the second reason is reached by scrolling, so scroll it into view first.
  await why2.scrollIntoViewIfNeeded();
  check(width, 'the Adjust reason text is visible', await why2.isVisible());
  console.log(
    `INFO ${width}px adjust ${JSON.stringify(await adjust.boundingBox())} why2 ${JSON.stringify(await why2.boundingBox())} (before scroll ${JSON.stringify(ab)})`,
  );
  await page.screenshot({ path: `${out}/exploded-why-adjust-${width}.png` });
  await tools.evaluate((el) => (el.scrollLeft = 0));
  check(width, 'the reason text is visible', await why.isVisible());
  const mb = await move.boundingBox();
  const wb = await why.boundingBox();
  const t = await tools.boundingBox();
  const vb = await page.locator('.view.three').first().boundingBox();
  console.log(
    `INFO ${width}px move ${JSON.stringify(mb)} why ${JSON.stringify(wb)} tools ${JSON.stringify(t)}`,
  );
  // In the page's reading order the reason follows Move and sits in the same toolbar, within the 3D view.
  check(
    width,
    'the reason sits inside the tool row, after Move',
    !!(mb && wb && t) &&
      wb.x >= t.x - 1 &&
      wb.y >= t.y - 1 &&
      wb.y + wb.height <= t.y + t.height + 1,
  );
  check(
    width,
    'the reason lies inside the 3D view',
    !!(wb && vb) && wb.y >= vb.y && wb.y + wb.height <= vb.y + vb.height,
  );
  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  check(width, 'no horizontal page scroll', !sideways);
  const tops = await tools
    .locator('> *')
    .evaluateAll((els) => [
      ...new Set(els.map((e) => Math.round(e.getBoundingClientRect().y)).filter(Number)),
    ]);
  console.log(`INFO ${width}px tool row tops ${JSON.stringify(tops)}`);
  await page.screenshot({ path: `${out}/exploded-why-${width}.png` });
  await ctx.close();
}
await browser.close();
process.exit(results.every((x) => x.ok) ? 0 : 1);
