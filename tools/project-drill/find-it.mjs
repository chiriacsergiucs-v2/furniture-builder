// Find-it acceptance for drilling into a piece without leaving the project editor (ADR-088, backlog N83), run against
// a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/project-drill/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text. Not part of `pnpm test`.
// The user's steps: edit a project, tap a piece, tap it again → still the project editor, with the space's controls.
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
  const shot = (name) => page.screenshot({ path: `${out}/project-drill-${name}-${width}.png` });
  const dlg = page.locator('dialog[open]');
  const peek = page.locator('.sheet-peek');
  const sheet = async (open) => {
    if (phone && (await peek.getAttribute('aria-expanded')) !== String(open)) await peek.click();
    await page.waitForTimeout(250);
  };
  const inside = page.getByRole('region', { name: 'Inside this piece' });
  const inProject = () => page.getByRole('heading', { name: 'Project', exact: true }).isVisible();
  const partsCount = async () =>
    Number((await page.getByRole('tab', { name: /^Parts/ }).innerText()).replace(/\D+/g, ''));

  // 1. Bare app → a new project with a Sideboard in it.
  await page.goto(url);
  await page.getByRole('button', { name: 'Create a new project', exact: true }).click();
  await dlg.locator('input').fill(`Living ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await sheet(true);
  await page.getByRole('button', { name: 'Add a piece', exact: true }).click();
  await dlg.getByRole('searchbox', { name: 'Search the items' }).fill('Sideboard');
  await dlg.locator('.start-group .row-btn').first().click();
  await dlg.waitFor({ state: 'detached' }).catch(() => {});
  const place = page.getByRole('button', { name: 'Place to the right', exact: true });
  if (await place.isVisible()) await place.click();
  await sheet(false);

  // 2. The plan (no height): the 1st tap selects the whole piece, the 2nd its interior; the project stays open.
  const planRadio = page.getByRole('radio', { name: 'Plan' });
  if (await planRadio.isVisible().catch(() => false)) await planRadio.click();
  const onPlan = page.locator('g.plan-piece', { hasText: 'Sideboard' }).first();
  const tapPlan = async () => {
    const p = await onPlan.boundingBox();
    await page.mouse.click(p.x + p.width / 2, p.y + p.height / 2);
    await page.waitForTimeout(300);
  };
  // A piece just added is already selected; the next tap is the whole piece, inside the project.
  await tapPlan();
  await sheet(true);
  check(width, 'plan, 1st tap: "Inside this piece" in the project panel', await inside.isVisible());
  check(
    width,
    'plan, 1st tap: whole piece selected',
    (await inside.getByText('Selected: Whole cabinet').isVisible()) && (await inProject()),
  );
  await sheet(false);
  await tapPlan();
  await sheet(true);
  check(
    width,
    'plan, 2nd tap: the interior ("Divided space"), still the project editor',
    (await inside.getByRole('heading', { name: 'Divided space' }).isVisible()) &&
      (await inProject()),
  );
  await shot('plan');
  await sheet(false);

  // 3. 3D (desktop, beside the panel): from the interior, a tap selects the bay under it; still the project.
  if (!phone) {
    await page.getByRole('radio', { name: '3D', exact: true }).click();
    const canvas = page.locator('.view.three canvas');
    await canvas.waitFor({ state: 'visible', timeout: 20000 });
    await page.getByRole('radio', { name: 'Simple' }).click();
    await page.waitForTimeout(1500);
    const tap = async () => {
      const r = await canvas.boundingBox();
      await page.mouse.click(r.x + r.width * 0.62, r.y + r.height * 0.6);
      await page.waitForTimeout(500);
    };
    const sel = () =>
      inside
        .getByRole('heading')
        .first()
        .innerText()
        .catch(() => '');
    await tap();
    const second = await sel();
    check(
      width,
      '3D, a further tap: a space inside the piece, still the project editor',
      (await inside.isVisible()) && second === 'Shelves' && (await inProject()),
      second,
    );
    const card = page.locator('.view.three').getByRole('group', { name: 'Quick counts' });
    check(width, '3D: "Quick counts" over the project 3D view', await card.isVisible());
    const before = await partsCount();
    await card.getByRole('button', { name: 'More shelves' }).click();
    await page.waitForTimeout(300);
    check(
      width,
      '"More shelves" adds a shelf to the project\'s parts',
      (await partsCount()) === before + 1,
      `${before} → ${await partsCount()}`,
    );
    await shot('3d');
    await page.getByRole('radio', { name: 'Compose' }).click();
    await page.waitForTimeout(200);
    check(width, '"Compose" still shows the project', await inProject());
    await page.getByRole('button', { name: 'Undo' }).click();
    await page.waitForTimeout(300);
    check(width, 'Undo takes the shelf back', (await partsCount()) === before);
    await tap();
    check(
      width,
      '3D, the next tap: the whole piece again',
      await inside.getByText('Selected: Whole cabinet').isVisible(),
    );
    await page.getByRole('button', { name: 'Edit this piece' }).click();
    await page.waitForTimeout(300);
    check(width, '"Edit this piece" still opens the piece editor', !(await inProject()));
  }

  // 4. Phone: 3D is in Build & Preview; a tap there drills (just below the card, which covers much of the short
  //    view, ADR-085), and Compose's project panel shows the space.
  if (phone) {
    await page.getByRole('radio', { name: /Build & Preview/ }).click();
    const canvas = page.locator('.view.three canvas');
    await canvas.waitFor({ state: 'visible', timeout: 20000 });
    await page.waitForTimeout(1500);
    const card = page.locator('.view.three').getByRole('group', { name: 'Quick counts' });
    check(width, '3D: "Quick counts" over the project 3D view', await card.isVisible());
    const r = await canvas.boundingBox();
    const cb = await card.boundingBox();
    const fy = Math.min(0.92, Math.max(0.6, (cb.y + cb.height + 14 - r.y) / r.height));
    await page.mouse.click(r.x + r.width * 0.62, r.y + r.height * fy);
    await page.waitForTimeout(500);
    await shot('3d');
    await page.getByRole('radio', { name: 'Compose' }).click();
    await sheet(true);
    const h = await inside
      .getByRole('heading')
      .first()
      .innerText()
      .catch(() => '');
    check(
      width,
      '3D tap, then Compose: the project panel shows the space inside the piece',
      (await inProject()) && ['Shelves', 'Drawers'].includes(h),
      h,
    );
  }

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
