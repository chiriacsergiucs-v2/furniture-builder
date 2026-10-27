// Find-it acceptance for moving and turning project pieces in the 3D view (CLAUDE.md R3, backlog N91, ADR-093), run
// against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/move-3d/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text: a project with a base cabinet, the
// 3D view, **Move**, a drag on the piece that changes its "From left", one **Undo** putting it back, **Turn 90° ↺**
// turning it, and with Move off a drag that turns the view and moves nothing. Desktop drags with the mouse; the phone
// with real touch (CDP). Not part of `pnpm test`.
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
  const cdp = await ctx.newCDPSession(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const shot = (name) =>
    page.screenshot({ path: `${out}/move-3d-${name}-${width}.png`, fullPage: true });
  const dlg = page.locator('dialog[open]');
  const click = async (loc) => {
    await loc.scrollIntoViewIfNeeded();
    await loc.click({ timeout: 3000 }).catch(() => loc.dispatchEvent('click'));
  };
  const btn = (name, exact = true) => page.getByRole('button', { name, exact });
  // On a phone the project's pieces sit in the Compose sheet: open it to add or read, close it to see the view.
  const sheet = async (open) => {
    const peek = page.locator('.sheet-peek');
    if (!(await peek.isVisible().catch(() => false))) return;
    if (((await peek.getAttribute('aria-expanded')) === 'true') !== open) await peek.click();
    await page.waitForTimeout(200);
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
  const tools = page.getByRole('toolbar', { name: 'Place pieces in 3D' });
  const three = page.locator('.view.three');
  const canvas = three.locator('canvas');
  const move = tools.getByRole('button', { name: 'Move', exact: true });
  const note = three.getByText(/From left -?\d+ · From back -?\d+ mm/);
  /** The selected piece's "From left" and turn, read from the piece's fields (on a phone: Compose, then back). */
  const read = async () => {
    if (phone) {
      await page.getByRole('radio', { name: /Compose/ }).click();
      await page.waitForTimeout(300);
      await sheet(true);
    }
    await openGroup('Position');
    const field = page.getByLabel('From left', { exact: true }).first();
    if (!(await field.isVisible().catch(() => false))) {
      // Nothing selected yet: tap the piece on the plan, as a user would.
      await sheet(false);
      const onPlan = page
        .getByRole('figure', { name: /Room plan, seen from above/ })
        .getByRole('button', { name: /^Base cabinet.*, \d+ by \d+ mm$/ })
        .first();
      await click(onPlan);
      await page.waitForTimeout(200);
      await sheet(true);
      await openGroup('Position');
    }
    await field.scrollIntoViewIfNeeded().catch(() => {});
    const x = Number(await field.inputValue({ timeout: 3000 }).catch(() => 'NaN'));
    const turn =
      (await page
        .getByRole('radiogroup', { name: 'Turn' })
        .getByRole('radio', { checked: true })
        .textContent({ timeout: 3000 })
        .catch(() => '')) ?? '';
    if (phone) {
      await sheet(false);
      await to3d();
    }
    return { x, turn: turn.trim() };
  };
  const to3d = async () => {
    if (phone) await page.getByRole('radio', { name: /Build & Preview/ }).click();
    else await page.getByRole('radio', { name: '3D', exact: true }).click();
    await canvas.waitFor({ state: 'visible', timeout: 20000 });
    await page.waitForTimeout(1200);
  };
  const pixels = async () =>
    (await page.screenshot({ clip: await canvas.boundingBox() })).toString('base64');
  /** Press the canvas centre (the piece, framed there), drag dx px to the right in steps, release. */
  const drag = async (dx, name) => {
    const r = await canvas.boundingBox();
    const a = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    const steps = 10;
    const at = (i) => ({ x: a.x + (dx * i) / steps, y: a.y });
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
    await page.waitForTimeout(250);
    const seen = (await note.isVisible().catch(() => false))
      ? ((await note.textContent()) ?? '')
      : '';
    await shot(name);
    if (phone) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    else await page.mouse.up();
    await page.waitForTimeout(400);
    return seen;
  };

  // 1. Bare app → new project → one base cabinet → the 3D view.
  await page.goto(url);
  await click(btn('Create a new project'));
  await page.locator('dialog[open] input').fill(`Move 3D ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await addBase();
  await to3d();
  // The Simple look draws fast enough in a software-rendered browser (it is kept on this device).
  {
    const menu = page.locator('details.view-options');
    const inMenu = (await menu.count()) > 0;
    if (inMenu && !(await menu.evaluate((d) => d.open))) await menu.locator('summary').click();
    await page.getByRole('radio', { name: 'Simple' }).click();
    if (inMenu) await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
  }
  check(width, 'the 3D view shows the project', await canvas.isVisible());
  check(width, 'a "Move" button is over the 3D view', await move.isVisible());
  await shot('start');
  const start = await read();
  check(width, 'the piece has a "From left" value', Number.isFinite(start.x), `${start.x}`);

  // 2. Move on → drag the piece → "From left" changes; the label showed the drop while dragging.
  await click(move);
  check(width, 'Move turns on (pressed)', (await move.getAttribute('aria-pressed')) === 'true');
  const seen = await drag(phone ? 90 : 160, 'dragging');
  check(
    width,
    'while dragging, "From left … · From back … mm" shows over the 3D view',
    /From left -?\d+/.test(seen),
    seen,
  );
  check(width, 'the label is gone after release', !(await note.isVisible().catch(() => false)));
  const moved = await read();
  check(
    width,
    'the drag changed the piece’s "From left"',
    moved.x !== start.x && Number.isFinite(moved.x) && Number.isFinite(start.x),
    `${start.x} → ${moved.x}`,
  );
  check(
    width,
    'it landed where the label said',
    seen.includes(`From left ${moved.x} `),
    `${seen} / ${moved.x}`,
  );
  await shot('dropped');

  // 3. One Undo puts it back.
  if (phone) {
    await page.getByRole('radio', { name: /Compose/ }).click();
    await page.waitForTimeout(300);
  }
  await click(btn('Undo'));
  await page.waitForTimeout(300);
  if (phone) await to3d();
  const undone = await read();
  check(width, 'one Undo puts it back', undone.x === start.x, `${undone.x}`);

  // 4. Turn 90° ↺ over the 3D view turns the selected piece.
  await click(move);
  if ((await move.getAttribute('aria-pressed')) !== 'true') await click(move);
  // Pressing the piece with Move on selects it (a tap without moving).
  const r = await canvas.boundingBox();
  if (phone) await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
  else await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  await page.waitForTimeout(300);
  const turnBtn = tools.getByRole('button', { name: /Turn 90° anticlockwise/ });
  check(
    width,
    '"Turn 90° ↺" shows over the 3D view for the selected piece',
    await turnBtn.isVisible(),
  );
  await click(turnBtn);
  await page.waitForTimeout(400);
  const turned = await read();
  check(
    width,
    'Turn 90° ↺ turned the piece',
    turned.turn === '90°',
    `${start.turn} → ${turned.turn}`,
  );
  await shot('turned');

  // 5. Move off → a drag on the piece turns the view and moves nothing.
  if ((await move.getAttribute('aria-pressed')) === 'true') await click(move);
  check(width, 'Move turns off', (await move.getAttribute('aria-pressed')) === 'false');
  const before = await pixels();
  await drag(phone ? 90 : 160, 'orbit');
  await page.waitForTimeout(600);
  const after = await pixels();
  check(width, 'with Move off, dragging turns the view', before !== after);
  const still = await read();
  check(
    width,
    'with Move off, the piece did not move',
    still.x === turned.x,
    `${turned.x} → ${still.x}`,
  );

  check(width, 'no sideways scroll', await noSideScroll());
  check(width, 'no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
