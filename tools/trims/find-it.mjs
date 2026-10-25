// Find-it acceptance for trims and a worktop over part of a run (ADR-075, backlog N70), run against a production
// build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/trims/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
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
const flat = (s) => s.replace(/\s+/g, ' ').trim();

for (const width of [375, 390, 1280, 1440]) {
  const phone = width < 500;
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const btn = (name) => page.getByRole('button', { name });
  const dlg = page.locator('dialog[open]');
  const click = async (l) => {
    await l.scrollIntoViewIfNeeded();
    await l.click();
  };
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const shot = (name) =>
    page.screenshot({ path: `${out}/trims-${name}-${width}.png`, fullPage: true });
  const openSheet = async () => {
    const peek = page.locator('.sheet-peek');
    if ((await peek.isVisible()) && (await peek.getAttribute('aria-expanded')) === 'false')
      await peek.click();
  };
  const addPiece = async (search) => {
    await openSheet();
    await click(btn('Add a piece'));
    await dlg.getByRole('searchbox', { name: 'Search the items' }).fill(search);
    await dlg.locator('.start-group .row-btn').first().click();
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
    if (await btn('Place to the right').isVisible()) await click(btn('Place to the right'));
    await page.waitForTimeout(150);
  };

  // 1. Bare app → new project → three base cabinets and two wall cabinets side by side.
  await page.goto(url);
  await click(btn('Create a new project'));
  await page.locator('dialog[open] input').fill(`Trims ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  for (const s of ['Base cabinet', 'Base cabinet', 'Base cabinet', 'Wall cabinet', 'Wall cabinet'])
    await addPiece(s);

  // 2. Configure → Run parts: "Add worktop over…", tick two of the three base units.
  await page.getByRole('radio', { name: 'Configure' }).click();
  const runParts = page.getByRole('region', { name: 'Run parts' });
  await runParts.waitFor({ state: 'visible' });
  const addWt = runParts.getByRole('button', { name: 'Add worktop over…' });
  await addWt.scrollIntoViewIfNeeded();
  check(width, 'Run parts has "Add worktop over…"', await addWt.isVisible());
  check(
    width,
    'Run parts has "Add trim…"',
    await runParts.getByRole('button', { name: 'Add trim…' }).isVisible(),
  );
  await click(addWt);
  const pick = runParts.locator('fieldset.run-pick');
  const boxes = pick.getByRole('checkbox');
  check(
    width,
    'the three base cabinets are offered',
    (await boxes.count()) === 3,
    `${await boxes.count()}`,
  );
  await boxes.nth(1).check();
  await boxes.nth(2).check();
  await click(runParts.getByRole('button', { name: 'Add worktop', exact: true }));
  await page.waitForTimeout(200);
  const list = runParts.locator('ul.run-list');
  const wtRow = list.locator('li', { hasText: 'Worktop' });
  const wtText = (await wtRow.count()) ? flat(await wtRow.first().innerText()) : '';
  check(
    width,
    // Two 600 mm units; the right one ends the run, so the worktop also covers its 18 mm cover panel.
    'one Worktop over the 2 ticked pieces (1200 mm + an end cover panel)',
    (await wtRow.count()) === 1 && /over 2 pieces, 12(00|18) mm long/.test(wtText),
    wtText,
  );
  await shot('worktop');

  // 3. Overhang: "Front overhang" 40 mm makes the worktop 20 mm deeper.
  const [, w0, d0] = (/(\d+) × 38 × (\d+)/.exec(wtText) ?? []).map(Number);
  await click(wtRow.getByRole('button', { name: /^Overhang: 20 mm front, 0 mm sides/ }));
  const fo = wtRow.getByRole('textbox', { name: 'Front overhang' });
  await fo.fill('40');
  await fo.press('Enter');
  await page.waitForTimeout(200);
  const wtText2 = flat(await list.locator('li', { hasText: 'Worktop' }).first().innerText());
  check(
    width,
    'Front overhang 40 mm: the worktop is 20 mm deeper',
    new RegExp(`${w0} × 38 × ${d0 + 20}`).test(wtText2) && /overhang 40 mm front/.test(wtText2),
    wtText2,
  );

  // 4. "Add trim…": Crown over the two wall cabinets, height typed by the user (no default).
  await click(runParts.getByRole('button', { name: 'Add trim…' }));
  await click(runParts.getByRole('radio', { name: 'Crown' }));
  const height = runParts.getByRole('textbox', { name: 'Trim height' });
  check(width, 'Trim height starts empty (no default)', (await height.inputValue()) === '');
  const tb = runParts.locator('fieldset.run-pick').getByRole('checkbox');
  check(
    width,
    'the two wall cabinets are offered for trims',
    (await tb.count()) === 2,
    `${await tb.count()}`,
  );
  await tb.nth(0).check();
  await tb.nth(1).check();
  const addTrim = runParts.getByRole('button', { name: 'Add trim', exact: true });
  check(width, '"Add trim" waits for a height', await addTrim.isDisabled());
  await height.fill('60');
  await click(addTrim);
  await page.waitForTimeout(200);
  const crown = list.locator('li', { hasText: 'Crown' });
  const crownText = (await crown.count()) ? flat(await crown.first().innerText()) : '';
  check(
    width,
    'Crown 1600 × 60 listed in Run parts, in the door board (18 mm)',
    /1600 × 60 × 18/.test(crownText),
    crownText,
  );
  // Ceiling filler asks for the room height first; a pelmet under one wall cabinet.
  await click(runParts.getByRole('button', { name: 'Add trim…' }));
  await click(runParts.getByRole('radio', { name: 'Ceiling filler' }));
  check(
    width,
    'Ceiling filler says it needs the room height',
    await runParts.getByText('Needs the room height').isVisible(),
  );
  await click(runParts.getByRole('radio', { name: 'Pelmet' }));
  await runParts.locator('fieldset.run-pick').getByRole('checkbox').nth(0).check();
  await runParts.getByRole('textbox', { name: 'Trim height' }).fill('40');
  await click(runParts.getByRole('button', { name: 'Add trim', exact: true }));
  await page.waitForTimeout(200);
  const pelmet = list.locator('li', { hasText: 'Pelmet' });
  const pelmetText = (await pelmet.count()) ? flat(await pelmet.first().innerText()) : '';
  check(width, 'Pelmet 800 × 40 listed in Run parts', /800 × 40 × 18/.test(pelmetText), pelmetText);
  check(width, 'no sideways scroll (Run parts)', await noSideScroll());
  await shot('trims');

  // 5. Build & Preview → Parts: the worktop and the trims are cut-list rows.
  await page.getByRole('radio', { name: /Build & Preview/ }).click();
  await page.waitForTimeout(400);
  const partsTab = page.getByRole('tab', { name: /^Parts/ });
  if (await partsTab.isVisible().catch(() => false)) await partsTab.click({ timeout: 30000 });
  await page.waitForTimeout(200);
  const body = await page.locator('body').innerText();
  for (const t of ['Run: Worktop', 'Run: Crown', 'Run: Pelmet'])
    check(width, `Parts list has "${t}"`, body.includes(t));
  check(width, 'no sideways scroll (Parts)', await noSideScroll());
  await shot('parts');
  check(width, 'no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
