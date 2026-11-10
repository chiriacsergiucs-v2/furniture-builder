// Find-it acceptance for the results tabs collapsed until tapped on phones (ADR-091, backlog N89),
// run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/results-collapse/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text. Not part of `pnpm test`.
import { launchBrowser, previewUrl, outDir } from '../lib/harness.mjs';
import { goBuild, goCompose } from '../lib/steps.mjs';
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
// Assembly was added as a sixth tab (N82).
const TABS = ['Parts', 'Sheets', 'Hardware', 'Assembly', 'Shopping list', 'Checks'];

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

  // 1. Bare app → New single piece → Sideboard → Build & Preview (the Cut list place on a phone, ADR-241).
  await page.goto(url);
  await page.getByRole('button', { name: 'New single piece' }).click();
  await page
    .locator('dialog[open]')
    .getByRole('button', { name: /Sideboard/ })
    .first()
    .click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await goBuild(page);
  await page.waitForTimeout(400);

  for (const t of TABS) check(width, `tab "${t}" visible`, await tab(t).isVisible());
  await shot('start');

  if (phone) {
    // 2. ADR-241 replaced "collapsed on arrival" (ADR-091): entering the Cut list place opens Parts.
    check(width, 'Cut list opens on Parts: "Download CSV" visible', await csv.isVisible());
    check(
      width,
      '"Parts" aria-expanded',
      (await tab('Parts').getAttribute('aria-expanded')) === 'true',
    );
    await shot('parts');
    // 3. Tap Sheets → switch; tap Sheets again → collapsed, and the 3D view takes the room (ADR-091).
    await tab('Sheets').click();
    await sheetsPanel.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    check(width, 'tap "Sheets" → sheet layout visible', await sheetsPanel.isVisible());
    check(width, '"Download CSV" gone on Sheets', !(await csv.isVisible()));
    await tab('Sheets').click();
    await page.waitForTimeout(300);
    check(
      width,
      'tap "Sheets" again → collapsed',
      !(await sheetsPanel.isVisible()) && !(await csv.isVisible()),
    );
    check(
      width,
      'no tab selected while collapsed',
      (await page.locator('[role=tab][aria-selected=true]').count()) === 0,
    );
    const stage = await page.locator('.stage').boundingBox();
    check(
      width,
      'collapsed: the 3D view takes most of the screen',
      (stage?.height ?? 0) > 844 * 0.55,
      `${stage?.height}px`,
    );
    // 4. Leaving and coming back to Cut list opens Parts again (ADR-241); a design with an error opens Checks,
    // whose badge counts it.
    await goCompose(page);
    await goBuild(page);
    await page.waitForTimeout(300);
    check(width, 'back in Cut list → Parts open again', await csv.isVisible());
    // Cut list picks Checks or Parts only when the results are closed (App.tsx): close them first.
    await tab('Parts').click();
    await goCompose(page);
    const dlg = page.locator('dialog[open]');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await dlg.getByRole('heading', { name: /^Settings: / }).waitFor();
    const w = dlg.getByLabel('Width', { exact: true }).first();
    await w.fill('100');
    await w.press('Tab');
    await dlg.getByRole('button', { name: 'Done', exact: true }).click();
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
    await goBuild(page);
    await page.waitForTimeout(400);
    const badge =
      (await tab('Checks')
        .locator('.badge')
        .textContent()
        .catch(() => '')) ?? '';
    check(
      width,
      'an error opens Cut list on Checks (ADR-241)',
      (await tab('Checks').getAttribute('aria-expanded')) === 'true' && !(await csv.isVisible()),
    );
    check(
      width,
      'Checks badge shows the error count',
      Number(badge.trim()) > 0 && (await tab('Checks').locator('.badge.error').count()) === 1,
      `badge "${badge}"`,
    );
    await shot('error');
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
