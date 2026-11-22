// Find-it acceptance for Find an action and the first-run hints (ADR-289, backlog N372), on a production build:
//   pnpm build && pnpm preview &  node tools/find-action/find-it.mjs [url] [out dir]
// Starts from the bare app at 360 and 390 px, turns the canvas editor on from More, walks the first-run hints, and finds
// a block, an output and a feature by typing in Find.
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
  const hints = page.getByRole('dialog', { name: 'Getting started' });
  const find = page.getByRole('dialog', { name: 'Find an action' });
  const search = find.getByRole('searchbox', { name: 'Search actions and features' });
  const toggleFlag = async () => {
    await page.locator('details.more > summary').first().click();
    await page.getByRole('button', { name: /Canvas editor \(preview\)/ }).click();
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

  // 1. First-run hints: three steps, then never again.
  check(width, 'first run shows "Getting started"', await hints.isVisible());
  check(width, 'step 1 of 3', /Step 1 of 3/.test(await hints.innerText()));
  await hints.getByRole('button', { name: 'Next' }).click();
  await hints.getByRole('button', { name: 'Next' }).click();
  check(width, 'step 3 ends with Start', /Step 3 of 3/.test(await hints.innerText()));
  await hints.getByRole('button', { name: 'Start' }).click();
  await toggleFlag();
  await toggleFlag();
  check(width, 'hints do not come back', !(await hints.isVisible()));

  // 2. Find opens a block of the selected space.
  for (let n = 0; n < 4 && (await pill.getByRole('button').count()) < 2; n++)
    await page.locator('.el-space').first().click({ force: true });
  await page.getByRole('button', { name: 'Find an action' }).click();
  check(width, 'the magnifier opens "Find an action"', await find.isVisible());
  await search.fill('cont');
  await find.getByRole('button', { name: 'Contents', exact: true }).first().click();
  await page.waitForTimeout(300);
  check(
    width,
    'Find › Contents opens the Contents block',
    (
      await page
        .getByRole('tablist', { name: 'Editor card' })
        .getByRole('tab', { selected: true })
        .innerText()
    ).trim() === 'Contents',
  );

  // 3. Find opens an output.
  await page.getByRole('button', { name: 'Close the card' }).click();
  await page.getByRole('button', { name: 'Find an action' }).click();
  await search.fill('sheets');
  await find
    .getByRole('region', { name: 'Open here' })
    .getByRole('button', { name: 'Sheets', exact: true })
    .click();
  await page.waitForTimeout(300);
  check(
    width,
    'Find › Sheets opens the Sheets card',
    await page.locator('#panel-sheets').isVisible(),
  );
  await page.locator('.lens-out-close').click();

  // 4. Find lists any feature with its description.
  await page.getByRole('button', { name: 'Find an action' }).click();
  await search.fill('mirror');
  const feature = find.getByRole('region', { name: 'All features' }).getByRole('button').first();
  check(width, 'a feature search lists features', (await feature.count()) === 1);
  await feature.click();
  check(
    width,
    'a feature shows its description',
    (await find.locator('.find-detail').count()) === 1,
  );
  await page.screenshot({ path: `${out}/find-${width}.png` });
  await page.keyboard.press('Escape');
  check(width, 'Esc closes Find', !(await find.isVisible()));
  check(width, 'no script errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length ? 1 : 0);
