// Find-it acceptance for the full-size drawing and the compact count card inside it (ADR-112, backlog N111), run
// against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/stage-card/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at 1280 px and at 390 px with touch, and finds everything by role and visible text: a single
// Sideboard (the card over the drawing and over 3D, Width in the side panel / bottom sheet), then a Sideboard in a
// project (the plan toolbar row, the card over the front view). Not part of `pnpm test`.
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
  const shot = (name) => page.screenshot({ path: `${out}/stage-card-${name}-${width}.png` });
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const dlg = page.locator('dialog[open]');
  const sheetBtn = page.locator('.sheet-peek');
  const sheet = async (open) => {
    if (phone && (await sheetBtn.getAttribute('aria-expanded')) !== String(open))
      await sheetBtn.click();
    await page.waitForTimeout(300);
  };
  const stage = page.getByRole('region', { name: 'Drawing' });
  const front = page.locator('.view.front');
  const card = (where) => where.getByRole('group', { name: 'Quick counts' });
  const box = async (l) => (await l.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
  const inside = (a, b) =>
    a.width > 0 &&
    a.x >= b.x - 1 &&
    a.y >= b.y - 1 &&
    a.x + a.width <= b.x + b.width + 1 &&
    a.y + a.height <= b.y + b.height + 1;
  const overlap = (a, b) =>
    Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const fmt = (b) =>
    `${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}×${Math.round(b.height)}`;
  // The stage's height and the drawing's scale (screen px per mm) of the given figure's SVG.
  const measure = async (figure) => ({
    stage: Math.round((await box(stage)).height),
    scale: await figure
      .locator(':scope > svg')
      .evaluate((s) => Math.round((s.getScreenCTM()?.a ?? 0) * 10000) / 10000),
  });
  const same = (a, b) => a.stage === b.stage && a.scale === b.scale;
  const show = (m) => `stage ${m.stage} px, scale ${m.scale}`;
  // No Width or Depth field or label anywhere in the card.
  const noSize = async (c) =>
    (await c.getByLabel('Width').count()) === 0 &&
    (await c.getByLabel('Depth').count()) === 0 &&
    (await c.getByText(/Width|Depth/).count()) === 0;
  // Each row at most 52 px tall; at 390 with touch every button at least 44 × 44 px.
  const sizes = async (c) => {
    const rows = await c
      .locator('.cs-row')
      .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
    const btns = await c
      .getByRole('button')
      .evaluateAll((els) =>
        els.map((e) => [
          Math.round(e.getBoundingClientRect().width),
          Math.round(e.getBoundingClientRect().height),
        ]),
      );
    return { rows, btns };
  };
  const checkSizes = async (where, c) => {
    const { rows, btns } = await sizes(c);
    check(
      width,
      `${where}: each card row ≤ 52 px tall`,
      rows.length > 0 && rows.every((h) => h <= 52),
      rows.join(', '),
    );
    if (phone)
      check(
        width,
        `${where}: card buttons ≥ 44 × 44 px with touch`,
        btns.length > 0 && btns.every(([w, h]) => w >= 44 && h >= 44),
        btns.map((b) => b.join('×')).join(', '),
      );
  };

  // 1. Bare app → New single piece → Sideboard → Compose, nothing selected.
  await page.goto(url);
  await page.getByRole('button', { name: 'New single piece' }).click();
  await dlg
    .getByRole('button', { name: /Sideboard/ })
    .first()
    .click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await page.getByRole('radio', { name: 'Compose' }).click();
  await page.waitForTimeout(300);
  const elev = front.getByRole('figure', { name: /^Front view/ });
  const m0 = await measure(elev);
  await shot('single-none');

  // 2. First tap: the whole piece. The card shows counts only, no Width or Depth; the drawing keeps its size.
  const bank = front.getByRole('button', { name: /^3 drawers space/ });
  await bank.click({ force: true });
  await page.waitForTimeout(400);
  const c1 = card(front);
  check(width, 'whole piece: "Quick counts" card over the drawing', await c1.isVisible());
  check(width, 'whole piece: no "Width" or "Depth" in the card', await noSize(c1));
  check(
    width,
    'whole piece: counts only ("V. dividers" − N +)',
    (await c1.getByText('V. dividers', { exact: true }).isVisible()) &&
      (await c1.getByRole('button', { name: 'More vertical dividers' }).isVisible()),
  );
  const m1 = await measure(elev);
  check(
    width,
    'piece selected: stage and scale unchanged',
    same(m0, m1),
    `${show(m0)} → ${show(m1)}`,
  );
  check(width, 'whole piece: card inside the stage', inside(await box(c1), await box(stage)));
  await checkSizes('whole piece', c1);
  await shot('single-whole');

  // 3. The side panel (desktop) / bottom sheet (phone) keeps Width and Depth; opening the sheet keeps the scale.
  await sheet(true);
  const m2 = await measure(elev);
  if (phone)
    check(
      width,
      'sheet open: stage and scale unchanged',
      same(m0, m2),
      `${show(m0)} → ${show(m2)}`,
    );
  const size = page
    .locator('main.work .side')
    .getByRole('group', { name: 'Size of the whole piece' });
  check(
    width,
    `${phone ? 'bottom sheet' : 'side panel'}: "Width" and "Depth" for the whole piece`,
    (await size.getByLabel('Width', { exact: true }).isVisible()) &&
      (await size.getByLabel('Depth', { exact: true }).isVisible()),
  );
  await shot('single-sheet');
  const wField = size.getByLabel('Width', { exact: true });
  await wField.fill('1500');
  await wField.press('Enter');
  await page.waitForTimeout(400);
  await sheet(false);
  check(
    width,
    'typing Width 1500 there resizes the piece: the drawing says 1500',
    await front
      .locator('svg text', { hasText: /^1500$/ })
      .first()
      .isVisible(),
  );

  // 4. Second tap: the drawer bank. The card lies inside the stage and covers neither the bank nor its size label.
  await bank.click({ force: true });
  await page.waitForTimeout(400);
  const c2 = card(front);
  const cb = await box(c2);
  const selB = await box(front.locator('rect.el-selection'));
  const selDim = await box(front.locator('g.dim.subtle').first());
  check(
    width,
    'drawer bank: card shows "Drawers"',
    await c2.getByText('Drawers', { exact: true }).isVisible(),
  );
  check(width, 'drawer bank: card inside the stage', inside(cb, await box(stage)), fmt(cb));
  check(
    width,
    'drawer bank: card covers neither the bank nor its size label',
    overlap(cb, selB) === 0 && overlap(cb, selDim) === 0,
    `card ${fmt(cb)}, bank ${fmt(selB)}, label ${fmt(selDim)}`,
  );
  await checkSizes('drawer bank', c2);
  const m3 = await measure(elev);
  check(width, 'after resize, space selected: stage unchanged', m3.stage === m0.stage, show(m3));
  await shot('single-bank');
  await sheet(true);
  const m4 = await measure(elev);
  if (phone)
    check(
      width,
      'space selected, sheet open: stage and scale unchanged',
      same(m3, m4),
      `${show(m3)} → ${show(m4)}`,
    );
  await shot('single-bank-sheet');
  await sheet(false);

  // 5. 3D (Build & Preview): the card over the view (docked under it on a phone, G-070) has no Width or Depth.
  await page.getByRole('radio', { name: /Build & Preview/ }).click();
  await page.locator('.view.three canvas').waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(1500);
  const c3 = card(phone ? page.locator('#count-dock') : page.locator('.view.three'));
  check(
    width,
    '3D: card shown, no "Width" or "Depth"',
    (await c3.isVisible()) && (await noSize(c3)),
  );
  await shot('3d');

  // 6. Bare app → a new project → Add a piece → Sideboard from the catalog.
  await page.goto(url);
  await page.getByRole('button', { name: 'Create a new project', exact: true }).click();
  await dlg.locator('input').fill(`Stage ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await page.getByRole('radio', { name: 'Compose' }).click();
  await sheet(true);
  await page.getByRole('button', { name: 'Add a piece', exact: true }).click();
  await dlg.getByRole('searchbox', { name: 'Search the items' }).fill('Sideboard');
  await dlg.locator('.start-group .row-btn').first().click();
  await dlg.waitFor({ state: 'detached' }).catch(() => {});
  const place = page.getByRole('button', { name: 'Place to the right', exact: true });
  if (await place.isVisible()) await place.click();
  await sheet(false);
  const planRadio = page.getByRole('radio', { name: '2D' });
  if (await planRadio.isVisible().catch(() => false)) await planRadio.click();
  await page.waitForTimeout(300);

  // 7. The plan toolbar: "Fronts", "Snap", "Select" and "Clear." on one row; the checkboxes keep their full names.
  const tools = [
    front.getByText('Fronts', { exact: true }),
    front.getByRole('checkbox', { name: 'Snap', exact: true }),
    front.getByRole('checkbox', { name: 'Select', exact: true }),
    front.getByText('Clear.', { exact: true }),
  ];
  const tb = await Promise.all(tools.map(box));
  const mid = tb.map((b) => b.y + b.height / 2);
  check(
    width,
    '"Fronts", "Snap", "Select" and "Clear." on one row',
    tb.every((b) => b.width > 0) && Math.max(...mid) - Math.min(...mid) < 12,
    tb.map(fmt).join(' | '),
  );
  check(
    width,
    'checkboxes named "Doors and fronts" and "Clearances"',
    (await front.getByRole('checkbox', { name: 'Doors and fronts', exact: true }).isVisible()) &&
      (await front.getByRole('checkbox', { name: 'Clearances', exact: true }).isVisible()),
  );
  await shot('plan-row');

  // 8. Front view, nothing drilled: measure; then one tap on the piece shows the card (ADR-109) with counts only.
  const fv = front.getByRole('figure', { name: /^Room seen from the front/ });
  const p0 = await measure(fv);
  const piece = fv.getByRole('button', { name: /^Sideboard, \d+ wide/ });
  const pb = await box(piece);
  await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2);
  await page.waitForTimeout(500);
  const c4 = card(fv);
  const c4b = await box(c4);
  const pieceB = await box(piece);
  const info = await box(fv.getByRole('button', { name: 'About the front view' }));
  check(width, 'project, 1st tap: card over the front view', await c4.isVisible());
  check(width, 'project: no "Width" or "Depth" in the card', await noSize(c4));
  check(width, 'project: card inside the front view', inside(c4b, await box(fv)), fmt(c4b));
  // A whole piece that fills the front view leaves no free corner at 390 px; the card then takes the corner that
  // covers least of it (ADR-112, "the card can cover part of the drawing").
  const covered = overlap(c4b, pieceB) / Math.max(1, pieceB.width * pieceB.height);
  check(
    width,
    'project, whole piece: card off the ⓘ button, at most a corner of the piece',
    overlap(c4b, info) === 0 && covered < 0.1,
    `card ${fmt(c4b)}, piece ${fmt(pieceB)} (${Math.round(covered * 100)} % covered), ⓘ ${fmt(info)}`,
  );
  await checkSizes('project', c4);
  const p1 = await measure(fv);
  check(
    width,
    'project, piece selected: stage and scale unchanged',
    same(p0, p1),
    `${show(p0)} → ${show(p1)}`,
  );
  await shot('project-piece');
  await sheet(true);
  const pSize = page
    .locator('main.work .side')
    .getByRole('group', { name: 'Size of the whole piece' });
  check(
    width,
    `project: "Width" and "Depth" in the ${phone ? 'bottom sheet' : 'side panel'}`,
    (await pSize.first().getByLabel('Width', { exact: true }).isVisible()) &&
      (await pSize.first().getByLabel('Depth', { exact: true }).isVisible()),
  );
  await sheet(false);

  // 9. A second tap on the left bay selects it: the card goes to a far corner, covering neither it nor ⓘ.
  await page.mouse.click(pb.x + pb.width * 0.17, pb.y + pb.height / 2);
  await page.waitForTimeout(500);
  const c5b = await box(c4);
  const spaceB = await box(fv.locator('rect.el-selection'));
  check(
    width,
    'project, left bay selected: card inside the front view, covering neither it nor ⓘ',
    (await c4.isVisible()) &&
      inside(c5b, await box(fv)) &&
      spaceB.width > 0 &&
      overlap(c5b, spaceB) === 0 &&
      overlap(c5b, info) === 0,
    `card ${fmt(c5b)}, space ${fmt(spaceB)}`,
  );
  await checkSizes('project space', c4);
  await shot('project-space');
  await sheet(true);
  const p2 = await measure(fv);
  if (phone)
    check(
      width,
      'project, sheet open: stage and scale unchanged',
      same(p0, p2),
      `${show(p0)} → ${show(p2)}`,
    );
  await shot('project-sheet');
  await sheet(false);
  check(width, 'no sideways scroll', await noSideScroll());
  check(width, 'no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
