// Find-it acceptance for shaped parts (ADR-040) and the Pat Noi frame (ADR-041 amendment), against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/shapes/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text. Not part of `pnpm test`.
// Since ADR-079/080 the editor has two modes: Compose (drawing + editor, the editor in a bottom sheet on a phone) and
// Build & Preview (3D and the parts with Download CSV and Print). "No errors" is read as Download CSV enabled there.
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
  const csv = page.getByRole('button', { name: 'Download CSV' });
  const mode = (name) =>
    page
      .getByRole('radiogroup', { name: 'Editor mode' })
      .getByRole('radio', { name: new RegExp(`^${name}`) });
  /** Switch editor mode (Compose / Build & Preview). */
  const toMode = async (name) => {
    const m = mode(name);
    if ((await m.getAttribute('aria-checked')) !== 'true') await m.click();
    await page.waitForTimeout(250);
  };
  // The piece's own editor (type, recline positions, back rake…) is the Settings dialog since ADR-080.
  const settings = page.locator('dialog[open]');
  const openSettings = async () => {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await settings.waitFor({ state: 'visible' });
  };
  const closeSettings = async () => {
    await settings.getByRole('button', { name: 'Done', exact: true }).click();
    await settings.waitFor({ state: 'detached' }).catch(() => {});
  };
  /** Build & Preview → Parts tab: is Download CSV enabled (no error diagnostics)? Returns to Compose. */
  const noErrors = async (stay = false) => {
    await toMode('Build & Preview');
    const parts = page.getByRole('tab', { name: /Parts/ });
    if ((await parts.getAttribute('aria-selected')) !== 'true') await parts.click();
    const ok = (await csv.isVisible()) && (await csv.isEnabled());
    if (!stay) await toMode('Compose');
    return ok;
  };
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
    await toMode('Compose');
    check(width, `${it.item}: no errors (Download CSV enabled)`, await noErrors());
    if (n === 0) {
      check(
        width,
        'diagonal door drawn as a slanted outline in the front view',
        (await page.locator('.elevation polygon.el-front').count()) >= 1,
      );
      await openSettings();
      check(
        width,
        'corner editor (Settings) offers "Diagonal"',
        (await settings.getByRole('radio', { name: 'Diagonal' }).getAttribute('aria-checked')) ===
          'true',
      );
      await page.screenshot({ path: `${out}/shapes-diagonal-front-${width}.png` });
      await closeSettings();
      // Full-size templates on the print sheet: render it without opening the print dialog. Print sits with
      // Download CSV under Parts in Build & Preview.
      await page.evaluate(() => {
        window.print = () => {};
      });
      await noErrors(true);
      await page.getByRole('button', { name: 'Print', exact: true }).click();
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
      await page.waitForTimeout(200);
      await toMode('Compose');
    }
    if (n === 1) {
      await noErrors(true);
      check(
        width,
        'U-cut drawer bottom listed "cut to template" in the parts list',
        await page
          .getByText(/cut to template/)
          .first()
          .isVisible(),
      );
      await toMode('Compose');
    }
    if (n === 2) {
      await openSettings();
      check(
        width,
        'reclining positions 100° / 120° / 150° in the editor (Settings)',
        (await settings.getByRole('radio', { name: '100°' }).isVisible()) &&
          (await settings.getByRole('radio', { name: '120°' }).isVisible()) &&
          (await settings.getByRole('radio', { name: '150°' }).isVisible()),
      );
      await settings.getByRole('radio', { name: '150°' }).click();
      await page.waitForTimeout(200);
      check(
        width,
        'recliner set to 150°',
        (await settings.getByRole('radio', { name: '150°' }).getAttribute('aria-checked')) ===
          'true',
      );
      await closeSettings();
      check(width, 'recliner at 150° still has no errors', await noErrors(true));
      // Build & Preview opens on the 3D view (or Both from 1500 px); pick 3D by its visible name.
      const v3d = page.getByRole('radiogroup', { name: 'View' }).getByRole('radio', { name: '3D' });
      if ((await v3d.getAttribute('aria-checked')) !== 'true') await v3d.click();
      await page
        .locator('.view.three canvas')
        .waitFor({ timeout: 15000 })
        .catch(() => {});
      check(
        width,
        'recliner shows in 3D',
        (await page.locator('.view.three canvas').count()) === 1,
      );
      await page.screenshot({ path: `${out}/shapes-recliner-3d-${width}.png` });
      await toMode('Compose');
    }
    if (n === 3) {
      await openSettings();
      check(
        width,
        'chair/bench editor (Settings) shows "Back rake"',
        await settings.getByRole('textbox', { name: 'Back rake' }).isVisible(),
      );
      await closeSettings();
    }
    check(width, `${it.item}: no sideways scroll`, await noSideScroll());
  }

  // Pat Noi: Mobila — Dormitor. The in-app "Built in the app" list was removed (D02, 2026-10-24); the project ships as
  // docs/samples/mobila-dormitor.project.json and is opened with Projects → "Import a file". The bed frame is screwed
  // and listed.
  await page
    .getByRole('navigation', { name: 'Places' })
    .getByRole('link', { name: /Projects/ })
    .click();
  await page
    .getByLabel('Import a design, project or project template file')
    .setInputFiles(
      new URL('../../docs/samples/mobila-dormitor.project.json', import.meta.url).pathname,
    );
  await page
    .locator('main.work')
    .waitFor({ state: 'visible', timeout: 5000 })
    .catch(() => {});
  await page.waitForTimeout(500);
  check(
    width,
    'Dormitor project opens from "Import a file"',
    (await page
      .getByLabel('Name of this project')
      .inputValue()
      .catch(() => '')) === 'Mobila — Dormitor',
  );
  check(width, 'Dormitor project has no errors (Download CSV enabled)', await noErrors(true));
  await page.getByRole('tab', { name: /Hardware/ }).dispatchEvent('click');
  check(
    width,
    'Pat Noi: the two screwed joints are in the hardware list',
    (await page.getByText(/Screws: Laterală pat stânga to Cap pe picioare/).isVisible()) &&
      (await page.getByText(/Screws: Laterală pat dreapta to Cap pe picioare/).isVisible()),
  );
  await page.screenshot({ path: `${out}/shapes-dormitor-${width}.png` });
  check(width, 'no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
