// Find-it acceptance for quick counts over the drawing (ADR-084, backlog N79) and over 3D (ADR-085, N80),
// run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/count-stepper/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
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

for (const width of [1280, 390]) {
  const phone = width < 500;
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const shot = (name) => page.screenshot({ path: `${out}/count-stepper-${name}-${width}.png` });
  const mode = (name) => page.getByRole('radio', { name });
  const front = page.locator('.view.front');
  const three = page.locator('.view.three');
  const card = (where) => where.getByRole('group', { name: 'Quick counts' });
  const valueOf = (where, label) => card(where).getByRole('status', { name: label }).innerText();
  const box = async (l) => (await l.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
  const inside = (a, b) =>
    a.x >= b.x - 1 &&
    a.y >= b.y - 1 &&
    a.x + a.width <= b.x + b.width + 1 &&
    a.y + a.height <= b.y + b.height + 1;

  // 1. Bare app → New single piece → Sideboard (doors either side of a drawer bank).
  await page.goto(url);
  await page.getByRole('button', { name: 'New single piece' }).click();
  await page
    .locator('dialog[open]')
    .getByRole('button', { name: /Sideboard/ })
    .first()
    .click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await mode('Compose').click();

  // 2. First tap selects the whole piece (ADR-083): the card shows the piece's dividers. A second tap on the drawer
  //    bank selects it: the card sits right above it, inside the drawing.
  const bank = front.getByRole('button', { name: /^3 drawers space/ });
  await bank.click({ force: true });
  await page.waitForTimeout(250);
  check(
    width,
    'whole piece selected: card shows Vertical dividers 2',
    (await card(front).isVisible()) && (await valueOf(front, 'Vertical dividers')) === '2',
  );
  await bank.click({ force: true });
  await page.waitForTimeout(250);
  const c = card(front);
  check(width, '"Quick counts" card in the drawing', await c.isVisible());
  for (const t of ['Vertical dividers', 'Horizontal dividers', 'Drawers'])
    check(width, `card shows "${t}"`, await c.getByText(t, { exact: true }).isVisible());
  const cb = await box(c);
  const sel = await box(front.locator('.el-selection'));
  check(
    width,
    'card is right above the selected space',
    cb.y + cb.height <= sel.y + 1 && sel.y - (cb.y + cb.height) < 24,
    `card bottom ${Math.round(cb.y + cb.height)}, space top ${Math.round(sel.y)}`,
  );
  check(width, 'card is inside the drawing', inside(cb, await box(front)));
  check(width, 'Vertical dividers shows 2', (await valueOf(front, 'Vertical dividers')) === '2');
  await shot('drawing');

  // 3. + Drawers: 4, and the drawing says so; − Vertical dividers: one bay fewer.
  await c.getByRole('button', { name: 'More drawers' }).click();
  await page.waitForTimeout(200);
  check(width, 'More drawers → 4', (await valueOf(front, 'Drawers')) === '4');
  check(
    width,
    'drawing shows "4 drawers"',
    await front.getByText('4 drawers', { exact: true }).isVisible(),
  );
  const bays = await front.locator('.el-space').count();
  await c.getByRole('button', { name: 'Fewer vertical dividers' }).click();
  await page.waitForTimeout(200);
  check(
    width,
    'Fewer vertical dividers → 1, one space fewer',
    (await valueOf(front, 'Vertical dividers')) === '1' &&
      (await front.locator('.el-space').count()) === bays - 1,
  );
  check(width, 'no sideways scroll (drawing)', await noSideScroll());

  // 4. Tap the left door space: Shelves and Doors rows; + Doors → 2.
  await front
    .getByRole('button', { name: /^1 shelf space/ })
    .first()
    .click({ force: true });
  await page.waitForTimeout(200);
  await card(front).getByRole('button', { name: 'More doors' }).click();
  await page.waitForTimeout(200);
  check(width, 'More doors → 2', (await valueOf(front, 'Doors')) === '2');

  // 5. 3D (Build & Preview): the same card over the 3D view, inside it; − Doors → 1.
  await mode(/Build & Preview/).click();
  await three.locator('canvas').waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(1500);
  const c3 = card(three);
  check(width, '"Quick counts" card over the 3D view', await c3.isVisible());
  check(width, 'card is inside the 3D view', inside(await box(c3), await box(three)));
  check(width, '3D card shows Doors 2', (await valueOf(three, 'Doors')) === '2');
  await shot('3d');
  await c3.getByRole('button', { name: 'Fewer doors' }).click();
  await page.waitForTimeout(250);
  check(width, 'Fewer doors in 3D → 1', (await valueOf(three, 'Doors')) === '1');
  check(width, 'no sideways scroll (3D)', await noSideScroll());

  check(width, 'no page errors', errors.length === 0, errors.join(' / '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
