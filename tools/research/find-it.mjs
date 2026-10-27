// Find-it acceptance for the Feature Research & Catalog page (CLAUDE.md R3), run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/research/find-it.mjs http://localhost:4173/furniture-builder/
// Starts from the bare app at each width and finds everything by visible text. Not part of `pnpm test`.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4173/furniture-builder/';
const out = process.argv[3] ?? 'dist-acceptance';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const results = [];
const check = (width, name, ok, detail = '') => {
  results.push({ width, name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${width}px ${name}${detail ? ` — ${detail}` : ''}`);
};

for (const width of [1440, 1024, 390, 360]) {
  const ctx = await browser.newContext({
    viewport: { width, height: width < 500 ? 800 : 900 },
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const noSideScroll = async () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  await page.goto(url);
  // Since the shell rebuild (ADR-078) Feature Research is in the ⋯ More menu, not a top-bar tab.
  await page.locator('summary[aria-label="More"]').click();
  const item = page.getByRole('button', { name: /Feature Research/ });
  check(width, 'visible "Feature Research" in the More menu', await item.isVisible());
  await item.click();
  await page.getByRole('heading', { name: 'Feature Research & Catalog' }).waitFor();
  check(
    width,
    'page heading "Feature Research & Catalog"',
    await page.getByRole('heading', { name: 'Feature Research & Catalog' }).isVisible(),
  );
  // ADR-110: only Features (dashboard on top) and Competitors are left; no ticks, no export.
  const tabs = await page.getByRole('tab').allInnerTexts();
  check(
    width,
    'only the "Features" and "Competitors" tabs',
    tabs.map((t) => t.trim()).join('|') === 'Features|Competitors',
    tabs.join('|'),
  );
  check(
    width,
    'Features opens with the dashboard above the list',
    (await page.getByRole('tab', { name: 'Features' }).getAttribute('aria-selected')) === 'true' &&
      (await page.getByLabel('Search features').isVisible()),
  );
  check(
    width,
    'no tick boxes and no export',
    (await page.getByRole('checkbox', { name: /^Tick / }).count()) === 0 &&
      (await page.getByText(/Export specification|Download decisions|Import paper/).count()) === 0,
  );
  check(width, 'no sideways scroll on the dashboard', await noSideScroll());
  check(
    width,
    'assessment dashboard: matrix, distributions, quick wins',
    (await page
      .getByRole('heading', { name: 'Assessment: demand, value, complexity, confidence' })
      .isVisible()) &&
      (await page.getByText('Value (rows) × complexity (columns)').isVisible()) &&
      (await page.getByRole('heading', { name: /Quick wins/ }).isVisible()),
  );
  check(
    width,
    'appreciation distribution on the dashboard',
    (await page.getByRole('heading', { name: 'Appreciation', exact: true }).isVisible()) &&
      (await page.getByRole('button', { name: 'Unproven' }).isVisible()),
  );
  check(
    width,
    'research priority distribution on the dashboard',
    (await page.getByRole('heading', { name: 'Research priority' }).isVisible()) &&
      (await page.getByRole('button', { name: 'P0 foundational' }).isVisible()),
  );
  // ADR-092: what the app has built, and the dashboard on what is left
  check(
    width,
    'dashboard: "Built in this app" says built features are no longer listed; in progress / not started',
    (await page.getByRole('heading', { name: 'Built in this app' }).isVisible()) &&
      (await page.getByText(/92 features the app has built are no longer listed/).isVisible()) &&
      (await page.getByRole('button', { name: /in progress/ }).isVisible()) &&
      (await page.getByRole('button', { name: /not started/ }).isVisible()),
  );
  const leftRadio = page.getByRole('radio', { name: /^Left to build \(\d+\)$/ });
  check(
    width,
    'assessment dashboard defaults to "Left to build (…)"',
    (await leftRadio.getAttribute('aria-checked')) === 'true',
  );
  await page.getByRole('radio', { name: /^All features \(\d+\)$/ }).click();
  await page
    .getByRole('button', { name: /features with value 4\.5–5\.0 and Medium complexity/ })
    .click();
  check(
    width,
    'matrix cell opens the matching features',
    (await page.locator('table.features-table tbody tr').count()) >= 1 &&
      (await page.getByLabel('Value', { exact: true }).inputValue()) === '4.5',
  );
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${out}/research-dashboard-${width}.png`, fullPage: false });
  const rows = await page.locator('table.features-table tbody tr').count();
  check(
    width,
    'only the 44 features left to build are listed (ADR-111)',
    rows === 44,
    `${rows} rows`,
  );
  await page.getByLabel('Show merged').check();
  const withMerged = await page.locator('table.features-table tbody tr').count();
  check(width, '"Show merged" lists 65', withMerged === 65, `${withMerged} rows`);
  await page.getByLabel('Show merged').uncheck();
  await page.getByLabel('Left to build only').check();
  const leftRows = await page.locator('table.features-table tbody tr').count();
  check(
    width,
    '"Left to build only" keeps every row (nothing built is listed)',
    leftRows === rows,
    `${leftRows} rows`,
  );
  await page.getByLabel('Left to build only').uncheck();
  await page.getByLabel('Search features').fill('CNC');
  await page.getByRole('button', { name: 'Manufacturing/CAD/CNC export' }).first().click();
  await page.getByRole('heading', { name: /This app:/ }).waitFor();
  check(
    width,
    'feature page: "This app: In Progress" with "Missing:"',
    (await page.getByRole('heading', { name: /This app:\s*In Progress/ }).isVisible()) &&
      (await page.getByText('DXF, STEP and CNC output').first().isVisible()),
  );
  await page.getByRole('button', { name: '← All features' }).click();
  await page.getByLabel('Search features').fill('');
  await page.getByLabel('Search features').fill('disable snapping');
  check(
    width,
    'a built feature (snap override) is gone from the search',
    (await page.locator('table.features-table tbody tr').count()) === 0,
  );
  await page.getByLabel('Search features').fill('cutaway');
  check(
    width,
    'search finds a feature left to build',
    await page
      .getByRole('button', { name: 'Section/cutaway and visibility isolation' })
      .isVisible(),
  );
  await page.getByLabel('Search features').fill('');
  const sel = page.getByLabel('Your decision on Live price/cost estimate');
  await sel.selectOption('shortlisted');
  check(width, 'no sideways scroll on the feature list', await noSideScroll());
  await page.screenshot({ path: `${out}/research-features-${width}.png`, fullPage: false });

  await page
    .getByRole('button', { name: 'Precise numeric position, dimensions and gaps' })
    .first()
    .click();
  check(
    width,
    'detail shows sub-features and evidence',
    (await page.getByRole('heading', { name: /Sub-features/ }).isVisible()) &&
      (await page.getByRole('heading', { name: /Research evidence/ }).isVisible()),
  );
  await page.getByLabel('Your notes').fill(`note at ${width}`);
  await page.getByRole('combobox', { name: 'Your decision', exact: true }).selectOption('approved');
  await page.getByLabel('Your notes').blur();
  check(width, 'no sideways scroll on the feature detail', await noSideScroll());
  await page.screenshot({ path: `${out}/research-detail-${width}.png`, fullPage: false });
  await page.waitForTimeout(300);

  await page.reload();
  await page.goto(`${url}#research`);
  await page.getByRole('tab', { name: 'Features' }).click();
  check(
    width,
    'decision kept after reload',
    (await page.getByLabel('Your decision on Live price/cost estimate').inputValue()) ===
      'shortlisted',
  );
  await page.getByLabel('Shortlisted and approved only').check();
  const planned = await page.locator('table.features-table tbody tr').count();
  check(width, 'shortlisted + approved filter', planned === 2, `${planned} rows`);
  await page
    .getByRole('button', { name: 'Precise numeric position, dimensions and gaps' })
    .first()
    .click();
  check(
    width,
    'notes kept after reload',
    (await page.getByLabel('Your notes').inputValue()) === `note at ${width}`,
  );

  await page.getByRole('tab', { name: 'Competitors' }).click();
  check(width, '"Competitors" opens without sideways scroll', await noSideScroll());
  check(width, 'no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
