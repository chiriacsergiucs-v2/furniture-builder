// Find-it acceptance for "Enter in a field is one undo step" (ADR-090, backlog N86), run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/enter-undo/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Enter used to commit and then blur, and the blur committed again: two undo steps per Enter. For a millimetre field,
// an edge band field and a clearance depth, a value typed + Enter must come back with one Undo. Not part of `pnpm test`.
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

for (const width of [1280, 390]) {
  const phone = width < 500;
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 } });
  const page = await ctx.newPage();
  // ADR-116: the selected piece's Position, Clearance, Finish and Merge are folded groups: open one by its title
  // (when it is on screen; a phone's closed sheet hides the whole card, which is read as before).
  const openGroup = async (title) => {
    const s = page
      .locator('details.group > summary')
      .filter({ hasText: new RegExp(`^${title}$`) })
      .first();
    if ((await s.isVisible()) && !(await s.evaluate((el) => el.parentElement.open)))
      await s.click({ timeout: 5000 });
  };
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const dlg = page.locator('dialog[open]');
  const undo = async () => {
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(250);
  };
  /** Type a value + Enter, then one Undo: the field shows the value before again. */
  const enterThenUndo = async (name, field, value) => {
    await field.scrollIntoViewIfNeeded();
    const before = await field.inputValue();
    await field.fill(value);
    await field.press('Enter');
    await page.waitForTimeout(250);
    const typed = await field.inputValue();
    await undo();
    const after = await field.inputValue();
    check(
      width,
      `${name}: typed + Enter, one Undo brings "${before}" back`,
      typed === value && after === before,
      `${before} → ${typed} → ${after}`,
    );
  };

  // 1. A piece: Settings › Width and an edge band width.
  await page.goto(url);
  await page.getByRole('button', { name: 'New single piece' }).click();
  await dlg
    .getByRole('button', { name: /Chest of drawers/ })
    .first()
    .click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Settings' }).click();
  await dlg.waitFor({ state: 'visible' });
  const widthField = dlg.getByLabel('Width', { exact: true }).first();
  await enterThenUndo('Width', widthField, String(Number(await widthField.inputValue()) + 10));
  const pal = dlg.getByRole('group', { name: 'Edge band for PAL 18 white' });
  const boards = dlg.locator('details.group', {
    has: page.locator('summary', { hasText: 'Boards, sheets and saw cut' }),
  });
  if ((await boards.count()) && !(await boards.first().evaluate((d) => d.open)))
    await boards.first().locator('summary').first().click();
  await pal.scrollIntoViewIfNeeded();
  // A band is saved once it has a type, a thickness and a width.
  await pal.getByLabel('Band type').selectOption({ label: 'ABS' });
  await pal.getByRole('radio', { name: '0.8 mm' }).click();
  await page.waitForTimeout(200);
  const bandWidth = pal.getByLabel('Band width (mm)');
  await bandWidth.fill('22');
  await bandWidth.press('Tab');
  await page.waitForTimeout(200);
  await enterThenUndo('Band width', bandWidth, '23');
  await dlg.getByRole('button', { name: 'Done' }).click();

  // 2. A project piece: its service zone depth (a clearance field).
  await page.goto(url);
  await page.getByRole('button', { name: 'Create a new project', exact: true }).click();
  await dlg.locator('input').fill(`Enter ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  const peek = page.locator('.sheet-peek');
  if (phone && (await peek.getAttribute('aria-expanded')) !== 'true') await peek.click();
  await page.getByRole('button', { name: 'Add a piece', exact: true }).click();
  await dlg.getByRole('searchbox', { name: 'Search the items' }).fill('Base cabinet');
  await dlg.locator('.start-group .row-btn').first().click();
  await dlg.waitFor({ state: 'detached' }).catch(() => {});
  const place = page.getByRole('button', { name: 'Place to the right', exact: true });
  if (await place.isVisible()) await place.click();
  if (phone && (await peek.getAttribute('aria-expanded')) !== 'true') await peek.click();
  await openGroup('Clearance');
  const zones = page.getByRole('group', { name: 'Clearance zones' });
  await zones.scrollIntoViewIfNeeded();
  await zones.getByRole('radio', { name: 'Front' }).click();
  await page.waitForTimeout(200);
  await enterThenUndo('Service zone depth', zones.getByLabel('Service zone depth'), '650');

  check(width, 'no page errors', errors.length === 0, errors.join(' / '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
