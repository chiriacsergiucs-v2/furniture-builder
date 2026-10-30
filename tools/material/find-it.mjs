// Find-it acceptance for the one Material control (CLAUDE.md R3, backlog N165, ADR-163), against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/material/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// From the bare app, by visible text, at 1280 and 390 px: a single piece has a Material button in the header bar
// that opens the Material dialog with Part and Item scopes, part chips and a board list labelled "name, thickness mm"
// (no maker or type suffix); Item + Shelves + a board applies and says so; Settings has no Materials or Part boards
// group. A project of two base units: Material offers Part / Item / Group / Whole project; Group + Fronts applies to
// 2 items; the selected piece card has no Finish group; Project settings has no Carcass board select; no horizontal
// scroll. Not part of `pnpm test`.
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
  const shot = (name) => page.screenshot({ path: `${out}/material-${name}-${width}.png` });
  const dlg = page.locator('dialog[open]');
  const noScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

  // 1. Bare app → a single piece (Bookcase) → Material in the header bar.
  await page.goto(url);
  await page.getByRole('button', { name: 'New single piece', exact: true }).click();
  await dlg
    .getByRole('button', { name: /Bookcase/ })
    .first()
    .click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  const material = page.getByRole('button', { name: 'Material', exact: true });
  check(width, 'Material button in the header bar', await material.isVisible());
  await material.click();
  const md = page.locator('dialog[open]', { has: page.getByRole('heading', { name: 'Material' }) });
  await md.waitFor({ state: 'visible' });
  const scopes = md.getByRole('radiogroup', { name: 'Apply to' });
  check(
    width,
    'Scopes Part and Item for a single piece, no Group or Whole project',
    (await scopes.getByRole('radio', { name: 'Part', exact: true }).count()) === 1 &&
      (await scopes.getByRole('radio', { name: 'Item', exact: true }).count()) === 1 &&
      (await scopes.getByRole('radio', { name: 'Group', exact: true }).count()) === 0 &&
      (await scopes.getByRole('radio', { name: 'Whole project', exact: true }).count()) === 0,
  );
  const chips = md.getByRole('group', { name: 'Parts' });
  check(
    width,
    'Part chips: Carcass, Top, Bottom, Sides, Shelves, Back',
    (
      await Promise.all(
        ['Carcass', 'Top', 'Bottom', 'Sides', 'Shelves', 'Back'].map((n) =>
          chips.getByRole('button', { name: n, exact: true }).isVisible(),
        ),
      )
    ).every(Boolean),
  );
  const board = md.getByRole('combobox', { name: 'Board' });
  const labels = await board.locator('option').allTextContents();
  check(
    width,
    'Board labels are "name, thickness mm" without maker or type',
    labels.length > 0 && labels.every((l) => /, \d+ mm/.test(l) && !l.includes('·')),
    labels.join(' | '),
  );
  await chips.getByRole('button', { name: 'Shelves', exact: true }).click();
  await board.selectOption({ label: 'PAL 18 oak, 18 mm' });
  await shot('single-dialog');
  await md.getByRole('button', { name: 'Apply material' }).click();
  const status1 = (await md.getByRole('status').textContent()) ?? '';
  check(
    width,
    'Item + Shelves + PAL 18 oak → "Applied to 1 item"',
    /Applied to 1 item/.test(status1),
    status1,
  );
  await md.getByRole('radio', { name: 'Part', exact: true }).click();
  const part = md.getByRole('combobox', { name: 'Part', exact: true });
  check(
    width,
    'Part select lists the parts with their board',
    (await part.locator('option', { hasText: /^Left side — / }).count()) === 1,
  );
  await md.getByRole('button', { name: 'Close' }).click();
  check(width, 'No horizontal scroll (single piece)', await noScroll());

  // 2. Settings has no Materials or Part boards group.
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const sd = page.locator('dialog[open]').last();
  check(
    width,
    'Settings: no Materials and no Part boards group',
    (await sd.locator('summary', { hasText: /^Materials$/ }).count()) === 0 &&
      (await sd.locator('summary', { hasText: /^Part boards$/ }).count()) === 0,
  );
  await sd.getByRole('button', { name: 'Done' }).click();

  // 3. A project with two base units side by side.
  await page.goto(url);
  await page.getByRole('button', { name: 'Create a new project', exact: true }).click();
  await dlg.locator('input').fill(`Material ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  const side = page.getByRole('complementary', { name: 'Compose' });
  const peek = page.locator('.sheet-peek');
  const sheet = async (open) => {
    if (!phone) return;
    if (((await peek.getAttribute('aria-expanded')) === 'true') !== open) await peek.click();
    await page.waitForTimeout(250);
  };
  for (let i = 0; i < 2; i++) {
    await sheet(true);
    await side.getByRole('button', { name: 'Add a piece', exact: true }).click();
    await dlg.getByRole('searchbox', { name: 'Search the items' }).fill('Base cabinet, doors');
    await dlg.locator('.start-group .row-btn').first().click();
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
    const place = page.getByRole('button', { name: 'Place to the right', exact: true });
    if (await place.isVisible().catch(() => false)) await place.click();
    await page.waitForTimeout(300);
  }
  await sheet(true);
  const card = side.getByRole('region', { name: /^Selected piece: / });
  check(
    width,
    'Selected piece card has no Finish group',
    (await card.locator('summary', { hasText: /^Finish$/ }).count()) === 0,
  );
  await sheet(false);
  await material.click();
  await md.waitFor({ state: 'visible' });
  check(
    width,
    'Scopes Part / Item / Group / Whole project in a project',
    (
      await Promise.all(
        ['Part', 'Item', 'Group', 'Whole project'].map((n) =>
          scopes.getByRole('radio', { name: n, exact: true }).isVisible(),
        ),
      )
    ).every(Boolean),
  );
  const group = scopes.getByRole('radio', { name: 'Group', exact: true });
  check(width, 'Group is enabled for a piece in a run of two', await group.isEnabled());
  await group.click();
  await chips.getByRole('button', { name: 'Fronts', exact: true }).click();
  await board.selectOption({ label: 'PAL 18 oak, 18 mm' });
  await shot('project-dialog');
  await md.getByRole('button', { name: 'Apply material' }).click();
  const status2 = (await md.getByRole('status').textContent()) ?? '';
  check(
    width,
    'Group + Fronts + PAL 18 oak → "Applied to 2 items"',
    /Applied to 2 items/.test(status2),
    status2,
  );
  await md.getByRole('button', { name: 'Close' }).click();

  // 4. Project settings has no Carcass / Front / Back board select.
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const ps = page.locator('dialog[open]').last();
  check(
    width,
    'Project settings: no Carcass board, Front board or Back board select',
    (await ps.getByRole('combobox', { name: 'Carcass board' }).count()) === 0 &&
      (await ps.getByRole('combobox', { name: 'Front board' }).count()) === 0 &&
      (await ps.getByRole('combobox', { name: 'Back board' }).count()) === 0,
  );
  await ps.getByRole('button', { name: 'Done' }).click();
  check(width, 'No horizontal scroll (project)', await noScroll());
  check(width, 'No page errors', errors.length === 0, errors.join('; '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
