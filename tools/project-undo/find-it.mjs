// Find-it acceptance for undo in a project (CLAUDE.md R3, backlog N46, ADR-051), run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/project-undo/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
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

for (const width of [1440, 375]) {
  const phone = width < 500;
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 812 : 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const shot = (name) =>
    page.screenshot({ path: `${out}/project-undo-${name}-${width}.png`, fullPage: true });
  const pieces = page.locator('ul.pieces > li');
  const undo = page.getByRole('button', { name: 'Undo', exact: true });
  const redo = page.getByRole('button', { name: 'Redo', exact: true });
  // Phones (≤760 px, N82): the project panel is a bottom sheet; its peek row ("<project>: N pieces" or
  // "Selected: …") opens it. Elsewhere the panel is always shown and the peek row is hidden.
  const openSheet = async () => {
    const peek = page.locator('.sheet-peek');
    if ((await peek.isVisible()) && (await peek.getAttribute('aria-expanded')) === 'false')
      await peek.click();
  };
  const addPiece = async (search, name) => {
    await openSheet();
    await page.getByRole('button', { name: 'Add a piece' }).click();
    const dlg = page.locator('dialog[open]');
    await dlg.getByRole('searchbox', { name: 'Search the items' }).fill(search);
    await dlg.getByRole('button', { name }).first().click();
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
  };
  const rows = async () => (await pieces.allInnerTexts()).join(' | ');

  // 1. Bare app → Home → a project with two base cabinets side by side.
  await page.goto(url);
  await page.getByRole('button', { name: 'Create a new project' }).click();
  await page.locator('dialog[open] input').fill('Undo test');
  await page.locator('dialog[open]').getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await addPiece('Base cabinet', /Base cabinet, doors: 1 door \+ shelf/);
  await addPiece('Base cabinet', /Base cabinet, doors: Drawer over door/);
  check(width, 'two pieces in the project', (await pieces.count()) === 2);
  check(
    width,
    'Undo button visible and enabled in the project view',
    (await undo.isVisible()) && (await undo.isEnabled()),
  );

  // 2. Merge them (the confirmation now says undo brings them back).
  await openSheet();
  await pieces.nth(0).getByRole('button').click();
  await page
    .getByRole('button', { name: /^Merge with Base cabinet, drawer over door on the right$/ })
    .dispatchEvent('click');
  const dlg = page.locator('dialog[open]');
  check(
    width,
    'merge confirmation says Undo brings the pieces back',
    /Undo brings the two pieces back/.test(await dlg.innerText()),
  );
  await dlg.getByRole('button', { name: 'Merge', exact: true }).click();
  await page.waitForTimeout(300);
  check(width, 'one piece after merging', (await pieces.count()) === 1, await rows());
  await shot('merged');

  // 3. Undo → both pieces are back; Redo → merged again; Undo again.
  await undo.click();
  await page.waitForTimeout(300);
  const back = await rows();
  check(
    width,
    'Undo brings back both pieces',
    (await pieces.count()) === 2 && /1 door/.test(back) && /drawer over door/.test(back),
    back,
  );
  check(width, 'Redo enabled after undo', await redo.isEnabled());
  await redo.click();
  await page.waitForTimeout(300);
  check(width, 'Redo merges them again', (await pieces.count()) === 1);
  await undo.click();
  await page.waitForTimeout(300);

  // 4. Remove a piece, then Ctrl+Z brings it back.
  await openSheet();
  await pieces.nth(1).getByRole('button').click();
  await page.getByRole('button', { name: 'Remove from project' }).dispatchEvent('click');
  await page.locator('dialog[open]').getByRole('button', { name: 'Remove', exact: true }).click();
  await page.waitForTimeout(300);
  check(width, 'one piece after removing', (await pieces.count()) === 1);
  await page
    .locator('body')
    .click({ position: { x: 1, y: 1 } })
    .catch(() => {});
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(300);
  check(width, 'Ctrl+Z brings the removed piece back', (await pieces.count()) === 2, await rows());
  check(width, 'no sideways scroll', await noSideScroll());
  await shot('undone');

  // 5. After a reload the restored state was saved.
  await page.waitForTimeout(800);
  await page.reload();
  await page
    .getByRole('button', { name: /Undo test/ })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(500);
  if (await pieces.count())
    check(width, 'restored project was saved', (await pieces.count()) === 2);
  check(width, 'no page errors', errors.length === 0, errors.join(' / '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
