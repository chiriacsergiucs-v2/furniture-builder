// Find-it check for the 11 research features already in the app (backlog N48; IKEA + Roomle ensemble features),
// run against a production build:
//   npm run build && npx vite preview --port 4173 &  node tools/ensemble/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text. Not part of `npm test`.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4173/furniture-builder/';
const out = process.argv[3] ?? 'dist-acceptance';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const results = [];
const check = (width, name, ok, detail = '') => {
  results.push({ width, name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${width}px ${name}${detail ? ` — ${detail}` : ''}`);
};

for (const width of [1440, 375]) {
  const phone = width < 500;
  const ctx = await browser.newContext({
    viewport: { width, height: phone ? 812 : 900 },
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const shot = (name) =>
    page.screenshot({ path: `${out}/ensemble-${name}-${width}.png`, fullPage: true });
  const dlg = page.locator('dialog[open]');
  const pieces = page.locator('ul.pieces > li');
  const addPiece = async (search) => {
    await page.getByRole('button', { name: 'Add a piece' }).dispatchEvent('click');
    await dlg.getByRole('searchbox', { name: 'Search the items' }).fill(search);
    await dlg.locator('.start-group .row-btn').first().click();
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
  };
  const download = async (click) => {
    const [d] = await Promise.all([page.waitForEvent('download'), click()]);
    return readFileSync(await d.path(), 'utf8');
  };

  // Cross-family composition: one project holds a base cabinet, a wardrobe and a bed.
  await page.goto(url);
  await page.getByRole('button', { name: 'Create a new project' }).click();
  await dlg.locator('input').fill(`Verify ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await addPiece('Base cabinet');
  await addPiece('Wardrobe');
  await addPiece('Bed');
  const rows = await pieces.allInnerTexts();
  check(
    width,
    'cross-family: base cabinet, wardrobe and bed in one project',
    rows.length === 3 &&
      /Base cabinet/i.test(rows[0]) &&
      /Wardrobe/i.test(rows[1]) &&
      /Bed/i.test(rows[2]),
    rows.join(' | ').replace(/\n/g, ' '),
  );

  // Precise numeric position: "From left" moves the selected piece by an exact mm value; gap to the left neighbour.
  await pieces.nth(2).getByRole('button').first().dispatchEvent('click');
  const fromLeft = page.getByLabel('From left', { exact: true }).first();
  check(width, 'precise numeric: "From left" field found', await fromLeft.isVisible());
  await fromLeft.fill('4321');
  await fromLeft.press('Enter');
  await page.waitForTimeout(200);
  check(width, 'precise numeric: value kept as 4321 mm', (await fromLeft.inputValue()) === '4321');
  await pieces.nth(1).getByRole('button').first().dispatchEvent('click');
  check(
    width,
    'precise numeric: "Gap to … on the left" field found',
    await page
      .getByLabel(/^Gap to .* on the left$/)
      .first()
      .isVisible(),
  );

  // Dimensioning + synchronous 2D/3D: the plan and front views show the pieces with mm sizes; 3D shows the same project.
  await page.getByRole('radio', { name: 'Plan' }).click();
  const plan = page.getByRole('figure', { name: /Room plan, seen from above/ });
  const front = page.getByRole('figure', { name: /Room seen from the front/ });
  check(
    width,
    '2D: plan and front views visible',
    (await plan.isVisible()) && (await front.isVisible()),
  );
  const planPieces = await plan.locator('[aria-label*=" by "][aria-label$=" mm"]').count();
  check(width, '2D: plan shows every piece', planPieces === 3, `${planPieces} on the plan`);
  const dims = (await plan.locator('text').allTextContents()).filter((t) =>
    /^\d{3,5}$/.test(t.trim()),
  );
  check(width, 'dimensions: plan shows mm measurements', dims.length >= 2, dims.join(', '));
  await shot('plan');
  await page.getByRole('radio', { name: '3D' }).click();
  await page.waitForTimeout(1500);
  check(
    width,
    '3D: project shown in the 3D view',
    await page.locator('.view.three canvas').isVisible(),
  );
  await shot('3d');
  await page.getByRole('radio', { name: 'Plan' }).click();

  // In-context editing: "Edit this piece" opens the piece inside the project; changes stay in the project.
  await page.getByRole('button', { name: 'Edit this piece' }).dispatchEvent('click');
  check(
    width,
    'in-context: "Editing … in project" banner',
    await page.getByText(/Editing .* in project Verify/).isVisible(),
  );
  await page.getByRole('button', { name: 'Back to project' }).dispatchEvent('click');
  await page.waitForTimeout(200);

  // Keep identity: pieces stay separate rows; merging is an explicit, separate action.
  check(width, 'identity: still three separate pieces after editing', (await pieces.count()) === 3);
  await pieces.nth(0).getByRole('button').first().dispatchEvent('click');
  check(
    width,
    'identity: "Merge into one piece" is a separate explicit action',
    await page.getByRole('heading', { name: 'Merge into one piece' }).isVisible(),
  );

  // Automatic BOM: one Parts CSV for the whole project, rows from all three pieces.
  const csv = await download(() => page.getByRole('button', { name: 'Parts CSV' }).click());
  const lines = csv.trim().split('\n');
  check(width, 'BOM: project Parts CSV downloads', lines.length > 10, `${lines.length} lines`);
  check(
    width,
    'BOM: Print (cutting sheet) available',
    await page.getByRole('button', { name: 'Print' }).isEnabled(),
  );

  // Saved designs: the project is kept on this device and offered again after a reload; project file export.
  const json = await download(async () => {
    await page.locator('summary[aria-label="Export"]').click();
    await page.locator('.menu-items button').first().click();
  });
  check(
    width,
    'saved: project file export contains the three pieces',
    (JSON.parse(json).items ?? []).length === 3,
  );
  await page.waitForTimeout(1500);
  await page.reload();
  await page.getByRole('link', { name: 'Home' }).click();
  check(
    width,
    'saved: project listed under "Choose a project" after reload',
    // The list is read from the device after Home renders: wait for it.
    await page
      .getByText(`Verify ${width}`)
      .first()
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(
        () => true,
        () => false,
      ),
  );
  check(width, 'no sideways scroll (project)', await noSideScroll());

  // Finishes + professional bridge on a single piece: Materials dialog; SVG, Fusion script, design file.
  await page.getByRole('button', { name: 'New single piece' }).click();
  await dlg.locator('.start-group .row-btn').first().click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Materials' }).dispatchEvent('click');
  await dlg.getByRole('heading', { name: 'Materials in this piece' }).waitFor();
  check(
    width,
    'finishes: colour, name and "Add a picture" per board',
    (await dlg.locator('input[type=color]').first().isVisible()) &&
      (await dlg.getByText('Add a picture').first().isVisible()),
  );
  await page.keyboard.press('Escape');
  await dlg.waitFor({ state: 'detached' }).catch(() => {});
  await page.locator('summary[aria-label="Export"]').click();
  const items = (await page.locator('.menu-items').innerText()).replace(/\n/g, ' ');
  check(
    width,
    'pro bridge: SVG drawing, Fusion 360 script and design file in Export',
    /Front view drawing/.test(items) &&
      /Fusion 360 script/.test(items) &&
      /Design file/.test(items),
    items,
  );
  check(width, 'no sideways scroll (piece)', await noSideScroll());
  check(width, 'no page errors', errors.length === 0, errors.join(' / '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
