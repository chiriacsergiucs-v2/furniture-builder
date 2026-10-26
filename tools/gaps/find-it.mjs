// Find-it acceptance for the Gaps page (ADR-101, CLAUDE.md R3), run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/gaps/find-it.mjs http://localhost:4173/furniture-builder/
// Starts from the bare app at each width and finds everything by visible text. Not part of `pnpm test`.
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:4173/furniture-builder/';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const results = [];
const check = (width, name, ok, detail = '') => {
  results.push({ width, name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${width}px ${name}${detail ? ` — ${detail}` : ''}`);
};

for (const width of [1280, 390]) {
  const phone = width < 500;
  const ctx = await browser.newContext({
    viewport: { width, height: phone ? 800 : 900 },
    hasTouch: phone,
    isMobile: phone,
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
  await page.locator('summary[aria-label="More"]').click();
  const item = page.getByRole('button', { name: /^Gaps/ });
  check(width, 'visible "Gaps" in the ⋯ More menu', await item.isVisible());
  await item.click();
  const heading = page.getByRole('heading', { name: 'Gaps', exact: true });
  await heading.waitFor();
  check(width, 'page heading "Gaps"', await heading.isVisible());
  check(width, 'address is #gaps', page.url().endsWith('#gaps'));

  const totals = page.getByRole('region', { name: 'Totals' });
  check(
    width,
    'status counts: Open, Acknowledged, Moved to an ADR, Done, Marked by you',
    (await totals.getByText('Open', { exact: true }).isVisible()) &&
      (await totals.getByText('Acknowledged', { exact: true }).isVisible()) &&
      (await totals.getByText('Moved to an ADR', { exact: true }).isVisible()) &&
      (await totals.getByText('Done', { exact: true }).isVisible()) &&
      (await totals.getByText('Marked by you', { exact: true }).isVisible()),
  );
  check(width, 'no sideways scroll on the page', await noSideScroll());

  const openFilter = page.getByRole('button', { name: /^Open \(\d+\)$/ });
  check(
    width,
    'Open filter on by default',
    (await openFilter.getAttribute('aria-pressed')) === 'true',
  );
  const doneFilter = page.getByRole('button', { name: /^Done \(\d+\)$/ });
  await doneFilter.click();
  check(
    width,
    'Done filter adds done gaps (G-019)',
    await page.getByText(/G-019/).first().isVisible(),
  );
  await doneFilter.click();

  const search = page.getByRole('searchbox', { name: 'Search the gaps' });
  await search.fill('G-021');
  const row = page.locator('li.gap').filter({ hasText: 'G-021' });
  check(width, 'search finds a gap by id (G-021)', (await row.count()) === 1);
  check(
    width,
    '"1 of" shown after the search',
    await page.getByText(/^1 of \d+ shown$/).isVisible(),
  );
  await row.locator('summary').click();
  check(
    width,
    'expanded gap shows "Suggested pick"',
    await row.getByText('Suggested pick').isVisible(),
  );
  check(
    width,
    'expanded gap shows "Missing"',
    await row.getByText('Missing', { exact: true }).isVisible(),
  );
  check(width, 'no sideways scroll with a gap open', await noSideScroll());

  const ack = row.getByRole('button', { name: 'Acknowledge' });
  await ack.click();
  check(width, 'Acknowledge is pressed', (await ack.getAttribute('aria-pressed')) === 'true');
  const note = row.getByLabel('Your note');
  await note.fill(`checked at ${width}`);

  await page.getByRole('button', { name: /^Copy decisions \(1\)$/ }).click();
  const box = page
    .getByRole('region', { name: 'Decisions to paste to Claude' })
    .locator('textarea');
  const text = await box.inputValue();
  check(
    width,
    'Copy decisions shows "acknowledge G-021" with the note',
    text.includes('acknowledge G-021') && text.includes(`checked at ${width}`),
    text.split('\n')[1] ?? '',
  );

  // The note is saved while typing (no blur needed); give the short save delay time before reloading.
  await page.waitForTimeout(800);
  await page.reload();
  await heading.waitFor();
  await page.getByRole('searchbox', { name: 'Search the gaps' }).fill('G-021');
  const again = page.locator('li.gap').filter({ hasText: 'G-021' });
  check(
    width,
    'mark survives a reload ("You: acknowledge")',
    await again.getByText('You: acknowledge').isVisible(),
  );
  await again.locator('summary').click();
  check(
    width,
    'typed note survives a reload without leaving the box',
    (await again.getByLabel('Your note').inputValue()) === `checked at ${width}`,
  );
  await again.locator('summary').click();
  check(
    width,
    '"Marked by you" counts 1 after the reload',
    (
      await page.getByRole('region', { name: 'Totals' }).locator('.tile').last().innerText()
    ).startsWith('1'),
  );
  await again.locator('summary').click();
  await again.getByRole('button', { name: 'Acknowledge' }).click();
  check(
    width,
    'tapping Acknowledge again clears it',
    (await again.getByRole('button', { name: 'Acknowledge' }).getAttribute('aria-pressed')) ===
      'false',
  );

  await page.getByRole('button', { name: 'Back to the editor' }).click();
  check(width, 'Back to the editor leaves #gaps', !page.url().endsWith('#gaps'));
  check(width, 'no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
