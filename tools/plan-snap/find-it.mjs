// Find-it acceptance for snapping a dragged piece on the plan (CLAUDE.md R3, backlog N65, ADR-070), run against a
// production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/plan-snap/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text: the **Snap** toggle above the plan,
// the dashed snapped preview with its label while dragging, the flush drop, Snap off (and Alt on desktop) placing
// freely, and the toggle kept after a reload. Desktop drags with the mouse; the phone with real touch (CDP).
// Not part of `pnpm test`.
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
    page.screenshot({ path: `${out}/plan-snap-${name}-${width}.png`, fullPage: true });
  const dlg = page.locator('dialog[open]');
  const click = async (loc) => {
    await loc.scrollIntoViewIfNeeded();
    await loc.click({ timeout: 3000 }).catch(() => loc.dispatchEvent('click'));
  };
  const btn = (name, exact = true) => page.getByRole('button', { name, exact });
  /** The second piece's "From left" read off the plan: its outline's left edge (mm; the piece is not turned). */
  const fromLeft = async () => Number(await second.locator('rect').first().getAttribute('x'));
  // On a phone the project's pieces sit in the Compose sheet: open it to add, close it to see the plan.
  const sheet = async (open) => {
    const peek = page.locator('.sheet-peek');
    if (!(await peek.isVisible().catch(() => false))) return;
    if (((await peek.getAttribute('aria-expanded')) === 'true') !== open) await peek.click();
    await page.waitForTimeout(200);
  };
  const plan = page.getByRole('figure', { name: /Room plan, seen from above/ });
  const pieces = plan.getByRole('button', { name: /^Base cabinet.*, \d+ by \d+ mm$/ });
  const first = pieces.nth(0),
    second = pieces.nth(1);
  const snap = plan.getByRole('checkbox', { name: 'Snap', exact: true });
  const ghost = plan.locator('.drag-ghost');
  // The live snap note shows over the plan only while a piece is dragged (ADR-080).
  const status = plan.locator('.plan-drag-note[role="status"]');
  // The plan drawing itself (the "About the plan" info button carries an svg icon too, ADR-080).
  const drawing = plan.locator(':scope > svg');
  const about = plan.getByRole('button', { name: 'About the plan' });
  /** The text of the plan's "About the plan" popover (ADR-080: the idle Snap line moved there). */
  const aboutText = async () => {
    await click(about);
    const note = plan.getByRole('note');
    const t = (await note.textContent({ timeout: 3000 }).catch(() => '')) ?? '';
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    return t;
  };
  /** Screen point of a room point (mm) on the plan. */
  const screen = (x, z) =>
    drawing.evaluate(
      (svg, [x, z]) => {
        const p = new DOMPoint(x, z).matrixTransform(svg.getScreenCTM());
        return { x: p.x, y: p.y };
      },
      [x, z],
    );
  /** Press the piece's centre, move it by dx mm in steps, report what was seen mid-drag, release. */
  const drag = async (piece, dx, { alt = false, name = 'dragging' } = {}) => {
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
      if (alt) await page.keyboard.down('Alt');
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      for (let i = 1; i <= steps; i++) await page.mouse.move(at(i).x, at(i).y);
    }
    await page.waitForTimeout(120);
    const seen = {
      ghost: await ghost.isVisible().catch(() => false),
      snapped: await plan
        .locator('.drag-ghost.snapped')
        .isVisible()
        .catch(() => false),
      dashed: await ghost
        .locator('rect')
        .evaluate((r) => getComputedStyle(r).strokeDasharray)
        .catch(() => ''),
      label: (await ghost.textContent().catch(() => '')) ?? '',
      status: (await status.textContent({ timeout: 1000 }).catch(() => '')) ?? '',
    };
    await shot(name);
    if (phone) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    else {
      await page.mouse.up();
      if (alt) await page.keyboard.up('Alt');
    }
    await page.waitForTimeout(200);
    return seen;
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

  // 1. Bare app → new project → two base cabinets, side by side.
  await page.goto(url);
  await click(btn('Create a new project'));
  await page.locator('dialog[open] input').fill(`Snap ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await addBase();
  await addBase();
  const planRadio = page.getByRole('radio', { name: 'Plan' });
  if (await planRadio.isVisible().catch(() => false)) await planRadio.click();
  check(width, 'the plan "Room plan, seen from above" is visible', await plan.isVisible());
  check(width, 'two "Base cabinet…" pieces are on the plan', (await pieces.count()) === 2);
  check(width, 'the "Snap" toggle is found above the plan', await snap.isVisible());
  check(width, '"Snap" is on by default', await snap.isChecked());
  const idle = await aboutText();
  check(
    width,
    '"About the plan" says "Snaps within 60 mm … hold Alt to place freely"',
    /Snaps within 60 mm.*hold Alt to place freely/.test(idle),
    idle.slice(0, 80),
  );
  const firstX = Number(await first.locator('rect').first().getAttribute('x'));
  const w =
    firstX === 0 ? Number((await first.getAttribute('aria-label')).match(/, (\d+) by/)[1]) : NaN;
  const x0 = await fromLeft();
  check(
    width,
    'the second piece starts flush at x = the first one’s width',
    x0 === w,
    `${x0} vs ${w}`,
  );
  await shot('start');

  // 2. Drag it away (1000 mm; 500 mm on the phone, so the finger stays on screen), then back to about 35 mm from
  // the first: dashed snapped preview, flush drop.
  const away = phone ? 500 : 1000;
  await drag(second, away, { name: 'away' });
  const xAway = await fromLeft();
  check(
    width,
    `dragged away by about ${away} mm`,
    xAway - x0 >= away * 0.8 && xAway - x0 <= away + 20,
    `${x0} → ${xAway}`,
  );
  const back = await drag(second, w + 35 - xAway, { name: 'snap-preview' });
  check(width, 'while dragging, the preview outline is shown', back.ghost);
  check(width, 'the preview is dashed', back.dashed !== '' && back.dashed !== 'none', back.dashed);
  check(width, 'the preview is marked snapped', back.snapped);
  check(
    width,
    'the preview label says where and what it joins ("Joins Base cabinet")',
    /From left \d+ · From back \d+ mm/.test(back.label) && /joins Base cabinet/i.test(back.label),
    back.label,
  );
  check(
    width,
    'while dragging, the note over the plan says "Snaps: … joins Base cabinet"',
    /^Snaps: .*joins Base cabinet/i.test(back.status),
    back.status,
  );
  check(width, 'the preview is gone after release', !(await ghost.isVisible()));
  check(width, 'the "Snaps:" note is gone after release', !(await status.isVisible()));
  const xSnap = await fromLeft();
  check(width, 'the drop is flush with the first piece', xSnap === w, `${xSnap} vs ${w}`);
  await shot('snapped');
  await click(btn('Undo'));
  await page.waitForTimeout(200);
  check(
    width,
    'one Undo undoes the snapped drop',
    (await fromLeft()) === xAway,
    `${await fromLeft()}`,
  );

  // 3. Snap off: the same drag lands where released (on the 10 mm step), no snapped preview.
  await click(snap);
  check(width, '"Snap" turns off', !(await snap.isChecked()));
  const idleOff = await aboutText();
  check(
    width,
    'with Snap off "About the plan" says "Pieces go exactly where dropped."',
    idleOff.startsWith('Pieces go exactly where dropped.'),
    idleOff.slice(0, 80),
  );
  const off = await drag(second, w + 35 - xAway, { name: 'snap-off' });
  check(
    width,
    'with Snap off the preview is not marked snapped',
    off.ghost && !off.snapped,
    off.label,
  );
  const xOff = await fromLeft();
  check(
    width,
    'with Snap off the piece lands where released, not flush',
    xOff !== w && Math.abs(xOff - (w + 35)) <= 25 && (xOff - xAway) % 10 === 0,
    `${xOff} (flush would be ${w})`,
  );

  // 4. The choice is kept on this device: reload, find the toggle off, turn it back on.
  await page.reload();
  await page
    .locator('main.work')
    .waitFor({ state: 'visible' })
    .catch(() => {});
  if (!(await plan.isVisible().catch(() => false))) {
    await click(page.getByRole('button', { name: new RegExp(`Snap ${width}`) }).first()).catch(
      () => {},
    );
    if (await planRadio.isVisible().catch(() => false)) await planRadio.click();
  }
  const kept = (await snap.isVisible().catch(() => false)) && !(await snap.isChecked());
  check(width, '"Snap" stays off after a reload', kept);
  if (await snap.isVisible().catch(() => false)) {
    await click(snap);
    check(width, '"Snap" turns back on', await snap.isChecked());
  }

  // 5. Desktop: Alt held while dragging places freely even with Snap on.
  if (!phone && (await snap.isVisible().catch(() => false))) {
    await drag(second, 1000, { name: 'away-again' });
    const xs = await fromLeft();
    const target = w + 35;
    const alt = await drag(second, target - xs, { alt: true, name: 'alt' });
    check(width, 'with Alt held the preview is not snapped', alt.ghost && !alt.snapped, alt.status);
    const xa = await fromLeft();
    check(
      width,
      'with Alt held the piece lands where released',
      xa !== w && Math.abs(xa - target) <= 25,
      `${xa}`,
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
