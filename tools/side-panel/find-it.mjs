// Find-it acceptance for the Compose side panel ordered by use (CLAUDE.md R3, backlog N162, ADR-160), against a
// production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/side-panel/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// From the bare app, by visible text, at 1280 and 390 px: a project with three pieces. Desktop: Add a piece, the
// toolbar and an open Position sit in the first 900 px of the panel; no How many, Rotation (°) or quarter-turn
// buttons; Move to shows working actions and "N more are off"; More actions holds Replace…, Save to catalog,
// Lock size and Remove from project, and each works; All pieces, previous and next; Delete asks to remove; a set
// room is a closed fold naming shape and sizes; a single piece's space shows Divide before Contents and a closed
// Layouts. Phone: the peek row's Duplicate adds a piece with the sheet closed; no horizontal scroll.
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
  const ctx = await browser.newContext({
    viewport: { width, height: phone ? 844 : 900 },
    hasTouch: phone,
    isMobile: phone,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = (name) => page.screenshot({ path: `${out}/side-panel-${name}-${width}.png` });
  const dlg = page.locator('dialog[open]');
  const side = page.getByRole('complementary', { name: 'Compose' });
  const card = side.getByRole('region', { name: /^Selected piece: / });
  const peek = page.locator('.sheet-peek');
  const sheet = async (open) => {
    if (!phone) return;
    if (((await peek.getAttribute('aria-expanded')) === 'true') !== open) await peek.click();
    await page.waitForTimeout(250);
  };
  const pieceCount = async () =>
    Number(
      (await side.getByRole('button', { name: /^All pieces \(\d+\)$/ }).textContent()).match(
        /\d+/,
      )[0],
    );

  // 1. Bare app → a new project → three pieces from Add a piece.
  await page.goto(url);
  await page.getByRole('button', { name: 'Create a new project', exact: true }).click();
  await dlg.locator('input').fill(`Panel ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  for (const name of ['Sideboard', 'Wardrobe', 'Bookcase']) {
    await sheet(true);
    await side.getByRole('button', { name: 'Add a piece', exact: true }).click();
    await dlg.getByRole('searchbox', { name: 'Search the items' }).fill(name);
    await dlg.locator('.start-group .row-btn').first().click();
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
    const place = page.getByRole('button', { name: 'Place to the right', exact: true });
    if (await place.isVisible().catch(() => false)) await place.click();
    await page.waitForTimeout(300);
  }
  await sheet(true);

  if (!phone) {
    // 2. Add a piece, the toolbar and an open Position in the first 900 px of the panel.
    const top = (await side.boundingBox()).y;
    const within900 = async (loc) => {
      const b = await loc.boundingBox();
      return !!b && b.y + b.height - top <= 900;
    };
    const tools = card.getByRole('group', { name: 'Arrange this piece' });
    const position = card.locator('details.group', {
      has: page.locator('summary', { hasText: 'Position' }),
    });
    check(
      width,
      'Add a piece, the toolbar and an open Position in the first 900 px',
      (await within900(side.getByRole('button', { name: 'Add a piece', exact: true }))) &&
        (await within900(tools)) &&
        (await position.evaluate((d) => d.open)) &&
        (await within900(position.locator(':scope > summary'))),
    );
    const names = [
      'Duplicate',
      'Add a linked copy',
      'Turn 90° anticlockwise about its centre',
      'Turn 90° clockwise about its centre',
      'Mirror',
    ];
    let all = true;
    for (const n of names)
      all &&= await tools.getByRole('button', { name: n, exact: true }).isVisible();
    check(width, 'Toolbar: Duplicate, Linked, Turn ↺, Turn ↻, Mirror', all);
    await shot('selected');

    // 3. Gone: How many, Rotation (°), the quarter-turn buttons. Move to: working actions and "N more are off".
    check(
      width,
      'No How many, Rotation (°) or 0°/90°/180°/270° buttons',
      (await card.getByText('How many', { exact: true }).count()) === 0 &&
        (await card.getByLabel('Rotation (°)').count()) === 0 &&
        (await card.getByRole('radio', { name: '90°', exact: true }).count()) === 0,
    );
    const moveTo = card.getByRole('group', { name: 'Move to' });
    const off = moveTo.getByText(/^\d+ more (is|are) off$/);
    const disabled = await moveTo.locator('button[aria-disabled="true"]').count();
    await off.click();
    const reasons = await moveTo.locator('.move-to-off li').count();
    check(
      width,
      'Move to shows working actions only, the rest with reasons',
      disabled === 0 && reasons > 0,
      `${reasons} reasons`,
    );

    // 4. More actions: each works.
    const more = card.getByRole('button', { name: 'More actions' });
    const menu = card.getByRole('group', { name: 'More actions' });
    await more.click();
    await shot('menu');
    await menu.getByRole('button', { name: 'Lock size' }).click();
    await more.click();
    const unlock = await menu.getByRole('button', { name: 'Unlock size' }).isVisible();
    await menu.getByRole('button', { name: 'Unlock size' }).click();
    check(width, 'More actions › Lock size locks and unlocks the size', unlock);
    await more.click();
    await menu.getByRole('button', { name: 'Replace…' }).click();
    const replaceOpen = await page.getByRole('dialog', { name: /^Replace / }).isVisible();
    await page.keyboard.press('Escape');
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
    await more.click();
    await menu.getByRole('button', { name: 'Save to catalog' }).click();
    const saveOpen = await page.getByRole('dialog', { name: 'Save to catalog' }).isVisible();
    await page.keyboard.press('Escape');
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
    check(
      width,
      'More actions › Replace… and Save to catalog open their dialogs',
      replaceOpen && saveOpen,
    );

    // 5. Previous and next step through the pieces; All pieces shows the list.
    const step = side.getByRole('navigation', { name: 'Pieces' });
    const at = async () => (await step.locator('.num').textContent()).replace(/\s/g, '');
    const before = await at();
    await step.getByRole('button', { name: 'Next piece' }).click();
    const next = await at();
    await step.getByRole('button', { name: 'Previous piece' }).click();
    check(
      width,
      'Previous and next step through the pieces',
      next !== before && (await at()) === before,
      `${before} → ${next}`,
    );
    await side.getByRole('button', { name: /^All pieces/ }).click();
    const list = side.getByRole('list', { name: 'Pieces' });
    check(width, 'All pieces shows the list', (await list.getByRole('listitem').count()) === 3);
    await list.getByRole('button').first().click();

    // 6. Delete asks, then removes; More actions › Remove from project does the same.
    await card.getByRole('heading').first().click();
    await page.keyboard.press('Delete');
    await dlg.getByRole('button', { name: 'Remove', exact: true }).click();
    await page.waitForTimeout(300);
    const afterDelete = await side
      .getByRole('list', { name: 'Pieces' })
      .getByRole('listitem')
      .count();
    check(
      width,
      'Delete asks, then removes the selected piece',
      afterDelete === 2,
      `${afterDelete} left`,
    );
    await side.getByRole('list', { name: 'Pieces' }).getByRole('button').first().click();
    await more.click();
    await menu.getByRole('button', { name: 'Remove from project' }).click();
    await dlg.getByRole('button', { name: 'Remove', exact: true }).click();
    await page.waitForTimeout(300);
    check(
      width,
      'More actions › Remove from project removes the piece',
      (await side.getByRole('list', { name: 'Pieces' }).getByRole('listitem').count()) === 1,
    );

    // 7. A set room is a closed fold whose summary names shape and sizes.
    await side.getByRole('button', { name: 'Add the room' }).click();
    const room = side.getByRole('region', { name: 'Room' });
    const fold = room.locator('details.room-fold');
    const sum = await fold.locator('summary').textContent();
    check(
      width,
      'Room set: closed fold named by shape and sizes',
      !(await fold.evaluate((d) => d.open)) && /Rectangle · \d+ × \d+ × \d+ mm/.test(sum),
      sum.replace(/\s+/g, ' ').trim(),
    );
    await shot('room');

    // 8. A single piece's space: Divide this space before Contents, Layouts closed.
    await page.goto(url);
    await page
      .getByRole('link', { name: 'Projects' })
      .first()
      .click()
      .catch(() => {});
    await page.getByRole('button', { name: 'New single piece' }).click();
    await page
      .getByRole('button', { name: /Wall cabinet: 2 doors \+ shelf/ })
      .first()
      .click();
    await side.locator('.row-btn:visible').first().click();
    const divide = side.getByRole('region', { name: 'Divide this space' });
    const contents = side.getByRole('region', { name: 'Contents' });
    const order = await divide.evaluate(
      (d, c) => !!(d.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING),
      await contents.elementHandle(),
    );
    const layouts = side.locator('details', {
      has: page.locator('summary', { hasText: 'Layouts' }),
    });
    check(
      width,
      'Single piece: Divide this space before Contents, Layouts closed',
      order && !(await layouts.evaluate((d) => d.open)),
    );
    await shot('single');
  } else {
    // 9. Phone: Duplicate in the peek row adds a piece with the sheet closed.
    const n = await pieceCount().catch(() => null);
    await sheet(false);
    const dup = page.getByRole('button', { name: /^Duplicate / });
    await dup.click();
    await page.waitForTimeout(300);
    const closed = (await peek.getAttribute('aria-expanded')) === 'false';
    await sheet(true);
    const m = await pieceCount();
    check(
      width,
      'Peek row Duplicate adds a piece, sheet closed',
      closed && n !== null && m === n + 1,
      `${n} → ${m}`,
    );
    await sheet(false);
    await shot('peek');
    check(
      width,
      'No horizontal scroll',
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    );
  }
  check(width, 'No page errors', errors.length === 0, errors.join('; '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
