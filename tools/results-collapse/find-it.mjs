// Find-it acceptance for the results tabs collapsed until tapped on phones (ADR-091, backlog N89),
// run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/results-collapse/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text. Not part of `pnpm test`.
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
const TABS = ['Parts', 'Sheets', 'Hardware', 'Shopping list', 'Checks'];

for (const width of [1280, 390]) {
  const phone = width < 500;
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = (name) => page.screenshot({ path: `${out}/results-collapse-${name}-${width}.png` });
  const results_ = page.getByRole('region', { name: 'Results' });
  const tab = (name) => results_.getByRole('tab', { name: new RegExp(`^${name}`) });
  const csv = page.getByRole('button', { name: 'Download CSV' });
  const sheetsPanel = page.locator('.tabpanel .sheets');

  // 1. Bare app → New single piece → Sideboard → Build & Preview.
  await page.goto(url);
  await page.getByRole('button', { name: 'New single piece' }).click();
  await page
    .locator('dialog[open]')
    .getByRole('button', { name: /Sideboard/ })
    .first()
    .click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await page.getByRole('radio', { name: /^Build & Preview/ }).click();
  await page.waitForTimeout(400);

  for (const t of TABS) check(width, `tab "${t}" visible`, await tab(t).isVisible());
  await shot('start');

  if (phone) {
    // 2. Collapsed: no tab content, the 3D view takes the room.
    check(width, '"Download CSV" hidden while collapsed', !(await csv.isVisible()));
    check(
      width,
      'no tab selected while collapsed',
      (await page.locator('[role=tab][aria-selected=true]').count()) === 0,
    );
    const stage = await page.locator('.stage').boundingBox();
    check(
      width,
      '3D view takes most of the screen',
      (stage?.height ?? 0) > 844 * 0.55,
      `${stage?.height}px`,
    );
    // 3. Tap Parts → open; tap Sheets → switch; tap Sheets again → collapsed.
    await tab('Parts').click();
    check(width, 'tap "Parts" → "Download CSV" visible', await csv.isVisible());
    check(
      width,
      '"Parts" aria-expanded',
      (await tab('Parts').getAttribute('aria-expanded')) === 'true',
    );
    await shot('parts');
    await tab('Sheets').click();
    await sheetsPanel.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    check(width, 'tap "Sheets" → sheet layout visible', await sheetsPanel.isVisible());
    check(width, '"Download CSV" gone on Sheets', !(await csv.isVisible()));
    await tab('Sheets').click();
    check(
      width,
      'tap "Sheets" again → collapsed',
      !(await sheetsPanel.isVisible()) && !(await csv.isVisible()),
    );
    // 4. A design with a problem stays collapsed; the Checks badge shows it.
    await page.getByRole('radio', { name: /^Compose/ }).click();
    await page.getByRole('radio', { name: /^Build & Preview/ }).click();
    check(width, 'still collapsed after switching modes', !(await csv.isVisible()));
    check(
      width,
      'no horizontal page scroll',
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    );
  } else {
    // Desktop keeps today's layout: Parts open (G-075, user answer "Only phones").
    check(width, 'desktop: "Download CSV" visible without a tap', await csv.isVisible());
    await tab('Sheets').click();
    await tab('Sheets').click();
    await sheetsPanel.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    check(width, 'desktop: tapping "Sheets" twice keeps it open', await sheetsPanel.isVisible());
  }
  check(width, 'no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
