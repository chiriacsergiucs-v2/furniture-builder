// Find-it acceptance for several selected pieces and groups (CLAUDE.md R3, backlog N95, ADR-097), against a production
// build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/multi-select/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// From the bare app, by visible text. 1440 px: box-select three pieces → drag one → all move; Group → a tap selects
// the group, the next tap the piece. 390 px: Select → tap two pieces → Delete → Undo brings them back. Not part of
// `pnpm test`.
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

for (const width of [1440, 390]) {
  const phone = width < 500;
  const ctx = await browser.newContext({
    viewport: { width, height: phone ? 844 : 900 },
    hasTouch: phone,
    isMobile: phone,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const shot = (name) =>
    page.screenshot({ path: `${out}/multi-select-${name}-${width}.png`, fullPage: true });
  const dlg = page.locator('dialog[open]');
  const click = async (loc) => {
    await loc.scrollIntoViewIfNeeded();
    await loc.click({ timeout: 3000 }).catch(() => loc.dispatchEvent('click'));
  };
  const btn = (name, exact = true) => page.getByRole('button', { name, exact });
  const plan = page.getByRole('figure', { name: /Room plan, seen from above/ });
  const drawing = plan.locator(':scope > svg');
  const pieces = plan.locator('g.plan-piece');
  const pressed = async () =>
    (await pieces.evaluateAll((gs) => gs.map((g) => g.getAttribute('aria-pressed')))).map(
      (v) => v === 'true',
    );
  const xs = async () =>
    pieces.evaluateAll((gs) => gs.map((g) => Number(g.querySelector('rect').getAttribute('x'))));
  const screen = (x, z) =>
    drawing.evaluate(
      (svg, [x, z]) => {
        const p = new DOMPoint(x, z).matrixTransform(svg.getScreenCTM());
        return { x: p.x, y: p.y };
      },
      [x, z],
    );
  const sheet = async (open) => {
    const peek = page.locator('.sheet-peek');
    if (!(await peek.isVisible().catch(() => false))) return;
    if (((await peek.getAttribute('aria-expanded')) === 'true') !== open) await peek.click();
    await page.waitForTimeout(250);
  };
  const addPiece = async (query) => {
    await sheet(true);
    await click(btn('Add a piece'));
    await dlg.getByRole('searchbox', { name: 'Search the items' }).fill(query);
    await dlg.locator('.start-group .row-btn').first().click();
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
    const place = btn('Place to the right');
    await place.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
    if (await place.isVisible()) await click(place);
    await page.waitForTimeout(150);
    await sheet(false);
  };
  /** Tap the centre of piece i on the plan (touch on the phone). */
  const tap = async (i) => {
    const b = await pieces.nth(i).locator('rect').boundingBox();
    if (phone) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(200);
  };

  // 1. Bare app → new project → three pieces.
  await page.goto(url);
  await click(btn('Create a new project'));
  await page.locator('dialog[open] input').fill(`Select ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  for (const q of ['Base cabinet', 'Base cabinet', 'Chest']) await addPiece(q);
  const planRadio = page.getByRole('radio', { name: 'Plan' });
  if (await planRadio.isVisible().catch(() => false)) await planRadio.click();
  check(width, 'three pieces on the plan', (await pieces.count()) === 3, `${await pieces.count()}`);

  if (!phone) {
    // 2. Box-select the three: drag on empty plan round them.
    // From just inside the drawing's bottom-left corner (empty plan) to its top-right corner.
    const r = await drawing.boundingBox();
    const a = { x: r.x + 6, y: r.y + r.height - 6 },
      b = { x: r.x + r.width - 6, y: r.y + 6 };
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++)
      await page.mouse.move(a.x + ((b.x - a.x) * i) / 8, a.y + ((b.y - a.y) * i) / 8);
    const boxSeen = await plan.locator('.select-box').isVisible();
    await page.mouse.up();
    await page.waitForTimeout(250);
    check(width, 'a selection box shows while dragging on empty plan', boxSeen);
    check(
      width,
      'the box selects all three',
      (await pressed()).every(Boolean),
      JSON.stringify(await pressed()),
    );
    check(
      width,
      'the panel says "Selected pieces" · "3 pieces"',
      (await page.getByText('Selected pieces', { exact: true }).isVisible()) &&
        (await page.getByText('3 pieces', { exact: true }).first().isVisible()),
    );
    await shot('boxed');

    // 3. Drag one of them: all three move by the same amount.
    const x0 = await xs();
    const pb = await pieces.nth(1).locator('rect').boundingBox();
    const s0 = { x: pb.x + pb.width / 2, y: pb.y + pb.height / 2 };
    const o = await screen(0, 0),
      e = await screen(400, 0);
    await page.mouse.move(s0.x, s0.y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(s0.x + ((e.x - o.x) * i) / 8, s0.y);
    await page.waitForTimeout(100);
    await page.mouse.up();
    await page.waitForTimeout(300);
    const x1 = await xs();
    const d = x1.map((v, i) => v - x0[i]);
    check(
      width,
      'dragging one moves all three by the same whole mm',
      d[0] !== 0 && d.every((v) => v === d[0]) && Number.isInteger(d[0]),
      JSON.stringify(d),
    );
    check(width, 'still all three selected', (await pressed()).every(Boolean));
    await shot('moved');

    // 4. Group → a tap on a piece selects the group, the next tap the piece.
    await click(btn('Group'));
    await page.waitForTimeout(200);
    check(
      width,
      'the group is listed as "Group 1"',
      await page.getByText('Group 1').first().isVisible(),
    );
    await btn('Clear selection').click();
    await page.waitForTimeout(200);
    check(
      width,
      'Clear selection: nothing selected',
      (await pressed()).every((v) => !v),
    );
    await tap(0);
    check(
      width,
      'a first tap on a grouped piece selects the whole group',
      (await pressed()).every(Boolean),
      JSON.stringify(await pressed()),
    );
    await tap(0);
    const p2 = await pressed();
    check(
      width,
      'the next tap selects just that piece',
      p2[0] && !p2[1] && !p2[2],
      JSON.stringify(p2),
    );
    await shot('group-then-piece');
    // Ctrl+A selects every piece.
    await pieces.nth(0).focus();
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(200);
    check(width, 'Ctrl+A selects every piece', (await pressed()).every(Boolean));
  } else {
    // 5. Phone: Select → tap two pieces → Delete → Undo brings them back.
    const sel = plan.getByRole('checkbox', { name: 'Select', exact: true });
    check(width, 'a "Select" checkbox is on the plan', await sel.isVisible());
    // The piece added last is selected: start from nothing selected (Esc).
    await page.keyboard.press('Escape');
    await click(sel);
    check(width, 'Select turns on', await sel.isChecked());
    await tap(0);
    await tap(2);
    const p = await pressed();
    check(width, 'two taps select two pieces', p[0] && !p[1] && p[2], JSON.stringify(p));
    await shot('two-selected');
    await sheet(true);
    await click(btn('Delete'));
    await dlg
      .getByRole('button', { name: 'Delete' })
      .click({ timeout: 3000 })
      .catch(() => {});
    await page.waitForTimeout(300);
    await sheet(false);
    check(width, 'Delete removes both', (await pieces.count()) === 1, `${await pieces.count()}`);
    await shot('deleted');
    await click(btn('Undo'));
    await page.waitForTimeout(300);
    check(width, 'Undo brings them back', (await pieces.count()) === 3, `${await pieces.count()}`);
    await click(sel);
  }

  check(
    width,
    'no sideways scroll',
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  );
  check(width, 'no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
