// Browser acceptance for ADR-291 (catalog finder) from the bare app, by role and visible text, at 390 × 844 and
// 1280 × 900, against the production build:
//   pnpm build && pnpm preview --port 4176 --strictPort &
//   node tools/catalog-finder/find-it.mjs http://127.0.0.1:4176/furniture-builder/ <out dir>
// Not part of `pnpm test`. Every check prints PASS or FAIL; the script exits 1 when any check fails.
import { mkdirSync } from 'node:fs';
import { launchBrowser, makeChecker, outDir, previewUrl } from '../lib/harness.mjs';
import { goBuild, openTab } from '../lib/steps.mjs';

const url = previewUrl('http://127.0.0.1:4176/furniture-builder/');
const out = outDir('/tmp/furniture-catalog-finder-acceptance');
mkdirSync(out, { recursive: true });
const results = [];
const { check } = makeChecker(results);
const browser = await launchBrowser();

try {
  for (const width of [390, 1280]) {
    const phone = width < 500;
    const ctx = await browser.newContext({
      viewport: { width, height: phone ? 844 : 900 },
      isMobile: phone,
      hasTouch: phone,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const noSideScroll = () =>
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    const openCatalog = async () => {
      await page
        .getByRole('link', { name: /^Catalog/ })
        .first()
        .click();
      await page.getByRole('heading', { name: 'Catalog', level: 1 }).waitFor();
      await page.waitForTimeout(600);
    };
    const finderSwitch = async () => {
      await page.getByLabel('More', { exact: true }).first().click();
      const sw = page.getByRole('button', { name: /^Catalog finder \(preview\)/ });
      await sw.waitFor();
      return sw;
    };

    await page.goto(url);
    await page.waitForTimeout(800);

    // First visit, nothing stored: the finder is the default (G-582); the More switch brings the grouped page back.
    await openCatalog();
    const gridNow = page.getByRole('list', { name: 'Families' });
    await gridNow.waitFor({ timeout: 5000 }).catch(() => {});
    check(width, 'default: the finder grid', (await gridNow.count()) === 1);
    let sw = await finderSwitch();
    check(
      width,
      'More has "Catalog finder (preview)", on',
      (await sw.getAttribute('aria-pressed')) === 'true',
    );
    await sw.click();
    await page.waitForTimeout(500);
    check(
      width,
      'switch off: the grouped page (Jump to a group) and no Catalog actions button',
      (await page.getByRole('navigation', { name: 'Jump to a group' }).count()) === 1 &&
        (await page.getByRole('button', { name: 'Catalog actions' }).count()) === 0,
    );

    // Turn it on again from More.
    sw = await finderSwitch();
    check(
      width,
      'More has "Catalog finder (preview)", off',
      (await sw.getAttribute('aria-pressed')) === 'false',
    );
    await sw.click();
    await page.waitForTimeout(500);
    const grid = page.getByRole('list', { name: 'Families' });
    await grid.waitFor({ timeout: 5000 }).catch(() => {});
    check(width, 'flag on: a flat grid of families', (await grid.count()) === 1);
    const tiles = grid.getByRole('listitem');
    const first = await tiles.count();
    check(width, 'the first page shows 24 families', first === 24, String(first));
    const top = await grid.evaluate((el) => el.getBoundingClientRect().top);
    check(
      width,
      'the grid starts in the first screen',
      top < (phone ? 844 : 900) / 2,
      `${Math.round(top)} px`,
    );
    const ids = await grid.locator('.finder-tile strong').allInnerTexts();
    check(width, 'each family once', new Set(ids).size === ids.length);
    check(width, 'no sideways scroll', await noSideScroll());
    await page.screenshot({ path: `${out}/finder-${width}.png` });

    // G-585: Source tabs on their own row; Room, Type and Ready to open all inside the viewport.
    const inView = async (loc) =>
      loc.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return r.left >= 0 && r.right <= window.innerWidth + 1;
      });
    check(
      width,
      'Room, Type and Ready to open are on screen without swiping',
      (await inView(page.getByRole('combobox', { name: 'Room' }))) &&
        (await inView(page.getByRole('combobox', { name: 'Type' }))) &&
        (await inView(page.getByRole('button', { name: 'Ready to open' }))),
    );
    // Filters: Room, Type, Ready to open; the count follows.
    const count = page.locator('.finder-count');
    const before = await count.innerText();
    await page.getByRole('combobox', { name: 'Type' }).selectOption('kitchen');
    await page.waitForTimeout(300);
    const kitchen = await count.innerText();
    check(width, 'Type › Kitchen narrows the count', kitchen !== before, `${before} → ${kitchen}`);
    await page.getByRole('combobox', { name: 'Type' }).selectOption('');
    await page.getByRole('button', { name: 'Ready to open' }).click();
    check(
      width,
      'Ready to open is a pressed chip',
      (await page.getByRole('button', { name: 'Ready to open' }).getAttribute('aria-pressed')) ===
        'true',
    );
    await page.getByRole('button', { name: 'Ready to open' }).click();
    await page.getByRole('searchbox', { name: 'Search the catalog' }).fill('zzzz');
    await page
      .getByText('Nothing matches “zzzz”.')
      .waitFor({ timeout: 3000 })
      .catch(() => {});
    check(
      width,
      'a search with no match says so',
      await page.getByText('Nothing matches “zzzz”.').isVisible(),
    );
    await page.getByRole('searchbox', { name: 'Search the catalog' }).fill('media');

    // The family sheet: items with a visible verb.
    await grid
      .getByRole('button', { name: /^Media console/ })
      .first()
      .click();
    const sheet = page.getByRole('dialog', { name: 'Media console' });
    await sheet.waitFor({ timeout: 5000 }).catch(() => {});
    check(width, 'a family opens in a sheet', await sheet.isVisible());
    const verbs = await sheet.locator('.tile .verb').allInnerTexts();
    check(
      width,
      'each item shows its verb (Open)',
      verbs.length > 0 && verbs.every((v) => v === 'Open'),
    );
    check(
      width,
      'the sheet has Edit template',
      (await sheet.getByRole('button', { name: 'Edit template' }).count()) === 1,
    );
    await page.screenshot({ path: `${out}/finder-sheet-${width}.png` });
    await sheet
      .getByRole('button', { name: /^Open Open niches/ })
      .first()
      .click();
    await page
      .locator('main.work')
      .waitFor({ state: 'visible', timeout: 10000 })
      .catch(() => {});
    check(width, 'Open opens the piece in the editor', await page.locator('main.work').isVisible());
    // First-run hints (ADR-289) open once; skip them.
    await page.waitForTimeout(300);
    if (await page.getByRole('dialog', { name: 'Getting started' }).isVisible())
      await page.getByRole('button', { name: 'Skip' }).click();

    // Catalog actions: the page's other tools behind one button.
    await openCatalog();
    await page.getByRole('button', { name: 'Catalog actions' }).click();
    check(
      width,
      'Catalog actions shows New piece, Back to the editor, Template files and the safety switch',
      (await page.getByRole('button', { name: 'New piece' }).isVisible()) &&
        (await page.getByRole('button', { name: 'Back to the editor' }).isVisible()) &&
        (await page.getByText('Template files').isVisible()) &&
        (await page.getByText('I check safety-regulated items myself').isVisible()),
    );
    await page.getByRole('button', { name: 'Back to the editor' }).click();

    // The seller product picker: kind chips, a count, paging.
    if (phone) await goBuild(page);
    await openTab(page, /^Shopping/);
    await page.getByRole('button', { name: 'Add seller product' }).first().click();
    const picker = page.getByRole('dialog', { name: 'Add seller product' });
    await picker
      .getByRole('list', { name: 'Seller products' })
      .getByRole('listitem')
      .first()
      .waitFor({ timeout: 20000 });
    const kinds = picker.getByRole('group', { name: 'Product kind' });
    check(width, 'picker: kind chips', (await kinds.getByRole('button').count()) > 2);
    const rows = await picker
      .getByRole('list', { name: 'Seller products' })
      .getByRole('listitem')
      .count();
    check(width, 'picker: 30 products on the first page', rows === 30, String(rows));
    check(
      width,
      'picker: Show more',
      (await picker.getByRole('button', { name: /^Show \d+ more$/ }).count()) === 1,
    );
    // The second chip (the first kind after All kinds): pressed, and the count follows.
    const chip = kinds.getByRole('button').nth(1);
    const label = await chip.innerText();
    const all = await picker.getByText(/^\d+ products?$/).innerText();
    await chip.click();
    await page.waitForTimeout(300);
    const one = await picker.getByText(/^\d+ products?$/).innerText();
    check(
      width,
      `picker: ${label} is pressed and the count follows`,
      (await chip.getAttribute('aria-pressed')) === 'true' && one !== all,
      `${all} → ${one}`,
    );
    await page.screenshot({ path: `${out}/picker-${width}.png` });
    check(width, 'no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
