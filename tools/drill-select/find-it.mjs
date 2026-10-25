// Find-it acceptance for outside-in selection (ADR-083, backlog N78), run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/drill-select/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
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

for (const width of [390, 1280]) {
  const phone = width < 500;
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ck = (name, ok, detail) => check(width, name, ok, detail);
  // What is selected, by visible text: the phone sheet's peek row, or the side inspector on a desktop.
  const said = () => (phone ? page.locator('.sheet-peek') : page.locator('aside.side')).innerText();

  // 1. Bare app → New single piece → Wardrobe (two bays; the left bay divided into a top and a hanging space).
  await page.goto(url);
  await page.getByRole('button', { name: 'New single piece' }).click();
  await page
    .locator('dialog[open]')
    .getByRole('button', { name: /Wardrobe/ })
    .first()
    .click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await page.getByRole('radio', { name: 'Compose' }).click();
  ck('front view shown', await page.locator('figure.elevation').isVisible());

  // 2. Three taps at one spot in the hanging space, then a fourth.
  // The spot is measured before each tap: on a phone the sheet opening on a selection moves the drawing.
  const hanging = page.getByRole('button', { name: /^Hanging space, / });
  const tap = async () => {
    const b = await hanging.boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height * 0.25);
    await page.waitForTimeout(250);
  };
  await tap();
  let t = await said();
  ck('1st tap: whole piece', t.includes('Selected: Whole cabinet'), t.slice(0, 80));
  ck('whole piece outlined', (await page.locator('.el-selection').count()) === 1);
  await page.screenshot({ path: `${out}/drill-1-${width}.png` });
  await tap();
  t = await said();
  ck(
    '2nd tap: the left bay',
    phone ? t.includes('Selected: Divided space') : /Interior\s*\/?\s*Divided/.test(t),
    t.slice(0, 80),
  );
  await tap();
  t = await said();
  ck(
    '3rd tap: the hanging space',
    phone ? t.includes('Selected: Hanging') : /Divided\s*\/?\s*Hanging/.test(t),
    t.slice(0, 80),
  );
  ck('hanging space marked selected', (await hanging.getAttribute('aria-pressed')) === 'true');
  await page.screenshot({ path: `${out}/drill-3-${width}.png` });
  await tap();
  t = await said();
  ck('4th tap: whole piece again', t.includes('Selected: Whole cabinet'), t.slice(0, 80));

  // 3. A tap in the right bay after the left bay is selected selects the right bay.
  await tap();
  const right = page.getByRole('button', { name: /shelves space, / });
  const r = await right.boundingBox();
  await page.mouse.click(r.x + r.width / 2, r.y + r.height * 0.25);
  await page.waitForTimeout(150);
  ck(
    'tap in the other bay selects that bay',
    (await right.getAttribute('aria-pressed')) === 'true',
  );

  // 3b. The same taps in 3D (phone, Build & Preview): the peek row names the selection.
  if (phone) {
    await page.getByRole('radio', { name: /Build & Preview/ }).click();
    await page.waitForTimeout(2500);
    const c = await page.locator('canvas').first().boundingBox();
    const seen = [];
    for (let i = 0; i < 4; i++) {
      await page.mouse.click(c.x + c.width * 0.4, c.y + c.height * 0.6);
      await page.waitForTimeout(500);
      seen.push((await said()).split('\n')[0].replace('Selected: ', ''));
    }
    // The tap before these left the right bay selected; the 1st 3D tap lands in the left bay.
    ck(
      '3D: taps at one spot drill in and wrap',
      seen.join(' › ') === 'Divided space › Hanging › Whole cabinet › Divided space',
      seen.join(' › '),
    );
    await page.getByRole('radio', { name: 'Compose' }).click();
  }

  // 4. A project (ADR-083, G-052): the 1st tap on a piece selects it, a 2nd tap opens it, whole piece selected.
  const dlg = page.locator('dialog[open]');
  const peek = page.locator('.sheet-peek');
  const sheet = async (open) => {
    if (phone && (await peek.getAttribute('aria-expanded')) !== String(open)) await peek.click();
    await page.waitForTimeout(200);
  };
  await page.goto(url);
  await page.getByRole('button', { name: 'Create a new project', exact: true }).click();
  await dlg.locator('input').fill(`Drill ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await sheet(true);
  await page.getByRole('button', { name: 'Add a piece', exact: true }).click();
  await dlg.getByRole('searchbox', { name: 'Search the items' }).fill('Wardrobe');
  await dlg.locator('.start-group .row-btn').first().click();
  await dlg.waitFor({ state: 'detached' }).catch(() => {});
  const place = page.getByRole('button', { name: 'Place to the right', exact: true });
  if (await place.isVisible()) await place.click();
  await sheet(false);
  const planRadio = page.getByRole('radio', { name: 'Plan' });
  if (await planRadio.isVisible().catch(() => false)) await planRadio.click();
  const onPlan = page.locator('g.plan-piece', { hasText: 'Wardrobe' }).first();
  const tapPlan = async () => {
    const p = await onPlan.boundingBox();
    await page.mouse.click(p.x + p.width / 2, p.y + p.height / 2);
    await page.waitForTimeout(250);
  };
  // A piece just added is already selected (the 1st tap); one more tap opens it.
  ck(
    'project: the added piece is selected',
    (await onPlan.getAttribute('aria-pressed')) === 'true',
  );
  await tapPlan();
  t = await said();
  ck(
    'project: a tap on the selected piece opens it, whole piece selected',
    t.includes('Selected: Whole cabinet'),
    t.slice(0, 80),
  );
  await page.screenshot({ path: `${out}/drill-project-${width}.png` });

  ck(
    'no horizontal scroll',
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  );
  ck('no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
