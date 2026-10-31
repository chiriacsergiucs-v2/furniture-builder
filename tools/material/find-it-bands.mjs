// Find-it acceptance for run parts and edge bands in the Material dialog (CLAUDE.md R3, backlog N170, ADR-168),
// against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/material/find-it-bands.mjs http://localhost:4173/furniture-builder/ <out dir>
// From the bare app, by visible text, at 1280 and 390 px: a project with two base units and its run parts (Settings ›
// Suggest run parts) → Material → Run worktop chip → PAL 18 oak → Apply → the Parts list has the worktop on PAL 18
// oak; Material → Fronts → Edge band › Your own band… → 2 mm → Apply → the Parts list names the 2 mm band; no
// horizontal scroll, no page errors. Not part of `pnpm test`.
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
  const shot = (name) => page.screenshot({ path: `${out}/bands-${name}-${width}.png` });
  const dlg = page.locator('dialog[open]');
  const side = page.getByRole('complementary', { name: 'Compose' });
  const peek = page.locator('.sheet-peek');
  const sheet = async (open) => {
    if (!phone) return;
    if (((await peek.getAttribute('aria-expanded')) === 'true') !== open) await peek.click();
    await page.waitForTimeout(250);
  };

  // 1. Bare app → a project with two base units side by side.
  await page.goto(url);
  await page.getByRole('button', { name: 'Create a new project', exact: true }).click();
  await dlg.locator('input').fill(`Bands ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  for (let i = 0; i < 2; i++) {
    await sheet(true);
    const all = side.getByRole('button', { name: /^All pieces \(\d+\)$/ });
    if (await all.isVisible().catch(() => false)) await all.click();
    await side.getByRole('button', { name: 'Add a piece', exact: true }).click();
    await dlg.getByRole('searchbox', { name: 'Search the items' }).fill('Base cabinet, doors');
    await dlg.locator('.start-group .row-btn').first().click();
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
    const place = page.getByRole('button', { name: 'Place to the right', exact: true });
    if (await place.isVisible().catch(() => false)) await place.click();
    await page.waitForTimeout(300);
  }
  await sheet(false);

  // 2. Settings › Suggest run parts.
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.locator('dialog[open]').last();
  await settings.getByRole('button', { name: 'Suggest run parts', exact: true }).click();
  await page.waitForTimeout(300);
  await settings.getByRole('button', { name: 'Done' }).click();

  // 3. Material › Run worktop › PAL 18 oak › Apply.
  const material = page.getByRole('button', { name: 'Material', exact: true });
  await material.click();
  const md = page.locator('dialog[open]', { has: page.getByRole('heading', { name: 'Material' }) });
  await md.waitFor({ state: 'visible' });
  const chips = md.getByRole('group', { name: 'Parts' });
  const runChip = chips.getByRole('button', { name: 'Run worktop', exact: true });
  check(width, 'Run worktop chip shown for the selected base unit', await runChip.isVisible());
  await runChip.click();
  await md.getByRole('combobox', { name: 'Board' }).selectOption({ label: 'PAL 18 oak, 18 mm' });
  await shot('run-worktop');
  await md.getByRole('button', { name: 'Apply material' }).click();
  const s1 = (await md.getByRole('status').textContent()) ?? '';
  check(width, 'Apply reaches the worktop', /Applied to/.test(s1), s1);
  await runChip.click();

  // 4. Fronts › Edge band › Your own band… › 2 mm › Apply.
  await chips.getByRole('button', { name: 'Fronts', exact: true }).click();
  await md.getByRole('combobox', { name: 'Board' }).selectOption({ label: 'PAL 18 white, 18 mm' });
  await md.getByRole('combobox', { name: 'Edge band' }).selectOption({ label: 'Your own band…' });
  await md.getByLabel('Band thickness (mm)').fill('2');
  await shot('own-band');
  await md.getByRole('button', { name: 'Apply material' }).click();
  const s2 = (await md.getByRole('status').textContent()) ?? '';
  check(width, 'Apply with your own 2 mm band', /Applied to 1 item/.test(s2), s2);
  check(
    width,
    'No horizontal scroll in the dialog',
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  );
  await md.getByRole('button', { name: 'Close' }).click();

  // 5. Parts: the worktop on PAL 18 oak; the 2 mm band named.
  if (phone)
    await page
      .getByRole('radio', { name: 'Build & Preview' })
      .click()
      .catch(() => {});
  await page.getByRole('tab', { name: /^Parts/ }).click();
  await page.waitForTimeout(300);
  const tables = page.getByRole('table');
  let oakWorktop = false;
  for (let i = 0; i < (await tables.count()); i++) {
    const tb = tables.nth(i);
    const cap =
      (await tb
        .locator('caption')
        .textContent()
        .catch(() => '')) ?? '';
    const text = (await tb.textContent()) ?? '';
    if (/PAL 18 oak/.test(cap) && /Worktop/.test(text)) oakWorktop = true;
  }
  check(width, 'Parts: the worktop is on PAL 18 oak', oakWorktop);
  const body = (await page.locator('body').textContent()) ?? '';
  check(width, 'Parts: the 2 mm band is named', /ABS 2 × 22 mm/.test(body));
  await shot('parts');
  check(
    width,
    'No horizontal scroll',
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  );
  check(width, 'No page errors', errors.length === 0, errors.join('; '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
