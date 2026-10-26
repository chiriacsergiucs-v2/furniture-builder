// Find-it acceptance for quick counts over the drawing (ADR-084, backlog N79), over 3D (ADR-085, N80) and empty new
// parts (ADR-089, N85),
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
  // The 3D view's card: over the view on a desktop, docked under it on a phone (G-069).
  const dock3 = phone ? page.locator('#count-dock') : three;
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
    check(
      width,
      `card shows "${t}"`,
      await c.locator('.cs-label').getByText(t, { exact: true }).isVisible(),
    );
  const cb = await box(c);
  const sel = await box(front.locator('.el-selection'));
  check(
    width,
    'card is right above the selected space',
    cb.y + cb.height <= sel.y + 1 && sel.y - (cb.y + cb.height) < 24,
    `card bottom ${Math.round(cb.y + cb.height)}, space top ${Math.round(sel.y)}`,
  );
  check(width, 'card is inside the drawing', inside(cb, await box(front)));
  check(
    width,
    'drawer bank selected: its own Vertical dividers 0 (ADR-086)',
    (await valueOf(front, 'Vertical dividers')) === '0',
  );
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
  // The user's bug (ADR-086): with the middle section selected, + Vertical dividers divides that section only.
  const sides = () =>
    front
      .getByRole('button', { name: /^1 shelf space/ })
      .evaluateAll((es) => es.map((e) => e.getAttribute('aria-label')));
  const bays = await front.locator('.el-space').count();
  const before = await sides();
  await c.getByRole('button', { name: 'More vertical dividers' }).click();
  await page.waitForTimeout(200);
  check(
    width,
    'More vertical dividers on the middle section → it splits in two, the side sections keep their size',
    (await valueOf(front, 'Vertical dividers')) === '1' &&
      (await front.locator('.el-space').count()) === bays + 1 &&
      JSON.stringify(await sides()) === JSON.stringify(before),
    `${JSON.stringify(before)} → ${JSON.stringify(await sides())}`,
  );
  await c.getByRole('button', { name: 'Fewer vertical dividers' }).click();
  await page.waitForTimeout(200);
  check(
    width,
    'Fewer vertical dividers → one section again',
    (await valueOf(front, 'Vertical dividers')) === '0' &&
      (await front.locator('.el-space').count()) === bays,
  );
  // The user's bug (ADR-089): a section with 1 vertical divider, + Horizontal dividers adds the divider only, the new
  // part is Empty (no shelves).
  const labels = () =>
    front.locator('.el-space').evaluateAll((es) => es.map((e) => e.getAttribute('aria-label')));
  const shelfSpaces = async () =>
    (await labels()).filter((l) => /shel(f|ves) space/.test(l)).length;
  const emptySpaces = async () =>
    (await labels()).filter((l) => l.startsWith('Empty space')).length;
  const panels = () => front.locator('.el-panel').count();
  await c.getByRole('button', { name: 'More vertical dividers' }).click();
  await page.waitForTimeout(200);
  const [shelves0, empty0, panels0] = [await shelfSpaces(), await emptySpaces(), await panels()];
  await c.getByRole('button', { name: 'More horizontal dividers' }).click();
  await page.waitForTimeout(200);
  check(
    width,
    'More horizontal dividers on a section with 1 vertical divider → one divider, one Empty part, no shelves',
    (await valueOf(front, 'Horizontal dividers')) === '1' &&
      (await shelfSpaces()) === shelves0 &&
      (await emptySpaces()) === empty0 + 1 &&
      (await panels()) === panels0 + 1,
    `shelf spaces ${shelves0} → ${await shelfSpaces()}, empty ${empty0} → ${await emptySpaces()}, panels ${panels0} → ${await panels()}`,
  );
  await shot('empty-part');
  await c.getByRole('button', { name: 'Fewer horizontal dividers' }).click();
  await page.waitForTimeout(200);
  await card(front).getByRole('button', { name: 'Fewer vertical dividers' }).click();
  await page.waitForTimeout(200);
  check(
    width,
    'Fewer horizontal, fewer vertical → one section again',
    (await front.locator('.el-space').count()) === bays,
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
  const c3 = card(dock3);
  check(width, '"Quick counts" card with the 3D view', await c3.isVisible());
  if (phone) {
    const v = await box(three);
    check(
      width,
      'phone: the card is docked under the 3D view (G-069)',
      (await box(c3)).y >= v.y + v.height - 1,
    );
  } else check(width, 'card is inside the 3D view', inside(await box(c3), await box(three)));
  check(width, '3D card shows Doors 2', (await valueOf(dock3, 'Doors')) === '2');
  await shot('3d');
  await c3.getByRole('button', { name: 'Fewer doors' }).click();
  await page.waitForTimeout(250);
  check(width, 'Fewer doors in 3D → 1', (await valueOf(dock3, 'Doors')) === '1');
  check(width, 'no sideways scroll (3D)', await noSideScroll());

  check(width, 'no page errors', errors.length === 0, errors.join(' / '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
