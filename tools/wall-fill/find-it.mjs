// Find-it acceptance for Fill a wall (CLAUDE.md R3, backlog N101, ADR-103), run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/wall-fill/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text: Projects → Fill a wall, a 3000 mm
// wall 2000 mm high, 4 suggested mixes with pictures (5 × 600 first, the tall cabinet warned), Refine with a max
// piece width of 550 and with 6 equal fronts, then Use this mix opens a saved project. Not part of `pnpm test`.
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

const widths = (process.argv[4] ?? '1440,390').split(',').map(Number);
for (const width of widths) {
  const phone = width < 500;
  const ctx = await browser.newContext({
    viewport: { width, height: phone ? 812 : 900 },
    hasTouch: phone,
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
    page
      .screenshot({ path: `${out}/wall-fill-${name}-${width}.png`, fullPage: true, timeout: 90000 })
      .catch(() => {});
  const dlg = page.locator('dialog[open]');
  const btn = (name, exact = true) => page.getByRole('button', { name, exact });
  const field = (label) => dlg.getByLabel(label, { exact: true });
  const cards = dlg.locator('.wf-card');
  const cardWidths = async () =>
    (await cards.locator('strong').allInnerTexts()).map((t) => t.split(' · ').map(Number));
  const pictures = async () =>
    dlg
      .locator('.wf-card img')
      .evaluateAll((imgs) => imgs.filter((i) => i.complete && i.naturalWidth > 0).length);

  // 1. Bare app → Projects → "Fill a wall"; also listed in the "Start something new" dialog.
  await page.goto(url);
  await page.getByRole('heading', { name: 'Projects', level: 1 }).waitFor();
  await btn('New single piece').click();
  check(
    width,
    '"Fill a wall" is listed in Start something new',
    await dlg
      .getByRole('button', { name: /^Fill a wall/ })
      .isVisible()
      .catch(() => false),
  );
  await dlg.getByRole('button', { name: 'Close' }).click();
  await dlg.waitFor({ state: 'detached' }).catch(() => {});
  const entry = btn('Fill a wall');
  check(width, '"Fill a wall" is found on Projects', await entry.isVisible().catch(() => false));
  await entry.click();
  await dlg.waitFor();

  // 2. The Wall step asks width, depth, height and the tall cabinet depth.
  for (const l of ['Width', 'Depth', 'Height', 'Tall cabinet depth'])
    check(
      width,
      `"${l}" field is found`,
      await field(l)
        .isVisible()
        .catch(() => false),
    );
  // Tall cabinet depth follows Depth until it is edited (review of ADR-103).
  await field('Depth').fill('600');
  check(
    width,
    'Tall cabinet depth follows Depth',
    (await field('Tall cabinet depth').inputValue()) === '600',
    await field('Tall cabinet depth').inputValue(),
  );
  await field('Depth').fill('560');
  await field('Width').fill('3000');
  await field('Height').fill('2000');
  await shot('wall');
  check(width, 'no sideways scroll (Wall)', await noSideScroll());

  // 3. Show suggestions: 4 mixes with pictures, 5 × 600 first, the tall cabinet above 2000 mm warned.
  await dlg.getByRole('button', { name: 'Show suggestions' }).click();
  await cards.first().waitFor();
  await page.waitForTimeout(300);
  const n = await cards.count();
  check(width, '4 suggested mixes', n === 4, `${n}`);
  check(width, 'every card has a picture', (await pictures()) === n, `${await pictures()}/${n}`);
  const first = await cards.first().innerText();
  check(
    width,
    'first mix is 600 · 600 · 600 · 600 · 600',
    first.includes('600 · 600 · 600 · 600 · 600'),
  );
  check(
    width,
    'first mix: 1 tall, 2 open shelves, 1 drawers, 1 door + shelves',
    first.includes('1 tall, 2 open shelves, 1 drawers, 1 door + shelves'),
  );
  check(
    width,
    'tall cabinet above the height shows a warning and stays offered',
    /200 mm above the 2000 mm height/.test(first),
  );
  check(
    width,
    'every mix fills exactly 3000 mm',
    (await cardWidths()).every((ws) => ws.reduce((a, b) => a + b, 0) === 3000),
  );
  await shot('mixes');
  check(width, 'no sideways scroll (Suggestions)', await noSideScroll());

  // 4. Refine → Max piece width 550 → Suggest again: the cards change and no piece is wider than 550.
  const before = await cards.locator('strong').allInnerTexts();
  await dlg.getByRole('button', { name: 'Refine' }).last().click();
  check(width, '"Max piece width" is found in Refine', await field('Max piece width').isVisible());
  check(width, '"Equal fronts" is found in Refine', await field('Equal fronts').isVisible());
  check(
    width,
    '"Tall cabinets stand" is found in Refine',
    await dlg
      .getByRole('radiogroup', { name: 'Tall cabinets stand' })
      .isVisible()
      .catch(() => false),
  );
  await shot('refine');
  check(width, 'no sideways scroll (Refine)', await noSideScroll());
  await field('Max piece width').fill('550');
  await dlg.getByRole('button', { name: 'Suggest again' }).click();
  await cards.first().waitFor();
  const after = await cards.locator('strong').allInnerTexts();
  check(width, 'Suggest again changes the cards', after.join('|') !== before.join('|'));
  check(
    width,
    'no piece wider than 550 mm',
    (await cardWidths()).every((ws) => ws.every((w) => w <= 550)),
    after.join(' / '),
  );

  // 5. Equal fronts 6, no tall cabinets: every card says 6 equal front widths.
  await dlg.getByRole('button', { name: 'Refine' }).last().click();
  await field('Max piece width').fill('1200');
  await field('Tall cabinets').fill('0');
  await field('Equal fronts').fill('6');
  await dlg.getByRole('button', { name: 'Suggest again' }).click();
  await cards.first().waitFor();
  const fronts = await cards.allInnerTexts();
  check(
    width,
    'Equal fronts 6 gives mixes with 6 equal front widths',
    fronts.length > 1 && fronts.every((t) => t.includes('6 equal front widths')),
    `${fronts.length} cards`,
  );
  await shot('fronts');

  // 6. Back to the default mixes, Use this mix: a saved project opens in the editor with its 5 pieces.
  await dlg.getByRole('button', { name: 'Refine' }).last().click();
  await field('Tall cabinets').fill('');
  await field('Equal fronts').fill('');
  await dlg.getByRole('button', { name: 'Suggest again' }).click();
  await cards.first().waitFor();
  await cards.first().getByRole('button', { name: 'Use this mix' }).click();
  await dlg.waitFor({ state: 'detached' }).catch(() => {});
  await page.locator('main.work').waitFor({ state: 'visible' });
  check(width, 'Use this mix opens the editor', await page.locator('main.work').isVisible());
  await shot('project');
  await page
    .getByRole('navigation', { name: 'Places' })
    .getByRole('link', { name: 'Projects' })
    .click();
  const saved = page.locator('.projects-page ul.library .row-btn', { hasText: 'Wall 3000 mm' });
  await saved
    .first()
    .waitFor({ timeout: 5000 })
    .catch(() => {});
  const savedText = await saved
    .first()
    .innerText()
    .catch(() => '');
  check(
    width,
    'the project is saved with 5 pieces',
    /5 pieces/.test(savedText),
    savedText.replace(/\s+/g, ' '),
  );

  check(width, 'no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
