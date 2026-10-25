// Find-it acceptance for selecting a problem and applying a previewed repair (CLAUDE.md R3, backlog N66, ADR-071),
// run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/repairs/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
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
  const shot = (name) => page.screenshot({ path: `${out}/repairs-${name}-${width}.png` });
  const dlg = page.locator('dialog[open]');
  const click = async (loc) => {
    await loc.scrollIntoViewIfNeeded();
    await loc.click({ timeout: 3000 }).catch(() => loc.dispatchEvent('click'));
  };
  const btn = (name, exact = true) => page.getByRole('button', { name, exact });
  const plan = page.getByRole('figure', { name: /Room plan, seen from above/ });
  const pieces = plan.getByRole('button', { name: /^Base cabinet.*, \d+ by \d+ mm$/ });
  const addBase = async () => {
    // On a phone the project's pieces sit in the Compose sheet: tap its peek row to open it.
    const peek = page.locator('.sheet-peek');
    if ((await peek.isVisible()) && (await peek.getAttribute('aria-expanded')) === 'false')
      await peek.click();
    await click(btn('Add a piece'));
    await dlg.getByRole('searchbox', { name: 'Search the items' }).fill('Base cabinet');
    await dlg.locator('.start-group .row-btn').first().click();
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
    if (await btn('Place to the right').isVisible()) await click(btn('Place to the right'));
    await page.waitForTimeout(150);
  };

  // 1. Bare app → new project → two base cabinets side by side; push the second 100 mm into the first.
  await page.goto(url);
  await click(btn('Create a new project'));
  await page.locator('dialog[open] input').fill(`Repairs ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await addBase();
  await addBase();
  const planRadio = page.getByRole('radio', { name: 'Plan' });
  if (await planRadio.isVisible().catch(() => false)) await planRadio.click();
  check(width, 'two "Base cabinet" pieces on the plan', (await pieces.count()) === 2);
  const second = pieces.nth(1);
  await second.focus();
  await page.keyboard.press('Shift+ArrowLeft');
  await page.waitForTimeout(200);

  // 2. Checks lists the overlap with its amount; tapping it selects the piece and outlines the problem.
  const checksTab = page.getByRole('tab', { name: /Checks/ });
  // Checks sit under the results: on a phone they show in Build & Preview (ADR-079), found by its label.
  const openChecks = async () => {
    if (!(await checksTab.isVisible()))
      await click(page.getByRole('radio', { name: /Build & Preview/ }));
    await click(checksTab);
  };
  await openChecks();
  const item = page.locator('.checks button', { hasText: /overlap by 100 mm/ });
  check(
    width,
    'Checks says "… overlap by 100 mm in the room."',
    await item.isVisible(),
    (await item.textContent().catch(() => '')) ?? '',
  );
  check(
    width,
    'the check offers "Show on the plan and see repairs"',
    await item.getByText('Show on the plan and see repairs').isVisible(),
  );
  await click(item);
  await page.waitForTimeout(300);
  const banner = page.getByRole('region', { name: 'Problem and repairs' });
  check(width, 'the plan shows "Problem and repairs"', await banner.isVisible());
  const inView = await banner.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.top < window.innerHeight;
  });
  check(width, 'the plan scrolled to the problem (banner in view)', inView);
  check(
    width,
    'the banner repeats the problem',
    ((await banner.textContent()) ?? '').includes('overlap by 100 mm'),
  );
  check(
    width,
    'tapping the check selected the piece involved',
    (await second.getAttribute('aria-pressed')) === 'true',
  );
  check(
    width,
    'the problem zone is outlined on the plan',
    await plan.locator('.problem-zone').isVisible(),
  );
  const radios = banner.getByRole('radio');
  const first = banner.locator('label').first();
  const firstText = ((await first.textContent()) ?? '').trim();
  check(
    width,
    'first repair is the smallest move, chosen by default',
    /^Move Base cabinet[^·]* \(piece 2\) 100 mm to the right · smallest move$/.test(firstText) &&
      (await radios.first().isChecked()),
    firstText,
  );
  check(
    width,
    'the chosen repair is previewed as "After repair" on the plan',
    (await plan.locator('.repair-preview').count()) > 0 &&
      (await plan.getByText('After repair').first().isVisible()),
  );
  check(width, 'nothing applied yet: the overlap is still listed', (await item.count()) === 1);
  await shot('preview');
  if ((await radios.count()) > 1) {
    await radios.nth(1).check();
    check(width, 'choosing another repair moves the preview', await radios.nth(1).isChecked());
    await radios.first().check();
  }

  // 3. Apply: one step, the overlap is gone; one Undo brings it back.
  const apply = banner.getByRole('button', { name: 'Apply' });
  check(width, '"Apply" is found', await apply.isVisible());
  await click(apply);
  await page.waitForTimeout(300);
  check(
    width,
    'after Apply the notice says "Applied: … Undo puts it back."',
    await page
      .getByText(
        /Applied: Move Base cabinet.* \(piece 2\) 100 mm to the right\. Undo puts it back\./,
      )
      .isVisible(),
  );
  await openChecks();
  check(width, 'after Apply the overlap is gone from Checks', (await item.count()) === 0);
  check(width, 'after Apply the banner is gone', !(await banner.isVisible().catch(() => false)));
  await shot('applied');
  // A plain click: the helper's fallback would press Undo a second time if the first click reported a timeout.
  await btn('Undo').click();
  await page.waitForTimeout(300);
  await openChecks();
  await item.waitFor({ state: 'attached', timeout: 5000 }).catch(() => {});
  check(width, 'one Undo brings the overlap back', (await item.count()) === 1);
  await shot('undone');

  check(width, 'no sideways scroll', await noSideScroll());
  check(width, 'no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
