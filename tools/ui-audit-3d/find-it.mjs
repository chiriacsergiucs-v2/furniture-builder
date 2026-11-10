// Find-it acceptance for the UI audit's 3D and plan-drag items (CLAUDE.md R3; ADR-250 item 5, ADR-251 item 3, ADR-259
// items 3 and 6), run against a
// production build:
//   pnpm build && pnpm preview &  node tools/ui-audit-3d/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// From the bare app at 1280 and 390 px, by role and visible text:
// - ADR-250: a project with two base cabinets, both selected in the piece list, Move on, a drag in the 3D view moves
//   both by the same "From left" amount, and one Undo puts both back.
// - ADR-251 item 3: the same two pieces, connected; with Move alone on (Options on a phone), a plan drag of the second
//   piece moves it alone and the pair is no longer Connected.
// - ADR-259: the 3D view's one ⋯ "More 3D actions" menu holds Export for AR (.usdz), Export scene (.glb) and View in
//   AR (a stand-in WebXR that offers immersive AR), and Export for AR says "Saved ….usdz.".
// Not part of `pnpm test`.
import { launchBrowser, previewUrl, outDir, WIDTHS } from '../lib/harness.mjs';
import { goBuild, goCompose, showPieces } from '../lib/steps.mjs';
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

/** A device that offers immersive AR: View in AR shows (the session itself is not started here). */
function xrOffered() {
  Object.defineProperty(navigator, 'xr', {
    configurable: true,
    value: {
      isSessionSupported: async (mode) => mode === 'immersive-ar',
      requestSession: async () => {
        throw new Error('not in this check');
      },
    },
  });
}

for (const width of WIDTHS) {
  const phone = width < 500;
  const ctx = await browser.newContext({
    viewport: { width, height: phone ? 844 : 900 },
    hasTouch: phone,
    isMobile: phone,
    acceptDownloads: true,
    serviceWorkers: 'block',
  });
  await ctx.addInitScript(xrOffered);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  const shot = (name) =>
    page.screenshot({ path: `${out}/ui-audit-3d-${name}-${width}.png`, fullPage: true });
  const dlg = page.locator('dialog[open]');
  const btn = (name, exact = true) => page.getByRole('button', { name, exact });
  const click = async (loc) => {
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    await loc.click({ timeout: 3000 }).catch((e) => {
      if (!/performing click action|click action done/.test(e.message))
        return loc.dispatchEvent('click');
    });
  };
  const sheet = async (open) => {
    const peek = page.locator('.sheet-peek');
    if (!(await peek.isVisible().catch(() => false))) return;
    if (((await peek.getAttribute('aria-expanded')) === 'true') !== open) await peek.click();
    await page.waitForTimeout(200);
  };
  const openGroup = async (title) => {
    const s = page
      .locator('details.group > summary')
      .filter({ hasText: new RegExp(`^${title}$`) })
      .first();
    if (
      (await s.isVisible().catch(() => false)) &&
      !(await s.evaluate((el) => el.parentElement.open))
    )
      await s.click({ timeout: 5000 });
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
  };
  const list = page.getByRole('list', { name: 'Pieces' }).first();
  const selectSwitch = page.getByRole('checkbox', { name: 'Select', exact: true }).first();
  /** "From left" of the piece in row i: the row alone selected, its Position group read. */
  const fromLeft = async (i) => {
    await goCompose(page);
    await showPieces(page);
    if (await selectSwitch.isChecked().catch(() => false)) await click(selectSwitch);
    await click(list.getByRole('button').nth(i));
    await page.waitForTimeout(200);
    await openGroup('Position');
    const field = page.getByLabel('From left', { exact: true }).first();
    return Number(await field.inputValue({ timeout: 3000 }).catch(() => 'NaN'));
  };
  const three = page.locator('.view.three');
  const canvas = three.locator('canvas');
  const to3d = async () => {
    if (phone) {
      await sheet(false);
      await goBuild(page);
    }
    const r = page.getByRole('radio', { name: '3D', exact: true });
    if ((await r.getAttribute('aria-checked')) !== 'true') await r.click();
    await canvas.first().waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(1500);
  };

  // Bare app → new project → two base cabinets side by side.
  await page.goto(url);
  await click(btn('Create a new project'));
  await page.locator('dialog[open] input').fill(`Audit 3D ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await addBase();
  await addBase();
  const a0 = await fromLeft(0);
  const b0 = await fromLeft(1);
  check(
    width,
    'two pieces with a "From left"',
    Number.isFinite(a0) && Number.isFinite(b0) && a0 !== b0,
    `${a0}, ${b0}`,
  );

  // ADR-250 item 5: both selected → Move → a drag on one moves both by the same amount.
  await goCompose(page);
  await showPieces(page);
  if (!(await selectSwitch.isChecked())) await click(selectSwitch);
  const rows = list.getByRole('button');
  for (const i of [0, 1])
    if ((await rows.nth(i).getAttribute('aria-pressed')) !== 'true') await click(rows.nth(i));
  check(
    width,
    'both rows selected',
    (await rows.nth(0).getAttribute('aria-pressed')) === 'true' &&
      (await rows.nth(1).getAttribute('aria-pressed')) === 'true',
  );
  await to3d();
  const move = page
    .getByRole('toolbar', { name: 'Place pieces in 3D' })
    .getByRole('button', { name: 'Move', exact: true });
  await click(move);
  check(width, 'Move is on', (await move.getAttribute('aria-pressed')) === 'true');
  const r = await canvas.first().boundingBox();
  // Left of the centre: on the first piece (the view frames both, the seam at the centre).
  const a = { x: r.x + r.width * 0.42, y: r.y + r.height * 0.55 };
  const dx = phone ? 70 : 140;
  const steps = 10;
  if (phone) {
    const touch = (type, p) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y }] : [] });
    await touch('touchStart', a);
    for (let i = 1; i <= steps; i++)
      await touch('touchMove', { x: a.x + (dx * i) / steps, y: a.y });
    await touch('touchEnd');
  } else {
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) await page.mouse.move(a.x + (dx * i) / steps, a.y);
    await page.mouse.up();
  }
  await page.waitForTimeout(500);
  await shot('dragged');
  const a1 = await fromLeft(0);
  const b1 = await fromLeft(1);
  check(
    width,
    'the drag moved both pieces by the same amount',
    a1 !== a0 && a1 - a0 === b1 - b0,
    `${a0}→${a1}, ${b0}→${b1}`,
  );
  await goCompose(page);
  await sheet(true);
  await click(btn('Undo'));
  await page.waitForTimeout(300);
  const a2 = await fromLeft(0);
  const b2 = await fromLeft(1);
  check(width, 'one Undo puts both back', a2 === a0 && b2 === b0, `${a2}, ${b2}`);

  // ADR-251 item 3: connected pair → Move alone → a plan drag of the second piece moves it alone and disconnects it.
  const connected = page.getByRole('checkbox', { name: 'Connected', exact: true }).first();
  const selectBoth = async () => {
    await goCompose(page);
    await showPieces(page);
    if (!(await selectSwitch.isChecked())) await click(selectSwitch);
    for (const i of [0, 1])
      if ((await rows.nth(i).getAttribute('aria-pressed')) !== 'true') await click(rows.nth(i));
    await page.waitForTimeout(200);
  };
  await selectBoth();
  if (!(await connected.isChecked().catch(() => false))) await click(connected);
  check(width, 'the two pieces are Connected', await connected.isChecked().catch(() => false));
  const c0 = await fromLeft(0);
  const d0 = await fromLeft(1);
  await sheet(false);
  const two = page.getByRole('radio', { name: '2D', exact: true });
  if ((await two.getAttribute('aria-checked')) !== 'true') await two.click();
  const plan = page.getByRole('figure', { name: /Room plan, seen from above/ });
  // On a phone Move alone sits behind the plan's Options menu (ADR-144), beside Snap.
  const options = page
    .locator('details.view-options')
    .filter({ has: page.getByRole('checkbox', { name: 'Move alone', includeHidden: true }) });
  const inMenu = (await options.count()) > 0;
  if (inMenu && !(await options.evaluate((d) => d.open)))
    await options.locator(':scope > summary').click();
  const alone = page.getByRole('checkbox', { name: 'Move alone', exact: true });
  if (!(await alone.isChecked())) await click(alone);
  check(width, 'Move alone is on', await alone.isChecked());
  if (inMenu) await page.keyboard.press('Escape');
  const second = plan.getByRole('button', { name: /^Base cabinet/ }).nth(1);
  const sb = await second.boundingBox();
  const p0 = { x: sb.x + sb.width / 2, y: sb.y + sb.height / 2 };
  const pdx = phone ? 40 : 80;
  if (phone) {
    const touch = (type, p) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y }] : [] });
    await touch('touchStart', p0);
    for (let i = 1; i <= steps; i++)
      await touch('touchMove', { x: p0.x + (pdx * i) / steps, y: p0.y });
    await touch('touchEnd');
  } else {
    await page.mouse.move(p0.x, p0.y);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) await page.mouse.move(p0.x + (pdx * i) / steps, p0.y);
    await page.mouse.up();
  }
  await page.waitForTimeout(400);
  await shot('move-alone');
  const c1 = await fromLeft(0);
  const d1 = await fromLeft(1);
  check(
    width,
    'the plan drag moved the second piece alone',
    c1 === c0 && d1 !== d0,
    `${c0}→${c1}, ${d0}→${d1}`,
  );
  await selectBoth();
  check(width, 'the pair is no longer Connected', !(await connected.isChecked().catch(() => true)));

  // ADR-259 items 3 and 6: one ⋯ menu with the three 3D actions; Export for AR says Saved ….usdz.
  await to3d();
  await page.locator('details.three-more > summary').first().click();
  const more = page.getByRole('group', { name: 'More 3D actions' }).first();
  for (const name of ['Export for AR (.usdz)', 'Export scene (.glb)', 'View in AR'])
    check(
      width,
      `⋯ More 3D actions holds "${name}"`,
      await more.getByRole('button', { name, exact: true }).isVisible(),
    );
  check(
    width,
    'only one ⋯ menu over the 3D view',
    (await page.getByRole('group', { name: 'More 3D actions', includeHidden: true }).count()) === 1,
  );
  await shot('more-3d');
  const download = page.waitForEvent('download', { timeout: 30000 }).catch(() => null);
  await more.getByRole('button', { name: 'Export for AR (.usdz)', exact: true }).click();
  const file = await download;
  const notice = page.getByText(/^Saved .+\.usdz\.$/).first();
  const said = await notice
    .waitFor({ timeout: 30000 })
    .then(() => true)
    .catch(() => false);
  check(
    width,
    'Export for AR downloads a .usdz',
    !!file && /\.usdz$/.test(file.suggestedFilename()),
    file?.suggestedFilename() ?? 'none',
  );
  check(width, 'Export for AR says "Saved ….usdz."', said, said ? await notice.textContent() : '');
  await shot('usdz-saved');

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
