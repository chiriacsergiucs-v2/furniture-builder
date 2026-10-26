// Find-it acceptance for locking a piece (CLAUDE.md R3, backlog N93, ADR-095), run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/lock-piece/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at 1440 and 390 px and finds everything by visible text: select a piece → Lock → dragging
// it does not move it and "Locked" shows → Unlock → it moves. Desktop drags with the mouse; the phone with real touch
// events (CDP). Not part of `pnpm test`.
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
  const cdp = await ctx.newCDPSession(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const shot = (name) =>
    page.screenshot({ path: `${out}/lock-piece-${name}-${width}.png`, fullPage: true });
  const dlg = page.locator('dialog[open]');
  const click = async (loc) => {
    await loc.scrollIntoViewIfNeeded();
    await loc.click({ timeout: 3000 }).catch(() => loc.dispatchEvent('click'));
  };
  const btn = (name, exact = true) => page.getByRole('button', { name, exact });
  const plan = page.getByRole('figure', { name: /Room plan, seen from above/ });
  const piece = plan.getByRole('button', { name: /^Base cabinet.*, \d+ by \d+ mm/ }).first();
  const drawing = plan.locator(':scope > svg');
  /** The piece's left edge on the plan, room mm (the drawing's own coordinates). */
  const planX = async () => Number(await piece.locator('rect').first().getAttribute('x'));
  const screen = (x, z) =>
    drawing.evaluate(
      (svg, [x, z]) => {
        const p = new DOMPoint(x, z).matrixTransform(svg.getScreenCTM());
        return { x: p.x, y: p.y };
      },
      [x, z],
    );
  /** Drag the piece by dx mm; returns the plan's status note seen mid-drag. */
  const drag = async (dx) => {
    await piece.scrollIntoViewIfNeeded();
    const box = await piece.locator('rect').first().boundingBox();
    const a = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const o = await screen(0, 0),
      e = await screen(dx, 0);
    const b = { x: a.x + (e.x - o.x), y: a.y };
    const steps = 8;
    const at = (i) => ({ x: a.x + ((b.x - a.x) * i) / steps, y: a.y });
    if (phone) {
      const touch = (type, p) =>
        cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y }] : [] });
      await touch('touchStart', a);
      for (let i = 1; i <= steps; i++) await touch('touchMove', at(i));
    } else {
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      for (let i = 1; i <= steps; i++) await page.mouse.move(at(i).x, at(i).y);
    }
    await page.waitForTimeout(100);
    const note = plan.locator('.plan-drag-note');
    const seen = (await note.isVisible()) ? ((await note.textContent()) ?? '') : '';
    await shot(`dragging-${dx}`);
    if (phone) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    else await page.mouse.up();
    await page.waitForTimeout(250);
    return seen;
  };
  const sheet = async (open) => {
    const peek = page.locator('.sheet-peek');
    if (!(await peek.isVisible().catch(() => false))) return;
    if (((await peek.getAttribute('aria-expanded')) === 'true') !== open) await peek.click();
    await page.waitForTimeout(250);
  };
  const addBase = async () => {
    await sheet(true);
    await click(btn('Add a piece'));
    await dlg.getByRole('searchbox', { name: 'Search the items' }).fill('Base cabinet');
    await dlg.locator('.start-group .row-btn').first().click();
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
    const place = btn('Place to the right');
    await place.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
    if (await place.isVisible()) await click(place);
    await page.waitForTimeout(150);
    await sheet(false);
  };

  // 1. Bare app → new project → one base cabinet.
  await page.goto(url);
  await click(btn('Create a new project'));
  await page.locator('dialog[open] input').fill(`Lock ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await addBase();
  const planRadio = page.getByRole('radio', { name: 'Plan' });
  if (await planRadio.isVisible().catch(() => false)) await planRadio.click();
  check(width, 'the plan "Room plan, seen from above" is visible', await plan.isVisible());

  // 2. Select it → Lock.
  await click(piece);
  await page.waitForTimeout(150);
  await sheet(true);
  const lockBtn = btn('Lock');
  check(width, 'the selected piece card shows "Lock"', await lockBtn.isVisible());
  await click(lockBtn);
  await page.waitForTimeout(200);
  check(width, '"Unlock" replaces it', await btn('Unlock').isVisible());
  check(
    width,
    'the card says "Locked — unlock to move"',
    await page
      .getByText(/Locked — unlock to move/)
      .first()
      .isVisible(),
  );
  await shot('locked-card');
  await sheet(false);
  const badge = plan.locator('.lock-badge', { hasText: 'Locked' });
  check(width, '"Locked" shows on the piece in the plan', await badge.first().isVisible());
  check(
    width,
    'the piece is announced as locked',
    /, locked$/.test((await piece.getAttribute('aria-label')) ?? ''),
  );

  // The 3D view marks it too.
  const r3d = page.getByRole('radio', { name: '3D' });
  if (await r3d.isVisible().catch(() => false)) {
    const xBefore3d = await planX();
    await r3d.click();
    const b3d = page.locator('.lock-badge-3d', { hasText: 'Locked' });
    await b3d
      .first()
      .waitFor({ state: 'visible', timeout: 15000 })
      .catch(() => {});
    check(width, '"Locked" shows over the piece in 3D', await b3d.first().isVisible());
    await page.waitForTimeout(500);
    await shot('locked-3d');
    // Dragging it in 3D (ADR-093, Move on) does not move it either; the note says why.
    const three = page.locator('.view.three');
    const canvas = three.locator('canvas');
    const move = page
      .getByRole('toolbar', { name: 'Place pieces in 3D' })
      .getByRole('button', { name: 'Move', exact: true });
    // The Simple look draws fast enough in a software-rendered browser (as tools/move-3d does).
    await page.getByRole('radio', { name: 'Simple' }).click();
    await page.waitForTimeout(800);
    await click(move);
    const r = await canvas.boundingBox();
    // Below the "Locked" label, still on the piece.
    const a = { x: r.x + r.width / 2, y: r.y + r.height * 0.62 };
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(a.x + 16 * i, a.y);
    await page.waitForTimeout(250);
    const note3d = three.locator('.three-drag-note');
    const seen3d = (await note3d.isVisible().catch(() => false))
      ? ((await note3d.textContent()) ?? '')
      : '';
    await shot('locked-3d-drag');
    await page.mouse.up();
    await page.waitForTimeout(400);
    check(
      width,
      'dragging it in 3D shows "Locked — unlock to move"',
      /Locked — unlock to move/.test(seen3d),
      seen3d,
    );
    await click(move);
    await planRadio.click();
    await page.waitForTimeout(200);
    check(
      width,
      'the 3D drag did not move it',
      (await planX()) === xBefore3d,
      `${xBefore3d} → ${await planX()}`,
    );
    await page.waitForTimeout(200);
  }

  // 3. Dragging it does not move it, and "Locked" shows.
  const x0 = await planX();
  const seen = await drag(500);
  check(
    width,
    'while dragging, "Locked — unlock to move" shows',
    /Locked — unlock to move/.test(seen),
    seen,
  );
  const x1 = await planX();
  check(width, 'the locked piece did not move', x1 === x0, `${x0} → ${x1}`);
  const note = plan.locator('.plan-drag-note');
  check(
    width,
    'after the drop the plan says why (names the piece, "locked")',
    (await note.isVisible()) && /Base cabinet.* is locked/.test((await note.textContent()) ?? ''),
    (await note.textContent().catch(() => '')) ?? '',
  );
  // Arrow keys refuse too.
  await piece.focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(150);
  check(width, 'ArrowRight does not move it either', (await planX()) === x0, `${await planX()}`);
  await shot('locked-dragged');

  // 4. Unlock → it moves.
  await click(piece);
  await sheet(true);
  await click(btn('Unlock'));
  await page.waitForTimeout(200);
  check(width, '"Lock" is back after Unlock', await btn('Lock').isVisible());
  await sheet(false);
  check(width, 'the "Locked" badge is gone', (await badge.count()) === 0);
  const seen2 = await drag(500);
  const x2 = await planX();
  check(
    width,
    'unlocked, the drag moves it about 500 mm',
    Math.abs(x2 - x0 - 500) <= 20,
    `${x0} → ${x2} (${seen2})`,
  );
  await shot('unlocked-moved');

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
