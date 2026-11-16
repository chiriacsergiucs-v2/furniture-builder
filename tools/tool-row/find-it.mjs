// Find-it acceptance for audit finding F-30 (G-518), run against a production build:
//   pnpm build && pnpm preview &  node tools/tool-row/find-it.mjs [url] [out dir]
// A project with one base cabinet, opened in 3D: the tool row over the scene ("Place pieces in 3D": ⋯, Move, Select and
// the rest) is one row at 390 px (it scrolls sideways), so it covers one button height of the scene and no tool sits alone below.
// Not part of `pnpm test`.
import { launchBrowser, previewUrl, outDir, WIDTHS } from '../lib/harness.mjs';
import { goBuild } from '../lib/steps.mjs';
import { mkdirSync } from 'node:fs';

const url = previewUrl();
const out = outDir();
mkdirSync(out, { recursive: true });
const browser = await launchBrowser();
const results = [];
const check = (width, name, ok, detail = '') => {
  results.push({ width, name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${width}px ${name}${detail ? ` — ${detail}` : ''}`);
};

for (const width of WIDTHS) {
  const phone = width < 500;
  const ctx = await browser.newContext({
    viewport: { width, height: phone ? 812 : 900 },
    hasTouch: phone,
    isMobile: phone,
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
  await page.locator('dialog[open] input').fill(`Tool row ${width}`);
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
  if (phone) {
    await sheet(false);
    await goBuild(page);
  }
  const r = page.getByRole('radio', { name: '3D', exact: true });
  if ((await r.getAttribute('aria-checked')) !== 'true') await r.click();
  const tools = page.getByRole('toolbar', { name: 'Place pieces in 3D' });
  await tools.waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1000);
  const boxes = await tools.locator('> *').evaluateAll((els) =>
    els
      .map((e) => e.getBoundingClientRect())
      .filter((b) => b.width > 0)
      .map((b) => ({ x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width) })),
  );
  const tops = new Set(boxes.map((b) => b.y));
  const names = await tools.getByRole('button').allInnerTexts();
  await page.screenshot({ path: `${out}/tool-row-${width}.png` });
  check(
    width,
    'the tool row has tools',
    boxes.length >= 3,
    `${boxes.length}: ${names.join(' | ')}`,
  );
  if (phone) check(width, 'the tool row is one row', tops.size === 1, JSON.stringify(boxes));
  check(width, 'the first tool lies inside the screen', boxes[0].x >= 0 && boxes[0].x < width);
  await ctx.close();
}
await browser.close();
process.exit(results.every((x) => x.ok) ? 0 : 1);
