// Find-it acceptance for dragging a catalog item from the piece list onto the plan (CLAUDE.md R3, backlog N92,
// ADR-094), run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/piece-list-drag/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text. Desktop drags with the mouse; the
// phone long-presses and drags with real touch events (CDP). Not part of `pnpm test`.
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
    page.screenshot({ path: `${out}/piece-list-${name}-${width}.png`, fullPage: false });
  const btn = (name, exact = true) => page.getByRole('button', { name, exact });
  const click = async (loc) => {
    await loc.scrollIntoViewIfNeeded();
    await loc.click({ timeout: 3000 }).catch(() => loc.dispatchEvent('click'));
  };
  const list = page.getByRole('dialog', { name: 'Add a piece' });
  const plan = page.getByRole('figure', { name: /Room plan, seen from above/ });
  const drawing = plan.locator(':scope > svg');
  const pieces = plan.getByRole('button', { name: /^Base cabinet.*, \d+ by \d+ mm$/ });
  const label = plan.getByText(/From left \d+ · From back \d+ mm/);
  const field = async (name) =>
    Number(await page.getByLabel(name, { exact: true }).first().inputValue());
  /** Screen point of a room point (mm) on the plan. */
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
  const openList = async () => {
    await sheet(true);
    await click(btn('Add a piece'));
    await list.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
    await list.getByRole('searchbox', { name: 'Search the items' }).fill('Base cabinet');
    await page.waitForTimeout(150);
  };
  const item = list.getByRole('button', { name: /^Base cabinet/ }).first();
  const touch = (type, p) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y }] : [] });
  /**
   * Drag the item to the room point (x, z). Mouse on a desktop; on a phone a long-press first. Returns what was
   * seen mid-drag. With `cancel`, Esc is pressed before the release.
   */
  const dragTo = async (x, z, { cancel = false } = {}) => {
    await item.scrollIntoViewIfNeeded();
    const b = await item.boundingBox();
    const a = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    let folded = null;
    if (phone) {
      await touch('touchStart', a);
      // 300 ms to lift, then the sheet's fold transition.
      await page.waitForTimeout(700);
      folded = await list.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return el.classList.contains('folded') && r.top >= window.innerHeight - 1;
      });
    } else {
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
    }
    const end = await screen(x, z);
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const p = { x: a.x + ((end.x - a.x) * i) / steps, y: a.y + ((end.y - a.y) * i) / steps };
      if (phone) await touch('touchMove', p);
      else await page.mouse.move(p.x, p.y);
    }
    await page.waitForTimeout(150);
    const seen = (await label.isVisible()) ? ((await label.textContent()) ?? '') : '';
    await shot(cancel ? 'dragging-esc' : 'dragging');
    if (cancel) await page.keyboard.press('Escape');
    if (phone) await touch('touchEnd');
    else await page.mouse.up();
    await page.waitForTimeout(300);
    return { seen, folded };
  };

  // 1. Bare app → new project → Compose → Add a piece opens the list beside the plan.
  await page.goto(url);
  await click(btn('Create a new project'));
  await page.locator('dialog[open] input').fill(`Piece list ${width}`);
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
  check(width, 'the list is closed by default', !(await list.isVisible()));
  await openList();
  check(width, '"Add a piece" opens the piece list', await list.isVisible());
  check(width, 'the plan is shown with the list open', await plan.isVisible());
  check(width, 'the list has the catalog item "Base cabinet…"', await item.isVisible());
  if (!phone) {
    const lb = await list.boundingBox(),
      pb = await drawing.boundingBox();
    check(width, 'desktop: the list is a side panel next to the plan', lb.x + lb.width <= pb.x + 1);
  } else {
    const lb = await list.boundingBox();
    check(width, 'phone: the list is a bottom sheet', Math.abs(lb.x) < 1 && lb.width >= width - 1);
  }
  await shot('open');

  // 2. Drag "Base cabinet" onto the plan: outline + label while dragging, the piece appears there on release.
  const n0 = await pieces.count();
  const d = await dragTo(200, 300);
  if (phone) check(width, 'a long-press folds the sheet away', d.folded === true);
  check(
    width,
    'while dragging, "From left … · From back … mm" is shown',
    /From left \d+/.test(d.seen),
    d.seen,
  );
  check(width, 'the outline is gone after release', !(await label.isVisible()));
  check(
    width,
    'the piece appears on the plan',
    (await pieces.count()) === n0 + 1,
    `${n0} → ${await pieces.count()}`,
  );
  await sheet(true);
  const x1 = await field('From left'),
    z1 = await field('From back');
  check(
    width,
    'it is where it was dropped (as the label said)',
    d.seen.startsWith(`From left ${x1} · From back ${z1} mm`),
    `${x1}, ${z1} / ${d.seen}`,
  );
  check(
    width,
    'whole mm near the drop point',
    Math.abs(x1 - 200) <= 15 && Math.abs(z1 - 300) <= 15,
    `${x1}, ${z1}`,
  );
  await shot('dropped');

  if (!phone) {
    // 3. Undo removes it in one step.
    await click(btn('Undo'));
    await page.waitForTimeout(250);
    check(width, 'Undo removes it', (await pieces.count()) === n0, `${await pieces.count()}`);
    // 4. Esc during a drag adds nothing.
    check(width, 'the list stays open on a desktop', await list.isVisible());
    const e = await dragTo(500, 400, { cancel: true });
    check(width, 'the outline showed before Esc', /From left \d+/.test(e.seen), e.seen);
    check(
      width,
      'Esc during a drag adds nothing',
      (await pieces.count()) === n0,
      `${await pieces.count()}`,
    );
    check(width, 'Esc during a drag keeps the list open', await list.isVisible());
    // A release off the plan adds nothing either.
    const b = await item.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 40, b.y + b.height / 2 + 10, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(250);
    check(width, 'a release outside the plan adds nothing', (await pieces.count()) === n0);
  } else {
    // 3. A quick swipe on the list scrolls it and lifts nothing.
    await sheet(false);
    await openList();
    await list.getByRole('searchbox', { name: 'Search the items' }).fill('');
    await page.waitForTimeout(150);
    const body = list.locator('.piece-list-body');
    const top0 = await body.evaluate((el) => el.scrollTop);
    const b = await body.locator('.start-group .row-btn').first().boundingBox();
    const a = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    await touch('touchStart', a);
    for (let i = 1; i <= 8; i++) {
      await touch('touchMove', { x: a.x, y: a.y - i * 30 });
      await page.waitForTimeout(16);
    }
    await touch('touchEnd');
    await page.waitForTimeout(400);
    const top1 = await body.evaluate((el) => el.scrollTop);
    await shot('swiped');
    check(
      width,
      'a swipe on the list scrolls it and does not lift an item',
      top1 > top0 && !(await list.evaluate((el) => el.classList.contains('folded'))),
      `${top0} → ${top1}`,
    );
    check(width, 'the swipe added nothing', (await pieces.count()) === n0 + 1);
    // 4. Tap-to-place still works: tap an item, then tap the plan.
    await list.getByRole('searchbox', { name: 'Search the items' }).fill('Base cabinet');
    await page.waitForTimeout(150);
    const ib = await item.boundingBox();
    await page.touchscreen.tap(ib.x + ib.width / 2, ib.y + ib.height / 2);
    await page.waitForTimeout(300);
    const banner = page.getByText(/Tap the plan to place/);
    check(width, 'tapping an item shows "Tap the plan to place …"', await banner.isVisible());
    check(width, 'and closes the sheet', !(await list.isVisible()));
    const p = await screen(600, 500);
    await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(300);
    check(
      width,
      'a tap on the plan places it',
      (await pieces.count()) === n0 + 2 && !(await banner.isVisible()),
      `${await pieces.count()}`,
    );
    await sheet(true);
    check(
      width,
      'it is where the plan was tapped',
      Math.abs((await field('From left')) - 600) <= 15 &&
        Math.abs((await field('From back')) - 500) <= 15,
      `${await field('From left')}, ${await field('From back')}`,
    );
    await shot('tapped');
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
