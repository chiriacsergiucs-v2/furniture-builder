// Find-it acceptance for dropping a catalog item from the piece list onto the 3D view (CLAUDE.md R3, backlog N432,
// ADR-303), run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/catalog-drop-3d/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at desktop width (the phone brings the plan forward when the list opens, ADR-094) and finds
// everything by visible text. Not part of `pnpm test`.
import { launchBrowser, previewUrl, outDir, makeChecker } from '../lib/harness.mjs';
import { mkdirSync } from 'node:fs';

const url = previewUrl();
const out = outDir();
mkdirSync(out, { recursive: true });
const browser = await launchBrowser();
const results = [];
const { check } = makeChecker(results);

for (const width of [1440]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const shot = (name) =>
    page.screenshot({ path: `${out}/catalog-drop-3d-${name}-${width}.png`, fullPage: false });
  const btn = (name, exact = true) => page.getByRole('button', { name, exact });
  const click = async (loc) => {
    await loc.scrollIntoViewIfNeeded();
    await loc.click({ timeout: 3000 }).catch((e) => {
      if (!/performing click action|click action done/.test(e.message))
        return loc.dispatchEvent('click');
    });
  };
  const list = page.getByRole('dialog', { name: 'Add a piece' });
  const item = list.getByRole('button', { name: /^Base cabinet/ }).first();
  // The plan's pieces are named "Base cabinet …, W by D mm"; counted with hidden ones in case the plan is covered.
  const pieces = page
    .getByRole('figure', { name: /Room plan, seen from above/, includeHidden: true })
    .getByRole('button', { name: /^Base cabinet.*, \d+ by \d+ mm$/, includeHidden: true });
  const canvas = page.locator('.view.three canvas');

  /** Drag the item to the screen point `end` with the mouse; with `cancel`, Esc before the release. */
  const dragTo = async (end, { cancel = false } = {}) => {
    await item.scrollIntoViewIfNeeded();
    const b = await item.boundingBox();
    const a = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    const steps = 12;
    for (let i = 1; i <= steps; i++)
      await page.mouse.move(a.x + ((end.x - a.x) * i) / steps, a.y + ((end.y - a.y) * i) / steps);
    await page.waitForTimeout(400);
    await shot(cancel ? 'dragging-esc' : 'dragging');
    if (cancel) await page.keyboard.press('Escape');
    await page.mouse.up();
    await page.waitForTimeout(500);
  };

  // 1. Bare app → new project → Compose → Add a piece → Both; the 3D view is on screen beside the plan.
  await page.goto(url);
  await click(btn('Create a new project'));
  await page.locator('dialog[open] input').fill(`Drop 3D ${width}`);
  await page.locator('dialog[open]').getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  const compose = page
    .getByRole('radio', { name: /Compose/ })
    .or(page.getByRole('tab', { name: /Compose/ }));
  if (
    await compose
      .first()
      .isVisible()
      .catch(() => false)
  )
    await compose.first().click();
  await click(btn('Add a piece'));
  await list.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
  await list.getByRole('searchbox', { name: 'Search the items' }).fill('Base cabinet');
  await page.waitForTimeout(200);
  check(width, '"Add a piece" opens the piece list', await list.isVisible());
  check(width, 'the list has "Base cabinet…"', await item.isVisible());
  // Both: the plan and the 3D view side by side (Add a piece keeps Both, ADR-094).
  const both = page.getByRole('radio', { name: 'Both', exact: true });
  if (
    (await both.isVisible().catch(() => false)) &&
    (await both.getAttribute('aria-checked')) !== 'true'
  )
    await click(both);
  await canvas.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  check(width, 'the 3D view is on screen with the list open', await canvas.isVisible());
  await page.waitForTimeout(1000);
  await shot('open');

  const cb = await canvas.boundingBox();
  const centre = { x: cb.x + cb.width / 2, y: Math.min(cb.y + cb.height * 0.6, 880) };

  // 2. Drag "Base cabinet" onto the 3D view: a new piece appears (on the plan, and in the project).
  const n0 = await pieces.count();
  await dragTo(centre);
  const n1 = await pieces.count();
  check(width, 'a drop on the 3D view adds a piece', n1 === n0 + 1, `${n0} → ${n1}`);
  await shot('dropped');

  // 3. Undo removes it in one step.
  await click(btn('Undo'));
  await page.waitForTimeout(400);
  check(width, 'Undo removes it', (await pieces.count()) === n0, `${await pieces.count()}`);

  // 4. Esc during a drag over the 3D view adds nothing.
  await dragTo(centre, { cancel: true });
  check(width, 'Esc during a drag adds nothing', (await pieces.count()) === n0);

  // 5. A release on the 3D view's toolbar (not the floor) adds nothing.
  const tb = await page.getByRole('toolbar', { name: /3D view tools|Place pieces in 3D/ }).first();
  const tbb = await tb.boundingBox().catch(() => null);
  if (tbb) {
    await dragTo({ x: tbb.x + 4, y: tbb.y + tbb.height / 2 });
    check(width, 'a release on the 3D toolbar adds nothing', (await pieces.count()) === n0);
  }

  // 6. With Snap off, two drops further right on the view land further right in the room (the floor point, not a
  //    fixed place): the new piece is selected and its Position shows where it landed.
  const snap = page.getByRole('checkbox', { name: 'Snap', exact: true }).first();
  if (await snap.isChecked().catch(() => false)) await click(snap);
  const fromLeft = async () =>
    Number(
      await page
        .getByLabel('From left', { exact: true })
        .first()
        .inputValue({ timeout: 3000 })
        .catch(() => 'NaN'),
    );
  // The 3D view alone (the list stays open), the Simple look, framed again by Reset view.
  await click(page.getByRole('radio', { name: '3D', exact: true }));
  await click(page.getByRole('radio', { name: 'Simple', exact: true }));
  await click(btn('Reset view'));
  await page.waitForTimeout(1000);
  check(width, 'the list stays open with the 3D view alone', await list.isVisible());
  const cb3 = await canvas.boundingBox();
  const n1b = await pieces.count();
  const y = cb3.y + cb3.height * 0.9;
  await dragTo({ x: cb3.x + cb3.width * 0.6, y });
  const x1 = await fromLeft();
  await dragTo({ x: cb3.x + cb3.width * 0.95, y });
  const x2 = await fromLeft();
  check(width, 'two drops add two pieces', (await pieces.count()) === n1b + 2);
  check(
    width,
    'a drop further right on the 3D view lands further right ("From left")',
    Number.isFinite(x1) && Number.isFinite(x2) && x2 > x1,
    `${x1} → ${x2}`,
  );
  await shot('two');

  check(
    width,
    'no sideways scroll',
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  );
  check(width, 'no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
