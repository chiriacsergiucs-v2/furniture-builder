// Find-it acceptance for the Home welcome page (CLAUDE.md R3, backlog N38), run against a production build:
// Since ADR-078 the welcome page is the Projects place (the bare address, "Projects" in the places nav); the
// "Built in the app" list was removed at the user's request (backlog D02), so the script checks it is gone.
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/home/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
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

for (const width of [1440, 375, 360]) {
  const phone = width < 500;
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 812 : 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const shot = (name) =>
    page.screenshot({ path: `${out}/home-${name}-${width}.png`, fullPage: true });
  // ADR-078: Home became the Projects place; its page heading is "Projects".
  const welcome = page.getByRole('heading', { name: 'Projects', level: 1 });
  const homeTab = page
    .getByRole('navigation', { name: 'Places' })
    .getByRole('link', { name: 'Projects' });
  const savedRows = page.locator('.projects-page ul.library .row-btn');
  const editorShown = () => page.locator('main.work').isVisible();

  // 1. First start: the bare app opens on the welcome page.
  await page.goto(url);
  await welcome.waitFor({ timeout: 10000 });
  check(
    width,
    'first start opens the welcome page (Projects)',
    (await welcome.isVisible()) && !(await editorShown()),
  );
  check(
    width,
    '"Create a new project" visible',
    await page.getByRole('button', { name: 'Create a new project' }).isVisible(),
  );
  check(
    width,
    '"Choose a project" visible',
    await page.getByRole('heading', { name: 'Choose a project' }).isVisible(),
  );
  check(
    width,
    'empty device says nothing saved yet',
    await page.getByText('No projects saved yet').isVisible(),
  );
  // Rewritten: the built-in Mobila projects were removed from the app by the user (backlog D02).
  check(
    width,
    '"Built in the app" list removed (D02)',
    (await page.getByText('Built in the app').count()) === 0,
  );
  // Rewritten: the Home and Editor tabs are now the Projects, Catalog and Editor places (ADR-078).
  const places = page.getByRole('navigation', { name: 'Places' });
  check(
    width,
    'Projects, Catalog and Editor places visible',
    (await homeTab.isVisible()) &&
      (await places.getByRole('link', { name: /^Catalog/ }).isVisible()) &&
      (await places.getByRole('link', { name: 'Editor' }).isVisible()),
  );
  check(
    width,
    'editor actions hidden on Home',
    !(await page.getByRole('button', { name: 'Parts CSV' }).isVisible()),
  );
  check(width, 'no sideways scroll (empty)', await noSideScroll());
  await shot('empty');

  // 2. Create a new project by visible text; it opens in the editor.
  await page.getByRole('button', { name: 'Create a new project' }).click();
  const dlg = page.locator('dialog[open]');
  await dlg.locator('input').fill('Bucătărie test');
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  check(
    width,
    'new project opens in the editor',
    (await editorShown()) &&
      (await page.getByLabel('Name of this project').inputValue()) === 'Bucătărie test',
  );

  // 3. Home tab is findable; the new project is listed; choosing it opens it.
  await page.waitForTimeout(700); // autosave
  await homeTab.click();
  await welcome.waitFor();
  // Each row also has "Settings for …", "Duplicate …" and "Delete …" buttons: match the row by its start.
  const row = page.getByRole('button', { name: /^Bucătărie test/ });
  check(width, 'Projects tab back to the welcome page', await welcome.isVisible());
  check(width, 'saved project listed under Choose a project', await row.isVisible());
  check(width, 'open project marked "Open now"', (await row.innerText()).includes('Open now'));

  // 4. A single piece via New single piece → Start from, then both are listed.
  await page.getByRole('button', { name: 'New single piece' }).click();
  await page.locator('dialog[open] .start-group .row-btn').first().click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  check(
    width,
    'new single piece opens in the editor',
    (await editorShown()) && (await page.getByLabel('Name of this piece').isVisible()),
  );
  await page.getByRole('button', { name: 'Undo' }).isVisible();
  // edit once so the piece autosaves
  await page.getByLabel('Name of this piece').fill('Comodă test');
  await page.getByLabel('Name of this piece').press('Enter');
  await page.waitForTimeout(800);

  // 5. Reload the bare address: starting page is the welcome page again, with both listed.
  await page.goto(url);
  await welcome.waitFor();
  check(
    width,
    'restart opens the welcome page',
    (await welcome.isVisible()) && !(await editorShown()),
  );
  check(
    width,
    'project still listed after restart',
    await page.getByRole('button', { name: /^Bucătărie test/ }).isVisible(),
  );
  check(
    width,
    'piece listed under Single pieces',
    await page.getByRole('button', { name: /^Comodă test/ }).isVisible(),
  );
  check(
    width,
    'only what the user made is listed (no stray start-up piece)',
    (await savedRows.count()) === 2,
    `${await savedRows.count()} rows`,
  );
  check(width, 'no sideways scroll (with projects)', await noSideScroll());
  await shot('saved');
  await page.getByRole('button', { name: /^Bucătărie test/ }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  check(
    width,
    'choosing a project opens it',
    (await page.getByLabel('Name of this project').inputValue()) === 'Bucătărie test',
  );

  // 6. Rewritten: the built-in projects are gone (D02). From the welcome page the Editor place returns to the
  //    project that is open.
  await homeTab.click();
  await welcome.waitFor();
  await places.getByRole('link', { name: 'Editor' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  check(
    width,
    'Editor tab from the welcome page reopens the open project',
    (await editorShown()) &&
      (await page.getByLabel('Name of this project').inputValue()) === 'Bucătărie test',
  );
  check(width, 'no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
