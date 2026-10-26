// Find-it acceptance for drilling into a piece without leaving the project editor (ADR-088, backlog N84), run against
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

  // 2b. The piece's size, boards and construction from the project editor (ADR-090): wider by 100 mm, still the
  //     project; one Undo takes it back.
  const planLabel = () => onPlan.getAttribute('aria-label');
  const label0 = await planLabel();
  await inside.getByRole('button', { name: 'Size, boards and construction' }).click();
  const settings = page.locator('dialog[open]');
  await settings.waitFor({ state: 'visible' });
  const widthField = settings.getByLabel('Width', { exact: true }).first();
  const w0 = Number(await widthField.inputValue());
  await widthField.fill(String(w0 + 100));
  await widthField.press('Enter');
  await page.waitForTimeout(300);
  await shot('piece-settings');
  await settings.getByRole('button', { name: 'Done' }).click();
  await page.waitForTimeout(300);
  const label1 = await planLabel();
  check(
    width,
    '"Size, boards and construction": Width +100 widens the piece in the project',
    label1.startsWith(`Sideboard, ${w0 + 100} by`) && (await inProject()),
    `${label0} → ${label1}`,
  );
  await sheet(false);
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.waitForTimeout(300);
  check(width, 'Undo takes the width back', (await planLabel()) === label0, await planLabel());

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
    // The space is outlined on the plan (its footprint) and on the room front view too (G-071).
    await page.getByRole('radio', { name: 'Plan' }).click();
    await page.waitForTimeout(300);
    const outlines = page.locator('.view.front [aria-label="Selected space inside the piece"]');
    check(
      width,
      'plan and room front view outline the selected space',
      (await outlines.count()) === 2 &&
        (await outlines.nth(0).isVisible()) &&
        (await outlines.nth(1).isVisible()),
      `${await outlines.count()} outlines`,
    );
    await shot('plan-space');
    // Taps on the room front view drill too: at the bay's spot, the bay (innermost) wraps to the whole piece, then
    // the bay again.
    const hit = page.locator('.view.front .front-hit').first();
    const tapFront = async () => {
      const b = await hit.boundingBox();
      await page.mouse.click(b.x + b.width * 0.83, b.y + b.height * 0.5);
      await page.waitForTimeout(300);
    };
    await tapFront();
    const wrapped = await inside.getByText('Selected: Whole cabinet').isVisible();
    await tapFront();
    const again = await inside
      .getByRole('heading')
      .first()
      .innerText()
      .catch(() => '');
    check(
      width,
      'room front view: taps drill (bay → whole piece → bay), still the project editor',
      wrapped && again === 'Shelves' && (await inProject()),
      `${wrapped} / ${again}`,
    );
    await page.getByRole('radio', { name: '3D', exact: true }).click();
    await canvas.waitFor({ state: 'visible' });
    await page.waitForTimeout(800);
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

  // 4. Phone: 3D is in Build & Preview, its card docked under the view (G-070); a tap there drills, and Compose's
  //    project panel shows the space.
  if (phone) {
    await page.getByRole('radio', { name: /Build & Preview/ }).click();
    const canvas = page.locator('.view.three canvas');
    await canvas.waitFor({ state: 'visible', timeout: 20000 });
    await page.waitForTimeout(1500);
    const card = page.locator('#count-dock').getByRole('group', { name: 'Quick counts' });
    check(width, '3D: "Quick counts" over the project 3D view', await card.isVisible());
    const r = await canvas.boundingBox();
    const v = await page.locator('.view.three').boundingBox();
    check(
      width,
      'phone: the card is docked under the 3D view (G-070)',
      (await card.boundingBox()).y >= v.y + v.height - 1,
    );
    await page.mouse.click(r.x + r.width * 0.62, r.y + r.height * 0.6);
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
