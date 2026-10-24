// Find-it acceptance for dragging a piece on the plan (CLAUDE.md R3, backlog N60, ADR-065; ADR-066 catch-up), run
// against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/plan-drag/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text. Desktop drags with the mouse; the
// phone drags with real touch events (CDP), so `touch-action: none` is exercised too. Not part of `pnpm test`.
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
  const ctx = await browser.newContext({
    viewport: { width, height: phone ? 812 : 900 },
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
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const shot = (name) =>
    page.screenshot({ path: `${out}/plan-drag-${name}-${width}.png`, fullPage: true });
  const dlg = page.locator('dialog[open]');
  const click = async (loc) => {
    await loc.scrollIntoViewIfNeeded();
    await loc.click({ timeout: 3000 }).catch(() => loc.dispatchEvent('click'));
  };
  const btn = (name, exact = true) => page.getByRole('button', { name, exact });
  const fromLeft = async () =>
    Number(await page.getByLabel('From left', { exact: true }).first().inputValue());
  const plan = page.getByRole('figure', { name: /Room plan, seen from above/ });
  const piece = plan.getByRole('button', { name: /^Base cabinet.*, \d+ by \d+ mm$/ }).first();
  const label = plan.getByText(/From left \d+ · From back \d+ mm/);
  /** Screen point of a room point (mm) on the plan. */
  const screen = (x, z) =>
    plan.locator('svg').evaluate(
      (svg, [x, z]) => {
        const p = new DOMPoint(x, z).matrixTransform(svg.getScreenCTM());
        return { x: p.x, y: p.y };
      },
      [x, z],
    );
  /** Press the piece's centre, move it by dx mm to the right in steps, and report what was seen mid-drag. */
  const drag = async (dx, { cancel = false } = {}) => {
    await piece.scrollIntoViewIfNeeded();
    const box = await piece.locator('rect').first().boundingBox();
    const a = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const o = await screen(0, 0),
      e = await screen(dx, 0);
    const b = { x: a.x + (e.x - o.x), y: a.y };
    const scrollY = await page.evaluate(() => window.scrollY);
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
    const seen = (await label.isVisible()) ? ((await label.textContent()) ?? '') : '';
    await shot(cancel ? 'dragging-esc' : 'dragging');
    if (cancel) await page.keyboard.press('Escape');
    if (phone) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    else await page.mouse.up();
    await page.waitForTimeout(200);
    const scrolled = (await page.evaluate(() => window.scrollY)) !== scrollY;
    return { seen, scrolled };
  };

  // 1. Bare app → new project → one base cabinet, placed.
  await page.goto(url);
  await click(btn('Create a new project'));
  await page.locator('dialog[open] input').fill(`Drag ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await click(btn('Add a piece'));
  await dlg.getByRole('searchbox', { name: 'Search the items' }).fill('Base cabinet');
  await dlg.locator('.start-group .row-btn').first().click();
  await dlg.waitFor({ state: 'detached' }).catch(() => {});
  if (await btn('Place to the right').isVisible()) await click(btn('Place to the right'));
  const planRadio = page.getByRole('radio', { name: 'Plan' });
  if (await planRadio.isVisible().catch(() => false)) await planRadio.click();
  check(width, 'the plan "Room plan, seen from above" is visible', await plan.isVisible());
  check(width, 'the piece is on the plan as "Base cabinet…, W by D mm"', await piece.isVisible());
  await click(piece);
  const x0 = await fromLeft();

  // 2. Drag 500 mm to the right: outline + label while dragging, one move on release, one undo step.
  const d = await drag(500);
  check(
    width,
    'while dragging, "From left … · From back … mm" is shown',
    /From left \d+/.test(d.seen),
    d.seen,
  );
  check(width, 'the label is gone after release', !(await label.isVisible()));
  const x1 = await fromLeft();
  check(
    width,
    'the piece moved about 500 mm, on the 10 mm step',
    Math.abs(x1 - x0 - 500) <= 20 && (x1 - x0) % 10 === 0,
    `${x0} → ${x1}`,
  );
  check(width, 'the label showed the drop position', d.seen.includes(`From left ${x1} `), d.seen);
  if (phone) check(width, 'the touch drag did not scroll the page', !d.scrolled);
  await shot('dropped');
  await click(btn('Undo'));
  await page.waitForTimeout(200);
  await click(piece);
  check(width, 'one Undo puts it back', (await fromLeft()) === x0, `${await fromLeft()}`);

  // 3. Esc while dragging cancels: nothing moves.
  if (!phone) {
    await drag(300, { cancel: true });
    check(width, 'Esc cancels the drag', (await fromLeft()) === x0, `${await fromLeft()}`);
  }

  // 4. Arrow keys on the focused piece: 10 mm, Shift 100 mm.
  await piece.focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(150);
  check(width, 'ArrowRight moves 10 mm', (await fromLeft()) === x0 + 10, `${await fromLeft()}`);
  await piece.focus();
  await page.keyboard.press('Shift+ArrowRight');
  await page.waitForTimeout(150);
  check(
    width,
    'Shift+ArrowRight moves 100 mm',
    (await fromLeft()) === x0 + 110,
    `${await fromLeft()}`,
  );

  // 5. Phone: a tap still selects, and a swipe on the empty plan still scrolls the page.
  if (phone) {
    // A second piece takes the selection, so the tap on the first one has something to change.
    await click(btn('Add a piece'));
    await dlg.getByRole('searchbox', { name: 'Search the items' }).fill('Base cabinet');
    await dlg.locator('.start-group .row-btn').first().click();
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
    if (await btn('Place to the right').isVisible()) await click(btn('Place to the right'));
    await page.waitForTimeout(150);
    const before0 = await piece.getAttribute('aria-pressed');
    await piece.scrollIntoViewIfNeeded();
    const box = await piece.locator('rect').first().boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(150);
    check(
      width,
      'a tap on an unselected piece selects it',
      before0 === 'false' && (await piece.getAttribute('aria-pressed')) === 'true',
      `aria-pressed ${before0} → ${await piece.getAttribute('aria-pressed')}`,
    );
    const svgBox = await plan.locator('svg').boundingBox();
    const empty = { x: svgBox.x + 4, y: svgBox.y + svgBox.height - 4 };
    const before = await page.evaluate(() => window.scrollY);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [empty] });
    for (let i = 1; i <= 8; i++)
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: empty.x, y: empty.y - i * 25 }],
      });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => window.scrollY);
    check(
      width,
      'a swipe on the empty plan still scrolls the page',
      after > before,
      `${before} → ${after}`,
    );
  }

  check(width, 'no sideways scroll', await noSideScroll());
  check(width, 'no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
