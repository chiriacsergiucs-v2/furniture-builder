// Find-it acceptance for the editor modes (ADR-079, backlog N74), run against a production build:
// (Updated for ADR-080: Configure is now the Settings dialog opened from the top bar; ADR-083: the first tap on the
// drawing selects the whole piece, the next tap at the same spot the space.)
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/editor-modes/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
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
  console.log(
    `${ok ? 'PASS' : 'FAIL'} ${typeof width === 'number' ? `${width}px` : width} ${name}${detail ? ` — ${detail}` : ''}`,
  );
};

// Light at three widths, then dark (system setting) at phone and desktop widths.
for (const [width, scheme] of [
  [390, 'light'],
  [1280, 'light'],
  [360, 'light'],
  [390, 'dark'],
  [1280, 'dark'],
]) {
  const phone = width < 500;
  const ctx = await browser.newContext({
    viewport: { width, height: phone ? 844 : 900 },
    colorScheme: scheme,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const tag = scheme === 'dark' ? `${width}px dark` : `${width}px`;
  const ck = (w, name, ok, detail) => check(tag, name, ok, detail);
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const shot = (name) =>
    page.screenshot({
      path: `${out}/modes-${name}-${width}${scheme === 'dark' ? '-dark' : ''}.png`,
    });
  const mode = (name) => page.getByRole('radio', { name });
  const side = page.locator('aside.side');
  const peek = page.locator('.sheet-peek');
  const canvases = () => page.locator('canvas').count();
  const group = (name) => side.locator('details.group > summary', { hasText: name });
  // ADR-080: what was the Configure mode is the Settings dialog, opened by the top-bar "Settings" button.
  const settingsBtn = page.getByRole('button', { name: 'Settings', exact: true });
  const dlg = page.getByRole('dialog', { name: /^Settings: / });
  const dlgGroup = (name) => dlg.locator('details.group > summary', { hasText: name });
  const openSettings = async () => {
    await settingsBtn.click();
    await dlg.waitFor({ state: 'visible' });
  };
  const closeSettings = async () => {
    await dlg.getByRole('button', { name: 'Done', exact: true }).click();
    await dlg.waitFor({ state: 'hidden' });
  };
  const box = async (l) => (await l.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };

  // 1. A new piece from the bare app; the three modes are there.
  await page.goto(url);
  await page.getByRole('button', { name: 'New single piece' }).click();
  await page
    .locator('dialog[open]')
    .getByRole('button', { name: /Chest of drawers/ })
    .first()
    .click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  ck(
    width,
    'modes Compose · Build & Preview visible, Configure replaced by Settings (ADR-080)',
    (await mode('Compose').isVisible()) &&
      (await mode(/Build & Preview/).isVisible()) &&
      (await mode('Configure').count()) === 0 &&
      (await settingsBtn.isVisible()),
  );

  // 2. Compose: tap a space; its editor has contents, doors and divide, and no whole-piece settings.
  await mode('Compose').click();
  if (phone)
    check(
      width,
      'Compose peek says "Tap a space to edit it"',
      (await peek.innerText()).includes('Tap a space to edit it'),
    );
  // ADR-083: the first tap selects the whole piece, the second at the same spot the space under it.
  await page.locator('.el-space').first().click({ force: true });
  await page.waitForTimeout(200);
  if (phone)
    check(
      width,
      'peek names the selection',
      /^Selected: /.test(await peek.innerText()),
      await peek.innerText(),
    );
  await page.locator('.el-space').first().click({ force: true });
  await page.waitForTimeout(200);
  if (phone)
    check(
      width,
      'second tap selects a space inside the piece',
      /^Selected: /.test(await peek.innerText()) && !/Whole/.test(await peek.innerText()),
      await peek.innerText(),
    );
  // On a phone a space's editor no longer opens by itself (main's N82: the drawing keeps its height); the peek
  // row opens it.
  if (phone && (await peek.getAttribute('aria-expanded')) !== 'true') {
    await peek.click();
    await page.waitForTimeout(300);
  }
  for (const t of [/^contents$/i, /^doors and handles$/i, /^divide this space$/i]) {
    const l = side.getByText(t).first();
    await l.scrollIntoViewIfNeeded();
    ck(width, `Compose shows ${t.source}`, await l.isVisible());
  }
  ck(
    width,
    'Compose has no Construction or Materials settings',
    (await group('Construction').count()) === 0 && (await group(/^Materials$/).count()) === 0,
  );
  if (phone) ck(width, 'no 3D canvas in Compose', (await canvases()) === 0);
  ck(width, 'no sideways scroll (Compose)', await noSideScroll());
  await shot('compose');

  // 3. Settings (was Configure, ADR-080): size, construction, boards (with Add a material) and drawers; no
  //    Materials button or dialog.
  await openSettings();
  ck(
    width,
    'Settings shows Width',
    await dlg.getByLabel('Width', { exact: true }).first().isVisible(),
  );
  for (const t of [
    'Construction',
    'Materials',
    'Drawers and runners',
    'Boards, sheets and saw cut',
  ])
    ck(width, `Settings shows "${t}"`, (await dlgGroup(t).count()) > 0);
  await dlgGroup('Boards, sheets and saw cut').click();
  const addMaterial = dlg.getByRole('button', { name: 'Add a material' });
  await addMaterial.scrollIntoViewIfNeeded();
  ck(width, 'Settings has "Add a material"', await addMaterial.isVisible());
  ck(
    width,
    'no Materials button or dialog anywhere',
    (await page.getByRole('button', { name: 'Materials', exact: true }).count()) === 0 &&
      (await page.getByRole('dialog', { name: 'Materials in this piece' }).count()) === 0,
  );
  if (phone) ck(width, 'no 3D canvas behind Settings in Compose', (await canvases()) === 0);
  ck(
    width,
    'no sideways scroll (Settings)',
    await noSideScroll(),
    await page.evaluate(() =>
      [...document.querySelectorAll('main *')]
        .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
        .slice(0, 3)
        .map((e) => {
          const chain = [];
          for (let n = e; n && chain.length < 5; n = n.parentElement)
            chain.push(`${n.tagName}.${n.getAttribute('class') ?? ''}`);
          return `${chain.join(' < ')} ${Math.round(e.getBoundingClientRect().right)}`;
        })
        .join(', '),
    ),
  );
  await shot('configure');
  await closeSettings();

  // 4. Build & Preview: 3D and the parts with Download CSV and Print; an error blocks both.
  await mode('Build & Preview').click();
  await page
    .locator('canvas')
    .first()
    .waitFor({ timeout: 15000 })
    .catch(() => {});
  ck(width, 'Build & Preview shows the 3D view', (await canvases()) > 0);
  const csv = page.getByRole('button', { name: 'Download CSV' });
  const print = page.getByRole('button', { name: 'Print', exact: true });
  ck(
    width,
    'Parts tab has Download CSV and Print, enabled',
    (await csv.isVisible()) && (await csv.isEnabled()) && (await print.isEnabled()),
  );
  ck(width, 'no sideways scroll (Build & Preview)', await noSideScroll());
  await shot('build');
  await openSettings();
  const w = dlg.getByLabel('Width', { exact: true }).first();
  await w.fill('100');
  await w.press('Tab');
  await closeSettings();
  await mode(/Build & Preview/).click();
  await page.waitForTimeout(300);
  ck(
    width,
    'the mode names the problem ("1 problem")',
    /1 problem/.test(await mode(/Build & Preview/).textContent()),
  );
  ck(
    width,
    'Download CSV and Print disabled with an error',
    (await csv.isDisabled()) && (await print.isDisabled()),
  );
  await page.getByRole('tab', { name: /Checks/ }).click();
  ck(
    width,
    'Checks shows the error',
    await page
      .locator('#panel-checks')
      .getByText('Drawer box would be only 38 mm wide.')
      .isVisible(),
  );
  await shot('blocked');

  // 5. Desktop: Compose left, drawing centre, Build right.
  if (!phone) {
    await mode('Compose').click();
    const [a, b, c] = await Promise.all([
      box(side),
      box(page.locator('section.stage')),
      box(page.locator('section.output')),
    ]);
    ck(width, 'side left, drawing centre, Build right', a.x < b.x && b.x < c.x && c.width > 0);
  }

  // 6. A project opens in Compose with the plan; Settings holds the project settings; placing switches to Compose.
  await page.locator('summary[aria-label="More"]').click();
  await page.getByRole('button', { name: /New…/ }).click();
  await page
    .locator('dialog[open]')
    .getByRole('button', { name: /Project with several pieces/ })
    .click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await mode('Compose').click();
  ck(
    width,
    'project shows its plan in Compose',
    await page.getByText('Add pieces to see them on the plan.').isVisible(),
  );
  await openSettings();
  ck(
    width,
    'Settings holds the project settings',
    (await dlg.getByRole('heading', { name: 'Project settings' }).isVisible()) &&
      (await dlg.getByLabel('Saw cut (kerf) for this project', { exact: true }).isVisible()),
  );
  await closeSettings();
  await page
    .getByRole('navigation', { name: 'Places' })
    .getByRole('link', { name: /Catalog/ })
    .click();
  await page.getByRole('searchbox', { name: 'Search the catalog' }).fill('Base cabinet');
  await page.getByRole('button', { name: 'Add', exact: true }).first().click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
  ck(
    width,
    'placing a piece switches to Compose',
    (await mode('Compose').getAttribute('aria-checked')) === 'true' &&
      (await page.getByText('Tap the plan to place').isVisible()),
  );
  ck(width, 'no sideways scroll (project)', await noSideScroll());
  await shot('placing');
  if (scheme === 'dark') {
    // Every new surface follows the dark tokens: dark ground, light text (ADR-030).
    const lum = (rgb) => {
      const [r, g, b] = rgb.match(/\d+/g).map(Number);
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    };
    const colours = async (sel) =>
      page
        .locator(sel)
        .first()
        .evaluate((el) => {
          const cs = getComputedStyle(el);
          return [cs.backgroundColor, cs.color];
        });
    const parts = ['header.bar', 'nav.places', '.modes', 'aside.side', 'section.output'];
    if (phone) parts.push('.sheet-peek');
    for (const sel of parts) {
      if (!(await page.locator(sel).first().isVisible())) continue;
      const [bg, fg] = await colours(sel);
      ck(
        width,
        `dark: ${sel} is dark with light text`,
        lum(bg) < 0.25 && lum(fg) > 0.6,
        `${bg} / ${fg}`,
      );
    }
    await page.locator('summary[aria-label="More"]').click();
    const [mbg, mfg] = await colours('details.more .menu-items');
    ck(
      width,
      'dark: ⋯ menu is dark with light text',
      lum(mbg) < 0.25 && lum(mfg) > 0.6,
      `${mbg} / ${mfg}`,
    );
    await shot('more');
    await page.keyboard.press('Escape');
  }
  ck(width, 'no page errors', errors.length === 0, errors.join(' / '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
