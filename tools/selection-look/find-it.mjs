// Find-it acceptance for the selection look (ADR-087, backlog N82), run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/selection-look/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text. Not part of `pnpm test`.
// The user's steps: tap the piece, tap a part of it, tap again → the whole piece is selected again, outlined, nothing
// faded, and the quick-count card names it and acts on it.
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
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const shot = (name) => page.screenshot({ path: `${out}/selection-look-${name}-${width}.png` });
  const front = page.locator('.view.front');
  const three = page.locator('.view.three');
  const card = (where) => where.getByRole('group', { name: 'Quick counts' });
  // What is selected: the phone sheet's peek row, or the desktop inspector ("Selected: …" or the space's heading).
  const said = async () => {
    const text = await (
      phone ? page.locator('.sheet-peek') : page.locator('aside.side')
    ).innerText();
    const line = text.split('\n').find((l) => l.startsWith('Selected: '));
    if (line) return line.replace('Selected: ', '').trim();
    return phone ? '' : (await page.locator('aside.side h2').first().innerText()).trim();
  };
  // The selection outline's width as a share of the piece's drawn width.
  const outlineShare = () =>
    front.evaluate((f) => {
      const o = f.querySelector('.el-selection')?.getBoundingClientRect();
      const ps = [...f.querySelectorAll('.el-panel')].map((p) => p.getBoundingClientRect());
      if (!o || !ps.length) return 0;
      const w = Math.max(...ps.map((r) => r.right)) - Math.min(...ps.map((r) => r.left));
      return o.width / w;
    });
  const valueOf = (where, label) => card(where).getByRole('status', { name: label }).innerText();

  // 1. Bare app → New single piece → Sideboard; Compose shows the front drawing.
  await page.goto(url);
  await page.getByRole('button', { name: 'New single piece' }).click();
  await page
    .locator('dialog[open]')
    .getByRole('button', { name: /Sideboard/ })
    .first()
    .click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await page.getByRole('radio', { name: 'Compose' }).click();

  // 2. Drawing: three taps at one spot in the right bay.
  const bay = front.getByRole('button', { name: /^1 shelf space/ }).last();
  const tap = async () => {
    const r = await bay.boundingBox();
    await page.mouse.click(r.x + r.width / 2, r.y + r.height * 0.7);
    await page.waitForTimeout(300);
  };
  const faded = () => front.locator('.faded').count();
  await tap();
  let share = await outlineShare();
  check(
    width,
    '1st tap: "Whole cabinet", outlined round the piece, nothing faded',
    (await said()) === 'Whole cabinet' && share > 0.95 && (await faded()) === 0,
    `${await said()}, outline ${share.toFixed(2)} of the piece`,
  );
  await tap();
  share = await outlineShare();
  check(
    width,
    '2nd tap: "Shelves", only the bay outlined, the rest faded',
    (await said()) === 'Shelves' && share < 0.6 && (await faded()) > 0,
    `${await said()}, outline ${share.toFixed(2)}, ${await faded()} faded`,
  );
  await shot('drawing-bay');
  await tap();
  share = await outlineShare();
  check(
    width,
    '3rd tap: "Whole cabinet" again, outlined round the piece, nothing faded',
    (await said()) === 'Whole cabinet' && share > 0.95 && (await faded()) === 0,
    `${await said()}, outline ${share.toFixed(2)}`,
  );
  await card(front).getByRole('button', { name: 'More vertical dividers' }).click();
  await page.waitForTimeout(200);
  check(
    width,
    'More vertical dividers acts on the whole cabinet (2 → 3)',
    (await valueOf(front, 'Vertical dividers')) === '3',
  );
  await card(front).getByRole('button', { name: 'Fewer vertical dividers' }).click();
  await page.waitForTimeout(200);

  // 3. 3D (phone: Build & Preview; desktop: Compose › 3D, beside the inspector): clear the selection with a tap on
  //    empty space, then three taps at one spot.
  if (phone) await page.getByRole('radio', { name: /Build & Preview/ }).click();
  else await page.getByRole('radio', { name: '3D', exact: true }).click();
  const canvas = three.locator('canvas');
  await canvas.waitFor({ state: 'visible', timeout: 20000 });
  const simple = page.getByRole('radio', { name: 'Simple' });
  if (await simple.isVisible().catch(() => false)) await simple.click();
  await page.waitForTimeout(1500);
  const at = async (fx, fy) => {
    const r = await canvas.boundingBox();
    await page.mouse.click(r.x + r.width * fx, r.y + r.height * fy);
    await page.waitForTimeout(500);
  };
  await at(0.03, 0.97);
  check(width, '3D: a tap on empty space clears the card', !(await card(three).isVisible()));
  // On a phone the card covers much of the short 3D view (ADR-085), and it moves with the selection; each later tap
  // goes just below it, in the same bay, as a user would tap the part of the piece still in sight.
  const titles = [];
  await at(0.62, 0.6);
  titles.push(await said());
  for (let i = 1; i < 3; i++) {
    const r = await canvas.boundingBox();
    const cb = await card(three).boundingBox();
    await at(0.62, Math.min(0.92, Math.max(0.6, (cb.y + cb.height + 14 - r.y) / r.height)));
    titles.push(await said());
    if (i === 1) await shot('3d-part');
  }
  check(
    width,
    '3D: whole piece → the bay → whole piece again',
    titles.join(' → ') === 'Whole cabinet → Shelves → Whole cabinet',
    titles.join(' → '),
  );
  await shot('3d-whole');
  check(
    width,
    'no sideways scroll',
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  );
  check(width, 'no page errors', errors.length === 0, errors.join(' / '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
