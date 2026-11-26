// Find-it acceptance for the canvas editor on phones (ADR-283, backlog N366), run against a production build:
//   pnpm build && pnpm preview &  node tools/canvas-editor/find-it.mjs [url] [out dir]
// Starts from the bare app at 360 and 390 px, turns the editor on from More by its visible text, and finds the
// selection ladder, chip rail and lens card by role and text. A last run with the flag off checks today's sheet.
import { mkdirSync } from 'node:fs';
import { launchBrowser, makeChecker, outDir, previewUrl } from '../lib/harness.mjs';

const url = previewUrl();
const out = outDir();
mkdirSync(out, { recursive: true });
// This script tests the canvas editor as the phone default (ADR-290): no sheet-editor preset from the harness.
const browser = await launchBrowser({ appDefault: true });
const results = [];
const { check } = makeChecker(results);

const newChest = async (page) => {
  await page.goto(url);
  await page.getByRole('button', { name: 'New single piece' }).click();
  await page
    .locator('dialog[open]')
    .getByRole('button', { name: /Chest of drawers/ })
    .first()
    .click();
  await page.locator('main.work').waitFor({ state: 'visible' });
};
// The first tap selects the whole piece, the next at the same spot the space inside it (ADR-083).
const tapSpace = async (page) => {
  await page.locator('.el-space').first().click({ force: true });
  await page.locator('.el-space').first().click({ force: true });
};
const box = async (l) => (await l.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };

// 0. Default (ADR-290): a first visit on a phone opens the canvas editor, with its first-run hints.
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  await newChest(page);
  const hints = page.getByRole('dialog', { name: 'Getting started' });
  check(390, 'first visit: "Getting started" shows', await hints.isVisible());
  if (await hints.isVisible()) await hints.getByRole('button', { name: 'Skip' }).click();
  check(
    390,
    'first visit: the chip rail and ladder show, no peek row',
    (await page.getByRole('toolbar', { name: 'Editor actions' }).isVisible()) &&
      (await page.getByRole('navigation', { name: 'Selection path' }).isVisible()) &&
      !(await page.locator('.sheet-peek').isVisible()),
  );
  await ctx.close();
}

for (const width of [360, 390]) {
  const ctx = await browser.newContext({
    viewport: { width, height: 800 + (width === 390 ? 44 : 0) },
    hasTouch: true,
    isMobile: true,
  });
  // Start from the sheet (More › switch off, ADR-290), so turning it on is part of the find-it path.
  await ctx.addInitScript(() => localStorage.setItem('fb:canvasEditor', 'off'));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = (name) => page.screenshot({ path: `${out}/canvas-${name}-${width}.png` });
  const side = page.locator('aside.side');
  const pill = page.getByRole('navigation', { name: 'Selection path' });
  const rail = page.getByRole('toolbar', { name: 'Editor actions' });
  const tabs = page.getByRole('tablist', { name: 'Editor card' });

  // 1. Turned on from ⋯ More by its visible text.
  await newChest(page);
  await page.locator('details.more > summary').first().click();
  const toggle = page.getByRole('button', { name: /Canvas editor \(preview\)/ });
  check(width, 'More lists "Canvas editor (preview)"', await toggle.isVisible());
  await toggle.click();
  // First-run hints (ADR-289) open once; skip them.
  await page.waitForTimeout(200);
  if (await page.getByRole('dialog', { name: 'Getting started' }).isVisible())
    await page.getByRole('button', { name: 'Skip' }).click();
  await page.waitForTimeout(200);
  check(
    width,
    'the toggle is pressed after a tap',
    (await page.evaluate(() => localStorage.getItem('fb:canvasEditor'))) === 'on',
  );

  // 2. A space tap: the pill names Piece › Space, no sheet or peek row shows.
  await tapSpace(page);
  await page.waitForTimeout(300);
  const crumbs = await pill.getByRole('button').allInnerTexts();
  check(
    width,
    'pill reads "Chest of drawers › <space>"',
    crumbs.length === 2 && crumbs[0] === 'Chest of drawers',
    crumbs.join(' › '),
  );
  check(
    width,
    'no sheet: card and peek row hidden',
    !(await side.isVisible()) && !(await page.locator('.sheet-peek').isVisible()),
  );
  await shot('space');

  // 3. Every block of the space editor opens from a chip as one tab of the lens card.
  // The editor's chips; the output chips after them (ADR-288) open results, not editor blocks.
  const chips = (await rail.locator('button:not(.out)').allInnerTexts()).map((s) => s.trim());
  check(
    width,
    'chip rail starts with Find, then Overview',
    chips[0] === '' && chips[1] === 'Overview',
    chips.join(', '),
  );
  chips.shift();
  for (const want of ['Divide this space', 'Contents', 'Doors and handles', 'Layouts'])
    check(width, `chip "${want}" in the rail`, chips.includes(want));
  for (const chip of chips) {
    if (!(await rail.isVisible()))
      await page.getByRole('button', { name: 'Close the card' }).click();
    await rail.getByRole('button', { name: chip, exact: true }).click();
    await page.waitForTimeout(150);
    const selected = await tabs.getByRole('tab', { selected: true }).innerText();
    const shownBlocks = await side
      .locator('.side-body [data-lens-key]:visible')
      .evaluateAll((els) =>
        els
          .filter((e) => !e.parentElement?.closest('[data-lens-key]'))
          .map((e) => e.getAttribute('data-lens-key')),
      );
    const ok =
      chip === 'Overview'
        ? selected.trim() === 'Overview' && shownBlocks.length === 0
        : selected.trim() === chip && shownBlocks.length === 1 && shownBlocks[0] === chip;
    check(
      width,
      `chip "${chip}" opens one block in the card`,
      ok,
      `${selected} | ${shownBlocks.join(',')}`,
    );
  }

  // 4. The selected space stays inside the visible stage, compact and tall.
  await rail.isVisible().catch(() => {});
  if (await rail.isVisible())
    await rail.getByRole('button', { name: 'Contents', exact: true }).click();
  else await tabs.getByRole('tab', { name: 'Contents' }).click();
  for (const stop of ['compact', 'tall']) {
    if (stop === 'tall') await page.getByRole('button', { name: 'Taller card' }).click();
    await page.waitForTimeout(400);
    const sel = await box(page.locator('.el-space.selected rect').first());
    const card = await box(side);
    const stage = await box(page.locator('section.stage'));
    check(
      width,
      `selected space in sight with the card ${stop}`,
      sel.height > 0 && sel.y >= stage.y - 1 && sel.y + sel.height <= card.y + 1,
      `space ${Math.round(sel.y)}–${Math.round(sel.y + sel.height)}, card top ${Math.round(card.y)}`,
    );
    await shot(`card-${stop}`);
  }
  // Arrow keys on the height button step the stops too.
  await page.getByRole('button', { name: 'Shorter card' }).press('ArrowUp');
  check(
    width,
    'ArrowUp keeps it tall',
    (await page.getByRole('button', { name: 'Shorter card' }).count()) === 1,
  );
  await page.getByRole('button', { name: 'Shorter card' }).press('ArrowDown');
  check(
    width,
    'ArrowDown makes it compact',
    (await page.getByRole('button', { name: 'Taller card' }).count()) === 1,
  );

  // 4b. The card points at the selection; Esc closes the card first and keeps the level; a tap on empty drawing too.
  check(width, 'card points at the selection', (await side.getAttribute('data-anchored')) !== null);
  const before = await pill.getByRole('button').allInnerTexts();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  check(
    width,
    'Esc closes the open card and keeps the level',
    !(await side.isVisible()) &&
      (await pill.getByRole('button').allInnerTexts()).join('›') === before.join('›'),
  );
  // Find (ADR-289) opens its own search; Esc closes it. Then reopen the card for the next check.
  await page.getByRole('button', { name: 'Find an action' }).click();
  check(
    width,
    'Find opens "Find an action"',
    await page.getByRole('dialog', { name: 'Find an action' }).isVisible(),
  );
  await page.keyboard.press('Escape');
  await rail.getByRole('button', { name: 'Contents', exact: true }).click();
  const svgBox = await box(page.locator('section.stage svg').first());
  await page.mouse.click(svgBox.x + 4, svgBox.y + 4);
  await page.waitForTimeout(150);
  check(width, 'a tap on empty drawing closes the card', !(await side.isVisible()));
  // The empty-drawing tap may also let the selection go (today's behaviour): pick the space again.
  for (let n = 0; n < 3 && (await pill.getByRole('button').count()) < 2; n++)
    await page.locator('.el-space').first().click({ force: true });

  await rail.getByRole('button', { name: 'Contents', exact: true }).click();
  await page.getByRole('button', { name: 'Close the card' }).click();
  check(width, 'closing the card brings the rail back', await rail.isVisible());
  await page.getByRole('button', { name: 'Up one level' }).click();
  await page.waitForTimeout(150);
  const afterUp = await pill.getByRole('button').allInnerTexts();
  await tapSpace(page);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  const afterEsc = await pill.getByRole('button').allInnerTexts();
  check(
    width,
    '↑ and Esc reach the same level',
    afterUp.join('›') === afterEsc.join('›'),
    afterUp.join(' › '),
  );

  // 6. Touch targets and no side scroll.
  const small = await page.evaluate(
    () =>
      Array.from(document.querySelectorAll('.chip-rail button, .ladder button'))
        .filter((b) => b.offsetParent)
        .map((b) => b.getBoundingClientRect())
        .filter((r) => r.height < 43.5 || r.width < 43.5).length,
  );
  check(width, 'chips and ladder buttons are at least 44 px', small === 0, `${small} smaller`);
  check(
    width,
    'no horizontal page scroll',
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  );

  // 7. Flag off again: today's sheet and peek row come back.
  await page.locator('details.more > summary').first().click();
  await page.getByRole('button', { name: /Canvas editor \(preview\)/ }).click();
  // First-run hints (ADR-289) open once; skip them.
  await page.waitForTimeout(200);
  if (await page.getByRole('dialog', { name: 'Getting started' }).isVisible())
    await page.getByRole('button', { name: 'Skip' }).click();
  await page.waitForTimeout(200);
  check(
    width,
    'flag off: peek row back, no rail',
    (await page.locator('.sheet-peek').isVisible()) && (await rail.count()) === 0,
  );
  check(width, 'no script errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length ? 1 : 0);
