// Find-it acceptance for the editor modes (ADR-079, backlog N74), run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/editor-modes/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
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

for (const width of [390, 1280, 360]) {
  const phone = width < 500;
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const shot = (name) => page.screenshot({ path: `${out}/modes-${name}-${width}.png` });
  const mode = (name) => page.getByRole('radio', { name });
  const side = page.locator('aside.side');
  const peek = page.locator('.sheet-peek');
  const canvases = () => page.locator('canvas').count();
  const group = (name) => side.locator('details.group > summary', { hasText: name });
  const box = async (l) => (await l.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };

  // 1. A new piece from the bare app; the three modes are there.
  await page.goto(url);
  await page.getByRole('button', { name: 'New single piece' }).click();
  await page
    .locator('dialog[open]')
    .getByRole('button', { name: /Chest of drawers/ })
    .first()
    .click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  check(
    width,
    'modes Compose · Configure · Build & Preview visible',
    (await mode('Compose').isVisible()) &&
      (await mode('Configure').isVisible()) &&
      (await mode(/Build & Preview/).isVisible()),
  );

  // 2. Compose: tap a space; its editor has contents, doors and divide, and no whole-piece settings.
  await mode('Compose').click();
  if (phone)
    check(
      width,
      'Compose peek says "Tap a space to edit it"',
      (await peek.innerText()).includes('Tap a space to edit it'),
    );
  await page.locator('.el-space').first().click({ force: true });
  await page.waitForTimeout(200);
  if (phone)
    check(
      width,
      'peek names the selection',
      /^Selected: /.test(await peek.innerText()),
      await peek.innerText(),
    );
  for (const t of [/^contents$/i, /^doors and handles$/i, /^divide this space$/i]) {
    const l = side.getByText(t).first();
    await l.scrollIntoViewIfNeeded();
    check(width, `Compose shows ${t.source}`, await l.isVisible());
  }
  check(
    width,
    'Compose has no Construction or Materials settings',
    (await group('Construction').count()) === 0 && (await group(/^Materials$/).count()) === 0,
  );
  if (phone) check(width, 'no 3D canvas in Compose', (await canvases()) === 0);
  check(width, 'no sideways scroll (Compose)', await noSideScroll());
  await shot('compose');

  // 3. Configure: size, construction, boards (with Add a material) and drawers; no Materials button or dialog.
  await mode('Configure').click();
  await page.waitForTimeout(200);
  check(
    width,
    'Configure shows Width',
    await side.getByLabel('Width', { exact: true }).first().isVisible(),
  );
  for (const t of [
    'Construction',
    'Materials',
    'Drawers and runners',
    'Boards, sheets and saw cut',
  ])
    check(width, `Configure shows "${t}"`, (await group(t).count()) > 0);
  await group('Boards, sheets and saw cut').click();
  const addMaterial = side.getByRole('button', { name: 'Add a material' });
  await addMaterial.scrollIntoViewIfNeeded();
  check(width, 'Configure has "Add a material"', await addMaterial.isVisible());
  check(
    width,
    'no Materials button or dialog anywhere',
    (await page.getByRole('button', { name: 'Materials', exact: true }).count()) === 0 &&
      (await page.getByRole('dialog', { name: 'Materials in this piece' }).count()) === 0,
  );
  if (phone) check(width, 'no 3D canvas in Configure', (await canvases()) === 0);
  check(
    width,
    'no sideways scroll (Configure)',
    await noSideScroll(),
    await page.evaluate(() =>
      [...document.querySelectorAll('main *')]
        .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
        .slice(0, 3)
        .map((e) => {
          const chain = [];
          for (let n = e; n && chain.length < 5; n = n.parentElement)
            chain.push(`${n.tagName}.${n.getAttribute('class') ?? ''}`);
          return `${chain.join(' < ')} ${Math.round(e.getBoundingClientRect().right)}`;
        })
        .join(', '),
    ),
  );
  await shot('configure');

  // 4. Build & Preview: 3D and the parts with Download CSV and Print; an error blocks both.
  await mode('Build & Preview').click();
  await page
    .locator('canvas')
    .first()
    .waitFor({ timeout: 15000 })
    .catch(() => {});
  check(width, 'Build & Preview shows the 3D view', (await canvases()) > 0);
  const csv = page.getByRole('button', { name: 'Download CSV' });
  const print = page.getByRole('button', { name: 'Print', exact: true });
  check(
    width,
    'Parts tab has Download CSV and Print, enabled',
    (await csv.isVisible()) && (await csv.isEnabled()) && (await print.isEnabled()),
  );
  check(width, 'no sideways scroll (Build & Preview)', await noSideScroll());
  await shot('build');
  await mode('Configure').click();
  const w = side.getByLabel('Width', { exact: true }).first();
  await w.fill('100');
  await w.press('Tab');
  await mode(/Build & Preview/).click();
  await page.waitForTimeout(300);
  check(
    width,
    'the mode names the problem ("1 problem")',
    /1 problem/.test(await mode(/Build & Preview/).textContent()),
  );
  check(
    width,
    'Download CSV and Print disabled with an error',
    (await csv.isDisabled()) && (await print.isDisabled()),
  );
  await page.getByRole('tab', { name: /Checks/ }).click();
  check(
    width,
    'Checks shows the error',
    await page
      .locator('#panel-checks')
      .getByText('Drawer box would be only 38 mm wide.')
      .isVisible(),
  );
  await shot('blocked');

  // 5. Desktop: Compose/Configure left, drawing centre, Build right.
  if (!phone) {
    await mode('Compose').click();
    const [a, b, c] = await Promise.all([
      box(side),
      box(page.locator('section.stage')),
      box(page.locator('section.output')),
    ]);
    check(width, 'side left, drawing centre, Build right', a.x < b.x && b.x < c.x && c.width > 0);
  }

  // 6. A project opens in Compose with the plan; Configure holds the project settings; placing switches to Compose.
  await page.locator('summary[aria-label="More"]').click();
  await page.getByRole('button', { name: /New…/ }).click();
  await page
    .locator('dialog[open]')
    .getByRole('button', { name: /Project with several pieces/ })
    .click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await mode('Compose').click();
  check(
    width,
    'project shows its plan in Compose',
    await page.getByText('Add pieces to see them on the plan.').isVisible(),
  );
  await mode('Configure').click();
  check(
    width,
    'Configure holds the project settings',
    (await side.getByRole('heading', { name: 'Project settings' }).isVisible()) &&
      (await side.getByLabel('Saw cut (kerf) for this project', { exact: true }).isVisible()),
  );
  await page
    .getByRole('navigation', { name: 'Places' })
    .getByRole('link', { name: /Catalog/ })
    .click();
  await page.getByRole('searchbox', { name: 'Search the catalog' }).fill('Base cabinet');
  await page.getByRole('button', { name: 'Add', exact: true }).first().click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
  check(
    width,
    'placing a piece switches to Compose',
    (await mode('Compose').getAttribute('aria-checked')) === 'true' &&
      (await page.getByText('Tap the plan to place').isVisible()),
  );
  check(width, 'no sideways scroll (project)', await noSideScroll());
  await shot('placing');
  check(width, 'no page errors', errors.length === 0, errors.join(' / '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
