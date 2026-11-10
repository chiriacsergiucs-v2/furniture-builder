// Find-it acceptance for stored connections between pieces (CLAUDE.md R3, backlog N171, ADR-168), run against a
// production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/connections/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text: three base cabinets in a project;
// Select two → "Connected" toggle → a tick on the plan and "Connected to …" on the card; a snapped drag connects
// the third; dragging one moves the connected ones along (Alt moves it alone, desktop); a resized member →
// Checks warns "connected but no longer joined"; the toggle disconnects. ADR-179: the room front view shows the
// tick too, and Build & Preview › 3D draws a seam line (counted in `data-seams` on the 3D view, ADR-230) that is gone while
// exploded and after Disconnect. ADR-201 (G-346): in Build & Preview › 3D with Move on, dragging a connected piece moves
// the connected set along, and on a desktop an Alt drag moves that piece alone (then one Undo). Not part of `pnpm test`.
import { launchBrowser, previewUrl, outDir } from '../lib/harness.mjs';
import { goBuild, goCompose } from '../lib/steps.mjs';
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
  const shot = (name) => page.screenshot({ path: `${out}/connections-${name}-${width}.png` });
  const dlg = page.locator('dialog[open]');
  const click = async (loc) => {
    await loc.scrollIntoViewIfNeeded();
    // ADR-201 (G-181): a click Playwright delivered ("click action done") but whose page was too busy to answer in
    // 3 s (software-rendered 3D) was taken; clicking again here undid it, the "lost first tap". Fall back only when
    // the click never happened (covered or off screen).
    await loc.click({ timeout: 3000 }).catch((e) => {
      if (!/performing click action|click action done/.test(e.message))
        return loc.dispatchEvent('click');
    });
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
  const ticks = plan.locator('.plan-connections line');
  const drawing = plan.locator(':scope > svg');
  const planRadio = page.getByRole('radio', { name: '2D' });
  const side = page.getByRole('complementary', { name: 'Compose' });
  const showPlan = async () => {
    await sheet(false);
    if (await planRadio.isVisible().catch(() => false)) await planRadio.click();
    await page.waitForTimeout(150);
  };
  const add = async (search, row) => {
    await sheet(true);
    const all = side.getByRole('button', { name: /^All pieces \(\d+\)$/ });
    if (await all.isVisible().catch(() => false)) await click(all);
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
  const lefts = async () => {
    const n = await bases.count();
    const out = [];
    for (let i = 0; i < n; i++) out.push(await leftOf(bases.nth(i)));
    return out;
  };
  /** Press the piece's centre, move it by dx mm, release. `alt` holds Alt (desktop). */
  const drag = async (piece, dx, name, alt = false) => {
    await showPlan();
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
    await page.waitForTimeout(150);
    await shot(name);
    if (phone) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    else {
      await page.mouse.up();
      if (alt) await page.keyboard.up('Alt');
    }
    await page.waitForTimeout(250);
  };
  /** Select pieces i… through the side panel's Select switch and the Pieces list. */
  const selectRows = async (...which) => {
    await sheet(true);
    const all = side.getByRole('button', { name: /^All pieces \(\d+\)$/ });
    if (await all.isVisible().catch(() => false)) await click(all);
    const sw = side.getByRole('checkbox', { name: 'Select' });
    if (!(await sw.isChecked())) await click(sw);
    const rows = side.getByRole('list', { name: 'Pieces' }).getByRole('button');
    const n = await rows.count();
    for (let i = 0; i < n; i++) {
      const on = (await rows.nth(i).getAttribute('aria-pressed')) === 'true';
      if (on !== which.includes(i)) await click(rows.nth(i));
    }
    await page.waitForTimeout(150);
  };
  const selectOff = async () => {
    await sheet(true);
    const sw = side.getByRole('checkbox', { name: 'Select' });
    if (await sw.isChecked().catch(() => false)) await click(sw);
    await page.waitForTimeout(100);
  };

  // 1. Bare app → new project → three base cabinets, placed to the right of each other (touching, not snapped).
  await page.goto(url);
  await click(btn('Create a new project'));
  await page.locator('dialog[open] input').fill(`Connect ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  for (let i = 0; i < 3; i++) await add('Base cabinet', /^Base cabinet/);
  await showPlan();
  check(width, 'three "Base cabinet…" pieces on the plan', (await bases.count()) === 3);
  check(width, 'placed pieces are not connected: no tick on the plan', (await ticks.count()) === 0);

  // 2. Select the first two → the card shows "Connected"; on → one tick; one selected → "Connected to …".
  await selectRows(0, 1);
  const card = side.getByRole('region', { name: /^2 pieces selected/ });
  const connected = card.getByRole('checkbox', { name: 'Connected' });
  check(width, 'the 2-pieces card shows a "Connected" toggle', await connected.isVisible());
  check(
    width,
    'the toggle is enabled for two touching base units',
    !(await connected.isDisabled()),
  );
  await click(connected);
  await page.waitForTimeout(200);
  check(width, '"Connected" is on after the tap', await connected.isChecked());
  await shot('toggle');
  await selectOff();
  await showPlan();
  check(
    width,
    'one tick across the seam on the plan',
    (await ticks.count()) === 1,
    `${await ticks.count()}`,
  );
  // ADR-179: the same tick in the room front view, and a seam line in 3D that Disconnect takes away.
  const front = page.getByRole('figure', { name: /^Room seen from the front/ });
  const frontTicks = front.locator('.front-connections line');
  await front.scrollIntoViewIfNeeded().catch(() => {});
  check(
    width,
    'one tick across the seam in the room front view',
    (await frontTicks.count()) === 1,
    `${await frontTicks.count()}`,
  );
  await shot('front-tick');
  const seams = () =>
    page.evaluate(() => document.querySelector('.view.three[data-seams]')?.dataset.seams ?? null);
  const waitSeams = async (want) => {
    for (let i = 0; i < 40; i++) {
      if ((await seams()) === want) return want;
      await page.waitForTimeout(250);
    }
    return seams();
  };
  const show3d = async () => {
    await sheet(false);
    await goBuild(page);
    const r = page.getByRole('radio', { name: '3D', exact: true });
    if (await r.isVisible().catch(() => false)) await click(r);
    await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 30000 });
  };
  await show3d();
  check(width, 'Build & Preview › 3D draws one seam line', (await waitSeams('1')) === '1');
  await page.waitForTimeout(1500);
  await shot('3d-seam');
  const exploded = page.getByRole('checkbox', { name: 'Exploded 3D' });
  if (await exploded.isVisible().catch(() => false)) {
    await click(exploded);
    check(width, 'no seam line while exploded', (await waitSeams(null)) === null);
    await click(exploded);
    check(width, 'the seam line is back after Exploded 3D off', (await waitSeams('1')) === '1');
  }
  await goCompose(page);
  await selectRows(0, 1);
  const pairCard = side.getByRole('region', { name: /^2 pieces selected/ });
  await click(pairCard.getByRole('checkbox', { name: 'Connected' }));
  await page.waitForTimeout(200);
  await selectOff();
  await show3d();
  check(width, 'no seam line in 3D after Disconnect', (await waitSeams('0')) === '0');
  await shot('3d-disconnected');
  // Connect them again for the steps below.
  await goCompose(page);
  await selectRows(0, 1);
  await click(
    side
      .getByRole('region', { name: /^2 pieces selected/ })
      .getByRole('checkbox', { name: 'Connected' }),
  );
  await page.waitForTimeout(200);
  await selectOff();
  await showPlan();
  check(width, 'connected again: one tick on the plan', (await ticks.count()) === 1);

  await sheet(true);
  const all = side.getByRole('button', { name: /^All pieces \(\d+\)$/ });
  if (await all.isVisible().catch(() => false)) await click(all);
  await click(side.getByRole('list', { name: 'Pieces' }).getByRole('button').first());
  await page.waitForTimeout(200);
  const connectedTo = side.getByText(/^Connected to Base cabinet/);
  check(
    width,
    'the selected piece says "Connected to Base cabinet…" under Position',
    await connectedTo
      .first()
      .isVisible()
      .catch(() => false),
  );
  await shot('card');
  await sheet(false);

  // 3. Drag the third away, then back against the second: the snap connects them (two ticks).
  const third = bases.nth(2);
  const edge2 = (await leftOf(bases.nth(1))) + (await widthOf(bases.nth(1)));
  await drag(third, 400, 'away');
  const xAway = await leftOf(third);
  check(width, 'the third dragged away by about 400 mm', xAway - edge2 >= 300, `${xAway}`);
  check(width, 'still one tick while apart', (await ticks.count()) === 1);
  // The first and the third do not touch: the toggle is off, disabled, with the reason.
  await selectRows(0, 2);
  const apartCard = side.getByRole('region', { name: /^2 pieces selected/ });
  const apartToggle = apartCard.getByRole('checkbox', { name: 'Connected' });
  check(
    width,
    'for two pieces apart the Connected toggle is off and disabled',
    !(await apartToggle.isChecked()) && (await apartToggle.isDisabled()),
  );
  const why =
    (await apartCard
      .getByText(/are not side by side, in a corner or one over the other/)
      .first()
      .textContent()
      .catch(() => '')) ?? '';
  check(
    width,
    'the card says why: "… are not side by side, in a corner or one over the other."',
    /are not side by side, in a corner or one over the other/.test(why),
    why,
  );
  await shot('apart-reason');
  await selectOff();
  // Back to one selected piece (the third), so the next drag moves it alone.
  await click(side.getByRole('list', { name: 'Pieces' }).getByRole('button').nth(2));
  await showPlan();
  await drag(third, edge2 + 30 - xAway, 'snap-back');
  check(
    width,
    'the third snapped flush to the second',
    (await leftOf(third)) === edge2,
    `${await leftOf(third)} vs ${edge2}`,
  );
  check(
    width,
    'the snap connected them: two ticks',
    (await ticks.count()) === 2,
    `${await ticks.count()}`,
  );

  // 4. Drag the first: all three move by the same whole mm.
  const x0 = await lefts();
  await drag(bases.nth(0), -300, 'together');
  const x1 = await lefts();
  const d = x1.map((v, i) => v - x0[i]);
  check(
    width,
    'dragging one connected piece moves all three by the same whole mm',
    d[0] !== 0 && d.every((v) => v === d[0]) && Number.isInteger(d[0]),
    JSON.stringify(d),
  );
  check(width, 'two ticks after moving together', (await ticks.count()) === 2);

  // 4b. ADR-201 (G-346): the same in Build & Preview › 3D with Move on, as tools/move-3d/find-it.mjs drags (mouse on a
  // desktop, CDP touch on a phone): pressing the middle of the view takes the piece framed there; the connected set
  // moves along. On a desktop an Alt drag moves that piece alone; one Undo joins them again.
  await show3d();
  const canvas = page.locator('.view.three canvas');
  await canvas.waitFor({ state: 'visible', timeout: 20000 });
  {
    // The Simple look draws fast enough in a software-rendered browser.
    const menu = page
      .locator('details.view-options')
      .filter({ has: page.getByRole('radio', { name: 'Simple', includeHidden: true }) });
    const inMenu = (await menu.count()) > 0;
    if (inMenu && !(await menu.evaluate((d) => d.open)))
      await menu.locator(':scope > summary').click();
    await page.getByRole('radio', { name: 'Simple' }).click();
    if (inMenu) await page.keyboard.press('Escape');
    await page.waitForTimeout(1200);
  }
  const tools3d = page.getByRole('toolbar', { name: 'Place pieces in 3D' });
  const move3d = tools3d.getByRole('button', { name: 'Move', exact: true });
  if ((await move3d.getAttribute('aria-pressed')) !== 'true') await move3d.click();
  check(
    width,
    '3D: Move turns on (pressed)',
    (await move3d.getAttribute('aria-pressed')) === 'true',
  );
  /** Press the 3D view's centre, drag dx px to the right in steps, release; `alt` holds Alt (desktop). */
  const drag3d = async (dx, name, alt = false) => {
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
      if (alt) await page.keyboard.down('Alt');
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      for (let i = 1; i <= steps; i++) await page.mouse.move(at(i).x, at(i).y);
    }
    await page.waitForTimeout(250);
    await shot(name);
    if (phone) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    else {
      await page.mouse.up();
      if (alt) await page.keyboard.up('Alt');
    }
    await page.waitForTimeout(500);
  };
  /** Back to the 3D view, settled (as tools/move-3d/find-it.mjs's `to3d`). */
  const settled3d = async () => {
    await show3d();
    await page.waitForTimeout(1200);
  };
  await showPlan();
  const z0 = await lefts();
  await settled3d();
  await drag3d(phone ? 90 : 160, '3d-together');
  await showPlan();
  const z1 = await lefts();
  const dz = z1.map((v, i) => v - z0[i]);
  check(
    width,
    '3D Move: dragging a connected piece moves all three by the same whole mm',
    dz[0] !== 0 && dz.every((v) => v === dz[0]) && Number.isInteger(dz[0]),
    JSON.stringify(dz),
  );
  check(width, '3D Move: still two ticks after moving together', (await ticks.count()) === 2);
  if (!phone) {
    await settled3d();
    await drag3d(160, '3d-alone', true);
    await showPlan();
    const z2 = await lefts();
    const moved = z2.map((v, i) => v !== z1[i]);
    check(
      width,
      '3D Move: an Alt drag moves only the piece pressed',
      moved.filter(Boolean).length === 1,
      JSON.stringify(z2.map((v, i) => v - z1[i])),
    );
    check(
      width,
      '3D Move: the Alt drag parts it from its neighbours (fewer ticks)',
      (await ticks.count()) < 2,
      `${await ticks.count()}`,
    );
    // One Undo puts it back, joined again, for the steps below.
    await click(btn('Undo'));
    await page.waitForTimeout(300);
    await showPlan();
    check(
      width,
      'one Undo puts the Alt-dragged piece back, joined (two ticks)',
      JSON.stringify(await lefts()) === JSON.stringify(z1) && (await ticks.count()) === 2,
    );
  }
  await goCompose(page);
  await showPlan();

  if (!phone) {
    // 5. Alt-drag the third alone: the others stay and the pair is disconnected (one tick).
    const y0 = await lefts();
    await drag(bases.nth(2), 300, 'alone', true);
    const y1 = await lefts();
    check(
      width,
      'Alt-drag moves the piece alone',
      y1[2] !== y0[2] && y1[0] === y0[0] && y1[1] === y0[1],
      JSON.stringify(y1.map((v, i) => v - y0[i])),
    );
    check(
      width,
      'parted by Alt-drag: one tick left',
      (await ticks.count()) === 1,
      `${await ticks.count()}`,
    );
  }

  // 6. Make the first member narrower: Checks warns "connected but no longer joined".
  await sheet(true);
  if (await all.isVisible().catch(() => false)) await click(all);
  await click(side.getByRole('list', { name: 'Pieces' }).getByRole('button').first());
  await page.waitForTimeout(200);
  await click(btn('Size, boards and construction'));
  const w = dlg.getByLabel('Width', { exact: true }).first();
  await w.fill('500');
  await w.press('Tab');
  await page.waitForTimeout(150);
  await click(dlg.getByRole('button', { name: 'Done' }).last());
  await dlg.waitFor({ state: 'detached' }).catch(() => {});
  await sheet(false);
  const checksTab = page.getByRole('tab', { name: /Checks/ });
  if (!(await checksTab.isVisible().catch(() => false))) await goBuild(page);
  if ((await checksTab.getAttribute('aria-selected')) !== 'true') await click(checksTab);
  await page.waitForTimeout(200);
  const warnText =
    (await page
      .getByText(/are connected but no longer joined/)
      .first()
      .textContent({ timeout: 3000 })
      .catch(() => '')) ?? '';
  check(
    width,
    'Checks shows "… are connected but no longer joined: …"',
    /Base cabinet.*Base cabinet.*connected but no longer joined/.test(warnText),
    warnText,
  );
  await shot('checks');
  check(width, 'no sideways scroll (Checks)', await noSideScroll());

  // 7. Back in Compose, the toggle disconnects the pair.
  await goCompose(page);
  await selectRows(0, 1);
  const card2 = side.getByRole('region', { name: /^2 pieces selected/ });
  const connected2 = card2.getByRole('checkbox', { name: 'Connected' });
  check(width, 'the toggle is on for the still-connected pair', await connected2.isChecked());
  await click(connected2);
  await page.waitForTimeout(200);
  check(width, 'the toggle disconnects them', !(await connected2.isChecked()));
  await selectOff();
  await showPlan();
  check(
    width,
    'no tick for the disconnected pair',
    (await ticks.count()) <= 1,
    `${await ticks.count()}`,
  );
  await shot('end');
  check(width, 'no sideways scroll', await noSideScroll());
  check(width, 'no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
