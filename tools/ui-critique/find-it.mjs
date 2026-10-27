// Find-it acceptance for the UI critique fixes (backlog N82, 2026-10-26), run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/ui-critique/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
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

/** Visible controls smaller than 44 × 44 px (checkboxes, radios and inline text links aside). */
const smallTargets = (page) =>
  page.evaluate(() => {
    const out = [];
    const sel =
      'button, a[href], summary, select, input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden])';
    for (const e of document.querySelectorAll(sel)) {
      const r = e.getBoundingClientRect();
      const s = getComputedStyle(e);
      if (
        !r.width ||
        !r.height ||
        s.visibility === 'hidden' ||
        e.closest('details:not([open]) > :not(summary)')
      )
        continue;
      if (
        r.bottom < 0 ||
        r.top > innerHeight ||
        e.closest('svg, .link, .btn.link, .danger-link, p, li > span')
      )
        continue;
      if (e.matches('input') && e.closest('.mm, .search')) continue; // the field box is the target
      if (r.width < 43.5 || r.height < 43.5)
        out.push(
          `${e.tagName.toLowerCase()} "${(e.getAttribute('aria-label') || e.innerText || '').trim().slice(0, 24)}" ${Math.round(r.width)}×${Math.round(r.height)}`,
        );
    }
    return out;
  });
/** Visible text set smaller than 13 px (drawings aside). */
const tinyText = (page) =>
  page.evaluate(() => {
    const out = new Set();
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) {
      const el = w.currentNode.parentElement;
      if (!el || !w.currentNode.textContent.trim() || el.closest('svg, canvas, .print-sheet'))
        continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 12.9) out.add(`"${w.currentNode.textContent.trim().slice(0, 20)}" ${fs}px`);
    }
    return [...out];
  });
const tabsInSight = (page) =>
  page.evaluate(() => {
    const out = document.querySelector('.output').getBoundingClientRect();
    return [...document.querySelectorAll('.output .tabs button')].map((b) => {
      const r = b.getBoundingClientRect();
      return {
        t: b.innerText.replace(/\s+/g, ' ').trim(),
        ok: r.left >= out.left - 1 && r.right <= out.right + 1 && r.width > 0,
      };
    });
  });

for (const width of [390, 1280, 1600]) {
  const phone = width < 500;
  const ctx = await browser.newContext({
    viewport: { width, height: phone ? 844 : 900 },
    hasTouch: phone,
    isMobile: phone,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const shot = (name) => page.screenshot({ path: `${out}/ui-critique-${name}-${width}.png` });
  const dlg = page.locator('dialog[open]');
  const H = phone ? 844 : 900;

  await page.goto(url);
  await page.getByRole('heading', { name: 'Projects', level: 1 }).waitFor();
  if (phone) {
    check(
      width,
      'touch screen: (pointer: coarse) applies',
      await page.evaluate(() => matchMedia('(pointer: coarse)').matches),
    );
    const s = await smallTargets(page);
    check(width, 'Projects: every control ≥ 44 px', !s.length, s.join(', '));
  }
  const t0 = await tinyText(page);
  check(width, 'Projects: no text under 13 px', !t0.length, t0.join(', '));

  // A single piece from the bare app: New single piece → Wall cabinet.
  await page.getByRole('button', { name: 'New single piece' }).click();
  await dlg
    .getByRole('button', { name: /Wall cabinet/ })
    .first()
    .click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await page.getByRole('radio', { name: 'Compose' }).click();
  await page.waitForTimeout(400);
  const front = page.locator('.view.front');
  const card = (where) => where.getByRole('group', { name: 'Quick counts' });

  if (phone) {
    // 1. A tap selects; the sheet stays closed, the drawing keeps its height, the card is right above the selection.
    // The upper part, clear of the card, which now lies in a lower corner of the drawing (ADR-111).
    const svg = front.locator('svg').first();
    const b = await svg.boundingBox();
    await page.touchscreen.tap(b.x + b.width * 0.3, b.y + b.height * 0.4);
    await page.waitForTimeout(500);
    await page.touchscreen.tap(b.x + b.width * 0.3, b.y + b.height * 0.4);
    await page.waitForTimeout(500);
    const peek = page.locator('.sheet-peek');
    check(
      width,
      'peek row reads "Selected: Interior"',
      (await peek.innerText()).includes('Selected: Interior'),
    );
    check(
      width,
      'tapping a space leaves the sheet closed',
      (await peek.getAttribute('aria-expanded')) === 'false',
    );
    const stage = await page.locator('.work .stage').boundingBox();
    check(
      width,
      'drawing area ≥ 40 % of the screen',
      stage.height >= 0.4 * H,
      `${Math.round(stage.height)} px`,
    );
    check(width, '"Quick counts" card shown in the drawing', await card(front).isVisible());
    await shot('compose-selected');
    // The peek row opens the editor: at most 40 % of the screen; the card steps aside.
    await peek.click();
    await page.waitForTimeout(500);
    const side = await page.locator('.work .side').boundingBox();
    check(
      width,
      'peek opens the editor sheet',
      (await peek.getAttribute('aria-expanded')) === 'true',
    );
    check(
      width,
      'open sheet ≤ 40 % of the screen',
      side.height <= 0.4 * H + 1,
      `${Math.round(side.height)} px`,
    );
    const stage2 = await page.locator('.work .stage').boundingBox();
    const svg2 = await front.locator('svg').first().boundingBox();
    check(
      width,
      'drawing keeps ≥ 200 px with the sheet open',
      stage2.height >= 200 && svg2.height >= 150,
      `stage ${Math.round(stage2.height)}, drawing ${Math.round(svg2.height)} px`,
    );
    check(width, 'card hidden while the sheet is open', !(await card(front).isVisible()));
    check(
      width,
      'sheet shows "Shelves" to edit',
      await page.locator('.work .side').getByText('Shelves').first().isVisible(),
    );
    const s = await smallTargets(page);
    check(width, 'Compose with sheet: every control ≥ 44 px', !s.length, s.join(', '));
    await shot('compose-sheet');
    await peek.click();
  }

  // 2. Build & Preview: one toolbar row on a phone, the rest under "Options".
  await page.getByRole('radio', { name: /Build & Preview/ }).click();
  await page.locator('.view.three canvas').waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(1500);
  const tools = page.locator('.stage-tools');
  const options = page.getByText('Options', { exact: true });
  if (phone) {
    // One row: every control overlaps the same horizontal band.
    const rows = await tools.evaluate((t) =>
      [...t.children].map((c) => [c.getBoundingClientRect().top, c.getBoundingClientRect().bottom]),
    );
    const oneRow = Math.max(...rows.map((r) => r[0])) < Math.min(...rows.map((r) => r[1]));
    check(width, 'Build: view toolbar is one row', oneRow, JSON.stringify(rows));
    check(width, 'Build: "Options" visible', await options.isVisible());
    check(
      width,
      'Build: View switch "3D" visible',
      await page.getByRole('radio', { name: '3D' }).isVisible(),
    );
    const three = await page.locator('.view.three').boundingBox();
    check(
      width,
      'Build: 3D view ≥ 220 px tall',
      three.height >= 220,
      `${Math.round(three.height)} px`,
    );
    await options.click();
    for (const t of [
      'Doors and fronts',
      'Exploded 3D',
      'Reset view',
      'Simple',
      'Realistic',
      'Render',
    ])
      check(
        width,
        `Options shows "${t}"`,
        await page.locator('.view-options-panel').getByText(t, { exact: true }).isVisible(),
      );
    const s = await smallTargets(page);
    check(width, 'Build with Options open: every control ≥ 44 px', !s.length, s.join(', '));
    check(width, 'no sideways scroll (Options open)', await noSideScroll());
    await shot('build-options');
    await page.keyboard.press('Escape');
    check(width, 'Escape closes Options', !(await page.locator('.view-options-panel').isVisible()));
  } else {
    check(width, 'Build: no "Options" menu on a wide screen', !(await options.isVisible()));
    for (const t of ['Exploded 3D', 'Reset view', 'Render'])
      check(
        width,
        `Build: "${t}" visible in the toolbar`,
        await tools.getByText(t, { exact: true }).isVisible(),
      );
  }

  // 3. Every result tab, Checks included, inside the results column.
  for (const t of await tabsInSight(page)) check(width, `tab "${t.t}" in sight`, t.ok);
  const t1 = await tinyText(page);
  check(width, 'Build: no text under 13 px', !t1.length, t1.join(', '));
  check(width, 'no sideways scroll (Build)', await noSideScroll());
  await shot('build');

  // 4. Catalog: chips, badges and tags at 13 px or more; touch targets.
  await page
    .getByRole('navigation', { name: 'Places' })
    .getByRole('link', { name: /Catalog/ })
    .click();
  await page.getByRole('heading', { name: 'Catalog', level: 1 }).waitFor();
  await page.waitForTimeout(500);
  const t2 = await tinyText(page);
  check(width, 'Catalog: no text under 13 px', !t2.length, t2.join(', '));
  if (phone) {
    const s = await smallTargets(page);
    check(width, 'Catalog: every control ≥ 44 px', !s.length, s.join(', '));
  }
  check(width, 'no sideways scroll (Catalog)', await noSideScroll());
  await shot('catalog');

  check(width, 'no page errors', errors.length === 0, errors.join(' / '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
