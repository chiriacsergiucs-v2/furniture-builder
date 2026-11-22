// Find-it acceptance for divide handles and dividers on the drawing (ADR-285, backlog N368), on a production build:
//   pnpm build && pnpm preview &  node tools/divide-handles/find-it.mjs [url] [out dir]
// Starts from the bare app at 360 and 390 px, turns the canvas editor on from More, divides a space with the + handles
// and moves the divider by drag and by arrow keys.
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
  const drawing = page.locator('svg.elevation, figure svg').first();
  const handle = (name) => drawing.getByRole('button', { name, exact: true });
  const tapTo = async (depth) => {
    for (let n = 0; n < 6 && (await pill.getByRole('button').count()) < depth; n++)
      await page.locator('.el-space').first().click({ force: true });
  };

  await page.goto(url);
  await page.getByRole('button', { name: 'New single piece' }).click();
  await page
    .locator('dialog[open]')
    .getByRole('button', { name: /Chest of drawers/ })
    .first()
    .click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await page.locator('details.more > summary').first().click();
  await page.getByRole('button', { name: /Canvas editor \(preview\)/ }).click();
  await page.waitForTimeout(300);
  await tapTo(2);

  // 1. An undivided selected space shows both + handles, each at least 44 px.
  for (const name of ['Divide side by side', 'Divide stacked']) {
    const b = await handle(name).boundingBox();
    check(width, `"${name}" on the drawing, ≥ 44 px`, !!b && b.width >= 43.5 && b.height >= 43.5);
  }

  // 2. Side by side: one more space, and a divider shows.
  const before = await page.locator('.el-space').count();
  await handle('Divide side by side').click();
  await page.waitForTimeout(300);
  check(
    width,
    'side by side adds a space',
    (await page.locator('.el-space').count()) === before + 1,
  );
  const bar = drawing.getByRole('slider', { name: 'Divider 1 of 1' });
  check(width, 'the split shows "Divider 1 of 1"', (await bar.count()) === 1);

  // 3. Drag the divider right: the first part grows; one Undo puts it back.
  const v0 = Number(await bar.getAttribute('aria-valuenow'));
  const bb = (await bar.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
  const cx = bb.x + bb.width / 2,
    cy = bb.y + bb.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 20, cy, { steps: 4 });
  await page.mouse.move(cx + 40, cy, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const v1 = Number(await bar.getAttribute('aria-valuenow'));
  check(width, 'dragging right makes the first part wider', v1 > v0, `${v0} → ${v1} mm`);
  await page.screenshot({ path: `${out}/divide-drag-${width}.png` });
  await page.getByRole('button', { name: /^Undo/ }).first().click();
  await page.waitForTimeout(300);
  check(
    width,
    'one Undo puts the size back',
    Number(
      await drawing.getByRole('slider', { name: 'Divider 1 of 1' }).getAttribute('aria-valuenow'),
    ) === v0,
  );

  // 4. Keyboard: → on the focused divider adds 10 mm.
  await drawing.getByRole('slider', { name: 'Divider 1 of 1' }).focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);
  check(
    width,
    '→ on the divider adds 10 mm',
    Number(
      await drawing.getByRole('slider', { name: 'Divider 1 of 1' }).getAttribute('aria-valuenow'),
    ) ===
      v0 + 10,
  );

  // 5. Stacked on a part.
  await tapTo(3);
  const n3 = await page.locator('.el-space').count();
  await handle('Divide stacked').click();
  await page.waitForTimeout(300);
  check(width, 'stacked adds a space', (await page.locator('.el-space').count()) === n3 + 1);
  await page.screenshot({ path: `${out}/divide-stacked-${width}.png` });
  // 6. Flag off: a selected space has no handles.
  await page.locator('details.more > summary').first().click();
  await page.getByRole('button', { name: /Canvas editor \(preview\)/ }).click();
  await page.waitForTimeout(300);
  check(width, 'flag off: no divide handles', (await handle('Divide stacked').count()) === 0);
  check(width, 'no script errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length ? 1 : 0);
