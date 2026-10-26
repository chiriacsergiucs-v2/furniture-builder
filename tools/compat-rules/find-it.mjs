// Find-it acceptance for compatibility rules as data (CLAUDE.md R3, backlog N98, ADR-100), run against a production
// build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/compat-rules/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text: two base cabinets and a bed in a
// project; a bed dragged next to a kitchen base → "Won’t snap to …" naming the family rule; two base units of
// different depths → Checks shows the depth warning; Settings › Rules lists the rules. Not part of `pnpm test`.
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
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const shot = (name) => page.screenshot({ path: `${out}/compat-${name}-${width}.png` });
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
  const bases = plan.getByRole('button', { name: /^Base cabinet.*, \d+ by \d+ mm$/ });
  const bed = plan.getByRole('button', { name: /^Bed.*, \d+ by \d+ mm$/ }).first();
  const status = plan.locator('.plan-drag-note[role="status"]');
  const drawing = plan.locator(':scope > svg');
  const planRadio = page.getByRole('radio', { name: 'Plan' });
  const showPlan = async () => {
    await sheet(false);
    if (await planRadio.isVisible().catch(() => false)) await planRadio.click();
    await page.waitForTimeout(150);
  };
  /** Add a piece from Start from: the first row whose text matches `row`. */
  const add = async (search, row) => {
    await sheet(true);
    await click(btn('Add a piece'));
    await dlg.getByRole('searchbox', { name: 'Search the items' }).fill(search);
    await dlg.locator('.start-group .row-btn', { hasText: row }).first().click();
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
    const place = btn('Place to the right');
    await place.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
    if (await place.isVisible()) await click(place);
    await page.waitForTimeout(150);
    await sheet(false);
  };
  const screen = (x, z) =>
    drawing.evaluate(
      (svg, [x, z]) => {
        const p = new DOMPoint(x, z).matrixTransform(svg.getScreenCTM());
        return { x: p.x, y: p.y };
      },
      [x, z],
    );
  const leftOf = async (piece) => Number(await piece.locator('rect').first().getAttribute('x'));
  const widthOf = async (piece) =>
    Number(await piece.locator('rect').first().getAttribute('width'));
  /** Press the piece's centre, move it by dx mm, read the live note, release. */
  const drag = async (piece, dx, name) => {
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
    await page.waitForTimeout(150);
    const note = (await status.textContent({ timeout: 1000 }).catch(() => '')) ?? '';
    await shot(name);
    if (phone) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    else await page.mouse.up();
    await page.waitForTimeout(200);
    return note;
  };

  // 1. Bare app → new project → two base cabinets and a bed, side by side.
  await page.goto(url);
  await click(btn('Create a new project'));
  await page.locator('dialog[open] input').fill(`Rules ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await add('Base cabinet', /^Base cabinet/);
  await add('Base cabinet', /^Base cabinet/);
  await add('Bed', /^Bed: Platform with slats/);
  await showPlan();
  check(width, 'two "Base cabinet…" pieces on the plan', (await bases.count()) === 2);
  check(width, 'a "Bed…" piece on the plan', await bed.isVisible());

  // 2. Drag the bed away, then back next to the kitchen base: "Won’t snap to …" names the family rule.
  const base2 = bases.nth(1);
  const edge = (await leftOf(base2)) + (await widthOf(base2));
  const away = phone ? 500 : 1000;
  await drag(bed, away, 'away');
  const xAway = await leftOf(bed);
  check(width, `the bed dragged away by about ${away} mm`, xAway - edge >= away * 0.8, `${xAway}`);
  const note = await drag(bed, edge + 30 - xAway, 'family');
  check(
    width,
    'while dragging the bed next to the base: "Won’t snap to Base cabinet…" naming the family rule',
    /Won’t snap to Base cabinet[^:]*:.*family rule/.test(note),
    note,
  );
  const xBed = await leftOf(bed);
  check(width, 'the bed is not snapped flush to the base', xBed !== edge, `${xBed} vs ${edge}`);

  // 3. Make the second base unit shallower: Checks shows the depth warning.
  await click(base2);
  await page.waitForTimeout(200);
  await sheet(true);
  await click(btn('Size, boards and construction'));
  const depth = dlg.getByLabel('Depth', { exact: true }).first();
  await depth.fill('500');
  await depth.press('Tab');
  await page.waitForTimeout(150);
  await click(dlg.getByRole('button', { name: 'Done' }).last());
  await dlg.waitFor({ state: 'detached' }).catch(() => {});
  await sheet(false);
  const checksTab = page.getByRole('tab', { name: /Checks/ });
  if (!(await checksTab.isVisible().catch(() => false)))
    await click(page.getByRole('radio', { name: /Build & Preview/ }));
  if ((await checksTab.getAttribute('aria-selected')) !== 'true') await click(checksTab);
  await page.waitForTimeout(200);
  const depthWarn = page.locator('.checks', { hasText: /different depths/ }).first();
  const depthText =
    (await page
      .getByText(/different depths \(depth \d+ vs \d+ mm\); depth match/)
      .first()
      .textContent({ timeout: 3000 })
      .catch(() => '')) ?? '';
  check(
    width,
    'Checks shows "… stand side by side with different depths (depth A vs B mm); depth match: …"',
    /Base cabinet.*Base cabinet.*different depths \(depth \d+ vs \d+ mm\); depth match/.test(
      depthText,
    ),
    depthText,
  );
  check(width, 'the depth warning is under Checks', await depthWarn.isVisible().catch(() => false));
  await shot('checks');
  check(width, 'no sideways scroll (Checks)', await noSideScroll());

  // 4. Settings › Rules lists every rule with its text, what it applies to and its severity.
  if (
    phone &&
    (await page
      .getByRole('radio', { name: 'Compose' })
      .isVisible()
      .catch(() => false))
  )
    await click(page.getByRole('radio', { name: 'Compose' }));
  await click(page.getByRole('button', { name: 'Settings' }).first());
  await dlg.waitFor({ state: 'visible' }).catch(() => {});
  const rules = dlg.getByRole('region', { name: 'Rules' });
  await rules.scrollIntoViewIfNeeded().catch(() => {});
  check(width, 'Settings shows a "Rules" section', await rules.isVisible().catch(() => false));
  const rulesText = (await rules.textContent().catch(() => '')) ?? '';
  for (const name of [
    'Sides join sides',
    'Same placement',
    'Back to wall',
    'Depth match',
    'Height match',
    'Family',
  ])
    check(width, `Rules lists "${name}"`, rulesText.includes(name));
  check(
    width,
    'Rules says what each applies to and its severity ("Applies to:", "Refuses a snap", "a warning in Checks")',
    /Applies to:/.test(rulesText) &&
      /Refuses a snap/.test(rulesText) &&
      /warning in Checks/.test(rulesText),
  );
  await shot('rules');
  check(width, 'no sideways scroll (Settings › Rules)', await noSideScroll());
  check(width, 'no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
