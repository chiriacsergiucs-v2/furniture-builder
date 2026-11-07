// Find-it acceptance for typed connections, shared sides with a blind corner, editable assembly steps, Link
// identical pieces and the lounger's backrest end (CLAUDE.md R3, backlog N212, ADR-207), against a production build:
//   pnpm build && pnpm preview --port 4307 &  node tools/connections-typed/find-it.mjs http://localhost:4307/furniture-builder/ <out dir>
// Starts from the bare app at 1280 and 390 px and finds everything by visible text: a project with its room; a base
// cabinet → Against the wall on its card ("Connected to against wall 1"); a wall cabinet moved over it → Connected →
// "(stacked)" on the card; a dragged wall unit over its base moves with it; Link 2 identical pieces → "Linked: 2
// copies"; a blind corner and a base cabinet → Shared sides; Build & Preview › 3D › Assembly → Show step on "Fit
// hardware to the sides" lights the 3D view (`data-lit` on the 3D view, ADR-230), Move step up, Reset the steps; New single
// piece → Lounger → Settings → Backrest end → Right. No page errors. Not part of `pnpm test`.
import { launchBrowser, previewUrl, outDir } from '../lib/harness.mjs';
import { mkdirSync } from 'node:fs';

const url = previewUrl('http://localhost:4307/furniture-builder/');
const out = outDir();
mkdirSync(out, { recursive: true });
const browser = await launchBrowser();
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
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const shot = (name) => page.screenshot({ path: `${out}/connections-typed-${name}-${width}.png` });
  const dlg = page.locator('dialog[open]');
  const click = async (loc) => {
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    await loc.click({ timeout: 3000 }).catch(() => loc.dispatchEvent('click'));
  };
  const btn = (name, exact = true) => page.getByRole('button', { name, exact });
  const side = page.getByRole('complementary', { name: 'Compose' });
  const compose = page.getByRole('radio', { name: 'Compose' });
  const build = page.getByRole('radio', { name: /Build & Preview/ });
  /** The phone's bottom sheet holds the side panel: open or close it. */
  const sheet = async (open) => {
    const peek = page.locator('.sheet-peek');
    if (!(await peek.isVisible().catch(() => false))) return;
    if (((await peek.getAttribute('aria-expanded')) === 'true') !== open) await peek.click();
    await page.waitForTimeout(200);
  };
  const toCompose = async () => {
    if (await compose.isVisible().catch(() => false)) {
      if ((await compose.getAttribute('aria-checked')) !== 'true') await click(compose);
    }
    await page.waitForTimeout(150);
  };
  const allPieces = async () => {
    const all = side.getByRole('button', { name: /^All pieces \(\d+\)$/ });
    if (await all.isVisible().catch(() => false)) await click(all);
  };
  const add = async (search, row) => {
    await toCompose();
    await sheet(true);
    await allPieces();
    await click(btn('Add a piece'));
    await dlg.getByRole('searchbox', { name: 'Search the items' }).fill(search);
    await dlg.locator('.start-group .row-btn', { hasText: row }).first().click();
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
    const place = btn('Place to the right');
    await place.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
    if (await place.isVisible()) await click(place);
    await page.waitForTimeout(200);
  };
  const selectSwitch = () => side.getByRole('checkbox', { name: 'Select' });
  /** Select pieces i… through the Select switch and the Pieces list. */
  const selectRows = async (...which) => {
    await toCompose();
    await sheet(true);
    await allPieces();
    if (!(await selectSwitch().isChecked())) await click(selectSwitch());
    await allPieces();
    const rows = side.getByRole('list', { name: 'Pieces' }).getByRole('button');
    const n = await rows.count();
    for (let i = 0; i < n; i++) {
      const on = (await rows.nth(i).getAttribute('aria-pressed')) === 'true';
      if (on !== which.includes(i)) await click(rows.nth(i));
    }
    await page.waitForTimeout(150);
  };
  /** Select one piece (the Select switch off); its card. */
  const selectOne = async (i) => {
    await toCompose();
    await sheet(true);
    await allPieces();
    if (await selectSwitch().isChecked()) await click(selectSwitch());
    await allPieces();
    await click(side.getByRole('list', { name: 'Pieces' }).getByRole('button').nth(i));
    await page.waitForTimeout(200);
    return side.getByRole('region', { name: /^Selected piece: / });
  };
  const plan = page.getByRole('figure', { name: /Room plan, seen from above/ });
  const drawing = plan.locator(':scope > svg');
  const showPlan = async () => {
    await sheet(false);
    const r2d = page.getByRole('radio', { name: '2D' });
    if (await r2d.isVisible().catch(() => false)) await r2d.click();
    await page.waitForTimeout(150);
  };
  /**
   * Press the base cabinet on the plan near its front edge (the wall unit over it covers its back part), move it by
   * dx mm along the wall and release.
   */
  const dragBase = async (dx, name) => {
    await toCompose();
    // Nothing selected, so no handle of the wall unit lies over the base.
    await sheet(true);
    await allPieces();
    await showPlan();
    const piece = plan.getByRole('button', { name: /^Base cabinet.*, \d+ by \d+ mm$/ }).first();
    await piece.scrollIntoViewIfNeeded();
    const box = await piece.locator('rect').first().boundingBox();
    const a = { x: box.x + box.width / 2, y: box.y + box.height * 0.88 };
    const scr = (x, z) =>
      drawing.evaluate(
        (svg, [x, z]) => {
          const p = new DOMPoint(x, z).matrixTransform(svg.getScreenCTM());
          return { x: p.x, y: p.y };
        },
        [x, z],
      );
    const o = await scr(0, 0),
      e = await scr(dx, 0);
    const b = { x: a.x + (e.x - o.x), y: a.y };
    const steps = 8;
    const at = (i) => ({ x: a.x + ((b.x - a.x) * i) / steps, y: a.y });
    if (phone) {
      const cdp = await ctx.newCDPSession(page);
      const touch = (type, p) =>
        cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y }] : [] });
      await touch('touchStart', a);
      for (let i = 1; i <= steps; i++) await touch('touchMove', at(i));
      await page.waitForTimeout(150);
      await shot(name);
      await touch('touchEnd');
    } else {
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      for (let i = 1; i <= steps; i++) await page.mouse.move(at(i).x, at(i).y);
      await page.waitForTimeout(150);
      await shot(name);
      await page.mouse.up();
    }
    await page.waitForTimeout(250);
  };
  /** More → New… → one of the ways to start. */
  const startNew = async (way) => {
    await sheet(false);
    await click(page.getByLabel('More', { exact: true }).first());
    await click(page.getByRole('button', { name: /New…/ }).first());
    await click(dlg.getByRole('button', { name: way }).first());
    await page.waitForTimeout(400);
  };
  const text = async (loc) =>
    (await loc
      .first()
      .textContent({ timeout: 2000 })
      .catch(() => '')) ?? '';

  // 1. Bare app → new project → Add the room → a base cabinet and a wall cabinet.
  await page.goto(url);
  await click(btn('Create a new project'));
  await page.locator('dialog[open] input').fill(`Typed ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await sheet(true);
  await click(side.getByRole('button', { name: 'Add the room' }));
  await page.waitForTimeout(200);
  await add('Base cabinet', /^Base cabinet/);
  await add('Wall cabinet', /^Wall cabinet/);

  // 2. The base unit → Against the wall on its card; the card names the wall.
  let card = await selectOne(0);
  const wall = card.getByRole('checkbox', { name: 'Against the wall' });
  check(width, 'the card shows an "Against the wall" toggle, enabled', await wall.isEnabled());
  if (!(await wall.isChecked())) await click(wall);
  await page.waitForTimeout(200);
  check(width, '"Against the wall" is on', await wall.isChecked());
  const wallText = await text(card.getByText(/^Connected to against wall \d+$/));
  check(
    width,
    'the card says "Connected to against wall 1"',
    /against wall 1$/.test(wallText),
    wallText,
  );
  await shot('against-wall');

  // 3. The wall cabinet moved over the base (From left 0) → select both → Connected → "(stacked)".
  card = await selectOne(1);
  const left = card.getByRole('textbox', { name: 'From left' });
  await left.fill('0');
  await left.press('Tab');
  await page.waitForTimeout(200);
  await selectRows(0, 1);
  const pair = side.getByRole('region', { name: /^2 pieces selected/ });
  const connected = pair.getByRole('checkbox', { name: 'Connected' });
  check(width, 'a wall unit over a base: Connected is enabled', await connected.isEnabled());
  await click(connected);
  await page.waitForTimeout(200);
  check(width, 'Connected is on', await connected.isChecked());
  card = await selectOne(1);
  const stackedText = await text(card.getByText(/^Connected to Base cabinet.*\(stacked\)$/));
  check(
    width,
    'the card says "Connected to Base cabinet … (stacked)"',
    /\(stacked\)$/.test(stackedText),
    stackedText,
  );
  await shot('stacked');

  // 4. Dragging the base on the plan carries the stacked wall unit along, by the same whole mm.
  const fromLeft = async (i) =>
    Number(await (await selectOne(i)).getByRole('textbox', { name: 'From left' }).inputValue());
  const base0 = await fromLeft(0),
    wall0 = await fromLeft(1);
  await dragBase(300, 'carried');
  const base1 = await fromLeft(0),
    wall1 = await fromLeft(1);
  check(
    width,
    'dragging the base moves its stacked wall unit by the same whole mm',
    base1 !== base0 && base1 - base0 === wall1 - wall0,
    `base ${base0}→${base1}, wall unit ${wall0}→${wall1}`,
  );

  // 5. A second base cabinet, identical to the first → Link 2 identical pieces → linked.
  await add('Base cabinet', /^Base cabinet/);
  card = await selectOne(2);
  const link = card.getByRole('button', { name: 'Link 2 identical pieces' });
  check(
    width,
    'the card offers "Link 2 identical pieces"',
    await link.isVisible().catch(() => false),
  );
  await click(link);
  await page.waitForTimeout(250);
  check(
    width,
    'tapped: "Linked: 2 copies"',
    await side
      .getByText(/^Linked: 2 copies$/)
      .first()
      .isVisible()
      .catch(() => false),
  );
  await shot('linked');

  // 6. A blind corner and a base cabinet side by side → Shared sides is enabled and turns on.
  await startNew(/Project with several pieces/);
  await add('Blind corner', /^Blind corner/);
  await add('Base cabinet', /^Base cabinet/);
  await selectRows(0, 1);
  const shared = side
    .getByRole('region', { name: /^2 pieces selected/ })
    .getByRole('group', { name: 'Common top, bottom and sides' })
    .getByRole('checkbox', { name: 'Shared sides' });
  check(
    width,
    'a blind corner beside a base cabinet: Shared sides is enabled',
    await shared.isEnabled(),
  );
  await click(shared);
  await page.waitForTimeout(200);
  check(width, 'Shared sides is on', await shared.isChecked());
  await shot('shared');

  // 7. Build & Preview › 3D › Assembly: Show step on Fit hardware lights the 3D view; Move step up; Reset.
  await sheet(false);
  await click(build);
  const r3d = page.getByRole('radio', { name: '3D', exact: true });
  if (await r3d.isVisible().catch(() => false)) await click(r3d);
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 30000 });
  await click(page.getByRole('tab', { name: /^Assembly/ }));
  const piece = page.getByRole('region', { name: /^Assembly: Base cabinet/ }).first();
  const steps = piece.locator('ol.assembly-steps > li');
  const fit = steps.filter({ hasText: 'Fit hardware to the sides' }).first();
  await click(fit.getByRole('button', { name: 'Show step' }));
  let lit = '0';
  for (let i = 0; i < 40 && lit === '0'; i++) {
    await page.waitForTimeout(250);
    lit = await page.evaluate(
      () => document.querySelector('.view.three[data-lit]')?.dataset.lit ?? '0',
    );
  }
  check(
    width,
    'Show step on "Fit hardware to the sides" lights parts in 3D',
    Number(lit) > 0,
    `lit ${lit}`,
  );
  await page
    .locator('canvas')
    .first()
    .scrollIntoViewIfNeeded()
    .catch(() => {});
  await shot('show-step');
  const titles = () => steps.locator('.step-head strong').allTextContents();
  const before = await titles();
  await fit.scrollIntoViewIfNeeded();
  await click(steps.nth(2).getByRole('button', { name: 'Move step up' }));
  await page.waitForTimeout(250);
  check(
    width,
    'after the move the shown step is still "Fit hardware to the sides"',
    (await fit.getByRole('button', { name: 'Show step' }).getAttribute('aria-pressed')) ===
      'true' &&
      (await piece.locator('button[aria-pressed="true"]', { hasText: 'Show step' }).count()) === 1,
  );
  const moved = await titles();
  check(
    width,
    'Move step up: the third step is second now',
    moved[1] === before[2] && moved[2] === before[1],
    `${before.slice(0, 3).join(' | ')} → ${moved.slice(0, 3).join(' | ')}`,
  );
  const reset = piece.getByRole('button', { name: 'Reset the steps' });
  check(width, '"Reset the steps" appears', await reset.isVisible().catch(() => false));
  await shot('moved-step');
  await click(reset);
  const ask = page.getByRole('dialog').filter({ hasText: /^Reset the steps of/ });
  await ask.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  await shot('reset-ask');
  await click(ask.getByRole('button', { name: 'Reset the steps' }));
  await page.waitForTimeout(250);
  check(
    width,
    'Reset the steps restores the generated order',
    JSON.stringify(await titles()) === JSON.stringify(before),
  );
  check(width, 'no sideways scroll (Assembly)', await noSideScroll());

  // 8. New single piece → Lounger with backrest → Settings → Backrest end → Right.
  await sheet(false);
  await click(
    page.getByRole('navigation', { name: 'Places' }).getByRole('link', { name: 'Projects' }),
  );
  await page.getByRole('heading', { name: 'Projects', level: 1 }).waitFor();
  await click(btn('New single piece'));
  const search = dlg.getByRole('searchbox').first();
  if (await search.isVisible().catch(() => false)) await search.fill('lounger');
  await click(
    dlg.getByRole('button', { name: /Lounger with backrest|Adjustable backrest/ }).first(),
  );
  await page.waitForTimeout(300);
  await click(btn('Settings'));
  const end = dlg.getByRole('radiogroup', { name: 'Backrest end' });
  check(
    width,
    'the lounger Settings show "Backrest end"',
    await end.isVisible().catch(() => false),
  );
  check(
    width,
    'Backrest end is Left at first',
    (await end.getByRole('radio', { name: 'Left' }).getAttribute('aria-checked')) === 'true',
  );
  await click(end.getByRole('radio', { name: 'Right' }));
  await page.waitForTimeout(200);
  check(
    width,
    'Backrest end → Right',
    (await end.getByRole('radio', { name: 'Right' }).getAttribute('aria-checked')) === 'true',
  );
  await shot('backrest-end');
  check(width, 'no sideways scroll', await noSideScroll());
  check(width, 'no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
