// Find-it acceptance for selecting several pieces in the front view, the 3D view and the piece list (CLAUDE.md R3,
// backlog N161, ADR-159), against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/multi-select-views/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// From the bare app, by visible text, at 1440 and 390 px: a base cabinet with a wall cabinet hung above it. Select in
// the front view → tap both → both pressed; the plan's and 3D's Select show checked; Group groups them. 3D: Esc →
// tap both → both selected. Desktop: Shift-click in 3D adds a piece. Piece list: Select on → tap two rows → both
// selected. No horizontal scroll at 390 px. Not part of `pnpm test`.
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
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = (name) =>
    page.screenshot({ path: `${out}/multi-select-views-${name}-${width}.png` });
  const dlg = page.locator('dialog[open]');
  const btn = (name) => page.getByRole('button', { name, exact: true });
  const plan = page.getByRole('figure', { name: /Room plan, seen from above/ });
  const front = page.getByRole('figure', { name: /Room seen from the front/ });
  const sheet = async (open) => {
    const peek = page.locator('.sheet-peek');
    if (!(await peek.isVisible().catch(() => false))) return;
    if (((await peek.getAttribute('aria-expanded')) === 'true') !== open) await peek.click();
    await page.waitForTimeout(300);
  };
  const tapAt = async (x, y, shift = false) => {
    if (shift) await page.keyboard.down('Shift');
    if (phone) await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);
    if (shift) await page.keyboard.up('Shift');
    await page.waitForTimeout(250);
  };
  const rows = page.locator('ul.pieces .row-btn');
  const listPressed = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('ul.pieces .row-btn')].map(
        (b) => b.getAttribute('aria-pressed') === 'true',
      ),
    );
  const view = async (name) => {
    const r = page.getByRole('radio', { name, exact: true });
    if (await r.isVisible().catch(() => false)) await r.click();
    await page.waitForTimeout(name === '3D' ? 2500 : 300);
  };

  // 1. Bare app → new project → a base cabinet, and a wall cabinet tapped onto the plan over it.
  await page.goto(url);
  await btn('Create a new project').click();
  await page.locator('dialog[open] input').fill(`Views ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  for (const q of ['Base cabinet', 'Wall cabinet']) {
    await sheet(true);
    await btn('Add a piece').click();
    await dlg.getByRole('searchbox', { name: 'Search the items' }).fill(q);
    await dlg
      .locator('.start-group .row-btn')
      .nth(q === 'Wall cabinet' ? 1 : 0)
      .click();
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
    await page.waitForTimeout(300);
    await sheet(false);
    if (q === 'Base cabinet') {
      const place = btn('Place to the right');
      if (await place.isVisible().catch(() => false)) await place.click();
    } else {
      await view('2D');
      const pt = await plan.locator(':scope > svg').evaluate((s) => {
        const p = new DOMPoint(10, 10).matrixTransform(s.getScreenCTM());
        return { x: p.x, y: p.y };
      });
      await tapAt(pt.x, pt.y);
    }
    await page.waitForTimeout(300);
  }
  await page.keyboard.press('Escape');
  await view('2D');

  // 2. Front view: Select → tap both → both pressed; Select checked on the plan too.
  const fr = front.locator('rect.front-hit');
  check(width, 'two pieces in the front view', (await fr.count()) === 2, `${await fr.count()}`);
  const sel = front.getByRole('checkbox', { name: 'Select', exact: true });
  check(width, 'a "Select" checkbox is on the front view', await sel.isVisible());
  await sel.click();
  for (let i = 0; i < 2; i++) {
    await sheet(false);
    await fr.nth(i).scrollIntoViewIfNeeded();
    const b = await fr.nth(i).boundingBox();
    await tapAt(b.x + b.width / 2, b.y + b.height / 2);
  }
  const fp = await fr.evaluateAll((rs) => rs.map((r) => r.getAttribute('aria-pressed')));
  check(
    width,
    'front view: taps select the base and the wall cabinet',
    fp.join() === 'true,true',
    fp.join(),
  );
  check(
    width,
    'Select is shared: the plan shows it checked',
    await plan.getByRole('checkbox', { name: 'Select', exact: true }).isChecked(),
  );
  await shot('front');
  await sheet(true);
  await btn('Group').click();
  await page.waitForTimeout(200);
  check(
    width,
    'Group groups them ("Group 1")',
    await page.getByText('Group 1').first().isVisible(),
  );
  await btn('Ungroup')
    .first()
    .click()
    .catch(() => {});
  await sheet(false);

  // 3. 3D: Select pressed; Esc → tap both → both selected.
  await view('3D');
  check(
    width,
    '3D: "Select" is pressed',
    (await btn('Select').getAttribute('aria-pressed')) === 'true',
  );
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const c = await page.locator('canvas').first().boundingBox();
  for (const fy of [0.3, 0.75]) {
    await tapAt(c.x + c.width * 0.5, c.y + c.height * fy);
    await sheet(false);
  }
  const p3 = await listPressed();
  check(width, '3D: taps select both pieces', p3.every(Boolean), JSON.stringify(p3));
  await shot('3d');
  if (!phone) {
    // Select off: a plain tap selects one; Shift-click adds the other.
    await btn('Select').click();
    await page.keyboard.press('Escape');
    await tapAt(c.x + c.width * 0.5, c.y + c.height * 0.3);
    await tapAt(c.x + c.width * 0.5, c.y + c.height * 0.75, true);
    const ps = await listPressed();
    check(width, '3D: Shift-click adds a piece', ps.every(Boolean), JSON.stringify(ps));
    await btn('Select').click();
  }

  // 4. Piece list: Select on → tap two rows → both selected.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await sheet(true);
  check(
    width,
    'a "Select" checkbox sits beside the Pieces heading',
    await page
      .locator('.list-head-row')
      .getByRole('checkbox', { name: 'Select', exact: true })
      .isChecked(),
  );
  for (let i = 0; i < 2; i++) {
    await rows.nth(i).scrollIntoViewIfNeeded();
    await rows.nth(i).click();
    await page.waitForTimeout(250);
  }
  const pl = await listPressed();
  check(width, 'list: two taps select two pieces', pl.every(Boolean), JSON.stringify(pl));
  await rows.first().scrollIntoViewIfNeeded();
  await shot('list');
  if (phone) {
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    check(width, 'no horizontal scroll', sw <= width, `${sw}`);
  }
  check(width, 'no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
