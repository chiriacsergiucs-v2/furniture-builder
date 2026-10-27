// Find-it acceptance for the app shell (ADR-078, backlog N73), run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/shell/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text. Not part of `pnpm test`.
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

for (const width of [1280, 390, 360]) {
  const phone = width < 500;
  const ctx = await browser.newContext({
    viewport: { width, height: phone ? 844 : 900 },
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
  const shot = (name) => page.screenshot({ path: `${out}/shell-${name}-${width}.png` });
  const bar = page.locator('header.bar');
  const nav = page.getByRole('navigation', { name: 'Places' });
  const place = (name) => nav.getByRole('link', { name });
  const more = page.locator('summary[aria-label="More"]');
  const menu = page.locator('details.more .menu-items');
  const box = async (l) => (await l.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };

  // 1. The bare app opens Projects; the three places are one tap away.
  await page.goto(url);
  await page.getByRole('heading', { name: 'Projects', level: 1 }).waitFor({ timeout: 10000 });
  check(width, 'bare address opens Projects', true);
  check(
    width,
    'places Projects · Catalog · Editor visible',
    (await place('Projects').isVisible()) &&
      (await place(/Catalog/).isVisible()) &&
      (await place('Editor').isVisible()),
  );
  const navBox = await box(nav);
  const barBox = await box(bar);
  if (phone) {
    check(width, 'places are a bottom nav', navBox.y + navBox.height >= 844 - 2, `${navBox.y}`);
    check(width, 'bottom nav is one row', navBox.height <= 72, `${navBox.height}px`);
  } else check(width, 'places are tabs in the top bar', navBox.y < barBox.y + barBox.height);
  check(width, 'top bar is one row', barBox.height <= 56, `${barBox.height}px`);
  check(width, 'no sideways scroll (Projects)', await noSideScroll());
  // D02: the "Built in the app" list is gone (user request 2026-10-24).
  check(
    width,
    'Projects has no "Built in the app"',
    (await page.getByText('Built in the app').count()) === 0,
  );
  await shot('projects');

  // 2. A new single piece opens in the editor.
  await page.getByRole('button', { name: 'New single piece' }).click();
  const dlg = page.locator('dialog[open]');
  check(
    width,
    'New has no "Built in the app"',
    (await dlg.getByText('Built in the app').count()) === 0,
  );
  await dlg
    .getByRole('button', { name: /Wall cabinet/ })
    .first()
    .click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  check(
    width,
    'new piece opens in the Editor',
    (await place('Editor').getAttribute('aria-current')) === 'page',
  );
  check(width, 'editor top bar is one row', (await box(bar)).height <= 56);

  // 3. No import or export control in the top or bottom bar.
  const fileish = /import|export|csv|print|design file|project file|fusion|svg/i;
  const visibleFileButtons = async (scope) => {
    let n = 0;
    for (const l of await scope.locator('button, a, label, summary').all())
      if (
        (await l.isVisible()) &&
        fileish.test((await l.innerText()) + ((await l.getAttribute('aria-label')) ?? ''))
      )
        n++;
    return n;
  };
  check(width, 'top bar has no file controls', (await visibleFileButtons(bar)) === 0);
  check(width, 'bottom nav has no file controls', (await visibleFileButtons(nav)) === 0);
  await shot('editor');

  // 4. ⋯ → Files: each file works.
  await more.click();
  for (const t of [
    'Files',
    'Design file',
    'Front view drawing',
    'Fusion 360 script',
    'Import a file',
  ])
    check(width, `⋯ shows "${t}"`, await menu.getByText(t, { exact: false }).first().isVisible());
  await shot('more');
  const fileFrom = async (label) => {
    if (!(await menu.isVisible())) await more.click();
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }),
      menu.getByRole('button', { name: new RegExp(label) }).click(),
    ]);
    return dl;
  };
  const design = await fileFrom('Design file');
  check(
    width,
    'Design file downloads a .json',
    design.suggestedFilename().endsWith('.json'),
    design.suggestedFilename(),
  );
  const svg = await fileFrom('Front view drawing');
  check(
    width,
    'Front view drawing downloads an .svg',
    svg.suggestedFilename().endsWith('-front.svg'),
    svg.suggestedFilename(),
  );
  const py = await fileFrom('Fusion 360 script');
  check(
    width,
    'Fusion 360 script downloads a .py',
    py.suggestedFilename().endsWith('-fusion.py'),
    py.suggestedFilename(),
  );
  // Escape closes the menu and returns focus to ⋯.
  await more.click();
  await page.keyboard.press('Escape');
  check(width, 'Escape closes ⋯', !(await menu.isVisible()));
  const focusOk = await more.evaluate(
    (el) => document.activeElement === el && getComputedStyle(el).outlineStyle !== 'none',
  );
  check(width, 'focus is back on ⋯ and visible', focusOk);

  // 5. Import a file from ⋯: the downloaded design opens as a new copy.
  const path = await design.path();
  const imported = JSON.parse(readFileSync(path, 'utf8'));
  await more.click();
  await menu.locator('input[type=file]').setInputFiles({
    name: 'imported.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...imported, name: 'Imported via menu' })),
  });
  await page.waitForTimeout(500);
  check(
    width,
    'Import a file opens the file in the editor',
    (await page.getByRole('textbox', { name: 'Name of this piece' }).inputValue()) ===
      'Imported via menu',
  );

  // 6. Projects: open, duplicate, delete, import — the Library content lives here.
  await place('Projects').click();
  await page.getByRole('heading', { name: 'Single pieces' }).waitFor();
  check(width, 'Projects lists single pieces', true);
  check(
    width,
    'Projects has "Import a file"',
    await page.locator('main.projects-page').getByText('Import a file').isVisible(),
  );
  check(
    width,
    '"Clean up unused pictures" under ⋯ More (G-059)',
    await (async () => {
      await more.click();
      const ok = await menu.getByRole('button', { name: /Clean up unused pictures/ }).isVisible();
      await page.keyboard.press('Escape');
      return ok;
    })(),
  );
  const rows = page.locator('main.projects-page ul.library > li');
  const before = await rows.count();
  // Up to 520 px a row's Settings, Duplicate and Delete sit in its ⋯ menu (ADR-118).
  const rowAction = async (action, name) => {
    if (width > 520)
      return page.getByRole('button', { name: `${action} ${name}`, exact: true }).click();
    const menu = page.locator('details.row-menu', {
      has: page.locator(`summary[aria-label="Actions for ${name}"]`),
    });
    await menu.locator('summary').click();
    await menu.getByRole('button', { name: action, exact: true }).click();
  };
  await rowAction('Duplicate', 'Imported via menu');
  await page.waitForTimeout(400);
  check(width, 'Duplicate adds a copy', (await rows.count()) === before + 1);
  await rowAction('Delete', 'Imported via menu (copy)');
  await page.locator('dialog[open]').getByRole('button', { name: 'Delete', exact: true }).click();
  await page.waitForTimeout(400);
  check(width, 'Delete removes it after asking', (await rows.count()) === before);
  check(width, 'no sideways scroll (Projects with items)', await noSideScroll());

  // 7. A piece inside a project: the path in the app bar, and back to the project.
  await page.getByRole('button', { name: 'Create a new project' }).click();
  await page.locator('dialog[open] input').fill('Shell test');
  await page.locator('dialog[open]').getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  // On a phone the project's pieces sit in the Compose sheet: tap its peek row to open it.
  const openSheet = async () => {
    const peek = page.locator('.sheet-peek');
    if ((await peek.isVisible()) && (await peek.getAttribute('aria-expanded')) === 'false')
      await peek.click();
  };
  await openSheet();
  await page.getByRole('button', { name: 'Add a piece' }).click();
  const add = page.locator('dialog[open]');
  await add.getByRole('searchbox', { name: 'Search the items' }).fill('Base cabinet');
  await add
    .getByRole('button', { name: /Base cabinet, doors: 1 door \+ shelf/ })
    .first()
    .click();
  await add.waitFor({ state: 'detached' }).catch(() => {});
  await openSheet();
  await page.locator('ul.pieces > li').first().getByRole('button').click();
  await page.getByRole('button', { name: 'Edit this piece' }).click();
  const back = page.getByRole('button', { name: 'Back to project Shell test' });
  check(
    width,
    'app bar shows ‹ Shell test › piece',
    (await back.isVisible()) &&
      (await bar.getByRole('textbox', { name: 'Name of this piece' }).isVisible()),
  );
  await shot('path');
  await back.click();
  check(
    width,
    'tapping the project returns to it',
    await page.getByRole('textbox', { name: 'Name of this project' }).isVisible(),
  );

  // 8. A template variant: Save to template and Cancel in the app bar.
  await place(/Catalog/).click();
  await page.getByRole('searchbox', { name: 'Search the catalog' }).fill('Wall cabinet');
  await page.getByRole('button', { name: 'Edit template' }).first().click();
  await page.getByRole('button', { name: 'Edit design' }).first().click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  check(
    width,
    'template variant offers Save to template and Cancel',
    (await bar.getByRole('button', { name: 'Save to template' }).isVisible()) &&
      (await bar.getByRole('button', { name: 'Cancel' }).isVisible()),
  );
  check(width, 'no sideways scroll (template path)', await noSideScroll());
  await bar.getByRole('button', { name: 'Cancel' }).click();
  check(
    width,
    'Cancel returns to the Catalog',
    await page.getByRole('searchbox', { name: 'Search the catalog' }).isVisible(),
  );
  check(
    width,
    'Catalog template files sit in a menu',
    await (async () => {
      // On a phone the catalog's actions fold under "More catalog actions" (G-059).
      const fold = page.locator('details.catalog-more');
      if ((await fold.count()) && !(await fold.evaluate((d) => d.open)))
        await fold.locator(':scope > summary').click();
      return page.locator('summary[aria-label="Template files"]').isVisible();
    })(),
  );

  // 9. Feature Research from ⋯; old links still open their pages.
  await more.click();
  await menu.getByRole('button', { name: /Feature Research/ }).click();
  check(
    width,
    'Feature Research opens from ⋯',
    await page.getByRole('heading', { name: /Feature Research/ }).isVisible(),
  );
  for (const [hash, test] of [
    ['#editor', () => page.locator('main.work').isVisible()],
    ['#catalog', () => page.getByRole('searchbox', { name: 'Search the catalog' }).isVisible()],
    ['#research', () => page.getByRole('heading', { name: /Feature Research/ }).isVisible()],
  ]) {
    await page.goto(url + hash);
    await page.waitForTimeout(500);
    check(width, `${hash} still opens its page`, await test());
  }
  check(width, 'no page errors', errors.length === 0, errors.join(' / '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
