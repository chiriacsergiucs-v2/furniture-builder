// Find-it acceptance for value sets (CLAUDE.md R3, backlog N169, ADR-167; Acceptance: browser), against a
// production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/variables/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// From the bare app, by visible text, at 1280 and 390 px: a project with two base cabinets in a 3000-wide room; a
// variable `bottom height = 400` bound to the first cabinet's Height; Add set → value 450 → a third cabinet 450 high
// and a second room outline to the right in the plan (tagged "Set 2") and in 3D; the duplicate's card says to edit
// the set-1 piece; Save as separate project → Remove → one bound cabinet left; the new project opens from Projects
// with the cabinet 450 high; no horizontal scroll at 390 px.
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
  const shot = (name) => page.screenshot({ path: `${out}/variables-${name}-${width}.png` });
  const dlg = page.locator('dialog[open]');
  const side = page.getByRole('complementary', { name: 'Compose' });
  const card = side.getByRole('region', { name: /^Selected piece: / });
  const peek = page.locator('.sheet-peek');
  const sheet = async (open) => {
    if (!phone) return;
    if (((await peek.getAttribute('aria-expanded')) === 'true') !== open) await peek.click();
    await page.waitForTimeout(250);
  };
  const pieceCount = async () => {
    const all = side.getByRole('button', { name: /^All pieces \(\d+\)$/ });
    if (await all.isVisible().catch(() => false))
      return Number((await all.textContent()).match(/\d+/)[0]);
    return side.getByRole('list', { name: 'Pieces' }).getByRole('listitem').count();
  };

  // 1. A new project with two base cabinets and the room.
  await page.goto(url);
  await page.getByRole('button', { name: 'Create a new project', exact: true }).click();
  await dlg.locator('input').fill(`Sets ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  for (let i = 0; i < 2; i++) {
    await sheet(true);
    await side.getByRole('button', { name: 'Add a piece', exact: true }).click();
    await dlg.getByRole('searchbox', { name: 'Search the items' }).fill('Base cabinet');
    await dlg.locator('.start-group .row-btn').first().click();
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
    const place = page.getByRole('button', { name: 'Place to the right', exact: true });
    if (await place.isVisible().catch(() => false)) await place.click();
    await page.waitForTimeout(300);
  }
  await sheet(true);
  await side.getByRole('button', { name: 'Add the room' }).click();
  await page.waitForTimeout(300);
  check(width, 'Two cabinets and a room', (await pieceCount()) === 2);

  // 2. A variable, bound to the selected cabinet's Height.
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: /^Settings: / });
  await settings.getByLabel('New variable').fill('bottom height');
  await settings.getByLabel('Value or formula').fill('400');
  await settings.getByRole('button', { name: 'Add variable' }).click();
  await settings.getByRole('button', { name: 'Done' }).click();
  await sheet(true);
  await card.getByRole('button', { name: 'Bind Height to a variable' }).click();
  await page.getByRole('button', { name: /^bottom height = 400/ }).click();
  await page.getByRole('button', { name: 'Bind', exact: true }).click();
  await page.waitForTimeout(300);
  check(
    width,
    'Height bound: field reads bottom height = 400',
    (await card.getByText('bottom height = 400').count()) === 1 &&
      (await card.getByLabel('Height', { exact: true }).inputValue()) === '400',
  );

  // 3. Add set, value 450 → a third cabinet 450 high, a second room tagged Set 2 in the plan.
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await settings.getByRole('button', { name: 'Add set' }).click();
  const v = settings.getByLabel('Set 2: value of bottom height');
  await v.fill('450');
  await v.blur();
  await page.waitForTimeout(400);
  check(
    width,
    'Set 2 card: 1 piece, Select them, Save as separate project on',
    (await settings.getByText('1 piece', { exact: true }).count()) === 1 &&
      (await settings.getByRole('button', { name: 'Select them' }).count()) === 1 &&
      (await settings.getByRole('button', { name: 'Save as separate project' }).isEnabled()),
  );
  await shot('set-card');
  await settings.getByRole('button', { name: 'Done' }).click();
  await sheet(true);
  check(width, 'Three cabinets', (await pieceCount()) === 3);
  const rooms = page.locator('.plan .room-outline, svg .room-outline');
  check(
    width,
    'Plan: two room outlines and a Set 2 tag',
    (await rooms.count()) === 2 &&
      (await page.locator('.set-tag', { hasText: 'Set 2' }).count()) === 1,
  );
  await sheet(false);
  await shot('plan');

  // 4. The duplicate's card: a copy of the set-1 piece, 450 high, size fields off, no Edit this piece.
  await sheet(true);
  await side.getByRole('button', { name: /^All pieces/ }).click();
  await side
    .getByRole('list', { name: 'Pieces' })
    .getByRole('button', { name: /Base cabinet/ })
    .last()
    .click();
  await page.waitForTimeout(300);
  check(
    width,
    'Duplicate card: Set 2 of …, 450 high, Height off, Go to it, no Edit this piece',
    (await card.getByText(/^Set 2 of Base cabinet/).count()) === 1 &&
      (await card.getByLabel('Height', { exact: true }).inputValue()) === '450' &&
      (await card.getByLabel('Height', { exact: true }).isDisabled()) &&
      (await card.getByRole('button', { name: 'Go to it' }).count()) === 1 &&
      (await card.getByRole('button', { name: 'Edit this piece' }).count()) === 0,
  );
  await shot('duplicate');

  // 5. 3D: two room floors.
  await sheet(false);
  await page.getByRole('radio', { name: '3D' }).first().click();
  await page.waitForTimeout(3000);
  check(
    width,
    '3D view drawn (canvas present, no page errors)',
    (await page.locator('canvas').count()) >= 1 && errors.length === 0,
  );
  await shot('3d');
  await page.getByRole('radio', { name: '2D' }).first().click();

  // 6. Save as separate project → Remove → one cabinet bound left, two pieces.
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await settings.getByRole('button', { name: 'Save as separate project' }).click();
  const ask = page.getByRole('dialog', { name: 'Confirm' });
  await ask.waitFor({ state: 'visible' });
  check(
    width,
    'Asks: Keep Set 2 in this project? with Keep and Remove',
    (await ask.getByText(/Keep Set 2 in this project\?/).count()) === 1 &&
      (await ask.getByRole('button', { name: 'Keep' }).count()) === 1,
  );
  await ask.getByRole('button', { name: 'Remove' }).click();
  await page.waitForTimeout(400);
  check(
    width,
    'Saved as “… — Set 2”, Remove took the set',
    (await settings.getByText(/Saved as “Sets \d+ — Set 2”/).count()) === 1 &&
      (await settings.getByRole('button', { name: 'Add set' }).count()) === 1 &&
      (await settings.getByText('1 piece', { exact: true }).count()) === 0,
  );
  await settings.getByRole('button', { name: 'Done' }).click();
  await sheet(true);
  check(width, 'Two pieces left', (await pieceCount()) === 2);

  // 7. The new project opens from Projects with the cabinet 450 high.
  await page
    .getByRole('link', { name: 'Projects' })
    .first()
    .click()
    .catch(() => {});
  await page
    .getByRole('button', { name: 'Projects' })
    .first()
    .click()
    .catch(() => {});
  await page
    .getByRole('button', { name: new RegExp(`Sets ${width} — Set 2`) })
    .first()
    .click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await sheet(true);
  // The bound cabinet was the selected (last added) one; its copy keeps that place in the list.
  const list = side.getByRole('list', { name: 'Pieces' });
  await list
    .getByRole('button', { name: /Base cabinet/ })
    .last()
    .click();
  await page.waitForTimeout(300);
  const h = await card.getByLabel('Height', { exact: true }).inputValue();
  const hint = await card.getByText('bottom height = 450').count();
  const setNote = await card.getByText(/^Set 2 of/).count();
  const title = await page.locator('header .bar, header').first().textContent();
  check(
    width,
    'New project: bound cabinet 450 high, no set',
    h === '450' && hint === 1 && setNote === 0,
    `height ${h}, hint ${hint}, set note ${setNote}, title ${(title ?? '').slice(0, 60)}`,
  );
  await shot('new-project');
  if (phone) {
    await sheet(false);
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
