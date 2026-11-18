// Find-it acceptance for the nesting engine as a workspace package (ADR-279), run against a production build:
//   pnpm build && pnpm preview &  node tools/nesting-package/find-it.mjs [url] [out dir]
// From the bare app at each width: New single piece → Sideboard → Cut list → Sheets. The sheet layout must come from
// the Web Worker that @furniture-builder/nesting/client builds (a worker chunk under assets/), not the main-thread
// fallback. Not part of `pnpm test`.
import { launchBrowser, previewUrl, outDir, makeChecker, WIDTHS } from '../lib/harness.mjs';
import { goBuild, openTab } from '../lib/steps.mjs';
import { mkdirSync } from 'node:fs';

const url = previewUrl();
const out = outDir();
mkdirSync(out, { recursive: true });
const browser = await launchBrowser();
const results = [];
const { check } = makeChecker(results);

for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 } });
  const page = await ctx.newPage();
  const errors = [];
  const workers = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('worker', (w) => workers.push(w.url()));

  await page.goto(url);
  await page.getByRole('button', { name: 'New single piece' }).click();
  await page
    .locator('dialog[open]')
    .getByRole('button', { name: /Sideboard/ })
    .first()
    .click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await goBuild(page);
  await openTab(page, 'Sheets');
  const toBuy = page.getByText('Sheets to buy');
  await toBuy.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  check(width, '"Sheets to buy" visible', await toBuy.isVisible());
  check(
    width,
    'a used percentage is shown for a sheet',
    (await page.getByRole('cell', { name: /^\d+%$/ }).count()) > 0,
  );
  check(
    width,
    '"Laying out sheets…" is gone',
    !(await page.getByText('Laying out sheets…').isVisible()),
  );
  const nestWorker = workers.find((w) => /\/assets\/worker-[\w-]+\.js$/.test(w));
  check(width, 'the layout ran in the package worker', Boolean(nestWorker), workers.join(', '));
  await page.screenshot({ path: `${out}/nesting-package-${width}.png` });
  check(width, 'no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
