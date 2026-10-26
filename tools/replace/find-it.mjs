// Find-it acceptance for "Replace a piece with a compatible catalog alternative" (CLAUDE.md R3, backlog N96, ADR-098),
// run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/replace/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at 1440 and 390 px and finds everything by visible text. Not part of `pnpm test`.
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

for (const width of [1440, 390]) {
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
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const shot = (name) =>
    page.screenshot({ path: `${out}/replace-${name}-${width}.png`, fullPage: true });
  const dlg = page.locator('dialog[open]');
  const click = async (loc) => {
    await loc.scrollIntoViewIfNeeded();
    await loc.click({ timeout: 3000 }).catch(() => loc.dispatchEvent('click'));
  };
  const btn = (name, exact = true) => page.getByRole('button', { name, exact });
  const pieces = page.locator('ul.pieces > li');
  const card = page.locator('section.piece-edit');
  const openSheet = async () => {
    const peek = page.locator('.sheet-peek');
    if ((await peek.isVisible()) && (await peek.getAttribute('aria-expanded')) === 'false')
      await peek.click();
  };
  const addPiece = async (search, name) => {
    await openSheet();
    await click(btn('Add a piece'));
    await dlg.getByRole('searchbox', { name: 'Search the items' }).fill(search);
    await dlg.getByRole('button', { name }).first().click();
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
    if (await btn('Place to the right').isVisible()) await click(btn('Place to the right'));
    await openSheet();
  };
  const fromLeft = async () =>
    Number(await page.getByLabel('From left', { exact: true }).first().inputValue());
  const pieceName = async () => ((await card.locator('h3').first().textContent()) ?? '').trim();

  // 1. Bare app → new project → two base cabinets in a row; select the second.
  await page.goto(url);
  await click(btn('Create a new project'));
  await page.locator('dialog[open] input').fill(`Replace ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await addPiece('Base cabinet', /Base cabinet, doors: 1 door \+ shelf/);
  await addPiece('Base cabinet', /Base cabinet, doors: 1 door \+ shelf/);
  await click(pieces.nth(1).getByRole('button'));
  await page.waitForTimeout(150);
  const name0 = await pieceName();
  const x0 = await fromLeft();

  // 2. "Replace…" is found in the selected-piece card and lists only same-width items.
  const replace = card.getByRole('button', { name: 'Replace…', exact: true });
  check(width, '"Replace…" is found in the selected-piece card', await replace.isVisible());
  await click(replace);
  await dlg.waitFor({ state: 'visible' });
  const rows = dlg.locator('ul.replace-list > li');
  const sizes = await rows.locator('.sub.num').allTextContents();
  check(
    width,
    'the Replace list shows pictures, names and sizes',
    sizes.length > 0 && (await rows.first().locator('img').count()) === 1,
    `${sizes.length} items`,
  );
  check(
    width,
    'only same-width (600 mm) items are listed',
    sizes.length > 0 && sizes.every((s) => /^600 × /.test(s.trim())),
    [...new Set(sizes.map((s) => s.trim().split(' ')[0]))].join(', '),
  );
  check(
    width,
    'no "Neighbours may need moving" note on same-width items',
    (await dlg.getByText('Neighbours may need moving.').count()) === 0,
  );
  check(width, 'no horizontal scroll with the Replace list open', await noSideScroll());
  await shot('list');

  // 3. "Show other widths" adds the rest, each with the note; switching it off hides them again.
  const other = dlg.getByLabel('Show other widths');
  check(width, '"Show other widths" switch is found', await other.isVisible());
  await other.check();
  await page.waitForTimeout(100);
  const all = await rows.count();
  const notes = await dlg.getByText('Neighbours may need moving.').count();
  check(
    width,
    'other widths appear, each with "Neighbours may need moving"',
    all > sizes.length && notes === all - sizes.length,
    `${sizes.length} → ${all}, ${notes} notes`,
  );
  await shot('other-widths');
  await other.uncheck();
  await page.waitForTimeout(100);
  check(
    width,
    'switching it off shows the same-width list again',
    (await rows.count()) === sizes.length,
  );

  // 4. Pick one: the piece is replaced in place.
  await click(dlg.getByRole('button', { name: /Base cabinet, drawers: 3 drawers, deep bottom/ }));
  await dlg.waitFor({ state: 'detached' }).catch(() => {});
  await page.waitForTimeout(200);
  await openSheet();
  const name1 = await pieceName();
  check(width, 'the selected piece is now the picked item', name1 !== name0, `${name0} → ${name1}`);
  check(width, 'still two pieces', (await pieces.count()) === 2);
  check(width, 'it stays in place (From left unchanged)', (await fromLeft()) === x0, `${x0}`);
  check(
    width,
    'the result says "Replaced."',
    await page
      .getByText(/^Replaced\./)
      .first()
      .isVisible(),
  );
  await shot('replaced');

  // 5. Undo restores it.
  await click(btn('Undo'));
  await page.waitForTimeout(200);
  await openSheet();
  check(width, 'Undo restores the old piece', (await pieceName()) === name0, await pieceName());

  // 6. A piece on another piece gets same-width items only, with no "Show other widths" switch (G-102).
  await click(card.getByRole('radio', { name: 'On a piece', exact: true }));
  await page.waitForTimeout(150);
  await click(replace);
  await dlg.waitFor({ state: 'visible' });
  const stackedSizes = await rows.locator('.sub.num').allTextContents();
  check(
    width,
    'a stacked piece lists only 600 mm items',
    stackedSizes.length > 0 && stackedSizes.every((s) => /^600 × /.test(s.trim())),
    [...new Set(stackedSizes.map((s) => s.trim().split(' ')[0]))].join(', '),
  );
  check(
    width,
    'a stacked piece has no "Show other widths" switch',
    (await dlg.getByLabel('Show other widths').count()) === 0,
  );
  await shot('stacked');
  await dlg
    .getByRole('button', { name: /close/i })
    .first()
    .click()
    .catch(() => page.keyboard.press('Escape'));
  check(width, 'no horizontal scroll', await noSideScroll());
  check(width, 'no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
