// Find-it acceptance for pipes and outlets in the room (ADR-072, backlog N67), run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/room-services/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text: a project with a base cabinet and a
// room, "Add pipe" and "Add outlet" in the Room panel, both drawn on the plan, and the pipe behind the cabinet
// reported as a warning. Not part of `pnpm test`.
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

for (const width of [1440, 1280, 390, 375]) {
  const phone = width < 500;
  const ctx = await browser.newContext({
    viewport: { width, height: phone ? 844 : 900 },
    hasTouch: phone,
    isMobile: phone,
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
    page.screenshot({ path: `${out}/room-services-${name}-${width}.png`, fullPage: true });
  const dlg = page.locator('dialog[open]');
  const btn = (name, exact = true) => page.getByRole('button', { name, exact });
  const click = async (loc) => {
    await loc.scrollIntoViewIfNeeded();
    await loc.click({ timeout: 3000 }).catch(() => loc.dispatchEvent('click'));
  };
  const openSheet = async () => {
    const peek = page.locator('.sheet-peek');
    if ((await peek.isVisible()) && (await peek.getAttribute('aria-expanded')) === 'false')
      await peek.click();
  };
  const plan = page.getByRole('figure', { name: /Room plan, seen from above/ });

  // 1. Bare app → new project → one base cabinet.
  await page.goto(url);
  await click(btn('Create a new project'));
  await dlg.locator('input').fill(`Services ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await openSheet();
  await click(btn('Add a piece'));
  await dlg.getByRole('searchbox', { name: 'Search the items' }).fill('Base cabinet');
  await dlg
    .getByRole('button', { name: /Base cabinet, doors: 1 door \+ shelf/ })
    .first()
    .click();
  await dlg.waitFor({ state: 'detached' }).catch(() => {});
  if (await btn('Place to the right').isVisible()) await click(btn('Place to the right'));
  await openSheet();

  // 2. The Room panel: add the room, then "Add pipe" and "Add outlet".
  const room = page.getByRole('region', { name: 'Room' });
  await click(room.getByRole('button', { name: 'Add the room' }));
  const addPipe = room.getByRole('button', { name: 'Add pipe' });
  const addOutlet = room.getByRole('button', { name: 'Add outlet' });
  await addPipe.scrollIntoViewIfNeeded();
  check(width, '"Add pipe" is in the Room panel', await addPipe.isVisible());
  check(width, '"Add outlet" is in the Room panel', await addOutlet.isVisible());
  await click(addPipe);
  await click(addOutlet);
  const pipeSet = room.getByRole('group', { name: 'Pipe 1' });
  const outletSet = room.getByRole('group', { name: 'Outlet 1' });
  check(width, '"Pipe 1" is listed with its zone', await pipeSet.isVisible());
  check(
    width,
    'the pipe zone defaults to 100 × 100 mm',
    (await pipeSet.getByLabel('Width', { exact: true }).inputValue()) === '100' &&
      (await pipeSet.getByLabel('Height', { exact: true }).inputValue()) === '100',
  );
  check(
    width,
    'the outlet zone defaults to 80 × 80 mm',
    (await outletSet.getByLabel('Width', { exact: true }).inputValue()) === '80' &&
      (await outletSet.getByLabel('Height', { exact: true }).inputValue()) === '80',
  );
  await shot('panel');

  // 3. Drawn on the plan as small marked zones with their names.
  const planRadio = page.getByRole('radio', { name: 'Plan' });
  if (await planRadio.isVisible().catch(() => false)) await planRadio.click();
  await plan.scrollIntoViewIfNeeded().catch(() => {});
  check(width, 'the plan is visible', await plan.isVisible());
  check(
    width,
    'the plan draws "Pipe 1" and "Outlet 1"',
    (await plan.locator('g.room-pipe').getByText('Pipe 1', { exact: true }).isVisible()) &&
      (await plan.locator('g.room-outlet').getByText('Outlet 1', { exact: true }).isVisible()),
  );
  await shot('plan');

  // 4. Both zones sit behind the cabinet's back at their default places: each gets a warning naming it.
  const warn = page.getByText(
    /Pipe behind Base cabinet.*\(Pipe 1\): cut the back or move the piece\./,
  );
  const outletWarn = page.getByText(
    /Outlet behind Base cabinet.*\(Outlet 1\): cut the back or move the piece\./,
  );
  /** Where the project's checks are listed: Build & Preview → Checks on a phone, the Checks tab on a desktop. */
  const showChecks = async () => {
    const build = page.getByRole('radio', { name: /Build & Preview/ });
    if (phone && (await build.isVisible().catch(() => false))) await build.click();
    const checks = page.getByRole('tab', { name: /Checks/ });
    await checks.waitFor({ timeout: 5000 }).catch(() => {});
    if (await checks.isVisible().catch(() => false)) await checks.click();
    await page.waitForTimeout(300);
  };
  await showChecks();
  await warn
    .first()
    .scrollIntoViewIfNeeded()
    .catch(() => {});
  check(
    width,
    'warning "Pipe behind Base cabinet… (Pipe 1): cut the back or move the piece." is shown',
    await warn
      .first()
      .isVisible()
      .catch(() => false),
  );
  check(
    width,
    'warning "Outlet behind Base cabinet… (Outlet 1): …" is shown',
    await outletWarn
      .first()
      .isVisible()
      .catch(() => false),
  );
  await shot('warning');

  // 5. Move the pipe along the wall, clear of the cabinet: its warning goes, the outlet's stays.
  if (phone) await page.getByRole('radio', { name: 'Compose' }).click();
  await openSheet();
  const from = page
    .getByRole('region', { name: 'Room' })
    .getByRole('group', { name: 'Pipe 1' })
    .getByLabel("From the wall's start", { exact: true });
  await from.scrollIntoViewIfNeeded();
  await from.fill('2000');
  await from.press('Tab');
  await page.waitForTimeout(300);
  check(
    width,
    'the side panel does not scroll sideways',
    await page.evaluate(() =>
      [...document.querySelectorAll('.side-body')].every((e) => e.scrollWidth <= e.clientWidth + 1),
    ),
  );
  await showChecks();
  check(
    width,
    'moved clear of the piece, the pipe warning goes and the outlet warning stays',
    (await warn.count()) === 0 &&
      (await outletWarn
        .first()
        .isVisible()
        .catch(() => false)),
  );

  check(width, 'no sideways scroll', await noSideScroll());
  check(width, 'no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
