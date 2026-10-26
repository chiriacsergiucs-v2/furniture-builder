// Find-it acceptance for shaped parts (ADR-040) and the Pat Noi frame (ADR-041 amendment), against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/shapes/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
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

// Family name on the Catalog page, item (variant) name, and the piece name it opens as.
const ITEMS = [
  { family: 'L corner', item: 'Diagonal front', piece: 'Diagonal corner base', search: 'diagonal' },
  {
    family: 'Sink base',
    item: 'U-cut drawer + drawer',
    piece: 'Sink base, U-cut drawer + drawer',
    search: 'sink',
  },
  { family: 'Recliner', item: 'Reclining frame', piece: 'Reclining frame', search: 'recliner' },
  {
    family: 'Garden bench',
    item: 'With back and arms',
    piece: 'Garden bench with back',
    search: 'garden',
  },
  {
    family: 'Outdoor lounger',
    item: 'Adjustable backrest',
    piece: 'Lounger with backrest',
    search: 'lounger',
  },
  {
    family: 'Ergonomic office chair',
    item: 'Ergonomic chair (bought base)',
    piece: 'Ergonomic chair boards',
    search: 'office',
  },
];

for (const width of [1440, 375]) {
  const phone = width < 500;
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 812 : 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const csv = page.getByRole('button', { name: 'Parts CSV' });
  /**
   * Scroll a control into the open band below the sticky drawing (phones pin the drawing at the top and the actions at
   * the bottom), as a person would, then tap it.
   */
  const tap = async (loc) => {
    await loc.evaluate((el) => {
      const stage = document.querySelector('.work:not([hidden]) .stage');
      const below =
        stage && getComputedStyle(stage).position === 'sticky'
          ? stage.getBoundingClientRect().bottom
          : 0;
      el.scrollIntoView({ block: 'start' });
      window.scrollBy(0, -(below + 20));
    });
    await loc.click();
  };
  await page.goto(url);

  for (const [n, it] of ITEMS.entries()) {
    await page.getByRole('link', { name: /Catalog/ }).click();
    await page.getByLabel('Search the catalog').fill(it.search);
    const fam = page.getByRole('article', { name: it.family, exact: true });
    const card = fam
      .locator('li.item')
      .filter({ has: page.locator('.item-name strong').getByText(it.item, { exact: true }) });
    const img = card.locator('img.snap');
    await img.scrollIntoViewIfNeeded();
    await page
      .waitForFunction((el) => el.complete && el.naturalWidth > 0, await img.elementHandle(), {
        timeout: 5000,
      })
      .catch(() => {});
    check(
      width,
      `${it.item}: listed in the Catalog with a picture`,
      (await card.isVisible()) && (await img.evaluate((i) => i.complete && i.naturalWidth > 0)),
    );
    await tap(card.getByRole('button', { name: 'Open' }));
    await page.waitForTimeout(300);
    check(
      width,
      `${it.item}: opens in the editor`,
      (await page.getByLabel('Name of this piece').inputValue()) === it.piece,
    );
    check(width, `${it.item}: no errors (Parts CSV enabled)`, await csv.isEnabled());
    if (n === 0) {
      check(
        width,
        'diagonal door drawn as a slanted outline in the front view',
        (await page.locator('.elevation polygon.el-front').count()) >= 1,
      );
      check(
        width,
        'corner editor offers "Diagonal"',
        (await page.getByRole('radio', { name: 'Diagonal' }).getAttribute('aria-checked')) ===
          'true',
      );
      await page.screenshot({ path: `${out}/shapes-diagonal-front-${width}.png` });
      // Full-size templates on the print sheet: render it without opening the print dialog.
      await page.evaluate(() => {
        window.print = () => {};
      });
      await page.getByRole('button', { name: 'Print' }).click();
      await page.waitForTimeout(800);
      const tiles = await page
        .locator('.print-root .pr-template svg')
        .evaluateAll((s) => s.map((x) => x.getAttribute('width')));
      check(
        width,
        'print sheet carries full-size template tiles (186 mm wide)',
        tiles.length === 20 && tiles.every((w) => w === '186mm'),
        `${tiles.length} tiles`,
      );
      await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    }
    if (n === 1) {
      const parts = page.getByRole('tab', { name: /Parts/ });
      if ((await parts.getAttribute('aria-selected')) !== 'true') await parts.click();
      check(
        width,
        'U-cut drawer bottom listed "cut to template" in the parts list',
        await page
          .getByText(/cut to template/)
          .first()
          .isVisible(),
      );
    }
    if (n === 2) {
      check(
        width,
        'reclining positions 100° / 120° / 150° in the editor',
        await page.getByRole('radio', { name: '150°' }).isVisible(),
      );
      await tap(page.getByRole('radio', { name: '150°' }));
      await page.waitForTimeout(200);
      check(width, 'recliner at 150° still has no errors', await csv.isEnabled());
      await tap(page.getByRole('radio', { name: '3D' }));
      await page.waitForTimeout(1500);
      check(
        width,
        'recliner shows in 3D',
        (await page.locator('.view.three canvas').count()) === 1,
      );
      await page.screenshot({ path: `${out}/shapes-recliner-3d-${width}.png` });
      await tap(page.getByRole('radio', { name: 'Front' }));
    }
    if (n === 3)
      check(
        width,
        'chair/bench editor shows "Back rake"',
        await page.getByRole('textbox', { name: 'Back rake' }).isVisible(),
      );
    check(width, `${it.item}: no sideways scroll`, await noSideScroll());
  }

  // Pat Noi: Mobila — Dormitor (before D02 it came from New → Built in the app); the bed frame is screwed and listed.
  // "New" is labelled in the top bar on desktop and an icon with that name in the phone bottom bar.
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('button', { name: /Mobila — Dormitor/ }).click();
  await page.waitForTimeout(500);
  {
    const t = page.getByRole('tab', { name: /Hardware/ });
    if ((await t.getAttribute('aria-selected')) !== 'true') await t.dispatchEvent('click');
  }
  check(
    width,
    'Pat Noi: the two screwed joints are in the hardware list',
    (await page.getByText(/Screws: Laterală pat stânga to Cap pe picioare/).isVisible()) &&
      (await page.getByText(/Screws: Laterală pat dreapta to Cap pe picioare/).isVisible()),
  );
  check(width, 'Dormitor project has no errors (Parts CSV enabled)', await csv.isEnabled());
  await page.screenshot({ path: `${out}/shapes-dormitor-${width}.png` });
  check(width, 'no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
