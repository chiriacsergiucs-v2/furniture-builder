// Find-it acceptance for output lenses (ADR-288, backlog N371), run against a production build:
//   pnpm build && pnpm preview &  node tools/output-lenses/find-it.mjs [url] [out dir]
// Starts from the bare app at 360 and 390 px, turns the canvas editor on from More, and opens each output from its chip
// as a card over the drawing.
import { mkdirSync } from 'node:fs';
import { launchBrowser, makeChecker, outDir, previewUrl } from '../lib/harness.mjs';

const url = previewUrl();
const out = outDir();
mkdirSync(out, { recursive: true });
const browser = await launchBrowser();
const results = [];
const { check } = makeChecker(results);
const OUTPUTS = ['Parts', 'Sheets', 'Hardware', 'Assembly', 'Shopping'];

for (const width of [360, 390]) {
  const ctx = await browser.newContext({
    viewport: { width, height: 800 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const rail = page.getByRole('toolbar', { name: 'Editor actions' });
  const results_ = page.getByRole('region', { name: 'Results' });
  const toggleFlag = async () => {
    await page.locator('details.more > summary').first().click();
    await page.getByRole('button', { name: /Canvas editor \(preview\)/ }).click();
    // First-run hints (ADR-289) open once; skip them.
    await page.waitForTimeout(200);
    if (await page.getByRole('dialog', { name: 'Getting started' }).isVisible())
      await page.getByRole('button', { name: 'Skip' }).click();
    await page.waitForTimeout(300);
  };
  const closeCard = () => page.locator('.lens-out-close').click();

  await page.goto(url);
  await page.getByRole('button', { name: 'New single piece' }).click();
  await page
    .locator('dialog[open]')
    .getByRole('button', { name: /Chest of drawers/ })
    .first()
    .click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await toggleFlag();

  // 1. Every output has a chip in the rail.
  for (const name of OUTPUTS)
    check(
      width,
      `rail chip "${name}"`,
      (await rail.getByRole('button', { name, exact: true }).count()) === 1,
    );

  // 2. Each chip opens that output as a card over the drawing; the drawing stays above it.
  for (const name of OUTPUTS) {
    if (!(await rail.isVisible())) await closeCard();
    await rail.getByRole('button', { name, exact: true }).click();
    await page.waitForTimeout(300);
    const tab = results_.getByRole('tab', { selected: true });
    const panel = results_.getByRole('tabpanel');
    const card = await results_.boundingBox();
    const stage = await page.locator('section.stage').boundingBox();
    check(
      width,
      `"${name}" opens as a card with its panel`,
      (await results_.isVisible()) &&
        (await tab.innerText()).includes(name.slice(0, 4)) &&
        (await panel.isVisible()),
    );
    check(
      width,
      `the drawing sits above the "${name}" card`,
      !!card && !!stage && stage.y + stage.height <= card.y + 1,
      `stage bottom ${Math.round((stage?.y ?? 0) + (stage?.height ?? 0))}, card top ${Math.round(card?.y ?? 0)}`,
    );
    if (name === 'Parts') {
      check(
        width,
        'Parts labels the fronts with their cut sizes',
        (await page.locator('.part-size').count()) > 0,
      );
      await page.screenshot({ path: `${out}/output-parts-${width}.png` });
    }
  }

  // 3. Close: the rail comes back and the sizes go.
  await closeCard();
  check(
    width,
    'closing brings the rail back',
    (await rail.isVisible()) && (await page.locator('.part-size').count()) === 0,
  );

  // 4. Flag off: no output chips.
  await toggleFlag();
  check(width, 'flag off: no output chips', (await rail.count()) === 0);
  check(width, 'no script errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length ? 1 : 0);
