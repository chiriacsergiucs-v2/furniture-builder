// Find-it acceptance for ADR-122 (CLAUDE.md R3, backlog N123): align Top and Bottom, Lock size, the 3D height handle
// and Section / Isolate, against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/research-batch-2/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// From the bare app at 1440 and 390 px, by visible text: two wall cabinets → select both → "Align bottom" →
// "Lock size" → "Size locked" and "Size locked — unlock to change" → 3D, Move, the "Change height" handle dragged up →
// "From floor … mm" → "Section" with "Width" / "Height" / "Depth" and "Cut at … mm" → "Isolate". Not part of `pnpm test`.
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
  const ctx = await browser.newContext({
    viewport: { width, height: phone ? 844 : 900 },
    hasTouch: phone,
    isMobile: phone,
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const shot = (name) =>
    page.screenshot({ path: `${out}/batch2-${name}-${width}.png`, fullPage: !phone });
  const dlg = page.locator('dialog[open]');
  const click = async (loc) => {
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    await loc.click({ timeout: 3000 }).catch(() => loc.dispatchEvent('click'));
  };
  const btn = (name, exact = true) => page.getByRole('button', { name, exact });
  /** Click a toggle until it reads `want` (the first tap after a touch drag can be taken by the view). */
  const toggle = async (loc, want) => {
    for (let i = 0; i < 3 && (await loc.getAttribute('aria-pressed')) !== String(want); i++) {
      await click(loc);
      await page.waitForTimeout(500);
    }
    return (await loc.getAttribute('aria-pressed')) === String(want);
  };
  const plan = page.getByRole('figure', { name: /Room plan, seen from above/ });
  const pieces = plan.locator('g.plan-piece');
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
  const tap = async (i) => {
    const b = await pieces.nth(i).locator('rect').first().boundingBox();
    if (phone) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    // Apart enough that two taps are not read as a double tap.
    await page.waitForTimeout(600);
  };
  const toPlan = async () => {
    if (phone) await page.getByRole('radio', { name: /Build & Preview/ }).click();
    const planRadio = page.getByRole('radio', { name: 'Plan' });
    if (await planRadio.isVisible().catch(() => false)) await planRadio.click();
    await page.waitForTimeout(300);
  };
  const three = page.locator('.view.three');
  const canvas = three.locator('canvas');
  const to3d = async () => {
    if (phone) await page.getByRole('radio', { name: /Build & Preview/ }).click();
    await page.getByRole('radio', { name: '3D', exact: true }).click();
    await canvas.waitFor({ state: 'visible', timeout: 20000 });
    await page.waitForTimeout(1200);
  };
  /** Press `from`, move by (dx, dy) px in steps, take a picture, release; mouse on a desktop, touch on a phone. */
  const drag = async (from, dx, dy, name) => {
    const steps = 10;
    const at = (i) => ({ x: from.x + (dx * i) / steps, y: from.y + (dy * i) / steps });
    if (phone) {
      const touch = (type, p) =>
        cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y }] : [] });
      await touch('touchStart', from);
      for (let i = 1; i <= steps; i++) await touch('touchMove', at(i));
    } else {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      for (let i = 1; i <= steps; i++) await page.mouse.move(at(i).x, at(i).y);
    }
    await page.waitForTimeout(300);
    await shot(name);
    const note =
      (await three
        .locator('.three-drag-note')
        .textContent()
        .catch(() => '')) ?? '';
    if (phone) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    else await page.mouse.up();
    await page.waitForTimeout(400);
    return note;
  };

  // 1. Bare app → new project → two wall cabinets.
  await page.goto(url);
  await click(btn('Create a new project'));
  await page.locator('dialog[open] input').fill(`Batch 2 ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  for (const q of ['Wall cabinet', 'Wall cabinet']) await addPiece(q);
  await toPlan();

  // 2. Select both → Align Top and Bottom are offered → Align bottom.
  if (phone) {
    // The piece just added is selected: start from none.
    await page.keyboard.press('Escape');
    await click(plan.getByRole('checkbox', { name: 'Select', exact: true }));
    for (const i of [0, 1]) await tap(i);
  } else {
    await tap(0);
    await page.keyboard.down('Shift');
    await tap(1);
    await page.keyboard.up('Shift');
  }
  const pressed = await pieces.evaluateAll((gs) => gs.map((g) => g.getAttribute('aria-pressed')));
  check(
    width,
    'both wall cabinets selected',
    pressed.every((v) => v === 'true'),
    JSON.stringify(pressed),
  );
  // On a phone the cards are under Compose.
  const compose = async () => {
    if (phone) await page.getByRole('radio', { name: /Compose/ }).click();
    await page.waitForTimeout(300);
  };
  await compose();
  const top = btn('Align top');
  const bottom = btn('Align bottom');
  check(
    width,
    'Align "Top" and "Bottom" are offered for two selected pieces',
    (await top.isVisible().catch(() => false)) && (await bottom.isVisible().catch(() => false)),
  );
  await top.scrollIntoViewIfNeeded().catch(() => {});
  await shot('align');
  await click(bottom);
  await toPlan();
  if (phone) await click(plan.getByRole('checkbox', { name: 'Select', exact: true }));
  await page.keyboard.press('Escape');

  // 3. One piece → Lock size → "Size locked" and the hint by its size fields.
  await tap(0);
  await compose();
  const lockSize = btn('Lock size');
  check(
    width,
    '"Lock size" is on the selected-piece card',
    await lockSize.isVisible().catch(() => false),
  );
  await click(lockSize);
  await page.waitForTimeout(200);
  check(
    width,
    'the card says "Size locked"',
    await page.getByText('Size locked', { exact: true }).first().isVisible(),
  );
  const hint = page.getByText('Size locked — unlock to change').first();
  check(
    width,
    'the size fields say "Size locked — unlock to change"',
    await hint.isVisible().catch(() => false),
  );
  check(
    width,
    '"Unlock size" is offered',
    await btn('Unlock size')
      .isVisible()
      .catch(() => false),
  );
  await hint.scrollIntoViewIfNeeded().catch(() => {});
  await shot('size-lock');

  // 4. 3D → Move → the "Change height" handle → drag up → "From floor … mm".
  await to3d();
  {
    const menu = page.locator('details.view-options');
    const inMenu = (await menu.count()) > 0;
    if (inMenu && !(await menu.evaluate((d) => d.open))) await menu.locator('summary').click();
    await page
      .getByRole('radio', { name: 'Simple' })
      .click()
      .catch(() => {});
    if (inMenu) await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
  }
  const tools = page.getByRole('toolbar', { name: 'Place pieces in 3D' });
  const move = tools.getByRole('button', { name: 'Move', exact: true });
  // The view may still be settling after the look changed.
  await toggle(move, true);
  check(width, 'Move turns on (pressed)', (await move.getAttribute('aria-pressed')) === 'true');
  const handle = btn('Change height');
  if (!(await handle.isVisible().catch(() => false))) {
    // Nothing selected in this view: tap a wall cabinet (pressing a piece in Move mode selects it).
    const r = await canvas.boundingBox();
    const c = { x: r.x + r.width * 0.35, y: r.y + r.height / 2 };
    if (phone) await page.touchscreen.tap(c.x, c.y);
    else await page.mouse.click(c.x, c.y);
    await page.waitForTimeout(500);
  }
  check(
    width,
    'Move mode shows a "Change height" handle on the wall unit',
    await handle.isVisible().catch(() => false),
  );
  const hb = (await handle.isVisible().catch(() => false)) ? await handle.boundingBox() : null;
  if (!hb) await shot('move');
  if (hb) {
    const note = await drag({ x: hb.x + hb.width / 2, y: hb.y + hb.height / 2 }, 0, -60, 'height');
    check(width, 'dragging it shows "From floor … mm"', /From floor \d+ mm/.test(note), note);
  }
  await toggle(move, false);

  // 5. Section → Width / Height / Depth and "Cut at … mm"; Isolate.
  const section = tools.getByRole('button', { name: 'Section', exact: true });
  check(width, '"Section" is in the 3D toolbar', await section.isVisible().catch(() => false));
  await toggle(section, true);
  check(
    width,
    'Section offers "Width", "Height", "Depth" and "Cut at … mm"',
    (await tools.getByRole('button', { name: 'Width', exact: true }).isVisible()) &&
      (await tools.getByRole('button', { name: 'Height', exact: true }).isVisible()) &&
      (await tools.getByRole('button', { name: 'Depth', exact: true }).isVisible()) &&
      (await tools.getByText(/Cut at -?\d+ mm/).isVisible()),
  );
  await shot('section');
  const isolate = tools.getByRole('button', { name: 'Isolate', exact: true });
  check(
    width,
    '"Isolate" is offered with a piece selected',
    await isolate.isVisible().catch(() => false),
  );
  await toggle(section, false);
  await toggle(isolate, true);
  check(
    width,
    'Isolate turns on (pressed)',
    (await isolate.getAttribute('aria-pressed')) === 'true',
  );
  await shot('isolate');

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
