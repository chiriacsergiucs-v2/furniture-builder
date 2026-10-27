// Find-it acceptance for duplicate, turn about the centre and mirror (CLAUDE.md R3, backlog N64, ADR-069), run
// against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/arrange/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
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
  const ctx = await browser.newContext({
    viewport: { width, height: phone ? 844 : 900 },
    hasTouch: phone,
    isMobile: phone,
  });
  const page = await ctx.newPage();
  // ADR-116: the selected piece's Position, Clearance, Finish and Merge are folded groups: open one by its title
  // (when it is on screen; a phone's closed sheet hides the whole card, which is read as before).
  const openGroup = async (title) => {
    const s = page
      .locator('details.group > summary')
      .filter({ hasText: new RegExp(`^${title}$`) })
      .first();
    if ((await s.isVisible()) && !(await s.evaluate((el) => el.parentElement.open)))
      await s.click({ timeout: 5000 });
  };
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const shot = (name) =>
    page.screenshot({ path: `${out}/arrange-${name}-${width}.png`, fullPage: true });
  const dlg = page.locator('dialog[open]');
  const click = async (loc) => {
    await loc.scrollIntoViewIfNeeded();
    await loc.click({ timeout: 3000 }).catch(() => loc.dispatchEvent('click'));
  };
  const btn = (name, exact = true) => page.getByRole('button', { name, exact });
  const textBtn = (re) => page.locator('button', { hasText: re }).first();
  const pieces = page.locator('ul.pieces > li');
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
  const fromLeft = async () => {
    await openGroup('Position');
    return Number(await page.getByLabel('From left', { exact: true }).first().inputValue());
  };
  const turnSel = async () => {
    await openGroup('Position');
    return (
      (await page
        .getByRole('radio', { name: /^\d+°$/, checked: true })
        .first()
        .textContent()) ?? ''
    );
  };

  // 1. Bare app → new project → one base cabinet, selected.
  await page.goto(url);
  await click(btn('Create a new project'));
  await page.locator('dialog[open] input').fill(`Arrange ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await addPiece('Base cabinet', /Base cabinet, doors: 1 door \+ shelf/);
  await click(pieces.first().getByRole('button'));
  await page.waitForTimeout(150);

  // 2. Duplicate is found by text: a touching copy, one undo step.
  const dup = textBtn(/^Duplicate$/);
  check(width, '"Duplicate" is found in the selected-piece card', await dup.isVisible());
  const x0 = await fromLeft();
  await click(dup);
  await page.waitForTimeout(200);
  check(width, 'Duplicate adds a second piece', (await pieces.count()) === 2);
  const x1 = await fromLeft();
  check(
    width,
    'the copy is selected and touches the original on its right',
    x1 === x0 + 600,
    `${x0} → ${x1}`,
  );
  await shot('duplicated');
  await click(btn('Undo'));
  await page.waitForTimeout(200);
  check(width, 'one Undo removes the copy', (await pieces.count()) === 1);
  await click(btn('Redo'));
  await page.waitForTimeout(200);
  check(width, 'Redo brings the copy back', (await pieces.count()) === 2);

  // 3. Turn 90° about the centre: the front turns, four turns come back to the same place.
  await openSheet();
  await click(pieces.first().getByRole('button'));
  const turn = textBtn(/^Turn 90° ↺$/);
  check(width, '"Turn 90°" is found in the selected-piece card', await turn.isVisible());
  const t0 = await fromLeft();
  const [fw, fd] = (
    (await page
      .getByText(/^Takes \d+ × \d+ mm of floor/)
      .first()
      .textContent()) ?? ''
  )
    .match(/(\d+) × (\d+)/)
    .slice(1)
    .map(Number);
  await click(turn);
  await page.waitForTimeout(150);
  check(
    width,
    'after one turn the front faces right (Turn shows 90°)',
    (await turnSel()) === '90°',
    await turnSel(),
  );
  const t1 = await fromLeft();
  check(
    width,
    'the piece turned about its centre (From left moved by half of width − depth)',
    t1 === t0 + Math.floor((fw - fd) / 2),
    `${fw} × ${fd} mm: ${t0} → ${t1}`,
  );
  await shot('turned');
  for (let i = 0; i < 3; i++) {
    await click(turn);
    await page.waitForTimeout(120);
  }
  check(
    width,
    'four turns return the piece to the same place',
    (await fromLeft()) === t0 && (await turnSel()) === '0°',
    `${await fromLeft()}, ${await turnSel()}`,
  );
  await click(textBtn(/^Turn 90° ↻$/));
  await page.waitForTimeout(120);
  check(
    width,
    '"Turn 90° ↻" turns the other way (270°)',
    (await turnSel()) === '270°',
    await turnSel(),
  );
  await click(btn('Undo'));
  await page.waitForTimeout(150);

  // 4. R on the piece focused on the plan turns it (desktop: the plan is beside the panel).
  if (!phone) {
    const plan = page.getByRole('figure', { name: /Room plan, seen from above/ });
    const onPlan = plan.getByRole('button', { name: /^Base cabinet.*, \d+ by \d+ mm$/ }).first();
    if (await onPlan.isVisible().catch(() => false)) {
      await onPlan.focus();
      await page.keyboard.press('r');
      await page.waitForTimeout(150);
      check(
        width,
        'R on the focused plan piece turns it 90°',
        (await turnSel()) === '90°',
        await turnSel(),
      );
      await page.keyboard.press('Shift+R');
      await page.waitForTimeout(150);
      check(width, 'Shift+R turns it back', (await turnSel()) === '0°', await turnSel());
    } else check(width, 'the plan piece is visible for R', false);
  }

  // 5. Mirror: a door piece mirrors (no message); a bookcase says there is nothing to mirror.
  await openSheet();
  await click(pieces.first().getByRole('button'));
  const mirror = textBtn(/^Mirror$/);
  check(width, '"Mirror" is found in the selected-piece card', await mirror.isVisible());
  await click(mirror);
  await page.waitForTimeout(150);
  check(
    width,
    'Mirror on a door cabinet changes it (no "Nothing to mirror")',
    !(await page.getByText('Nothing to mirror in this piece').isVisible()),
  );
  const run = textBtn(/^Mirror the run \(2 pieces\)$/);
  check(width, '"Mirror the run (2 pieces)" is found', await run.isVisible());
  await click(run);
  await page.waitForTimeout(150);
  check(width, 'Mirror the run keeps both pieces', (await pieces.count()) === 2);
  await shot('mirrored');
  await addPiece('Bookcase', /Bookcase/);
  await click(pieces.nth(2).getByRole('button'));
  await click(textBtn(/^Mirror$/));
  await page.waitForTimeout(150);
  check(
    width,
    'a bookcase says "Nothing to mirror in this piece"',
    await page.getByText('Nothing to mirror in this piece').isVisible(),
  );
  await shot('nothing-to-mirror');

  // 6. Ctrl+D duplicates the selected piece.
  if (!phone) {
    await page
      .locator('body')
      .click({ position: { x: 2, y: 2 } })
      .catch(() => {});
    await page.keyboard.press('Control+d');
    await page.waitForTimeout(200);
    check(
      width,
      'Ctrl+D duplicates the selected piece',
      (await pieces.count()) === 4,
      `${await pieces.count()}`,
    );
  }

  check(width, 'no sideways scroll', await noSideScroll());
  check(width, 'no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
