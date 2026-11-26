// Find-it for "Stacked in the edit panel does nothing" (Android report 2026-11-22), on a production build:
//   pnpm build && pnpm preview &  node tools/divide-lens/find-it.mjs [url] [out dir]
// With the canvas editor (the phone default, ADR-290), a project piece opened with "Edit Bookcase" fills the card;
// tapping Divide this space › Stacked split the space, but the card fell back to Overview and covered the drawing.
// Now the card follows to Division (Stacked chosen) and drops to half, so the drawing shows the split.
import { mkdirSync } from 'node:fs';
import { launchBrowser, makeChecker, outDir, previewUrl } from '../lib/harness.mjs';

const url = previewUrl();
const out = outDir();
mkdirSync(out, { recursive: true });
// This script tests the canvas editor as the phone default (ADR-290): no sheet-editor preset from the harness.
const browser = await launchBrowser({ appDefault: true });
const results = [];
const { check } = makeChecker(results);

for (const width of [360, 412]) {
  const ctx = await browser.newContext({
    viewport: { width, height: 839 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const wait = (ms = 400) => page.waitForTimeout(ms);
  const pill = page.getByRole('navigation', { name: 'Selection path' });
  const chip = (name) => page.locator('button:visible', { hasText: new RegExp(`^${name}$`) });

  await page.goto(url);
  await page.getByRole('button', { name: 'Create a new project' }).tap();
  await page.getByRole('button', { name: 'Create project' }).tap();
  await wait(800);
  if (await page.getByRole('dialog', { name: 'Getting started' }).isVisible())
    await page.getByRole('button', { name: 'Skip' }).tap();
  await page.getByRole('button', { name: 'Add a piece to the project' }).tap();
  await page
    .locator('dialog[open]')
    .getByRole('button', { name: /Bookcase/ })
    .first()
    .tap();
  await wait(800);
  await page.getByRole('button', { name: 'Edit Bookcase' }).tap();
  await wait(800);

  // "Edit Bookcase" opens the card full, over the drawing; lower it to pick the interior on the front view, where
  // the first tap on the piece selects it.
  await page.getByRole('button', { name: 'Shorter card' }).tap();
  await wait();
  const hit = await page
    .getByRole('button', { name: /^Bookcase, \d+ wide/ })
    .last()
    .boundingBox();
  const at = hit && { x: hit.x + hit.width / 2, y: hit.y + hit.height / 4 };
  if (at) await page.touchscreen.tap(at.x, at.y);
  await wait();
  check(width, 'pill reads "Interior"', (await pill.innerText()).includes('Interior'));

  await chip('Divide this space').first().tap();
  await wait();
  // Full card, as "Edit Bookcase" left it, so the drop to half is shown.
  await page.getByRole('button', { name: 'Taller card' }).tap();
  await wait();
  await page.getByRole('button', { name: 'Stacked', exact: true }).first().tap();
  await wait(600);

  // The card shows Division with Stacked chosen, not the overview.
  const stacked = page.getByRole('radio', { name: 'Stacked', exact: true });
  check(
    width,
    'after Stacked the card shows Division with "Stacked" chosen',
    (await stacked.isVisible()) && (await stacked.getAttribute('aria-checked')) === 'true',
  );
  check(
    width,
    'the overview ("Edit this piece") is not shown',
    !(await page.getByRole('button', { name: 'Edit this piece' }).isVisible()),
  );
  // The card is half, not full: "Taller card" is offered again.
  check(
    width,
    'the card dropped to half ("Taller card")',
    await page.getByRole('button', { name: 'Taller card' }).isVisible(),
  );
  await page.screenshot({ path: `${out}/divide-lens-${width}.png` });
  check(width, 'no script errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length ? 1 : 0);
