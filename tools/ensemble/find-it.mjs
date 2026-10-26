// Find-it check for the 11 research features already in the app (backlog N48; IKEA + Roomle ensemble features),
// run against a production build:
//   npm run build && npx vite preview --port 4173 &  node tools/ensemble/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text. Not part of `npm test`.
// Updated for the app shell (ADR-078: Projects place, ⋯ More → Files, breadcrumb in place of banners), the editor
// modes (ADR-079/080: Parts CSV and Print on the Parts list in Build & Preview, Materials in the Settings dialog)
// and the phone layout (N82: the project panel is a bottom sheet; Compose shows the drawing only).
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
  // Phones (≤760 px): the project panel is a bottom sheet opened by its peek row; elsewhere the row is hidden.
  const openSheet = async () => {
    const peek = page.locator('.sheet-peek');
    if ((await peek.isVisible()) && (await peek.getAttribute('aria-expanded')) === 'false')
      await peek.click();
  };
  const closeSheet = async () => {
    const peek = page.locator('.sheet-peek');
    if ((await peek.isVisible()) && (await peek.getAttribute('aria-expanded')) === 'true')
      await peek.click();
  };
  const selectPiece = async (i) => {
    await openSheet();
    await pieces.nth(i).getByRole('button').first().click();
  };
  const setMode = (name) => page.getByRole('radio', { name: new RegExp(`^${name}`) }).click();
  const moreMenu = page.locator('summary[aria-label="More"]');
  const addPiece = async (search) => {
    await openSheet();
    await page.getByRole('button', { name: 'Add a piece' }).click();
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
  await selectPiece(2);
  const fromLeft = page.getByLabel('From left', { exact: true }).first();
  check(width, 'precise numeric: "From left" field found', await fromLeft.isVisible());
  await fromLeft.fill('4321');
  await fromLeft.press('Enter');
  await page.waitForTimeout(200);
  check(width, 'precise numeric: value kept as 4321 mm', (await fromLeft.inputValue()) === '4321');
  await selectPiece(1);
  check(
    width,
    'precise numeric: "Gap to … on the left" field found',
    await page
      .getByLabel(/^Gap to .* on the left$/)
      .first()
      .isVisible(),
  );

  // Dimensioning + synchronous 2D/3D: the plan and front views show the pieces with mm sizes; 3D shows the same project.
  // On a phone Compose shows the drawing only and offers no View switch (ADR-081); the sheet steps aside.
  if (phone) await closeSheet();
  else await page.getByRole('radio', { name: 'Plan' }).click();
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
  // On a phone the 3D view is in Build & Preview (ADR-080, N82).
  if (phone) await setMode('Build & Preview');
  await page.getByRole('radio', { name: '3D' }).click();
  await page.waitForTimeout(1500);
  check(
    width,
    '3D: project shown in the 3D view',
    await page.locator('.view.three canvas').isVisible(),
  );
  await shot('3d');
  if (phone) await setMode('Compose');
  else await page.getByRole('radio', { name: 'Plan' }).click();

  // In-context editing: "Edit this piece" opens the piece inside the project; changes stay in the project.
  // Rewritten (ADR-078): the "Editing … in project" banner became the top-bar path "‹ <project> › <piece>".
  await selectPiece(1);
  await page.getByRole('button', { name: 'Edit this piece' }).click();
  const backToProject = page.getByRole('button', { name: `Back to project Verify ${width}` });
  check(
    width,
    'in-context: path "‹ project › piece" in the top bar',
    (await backToProject.isVisible()) &&
      /Wardrobe/i.test(await page.getByLabel('Name of this piece').inputValue()),
  );
  await backToProject.click();
  await page.waitForTimeout(200);

  // Keep identity: pieces stay separate rows; merging is an explicit, separate action.
  check(width, 'identity: still three separate pieces after editing', (await pieces.count()) === 3);
  await selectPiece(0);
  check(
    width,
    'identity: "Merge into one piece" is a separate explicit action',
    await page.getByRole('heading', { name: 'Merge into one piece' }).isVisible(),
  );

  // Automatic BOM: one Parts CSV for the whole project, rows from all three pieces. Since ADR-079 the CSV and Print
  // are on the Parts list in Build & Preview ("Download CSV").
  await setMode('Build & Preview');
  await page.getByRole('tab', { name: /^Parts/ }).click();
  const partsPanel = page.locator('#panel-parts');
  const csv = await download(() =>
    partsPanel.getByRole('button', { name: 'Download CSV' }).click(),
  );
  const lines = csv.trim().split('\n');
  check(width, 'BOM: project Parts CSV downloads', lines.length > 10, `${lines.length} lines`);
  check(
    width,
    'BOM: Print (cutting sheet) available',
    await partsPanel.getByRole('button', { name: 'Print' }).isEnabled(),
  );
  await setMode('Compose');

  // Saved designs: the project is kept on this device and offered again after a reload; project file export.
  // ADR-078: exports moved to ⋯ More → Files.
  const json = await download(async () => {
    await moreMenu.click();
    await page.getByRole('button', { name: /^Project file/ }).click();
  });
  check(
    width,
    'saved: project file export contains the three pieces',
    (JSON.parse(json).items ?? []).length === 3,
  );
  await page.waitForTimeout(1500);
  await page.reload();
  await page
    .getByRole('navigation', { name: 'Places' })
    .getByRole('link', { name: 'Projects' })
    .click();
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

  // Finishes + professional bridge on a single piece: boards in Settings (was the Materials dialog, ADR-080);
  // SVG, Fusion script, design file in ⋯ More → Files (ADR-078).
  await page.getByRole('button', { name: 'New single piece' }).click();
  await dlg.locator('.start-group .row-btn').first().click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('dialog', { name: /^Settings: / }).waitFor();
  await dlg.locator('summary', { hasText: 'Boards, sheets and saw cut' }).click();
  check(
    width,
    'finishes: colour, name and "Add a picture" per board',
    (await dlg.locator('input[type=color]').first().isVisible()) &&
      (await dlg.getByText('Add a picture').first().isVisible()),
  );
  await page.keyboard.press('Escape');
  await dlg.waitFor({ state: 'detached' }).catch(() => {});
  await moreMenu.click();
  const items = (await page.locator('.menu-items').innerText()).replace(/\n/g, ' ');
  check(
    width,
    'pro bridge: SVG drawing, Fusion 360 script and design file in More → Files',
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
