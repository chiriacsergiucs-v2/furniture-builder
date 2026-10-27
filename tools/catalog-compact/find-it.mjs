// Find-it acceptance for a compact Catalog on a phone and the wizard's form first (ADR-116, backlog N114), run
// against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/catalog-compact/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by role and visible text. Not part of `pnpm test`.
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
  const shot = (name) => page.screenshot({ path: `${out}/catalog-compact-${name}-${width}.png` });
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const dlg = page.locator('dialog[open]');
  /** On screen below the app bar and not covered: the element at its centre is inside it. */
  const shown = (loc) =>
    loc.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const bar = document.querySelector('header.bar')?.getBoundingClientRect().bottom ?? 0;
      const y = r.top + r.height / 2;
      if (r.height === 0 || y < bar || y > window.innerHeight) return false;
      const hit = document.elementFromPoint(r.left + r.width / 2, y);
      return !!hit && (el === hit || el.contains(hit));
    });

  // 1. Bare app → the Catalog tab.
  await page.goto(url);
  await page
    .getByRole('link', { name: /Catalog/ })
    .first()
    .click();
  await page.getByRole('heading', { name: 'Catalog', level: 1 }).waitFor();
  await page.waitForTimeout(500);
  await shot('top');
  const search = page.getByRole('searchbox', { name: 'Search the catalog' });
  const templates = page.getByRole('tab', { name: 'Templates' });
  const byRoom = page.getByRole('radio', { name: 'By room' });
  const saved = page.getByRole('tab', { name: 'Saved on this device' });
  check(
    width,
    'Source tabs, "By room" and the search are found by name',
    (await templates.isVisible()) &&
      (await byRoom.isVisible()) &&
      (await saved.isVisible()) &&
      (await search.isVisible()),
  );

  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const firstFamily = page.getByRole('article').first();
  const about = firstFamily.getByRole('button', { name: 'About this family' });
  const structure = firstFamily.getByText('Default structure:');
  if (phone) {
    check(width, 'Catalog page under 30 000 px tall', height < 30000, `${height} px`);

    // 2. Source and grouping share one row; the search row is its own.
    const [tb, rb, sb] = [
      await templates.boundingBox(),
      await byRoom.boundingBox(),
      await search.boundingBox(),
    ];
    check(
      width,
      'source and grouping switches in one row',
      !!tb && !!rb && Math.abs(tb.y - rb.y) < 4 && rb.x > tb.x,
      tb && rb ? `Templates y ${Math.round(tb.y)}, By room y ${Math.round(rb.y)}` : 'not found',
    );
    check(width, 'search row below the switches', !!sb && !!tb && sb.y > tb.y + tb.height - 1);

    // 3. Every item card: tags on one meta line, none clipped.
    const tags = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.catalog-page li.item')];
      const bad = [];
      for (const c of cards) {
        const meta = c.querySelector('.item-meta');
        const ts = [...c.querySelectorAll('.tag, .kind')];
        if (!meta || !ts.length) {
          bad.push(`${c.querySelector('.item-name')?.textContent}: no meta line`);
          continue;
        }
        const m = meta.getBoundingClientRect();
        const ok = ts.every((t) => {
          const r = t.getBoundingClientRect();
          return (
            meta.contains(t) &&
            Math.abs(r.top - ts[0].getBoundingClientRect().top) < 2 &&
            r.right <= m.right + 0.5 &&
            r.bottom <= m.bottom + 0.5
          );
        });
        if (!ok) bad.push(c.querySelector('.item-name')?.textContent ?? '?');
      }
      return { cards: cards.length, bad };
    });
    check(
      width,
      "each item card's tags sit on one meta line, unclipped",
      tags.cards > 100 && tags.bad.length === 0,
      `${tags.cards} cards, ${tags.bad.length} off: ${tags.bad.slice(0, 3).join(' / ')}`,
    );
    const pic = await page
      .locator('.catalog-page li.item img.snap')
      .first()
      .evaluate((i) => Math.round(i.getBoundingClientRect().width));
    check(width, 'item picture 96 px wide', pic === 96, `${pic} px`);

    // 4. "About this family" holds the details, closed until tapped.
    check(
      width,
      '"About this family" closed: Default structure hidden',
      (await about.getAttribute('aria-expanded')) === 'false' && (await structure.count()) === 0,
    );
    await about.click();
    check(
      width,
      '"About this family" opens Default structure and Configurations',
      (await about.getAttribute('aria-expanded')) === 'true' &&
        (await structure.isVisible()) &&
        (await firstFamily.getByText('Configurations:').isVisible()),
    );
    await shot('about-open');
    await about.click();

    // 5. Scrolled: only the search row stays on screen under the app bar.
    await page.evaluate(() => window.scrollTo(0, 6000));
    await page.waitForTimeout(400);
    await shot('scrolled');
    check(width, 'scrolled: the search row stays on screen', await shown(search));
    check(
      width,
      'scrolled: "Templates" and "By room" scroll away',
      !(await shown(templates)) && !(await shown(byRoom)),
    );
    await search.fill('wardrobe');
    await page.waitForTimeout(300);
    check(
      width,
      'searching from the sticky row filters the list',
      (await page.getByRole('article').count()) > 0 &&
        (await page.getByRole('article').count()) < 20,
      `${await page.getByRole('article').count()} families`,
    );
    await search.fill('');
    await page.evaluate(() => window.scrollTo(0, 0));
  } else {
    // Desktop layout unchanged: details shown directly, full item cards, one sticky toolbar.
    check(
      width,
      'desktop: Default structure shown without a tap, no "About this family"',
      (await structure.isVisible()) && (await about.count()) === 0,
    );
    const [tb, rb, sb] = [
      await templates.boundingBox(),
      await byRoom.boundingBox(),
      await search.boundingBox(),
    ];
    check(
      width,
      'desktop: source, grouping and search in one row',
      !!tb && !!rb && !!sb && Math.abs(tb.y - rb.y) < 4 && Math.abs(tb.y - sb.y) < 8,
    );
    await page.evaluate(() => window.scrollTo(0, 6000));
    await page.waitForTimeout(300);
    check(
      width,
      'desktop: scrolled, the whole filter row stays',
      (await shown(templates)) && (await shown(search)),
    );
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  check(width, 'no sideways scroll (Catalog)', await noSideScroll());

  // 6. The wizard from the Catalog: form first on a phone; footer Back, Skip, Next; no Cancel.
  await page.getByRole('button', { name: 'New piece', exact: true }).click();
  await dlg.getByRole('heading', { name: 'New piece' }).waitFor();
  const footer = dlg.locator('.wizard-footer');
  const labels = (await footer.getByRole('button').allInnerTexts()).map((s) => s.trim());
  check(
    width,
    'wizard footer is Back, Skip, Next',
    labels.join(',') === 'Back,Skip,Next',
    labels.join(' / '),
  );
  check(
    width,
    'wizard has no "Cancel"',
    (await dlg.getByRole('button', { name: 'Cancel', exact: true }).count()) === 0,
  );
  const preview = dlg.getByRole('complementary', { name: 'Preview' });
  // Type step: its first field is the type choice; Size step: Name.
  await dlg.getByRole('button', { name: /^Cabinet \(closed box\)/ }).click();
  const typeField = await dlg.getByRole('group', { name: 'Construction type' }).boundingBox();
  const pv = await preview.boundingBox();
  if (phone)
    check(
      width,
      'Type step: the first field is above the preview',
      !!typeField && !!pv && typeField.y < pv.y,
      typeField && pv ? `field y ${Math.round(typeField.y)}, preview y ${Math.round(pv.y)}` : '',
    );
  else
    check(
      width,
      'desktop: preview beside the form (unchanged)',
      !!typeField && !!pv && pv.x > typeField.x + typeField.width - 1,
    );
  await shot('wizard-type');
  await dlg.getByRole('button', { name: 'Next', exact: true }).click();
  const nameBox = await dlg.getByLabel('Name', { exact: true }).boundingBox();
  const pv2 = await preview.boundingBox();
  if (phone)
    check(
      width,
      'Size step: Name is above the preview, on the first screen',
      !!nameBox && !!pv2 && nameBox.y < pv2.y && nameBox.y + nameBox.height < 844,
      nameBox && pv2 ? `Name y ${Math.round(nameBox.y)}, preview y ${Math.round(pv2.y)}` : '',
    );
  else
    check(width, 'desktop: preview beside the Size form', !!nameBox && !!pv2 && pv2.x > nameBox.x);
  await shot('wizard-size');
  await dlg.getByRole('button', { name: 'Close', exact: true }).click();
  await dlg.waitFor({ state: 'detached', timeout: 2000 }).catch(() => {});
  check(
    width,
    'the dialog × closes the wizard',
    (await page.locator('dialog[open]').count()) === 0,
  );
  check(width, 'no sideways scroll (wizard closed)', await noSideScroll());
  check(width, 'no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length ? 1 : 0);
