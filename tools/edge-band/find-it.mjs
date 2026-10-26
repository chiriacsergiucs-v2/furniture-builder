// Find-it acceptance for edge band specs on boards (ADR-077, backlog N72), run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/edge-band/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text. Not part of `pnpm test`.
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

for (const width of [1440, 1280, 390, 375]) {
  const phone = width < 500;
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 } });
  const page = await ctx.newPage();
  // Build & Preview keeps a software-rendered 3D view busy; give clicks time.
  page.setDefaultTimeout(60000);
  const errors = [];
  const remote = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (
      !['localhost', '127.0.0.1'].includes(u.hostname) &&
      !u.protocol.startsWith('blob') &&
      !u.protocol.startsWith('data')
    )
      remote.push(r.url());
  });
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const shot = (name) =>
    page.screenshot({ path: `${out}/edge-band-${name}-${width}.png`, fullPage: true });
  const mode = (name) => page.getByRole('radio', { name });
  // Settings (ADR-080) holds the boards and their edge band fields; the Configure mode is gone.
  const dlg = page.locator('dialog[open]');
  const band = (board) => dlg.getByRole('group', { name: `Edge band for ${board}` });
  const fill = async (loc, text) => {
    await loc.scrollIntoViewIfNeeded();
    await loc.fill(text);
    await loc.press('Tab');
    await page.waitForTimeout(150);
  };

  /** Settings › Boards, sheets and saw cut. */
  const openBoards = async () => {
    await page.getByRole('button', { name: 'Settings' }).click();
    await dlg.waitFor({ state: 'visible' });
    const g = dlg.locator('details.group', {
      has: page.locator('summary', { hasText: 'Boards, sheets and saw cut' }),
    });
    if (!(await g.evaluate((d) => d.open))) await g.locator('summary').first().click();
  };
  const closeSettings = async () => {
    await dlg.getByRole('button', { name: 'Done' }).click();
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
  };

  // 1. Bare app → New single piece → Chest of drawers → editor.
  await page.goto(url);
  await page.getByRole('button', { name: 'New single piece' }).click();
  await page
    .locator('dialog[open]')
    .getByRole('button', { name: /Chest of drawers/ })
    .first()
    .click();
  await page.locator('main.work').waitFor({ state: 'visible' });

  // 2. Settings → Boards, sheets and saw cut → each board has "Edge band" with a "Band type".
  await openBoards();
  const pal = band('PAL 18 white');
  await pal.scrollIntoViewIfNeeded();
  check(
    width,
    '"Edge band" found on the board',
    await pal.getByText('Edge band').first().isVisible(),
  );
  check(
    width,
    'band not named yet: no default filled in',
    (await pal.getByLabel('Band type').inputValue()) === '' &&
      (await pal.getByText(/^Not named: the shopping list puts this board/).isVisible()),
  );

  // 3. Name the carcass band: ABS, 0.8 mm (common size), 22 mm, H1145.
  await pal.getByLabel('Band type').selectOption({ label: 'ABS' });
  check(
    width,
    '"common supplier sizes" thickness choices shown',
    await pal.getByText('Band thickness, common supplier sizes').isVisible(),
  );
  await pal.getByRole('radio', { name: '0.8 mm' }).click();
  await fill(pal.getByLabel('Band width (mm)'), '22');
  await fill(pal.getByLabel('Band code (optional)'), 'H1145');
  check(
    width,
    'carcass band named "ABS 0.8 × 22 mm, H1145"',
    await pal.getByText('ABS 0.8 × 22 mm, H1145').isVisible(),
  );

  // 4. Fronts: MDF band ABS 1 × 22 typed, fronts banded differently ABS 2 × 22.
  const mdf = band('MDF 18 painted');
  await mdf.scrollIntoViewIfNeeded();
  await mdf.getByLabel('Band type').selectOption({ label: 'ABS' });
  await fill(mdf.getByLabel('Band thickness (mm)'), '1');
  await fill(mdf.getByLabel('Band width (mm)'), '22');
  await mdf.getByText('Fronts banded differently').click();
  const front = mdf.locator('.band-fields').nth(1);
  await front.getByLabel('Band type').selectOption({ label: 'ABS' });
  await front.getByRole('radio', { name: '2 mm' }).click();
  await fill(front.getByLabel('Band width (mm)'), '22');
  check(
    width,
    'front band named "ABS 2 × 22 mm"',
    await front.getByText('ABS 2 × 22 mm', { exact: true }).isVisible(),
  );
  check(width, 'no sideways scroll (Settings, band fields)', await noSideScroll());
  await pal.scrollIntoViewIfNeeded();
  await shot('settings');
  await closeSettings();

  // 5. Build & Preview → Parts: each board header names its band.
  await mode(/Build & Preview/).dispatchEvent('click');
  {
    const t = page.getByRole('tab', { name: /Parts/ });
    if ((await t.getAttribute('aria-selected')) !== 'true') await t.dispatchEvent('click');
  }
  const parts = page.locator('#panel-parts');
  check(
    width,
    'Parts: "Edge band: ABS 0.8 × 22 mm, H1145" on PAL 18 white',
    await parts
      .locator('caption', { hasText: 'PAL 18 white' })
      .getByText('Edge band: ABS 0.8 × 22 mm, H1145')
      .isVisible(),
  );
  check(
    width,
    'Parts: MDF header names the board and the front band',
    await parts
      .locator('caption', { hasText: 'MDF 18 painted' })
      .getByText(/^Edge band: .*fronts ABS 2 × 22 mm$/)
      .isVisible(),
  );
  check(
    width,
    'Parts: a board without a band says "not named yet"',
    await parts.getByText('Edge band: not named yet').first().isVisible(),
  );
  check(width, 'no sideways scroll (Parts)', await noSideScroll());
  await shot('parts');

  // 6. Shopping list: one banding line per band, unnamed boards under To choose before buying.
  {
    const t = page.getByRole('tab', { name: 'Shopping list' });
    if ((await t.getAttribute('aria-selected')) !== 'true') await t.dispatchEvent('click');
  }
  const shop = page.locator('#panel-shopping');
  const banding = shop.getByRole('region', { name: 'Edge banding' });
  await banding.waitFor({ timeout: 10000 }).catch(() => {});
  // The chest's MDF parts are all drawer fronts, so its own band (ABS 1 × 22) has no metres to buy.
  for (const label of ['ABS 0.8 × 22 mm, H1145', 'ABS 2 × 22 mm'])
    check(
      width,
      `Shopping list: banding line "${label}" in metres`,
      await banding
        .locator('tr', { has: page.getByRole('cell', { name: label, exact: true }) })
        .getByText(/^\d+\.\d\d m$/)
        .isVisible(),
    );
  check(
    width,
    'Shopping list: "Edge band for PAL 16 white" to choose before buying',
    await shop
      .getByRole('region', { name: 'To choose before buying' })
      .getByText('Edge band for PAL 16 white')
      .isVisible(),
  );
  check(
    width,
    'Shopping list: a band with no banded parts has no line',
    (await banding.getByRole('cell', { name: 'ABS 1 × 22 mm', exact: true }).count()) === 0,
  );
  check(width, 'no sideways scroll (Shopping list)', await noSideScroll());
  await shot('shopping');

  // 7. A band narrower than the board: an error in Checks, exports blocked; fixed again.
  await openBoards();
  await fill(band('PAL 18 white').getByLabel('Band width (mm)'), '15');
  await closeSettings();
  await mode(/Build & Preview/).dispatchEvent('click');
  {
    const t = page.getByRole('tab', { name: /Checks/ });
    if ((await t.getAttribute('aria-selected')) !== 'true') await t.dispatchEvent('click');
  }
  check(
    width,
    'narrow band: error "… is narrower than the 18 mm board"',
    await page
      .locator('#panel-checks')
      .getByText(
        'Edge band ABS 0.8 × 15 mm, H1145 on PAL 18 white is narrower than the 18 mm board.',
      )
      .isVisible(),
  );
  {
    const t = page.getByRole('tab', { name: /Parts/ });
    if ((await t.getAttribute('aria-selected')) !== 'true') await t.dispatchEvent('click');
  }
  check(
    width,
    'narrow band: Download CSV blocked',
    await page.getByRole('button', { name: 'Download CSV' }).isDisabled(),
  );
  await shot('narrow');
  await openBoards();
  await fill(band('PAL 18 white').getByLabel('Band width (mm)'), '22');
  await closeSettings();
  await mode(/Build & Preview/).dispatchEvent('click');
  {
    const t = page.getByRole('tab', { name: /Parts/ });
    if ((await t.getAttribute('aria-selected')) !== 'true') await t.dispatchEvent('click');
  }
  check(
    width,
    'band fixed: Download CSV enabled again',
    await page.getByRole('button', { name: 'Download CSV' }).isEnabled(),
  );

  check(width, 'no requests leave the device', remote.length === 0, remote.slice(0, 3).join(' '));
  check(width, 'no page errors', errors.length === 0, errors.join(' / '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
