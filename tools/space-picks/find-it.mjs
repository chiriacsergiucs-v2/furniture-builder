// Find-it acceptance for in-space picks (ADR-286, backlog N369), run against a production build:
//   pnpm build && pnpm preview &  node tools/space-picks/find-it.mjs [url] [out dir]
// Starts from the bare app at 360 and 390 px, turns the canvas editor on from More, divides a space so one part is
// empty, and fills it from the picks laid over it.
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
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const pill = page.getByRole('navigation', { name: 'Selection path' });
  const picks = page.getByRole('group', { name: 'Fill this space' });
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
  await page
    .locator('svg')
    .getByRole('button', { name: 'Divide side by side', exact: true })
    .click();
  await page.waitForTimeout(300);
  // The new right part is empty: tap it until it is the selection.
  const empty = page.locator('.el-space').last();
  for (let n = 0; n < 4 && !/Right/.test(await pill.innerText()); n++)
    await empty.click({ force: true });

  // 1. Picks over the empty space, each at least 44 px.
  check(
    width,
    'an empty selected space shows "Fill this space"',
    await picks.isVisible(),
    await pill.innerText(),
  );
  for (const name of ['Shelves', 'Drawers', 'Hanging', 'Door']) {
    const b = await picks.getByRole('button', { name, exact: true }).boundingBox();
    check(width, `pick "${name}" ≥ 44 px`, !!b && b.height >= 43.5 && b.width >= 43.5);
  }
  await page.screenshot({ path: `${out}/space-picks-${width}.png` });

  // 2. Door adds a door (pressed); a second tap takes it off.
  await picks.getByRole('button', { name: 'Door', exact: true }).click();
  await page.waitForTimeout(200);
  check(
    width,
    'Door adds a door',
    (await picks
      .getByRole('button', { name: 'Door', exact: true })
      .getAttribute('aria-pressed')) === 'true',
  );
  await picks.getByRole('button', { name: 'Door', exact: true }).click();
  await page.waitForTimeout(200);

  // 3. Shelves fills the space: the picks go and the drawing names shelves.
  await picks.getByRole('button', { name: 'Shelves', exact: true }).click();
  await page.waitForTimeout(300);
  check(width, 'Shelves fills the space and the picks go', !(await picks.isVisible()));
  check(
    width,
    'the drawing names the shelves',
    /shel/i.test(await page.locator('figure.elevation').innerText()),
  );

  // 4. Flag off: no picks.
  await page.getByRole('button', { name: /^Undo/ }).first().click();
  await toggleFlag();
  check(width, 'flag off: no picks', (await picks.count()) === 0);
  check(width, 'no script errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length ? 1 : 0);
