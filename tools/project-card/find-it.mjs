// Find-it acceptance for the quick-count card over a project's drawing and "Doors" beside Snap (ADR-109,
// backlog N107), run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/project-card/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
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
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const shot = (name) => page.screenshot({ path: `${out}/project-card-${name}-${width}.png` });
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const dlg = page.locator('dialog[open]');
  const peek = page.locator('.sheet-peek');
  const sheet = async (open) => {
    if (phone && (await peek.getAttribute('aria-expanded')) !== String(open)) await peek.click();
    await page.waitForTimeout(250);
  };
  const front = page.locator('.view.front');
  const card = front.getByRole('group', { name: 'Quick counts' });
  const size = card.getByRole('group', { name: 'Size of the whole piece' });
  // On screen, not covered by the bottom sheet: the element at the card's centre is the card itself.
  const inView = (loc) =>
    loc.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(
        r.left + r.width / 2,
        r.top + Math.min(20, r.height / 2),
      );
      return r.bottom <= window.innerHeight && r.top >= 0 && !!hit && el.contains(hit);
    });

  // 1. Bare app → a new project → Add a piece → Sideboard from the catalog.
  await page.goto(url);
  await page.getByRole('button', { name: 'Create a new project', exact: true }).click();
  await dlg.locator('input').fill(`Card ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await page.getByRole('radio', { name: 'Compose' }).click();
  await sheet(true);
  await page.getByRole('button', { name: 'Add a piece', exact: true }).click();
  await dlg.getByRole('searchbox', { name: 'Search the items' }).fill('Sideboard');
  await dlg.locator('.start-group .row-btn').first().click();
  await dlg.waitFor({ state: 'detached' }).catch(() => {});
  const place = page.getByRole('button', { name: 'Place to the right', exact: true });
  if (await place.isVisible()) await place.click();
  await sheet(false);
  const planRadio = page.getByRole('radio', { name: 'Plan' });
  if (await planRadio.isVisible().catch(() => false)) await planRadio.click();

  // 2. "Doors" sits in one row with Snap, Select and Clearances (G-134).
  const doors = front.getByText('Doors', { exact: true });
  const snap = front.getByRole('button', { name: 'Snap', exact: true });
  const [db, sb] = [await doors.boundingBox(), await snap.boundingBox()];
  check(
    width,
    '"Doors" in the row with "Snap"',
    !!db && !!sb && Math.abs(db.y + db.height / 2 - (sb.y + sb.height / 2)) < sb.height / 2,
    db && sb ? `doors y ${Math.round(db.y)}, snap y ${Math.round(sb.y)}` : 'not found',
  );
  check(
    width,
    'only one doors toggle',
    (await page.getByText(/^Doors( and fronts)?$/).count()) === 1,
  );
  const clear = front.getByText('Clearances', { exact: true });
  const cb = await clear.boundingBox();
  check(
    width,
    '"Clearances" on the same row too',
    !!cb && !!sb && Math.abs(cb.y + cb.height / 2 - (sb.y + sb.height / 2)) < sb.height / 2,
    cb && sb ? `clearances y ${Math.round(cb.y)}, snap y ${Math.round(sb.y)}` : 'not found',
  );
  const fronts0 = await front.locator('polygon.el-front').count();
  await doors.click();
  await page.waitForTimeout(300);
  check(
    width,
    'unticking it hides the doors in the front view',
    fronts0 > 0 && (await front.locator('polygon.el-front').count()) === 0,
    `${fronts0} fronts before`,
  );
  await doors.click();
  await page.waitForTimeout(300);
  await shot('row');

  // 3. One tap on the piece in the front view: the card floats over the drawing with Width and Depth.
  const piece = front.getByRole('button', { name: /^Sideboard, \d+ wide/ });
  const tapPiece = async (fx = 0.5, fy = 0.5) => {
    const b = await piece.boundingBox();
    await page.mouse.click(b.x + b.width * fx, b.y + b.height * fy);
    await page.waitForTimeout(400);
  };
  await tapPiece();
  check(
    width,
    '1st tap: the card over the drawing has "Width" and "Depth"',
    (await size.getByLabel('Width', { exact: true }).isVisible()) &&
      (await size.getByLabel('Depth', { exact: true }).isVisible()) &&
      (await inView(card)),
  );
  const w0 = Number(await size.getByLabel('Width', { exact: true }).inputValue());
  const field = size.getByLabel('Width', { exact: true });
  await field.fill(String(w0 + 200));
  await field.press('Enter');
  await page.waitForTimeout(400);
  check(
    width,
    'typing Width +200 in the card resizes the piece',
    (await front
      .getByRole('button', { name: new RegExp(`^Sideboard, ${w0 + 200} wide`) })
      .count()) === 1,
  );
  await shot('card');

  // 4. A further tap selects a space inside: the card keeps its counts and drops Width and Depth.
  await tapPiece(0.5, 0.5);
  check(
    width,
    'tap inside: the card has counts, no "Width"',
    (await card.isVisible()) && (await size.count()) === 0,
  );
  await shot('inside');

  // 5. Undo takes the width back in one step.
  await page.getByRole('button', { name: 'Undo' }).first().click();
  await page.waitForTimeout(400);
  check(
    width,
    'Undo: the piece is its old width again',
    (await front.getByRole('button', { name: new RegExp(`^Sideboard, ${w0} wide`) }).count()) === 1,
  );
  check(width, 'no sideways scroll', await noSideScroll());
  check(width, 'no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
