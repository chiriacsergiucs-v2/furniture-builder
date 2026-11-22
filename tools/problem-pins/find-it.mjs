// Find-it acceptance for problem pins and the Checks chip (ADR-287, backlog N370), on a production build:
//   pnpm build && pnpm preview &  node tools/problem-pins/find-it.mjs [url] [out dir]
// Starts from the bare app at 360 and 390 px, turns the canvas editor on from More, makes a drawer too low with the
// quick counts and finds the pin, its callout and the Checks chip by role and text.
import { mkdirSync } from 'node:fs';
import { launchBrowser, makeChecker, outDir, previewUrl } from '../lib/harness.mjs';

const url = previewUrl();
const out = outDir();
mkdirSync(out, { recursive: true });
const browser = await launchBrowser();
const results = [];
const { check } = makeChecker(results);

for (const width of [360, 390]) {
  const ctx = await browser.newContext({
    viewport: { width, height: 800 },
    hasTouch: true,
    isMobile: true,
  });
  // Start from the sheet (More › switch off, ADR-290), so turning it on is part of the find-it path.
  await ctx.addInitScript(() => localStorage.setItem('fb:canvasEditor', 'off'));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const pill = page.getByRole('navigation', { name: 'Selection path' });
  const rail = page.getByRole('toolbar', { name: 'Editor actions' });
  const pin = page.locator('figure svg').getByRole('button', { name: /^Problem: / });
  const toggleFlag = async () => {
    await page.locator('details.more > summary').first().click();
    await page.getByRole('button', { name: /Canvas editor \(preview\)/ }).click();
    // First-run hints (ADR-289) open once; skip them.
    await page.waitForTimeout(200);
    if (await page.getByRole('dialog', { name: 'Getting started' }).isVisible())
      await page.getByRole('button', { name: 'Skip' }).click();
    await page.waitForTimeout(300);
  };

  await page.goto(url);
  await page.getByRole('button', { name: 'New single piece' }).click();
  await page
    .locator('dialog[open]')
    .getByRole('button', { name: /Chest of drawers/ })
    .first()
    .click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await toggleFlag();
  for (let n = 0; n < 4 && (await pill.getByRole('button').count()) < 2; n++)
    await page.locator('.el-space').first().click({ force: true });
  check(width, 'no pin while nothing is wrong', (await pin.count()) === 0);
  // Too many drawers for the height: a drawer box gets too low (an error on the space).
  const more = page
    .getByRole('group', { name: 'Quick counts' })
    .getByRole('button', { name: 'More drawers' });
  for (let i = 0; i < 8 && (await pin.count()) === 0; i++) await more.click();
  await page.waitForTimeout(300);

  // 1. The pin and the chip.
  const b = await pin.first().boundingBox();
  check(
    width,
    'a "Problem: …" pin on the space, ≥ 44 px',
    !!b && b.width >= 43.5 && b.height >= 43.5,
  );
  const chip = rail.getByRole('button', { name: /^Checks: \d+ problem/ });
  check(width, 'the rail shows "Checks: n problem(s)"', (await chip.count()) === 1);

  // 2. The callout names the problem; Select it selects the space.
  await pin.first().click();
  const callout = page.getByRole('dialog', { name: 'Problem and repairs' });
  check(width, 'tapping the pin opens the callout', await callout.isVisible());
  check(width, 'the callout names the problem', /Problem/.test(await callout.innerText()));
  await page.screenshot({ path: `${out}/problem-pin-${width}.png` });
  await callout.getByRole('button', { name: 'Select it' }).click();
  check(width, 'Select it closes the callout', !(await callout.isVisible()));

  // 3. Flag off: the drawing keeps the problem but shows no pin; back on for the chip.
  await toggleFlag();
  check(
    width,
    'flag off: no pins on the drawing',
    (await page.locator('figure.elevation').isVisible()) && (await pin.count()) === 0,
  );
  await toggleFlag();

  // 4. Open Checks from the chip: the Checks list shows.
  await chip.click();
  await page.waitForTimeout(400);
  check(
    width,
    'the chip opens Checks',
    await page.getByRole('tab', { name: /Checks/, selected: true }).isVisible(),
  );

  check(width, 'no script errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length ? 1 : 0);
