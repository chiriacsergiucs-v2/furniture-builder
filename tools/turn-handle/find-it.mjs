// Find-it acceptance for the turn handle (CLAUDE.md R3, backlog N172, ADR-169), run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/turn-handle/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text: a base cabinet in a project; its
// round "Turn …" handle; dragging it shows the angle and turns the piece to that whole degree; near a quarter turn
// it snaps; Shift steps by 15°; [ and ] turn by 1°; Undo turns it back; Esc during a drag restores the angle and the
// click that follows does not open the piece. Not part of `pnpm test`.
import { launchBrowser, previewUrl, outDir } from '../lib/harness.mjs';
import { mkdirSync } from 'node:fs';

const url = previewUrl();
const out = outDir();
mkdirSync(out, { recursive: true });
const browser = await launchBrowser();
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
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const shot = (name) => page.screenshot({ path: `${out}/turn-${name}-${width}.png` });
  const dlg = page.locator('dialog[open]');
  const click = async (loc) => {
    await loc.scrollIntoViewIfNeeded();
    await loc.click({ timeout: 3000 }).catch(() => loc.dispatchEvent('click'));
  };
  const btn = (name, exact = true) => page.getByRole('button', { name, exact });
  const sheet = async (open) => {
    const peek = page.locator('.sheet-peek');
    if (!(await peek.isVisible().catch(() => false))) return;
    if (((await peek.getAttribute('aria-expanded')) === 'true') !== open) await peek.click();
    await page.waitForTimeout(200);
  };
  const plan = page.getByRole('figure', { name: /Room plan, seen from above/ });
  const piece = plan.getByRole('button', { name: /^Base cabinet.*, \d+ by \d+ mm$/ }).first();
  const handle = plan.getByRole('slider', { name: /^Turn Base cabinet/ });
  const knob = plan.locator('.turn-knob');
  const label = plan.locator('.turn-label');
  const ghost = plan.locator('.turn-ghost');
  const drawing = plan.locator(':scope > svg');
  const planRadio = page.getByRole('radio', { name: '2D' });
  const showPlan = async () => {
    await sheet(false);
    if (await planRadio.isVisible().catch(() => false)) await planRadio.click();
    await page.waitForTimeout(150);
  };
  const screen = (x, z) =>
    drawing.evaluate(
      (svg, [x, z]) => {
        const p = new DOMPoint(x, z).matrixTransform(svg.getScreenCTM());
        return { x: p.x, y: p.y };
      },
      [x, z],
    );
  const angle = async () => Number(await handle.getAttribute('aria-valuenow'));
  /** The piece's centre and the knob, in plan mm. */
  const geometry = async () => {
    const r = piece.locator('rect, polygon').first();
    const b = await r.evaluate((el) => {
      const bb = el.getBBox();
      return { x: bb.x, z: bb.y, w: bb.width, d: bb.height };
    });
    const kx = Number(await knob.getAttribute('cx')),
      kz = Number(await knob.getAttribute('cy'));
    return { cx: b.x + b.w / 2, cz: b.z + b.d / 2, kx, kz };
  };
  /** Press the knob and move it round the centre by `deg` (counter-clockwise), in steps; `mid` runs mid-drag. */
  const turnBy = async (deg, name, { shift = false, esc = false, mid } = {}) => {
    await showPlan();
    const g = await geometry();
    const dx = g.kx - g.cx,
      dz = g.kz - g.cz;
    const target = (d) => {
      const r = (d * Math.PI) / 180;
      return {
        x: g.cx + dx * Math.cos(r) + dz * Math.sin(r),
        z: g.cz - dx * Math.sin(r) + dz * Math.cos(r),
      };
    };
    const a = await screen(g.kx, g.kz);
    const steps = 10;
    const at = async (i) => {
      const p = target((deg * i) / steps);
      return screen(p.x, p.z);
    };
    const touch = (type, p) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y }] : [] });
    if (phone) await touch('touchStart', a);
    else {
      if (shift) await page.keyboard.down('Shift');
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
    }
    for (let i = 1; i <= steps; i++) {
      const p = await at(i);
      if (phone) await touch('touchMove', p);
      else await page.mouse.move(p.x, p.y);
    }
    await page.waitForTimeout(150);
    if (mid) await mid();
    await shot(name);
    if (esc) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
    }
    if (phone) await touch('touchEnd');
    else {
      await page.mouse.up();
      if (shift) await page.keyboard.up('Shift');
    }
    await page.waitForTimeout(250);
  };

  // 1. Bare app → new project → one base cabinet, selected: the handle is there at 0°.
  await page.goto(url);
  await click(btn('Create a new project'));
  await page.locator('dialog[open] input').fill(`Turn ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await sheet(true);
  await click(btn('Add a piece'));
  await dlg.getByRole('searchbox', { name: 'Search the items' }).fill('Base cabinet');
  await dlg
    .locator('.start-group .row-btn', { hasText: /^Base cabinet/ })
    .first()
    .click();
  await dlg.waitFor({ state: 'detached' }).catch(() => {});
  const place = btn('Place to the right');
  await place.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
  if (await place.isVisible()) await click(place);
  await showPlan();
  check(width, 'a "Base cabinet…" piece on the plan', await piece.isVisible());
  if (!(await handle.isVisible().catch(() => false))) {
    const b = await piece.locator('rect').first().boundingBox();
    if (phone) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(200);
  }
  check(width, 'the selected piece shows a "Turn Base cabinet…" handle', await handle.isVisible());
  check(width, 'the handle reads 0°', (await angle()) === 0, `${await angle()}`);
  await shot('handle');

  // 2. Drag the handle by 37°: the angle label and the turned outline show; the piece is turned to 37°.
  let midLabel = '',
    midGhost = false;
  await turnBy(37, 'turning', {
    mid: async () => {
      midLabel = (await label.textContent().catch(() => '')) ?? '';
      midGhost = await ghost.isVisible().catch(() => false);
    },
  });
  check(
    width,
    'while dragging the label shows the angle ("37°")',
    /^3[6-8]°$/.test(midLabel),
    midLabel,
  );
  check(width, 'while dragging the turned outline is drawn', midGhost);
  check(
    width,
    'released: the piece is turned to 37° (±1)',
    Math.abs((await angle()) - 37) <= 1,
    `${await angle()}`,
  );
  check(
    width,
    'the turned piece is drawn as a polygon',
    (await piece.locator('polygon').count()) === 1,
  );
  await shot('turned');

  // 3. Near a quarter turn it snaps: from 37°, +50° lands at 87° → 90°.
  await turnBy(50, 'snap');
  check(
    width,
    'within 5° of a quarter turn it snaps to 90°',
    (await angle()) === 90,
    `${await angle()}`,
  );
  check(
    width,
    'at 90° the piece is drawn as a plain rectangle again',
    (await piece.locator('rect').count()) >= 1 && (await piece.locator('polygon').count()) === 0,
  );

  // 4. Shift steps by 15°.
  if (!phone) {
    await turnBy(-52, 'shift', { shift: true });
    check(
      width,
      'Shift steps by 15° (90 − 52 → 45 or 30)',
      (await angle()) % 15 === 0 && (await angle()) !== 90,
      `${await angle()}`,
    );
  }

  // 5. Keys: ] and [ turn by 1°, Shift+] by 15°.
  await piece.focus();
  const k0 = await angle();
  await page.keyboard.press(']');
  await page.waitForTimeout(150);
  check(width, '] turns by 1°', (await angle()) === (k0 + 1) % 360, `${k0} → ${await angle()}`);
  await piece.focus();
  await page.keyboard.press('[');
  await page.waitForTimeout(150);
  check(width, '[ turns back by 1°', (await angle()) === k0, `${await angle()}`);
  await piece.focus();
  await page.keyboard.press('Shift+]');
  await page.waitForTimeout(150);
  check(width, 'Shift+] turns by 15°', (await angle()) === (k0 + 15) % 360, `${await angle()}`);

  // 6. Undo turns it back one step.
  await click(btn('Undo'));
  await page.waitForTimeout(200);
  check(width, 'Undo takes back the last turn', (await angle()) === k0, `${await angle()}`);

  // 7. Esc during a drag restores the angle; the click that follows does not open the piece (desktop).
  if (!phone) {
    const e0 = await angle();
    await turnBy(40, 'esc', { esc: true });
    check(
      width,
      'Esc during a drag restores the angle',
      (await angle()) === e0,
      `${await angle()}`,
    );
    // The click that follows the release neither opens a dialog nor changes the selection.
    check(
      width,
      'the click after Esc opens nothing',
      (await page.locator('dialog[open]').count()) === 0,
    );
    check(width, 'the piece stays selected', await handle.isVisible());
  }
  check(width, 'no sideways scroll', await noSideScroll());
  check(width, 'no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
