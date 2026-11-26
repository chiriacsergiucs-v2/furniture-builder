// Find-it acceptance for size tags on the drawing (ADR-284, backlog N367), run against a production build:
//   pnpm build && pnpm preview &  node tools/size-tags/find-it.mjs [url] [out dir]
// Starts from the bare app at 360 and 390 px, turns the canvas editor on from More, and finds the size tags by role and
// name: the whole piece's width, height and depth, a side-by-side part's width and a stacked part's height.
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
  const side = page.locator('aside.side');
  const pill = page.getByRole('navigation', { name: 'Selection path' });
  const rail = page.getByRole('toolbar', { name: 'Editor bar' });
  // The panel shows the whole editor (ADR-295): Edit opens it, the jump index goes to a block.
  const openOn = async (title) => {
    const edit = rail.getByRole('button', { name: /^Edit/ });
    if ((await edit.getAttribute('aria-expanded')) !== 'true') await edit.click();
    await page.getByLabel('Jump to section').selectOption({ label: title });
    await page.waitForTimeout(150);
  };
  const tag = (re) => page.locator('svg').getByRole('button', { name: re });
  const focusedIn = (sel) => page.evaluate((s) => !!document.activeElement?.closest(s), sel);
  const closeCard = async () => {
    if (await side.isVisible()) await page.getByRole('button', { name: 'Close the card' }).click();
  };
  // Tap the drawing at the space until the pill is `depth` levels deep (each tap goes one space smaller, ADR-083).
  const tapTo = async (loc, depth) => {
    for (let n = 0; n < 6 && (await pill.getByRole('button').count()) < depth; n++)
      await loc.click({ force: true });
  };

  await page.goto(url);
  await page.getByRole('button', { name: 'New single piece' }).click();
  await page
    .locator('dialog[open]')
    .getByRole('button', { name: /Chest of drawers/ })
    .first()
    .click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  check(width, 'flag off: the sizes are not buttons', (await tag(/^Width \d+ mm$/).count()) === 0);
  await page.locator('details.more > summary').first().click();
  await page.getByRole('button', { name: /Canvas editor \(preview\)/ }).click();
  // First-run hints (ADR-289) open once; skip them.
  await page.waitForTimeout(200);
  if (await page.getByRole('dialog', { name: 'Getting started' }).isVisible())
    await page.getByRole('button', { name: 'Skip' }).click();
  await page.waitForTimeout(300);

  // 1. The whole piece's tags, each at least 44 px.
  for (const re of [/^Width \d+ mm$/, /^Height \d+ mm$/, /^Depth \d+ mm$/]) {
    const b = await tag(re).first().boundingBox();
    check(
      width,
      `tag ${re.source} on the drawing, ≥ 44 px`,
      !!b && b.width >= 43.5 && b.height >= 43.5,
    );
  }

  // 2. Width: the card opens with the Width field focused; 900 + Enter → the tag reads 900.
  await tag(/^Width \d+ mm$/)
    .first()
    .click();
  await page.waitForTimeout(400);
  const focusedLabel = await page.evaluate(() => {
    const el = document.activeElement;
    return el?.id ? (document.querySelector(`label[for="${el.id}"]`)?.textContent ?? '') : '';
  });
  check(
    width,
    'Width tag focuses the Width field in the card',
    (await side.isVisible()) && focusedLabel === 'Width',
  );
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('900');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  check(width, 'the tag reads 900 after typing 900', (await tag(/^Width 900 mm$/).count()) === 1);
  await page.screenshot({ path: `${out}/size-tags-width-${width}.png` });
  await closeCard();

  // 3. Divide the space side by side; a part's width tag opens Division with its size focused.
  const space = page.locator('.el-space').first();
  await tapTo(space, 2);
  await openOn('Divide this space');
  await side.getByRole('button', { name: 'Side by side', exact: true }).click();
  await closeCard();
  await tapTo(page.locator('.el-space').first(), 3);
  const partW = page.locator('svg .dim.subtle.tag:not([aria-label^="Depth"])');
  check(
    width,
    'a side-by-side part shows its width tag',
    /^Width \d+ mm$/.test((await partW.first().getAttribute('aria-label')) ?? ''),
  );
  await partW.first().click();
  await page.waitForTimeout(400);
  check(
    width,
    'part width tag opens Division with the part size focused',
    (await focusedIn('[data-lens-key="Division"]')) && (await focusedIn('[data-part-id]')),
  );
  await closeCard();

  // 4. Divide a part stacked; a stacked part's height tag does the same.
  await tapTo(page.locator('.el-space').first(), 3);
  await openOn('Divide this space');
  await side.getByRole('button', { name: 'Stacked', exact: true }).click();
  await closeCard();
  await tapTo(page.locator('.el-space').first(), 4);
  const partH = page.locator(
    'svg .dim.subtle.tag:not([aria-label^="Depth"])[aria-label^="Height"]',
  );
  check(width, 'a stacked part shows its height tag', (await partH.count()) === 1);
  await partH.first().click();
  await page.waitForTimeout(400);
  check(
    width,
    'part height tag opens Division with the part size focused',
    (await focusedIn('[data-lens-key="Division"]')) && (await focusedIn('[data-part-id]')),
  );
  await page.screenshot({ path: `${out}/size-tags-part-${width}.png` });
  check(width, 'no script errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length ? 1 : 0);
