// Find-it acceptance for align and distribute (CLAUDE.md R3, backlog N97, ADR-099), against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/align-distribute/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// From the bare app at 1440 and 390 px, by visible text: select three pieces → Distribute evenly → equal gaps shown;
// drag a wall unit over a base unit → the "centre" label. Not part of `pnpm test`.
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
    page.screenshot({ path: `${out}/align-${name}-${width}.png`, fullPage: true });
  const dlg = page.locator('dialog[open]');
  const click = async (loc) => {
    await loc.scrollIntoViewIfNeeded();
    await loc.click({ timeout: 3000 }).catch(() => loc.dispatchEvent('click'));
  };
  const btn = (name, exact = true) => page.getByRole('button', { name, exact });
  const plan = page.getByRole('figure', { name: /Room plan, seen from above/ });
  const drawing = plan.locator(':scope > svg');
  const pieces = plan.locator('g.plan-piece');
  const rects = async () =>
    pieces.evaluateAll((gs) =>
      gs.map((g) => {
        const r = g.querySelector('rect');
        return { x: Number(r.getAttribute('x')), w: Number(r.getAttribute('width')) };
      }),
    );
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
  const tap = async (i) => {
    const b = await pieces.nth(i).locator('rect').boundingBox();
    if (phone) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(200);
  };

  // 1. Bare app → new project → three pieces, the last one pushed 500 mm further right (unequal gaps).
  await page.goto(url);
  await click(btn('Create a new project'));
  await page.locator('dialog[open] input').fill(`Align ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  for (const q of ['Base cabinet', 'Base cabinet', 'Chest']) await addPiece(q);
  const planRadio = page.getByRole('radio', { name: '2D' });
  if (await planRadio.isVisible().catch(() => false)) await planRadio.click();
  await pieces.nth(2).focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+ArrowRight');
  await page.waitForTimeout(200);
  const before = await rects();
  const gapsOf = (r) => [r[1].x - (r[0].x + r[0].w), r[2].x - (r[1].x + r[1].w)];
  check(
    width,
    'three pieces with unequal gaps',
    gapsOf(before)[0] !== gapsOf(before)[1],
    JSON.stringify(gapsOf(before)),
  );

  // 2. Select the three: Select + taps on a phone, Shift-click on a desktop.
  await page.keyboard.press('Escape');
  if (phone) {
    await click(plan.getByRole('checkbox', { name: 'Select', exact: true }));
    for (const i of [0, 1, 2]) await tap(i);
  } else {
    await tap(0);
    await page.keyboard.down('Shift');
    await tap(1);
    await tap(2);
    await page.keyboard.up('Shift');
  }
  const pressed = await pieces.evaluateAll((gs) => gs.map((g) => g.getAttribute('aria-pressed')));
  check(
    width,
    'all three selected',
    pressed.every((v) => v === 'true'),
    JSON.stringify(pressed),
  );

  // 3. Distribute evenly → equal gaps, said and drawn.
  await sheet(true);
  const dist = btn('Distribute evenly');
  check(width, '"Distribute evenly" is offered', await dist.isVisible());
  check(
    width,
    'Align Left · Centre · Right · Back · Front are offered',
    (await btn('Align left').isVisible()) &&
      (await btn('Align centre').isVisible()) &&
      (await btn('Align right').isVisible()) &&
      (await btn('Align back').isVisible()) &&
      (await btn('Align front').isVisible()),
  );
  await click(dist);
  await page.waitForTimeout(250);
  const said = page.locator('.selection-card [role="status"]');
  const text = (await said.textContent().catch(() => '')) ?? '';
  check(width, 'the card shows "Gaps now a · b mm"', /Gaps now \d+ · \d+ mm/.test(text), text);
  await shot('distributed');
  await sheet(false);
  const after = await rects();
  const g = gapsOf(after);
  check(
    width,
    'the gaps on the plan are equal (±1 mm), the ends stayed',
    Math.abs(g[0] - g[1]) <= 1 && after[0].x === before[0].x && after[2].x === before[2].x,
    JSON.stringify(g),
  );
  check(width, 'the drawn gaps are the ones said', text.includes(`${g[0]} · ${g[1]}`), text);
  if (phone) await click(plan.getByRole('checkbox', { name: 'Select', exact: true }));
  await page.keyboard.press('Escape');

  // 4. A wall unit dragged over a base unit: the "centre" label.
  await addPiece('Wall cabinet');
  const wall = pieces.nth(3);
  const base = after[0];
  const wr = await rects();
  const from = await wall.locator('rect').boundingBox();
  const a = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  // Room mm from the wall unit's centre to 25 mm right of the base's centre.
  const dxMm = base.x + base.w / 2 + 25 - (wr[3].x + wr[3].w / 2);
  const o = await screen(0, 0),
    e = await screen(dxMm, 0);
  const b = { x: a.x + (e.x - o.x), y: a.y };
  const steps = 10;
  const pt = (i) => ({ x: a.x + ((b.x - a.x) * i) / steps, y: a.y });
  if (phone) {
    const touch = (type, p) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y }] : [] });
    await touch('touchStart', a);
    for (let i = 1; i <= steps; i++) await touch('touchMove', pt(i));
  } else {
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) await page.mouse.move(pt(i).x, pt(i).y);
  }
  await page.waitForTimeout(150);
  const note =
    (await plan
      .locator('.plan-drag-note')
      .textContent()
      .catch(() => '')) ?? '';
  await shot('centre-snap');
  if (phone) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  else await page.mouse.up();
  await page.waitForTimeout(300);
  check(width, 'dragging a wall unit over a base unit shows "centre"', /centre/i.test(note), note);
  const end = (await rects())[3];
  check(
    width,
    'it lands centred over the base unit (±½ mm)',
    Math.abs(end.x + end.w / 2 - (base.x + base.w / 2)) <= 0.5,
    `${end.x + end.w / 2} vs ${base.x + base.w / 2}`,
  );

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
