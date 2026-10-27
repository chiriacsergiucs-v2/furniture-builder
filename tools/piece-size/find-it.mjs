// Find-it acceptance for changing a whole piece's width and depth where it is selected (ADR-106, backlog N104), run
// against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/piece-size/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text: a single Sideboard (Compose panel;
// none on the card over the drawing or 3D, N110), then a Sideboard from the catalog in a project (its Selected piece card, gone once a space inside is selected).
// Not part of `pnpm test`.
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
  const shot = (name) => page.screenshot({ path: `${out}/piece-size-${name}-${width}.png` });
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const dlg = page.locator('dialog[open]');
  const peek = page.locator('.sheet-peek');
  const sheet = async (open) => {
    if (phone && (await peek.getAttribute('aria-expanded')) !== String(open)) await peek.click();
    await page.waitForTimeout(250);
  };
  const front = page.locator('.view.front');
  const size = (where) => where.getByRole('group', { name: 'Size of the whole piece' });
  const card = (where) => where.getByRole('group', { name: 'Quick counts' });
  const type = async (field, v) => {
    await field.fill(String(v));
    await field.press('Enter');
    await page.waitForTimeout(300);
  };

  // 1. Bare app → New single piece → Sideboard → Compose; one tap selects the whole piece (ADR-083).
  await page.goto(url);
  await page.getByRole('button', { name: 'New single piece' }).click();
  await dlg
    .getByRole('button', { name: /Sideboard/ })
    .first()
    .click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await page.getByRole('radio', { name: 'Compose' }).click();
  await front.getByRole('button', { name: /^3 drawers space/ }).click({ force: true });
  await page.waitForTimeout(300);

  // 2. The card over the drawing has no Width or Depth (user 2026-10-27, N110: only in the editor panel).
  check(
    width,
    'card over the drawing: no "Width" or "Depth"',
    (await size(card(front)).count()) === 0,
  );
  await shot('card-drawing');

  // 3. Compose panel: Width and Depth; Width 1500 shows in the drawing, Depth 420 is kept.
  await sheet(true);
  const panel = page.locator('.compose-start');
  const inPanel = size(panel);
  check(
    width,
    'Compose panel, whole piece: "Width" and "Depth"',
    (await inPanel.getByLabel('Width', { exact: true }).isVisible()) &&
      (await inPanel.getByLabel('Depth', { exact: true }).isVisible()),
  );
  await type(inPanel.getByLabel('Width', { exact: true }), 1500);
  check(
    width,
    'typing Width 1500 in the panel: the drawing says 1500',
    await front
      .locator('svg text', { hasText: /^1500$/ })
      .first()
      .isVisible(),
  );
  await type(inPanel.getByLabel('Depth', { exact: true }), 420);
  check(
    width,
    'Compose panel: Depth 420 kept',
    (await inPanel.getByLabel('Depth', { exact: true }).inputValue()) === '420',
  );
  check(width, 'no sideways scroll', await noSideScroll());
  await shot('compose');
  await sheet(false);

  // 4. Undo takes the depth back (one step).
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.waitForTimeout(300);
  await sheet(true);
  const afterUndo = await size(panel).getByLabel('Depth', { exact: true }).inputValue();
  check(width, 'Undo: Depth back from 420', afterUndo !== '420', afterUndo);
  await sheet(false);

  // 5. 3D: the card over the view (docked under it on a phone, G-070) has no Width or Depth either.
  await page.getByRole('radio', { name: /Build & Preview/ }).click();
  await page.locator('.view.three canvas').waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(1500);
  const dock3 = phone ? page.locator('#count-dock') : page.locator('.view.three');
  check(width, 'card over 3D: no "Width" or "Depth"', (await size(card(dock3)).count()) === 0);
  await shot('card-3d');

  // 6. Bare app → a new project → Add a piece → Sideboard from the catalog; its Selected piece card has the fields.
  await page.goto(url);
  await page.getByRole('button', { name: 'Create a new project', exact: true }).click();
  await dlg.locator('input').fill(`Sizes ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  // The editor remembers Build & Preview from step 5; pieces are added under Compose.
  await page.getByRole('radio', { name: 'Compose' }).click();
  await sheet(true);
  await page.getByRole('button', { name: 'Add a piece', exact: true }).click();
  await dlg.getByRole('searchbox', { name: 'Search the items' }).fill('Sideboard');
  await dlg.locator('.start-group .row-btn').first().click();
  await dlg.waitFor({ state: 'detached' }).catch(() => {});
  const place = page.getByRole('button', { name: 'Place to the right', exact: true });
  if (await place.isVisible()) await place.click();
  await sheet(true);
  const selected = page.getByRole('region', { name: /^Selected piece:/ });
  const inCard = size(selected);
  check(
    width,
    'project, catalog piece selected: "Width" and "Depth" in its card',
    (await inCard.getByLabel('Width', { exact: true }).isVisible()) &&
      (await inCard.getByLabel('Depth', { exact: true }).isVisible()),
  );
  check(
    width,
    'no "Inside this piece" needed',
    !(await page.getByRole('region', { name: 'Inside this piece' }).isVisible()),
  );
  await sheet(false);
  const planRadio = page.getByRole('radio', { name: 'Plan' });
  if (await planRadio.isVisible().catch(() => false)) await planRadio.click();
  const onPlan = page.locator('g.plan-piece', { hasText: 'Sideboard' }).first();
  const label0 = await onPlan.getAttribute('aria-label');
  await sheet(true);
  const d0 = Number(await inCard.getByLabel('Depth', { exact: true }).inputValue());
  const w0 = Number(await inCard.getByLabel('Width', { exact: true }).inputValue());
  await type(inCard.getByLabel('Depth', { exact: true }), d0 - 100);
  await type(inCard.getByLabel('Width', { exact: true }), w0 + 200);
  await shot('project');
  await sheet(false);
  const label1 = await onPlan.getAttribute('aria-label');
  const [, wa, da] = label0.match(/, (\d+) by (\d+) mm/) ?? [];
  const [, wb, db] = label1.match(/, (\d+) by (\d+) mm/) ?? [];
  check(
    width,
    'project: Depth −100 and Width +200 change the piece on the plan',
    Number(db) === Number(da) - 100 && Number(wb) === Number(wa) + 200,
    `${label0} → ${label1}`,
  );
  // 7. Drilled in: the whole piece keeps Width and Depth; a space inside it (2nd tap) shows none (user, 2026-10-27).
  const tapPlan = async () => {
    const p = await onPlan.boundingBox();
    await page.mouse.click(p.x + p.width / 2, p.y + p.height / 2);
    await page.waitForTimeout(300);
  };
  const inside = page.getByRole('region', { name: 'Inside this piece' });
  await tapPlan();
  await sheet(true);
  check(
    width,
    'drilled, whole piece selected: "Width" in its card',
    (await inside.getByText('Selected: Whole cabinet').isVisible()) &&
      (await inCard.getByLabel('Width', { exact: true }).isVisible()),
  );
  await sheet(false);
  await tapPlan();
  await sheet(true);
  check(
    width,
    'drilled, a space inside selected: no "Width" or "Depth" in the card',
    (await inside.getByRole('heading', { name: 'Divided space' }).isVisible()) &&
      (await inCard.count()) === 0,
  );
  await shot('project-inside');
  await sheet(false);
  check(width, 'no sideways scroll (project)', await noSideScroll());
  check(width, 'no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
