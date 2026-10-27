// Find-it acceptance for a compact Catalog at every width with "More" for cut card text (ADR-117 on a phone,
// backlog N116; ADR-118 at every width, N117) and the wizard's form first, run against a production build:
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
  // ADR-118: the compact catalog at every width; a phone shows the short switch labels, a desktop the full ones.
  const limit = phone ? 30000 : 15000;
  check(width, `Catalog page under ${limit} px tall`, height < limit, `${height} px`);
  const switchText = [(await saved.innerText()).trim(), (await byRoom.innerText()).trim()];
  check(
    width,
    `switch labels read ${phone ? '"Saved", "Room"' : '"Saved on this device", "By room"'}`,
    switchText.join('|') === (phone ? 'Saved|Room' : 'Saved on this device|By room'),
    switchText.join(' / '),
  );

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

  // 5. "More" on a card whose text is cut (ADR-118): shown only then, measured again on resize.
  /** Per card: whether it has a "More" button, and whether any of its lines is cut (text wider than its box). */
  const moreMatchesCut = () =>
    page.evaluate(() => {
      const LINES = '.item-name, .sub, .item-meta, .item-meta .num';
      const bad = [];
      let more = 0;
      for (const c of document.querySelectorAll('.catalog-page li.item')) {
        const b = [...c.querySelectorAll('button')].find((x) => x.textContent.trim() === 'More');
        const cut = [...c.querySelectorAll(LINES)].some((el) => el.scrollWidth > el.clientWidth);
        if (b) more++;
        if (!!b !== cut)
          bad.push(
            `${c.querySelector('.item-name')?.textContent} (${b ? 'More, nothing cut' : 'cut, no More'})`,
          );
      }
      return { more, bad };
    });
  const mm = await moreMatchesCut();
  check(
    width,
    '"More" shows on exactly the cards with a cut line',
    mm.more > 0 && mm.bad.length === 0,
    `${mm.more} cards with More, ${mm.bad.length} off: ${mm.bad.slice(0, 3).join(' / ')}`,
  );
  const wider = phone ? 690 : 1000;
  await page.setViewportSize({ width: wider, height: phone ? 844 : 900 });
  await page.waitForTimeout(600);
  const mw = await moreMatchesCut();
  check(
    width,
    `resized to ${wider} px: "More" re-checked, still exactly the cut cards`,
    mw.bad.length === 0 && mw.more !== mm.more,
    `${mw.more} cards with More (was ${mm.more}), ${mw.bad.length} off: ${mw.bad.slice(0, 3).join(' / ')}`,
  );
  await page.setViewportSize({ width, height: phone ? 844 : 900 });
  await page.waitForTimeout(600);
  const mb = await moreMatchesCut();
  check(
    width,
    'resized back: the same cards show "More"',
    mb.bad.length === 0 && mb.more === mm.more,
    `${mb.more} cards with More`,
  );

  // The first card with "More": by tap or click, then by keyboard (Enter, Space).
  // Pinned by its place in the list: a filter on "More" would move on to the next card once it reads "Less".
  const at = await page.evaluate(() =>
    [...document.querySelectorAll('.catalog-page li.item')].findIndex((c) =>
      [...c.querySelectorAll('button')].some((b) => b.textContent.trim() === 'More'),
    ),
  );
  const card = page.locator('.catalog-page li.item').nth(at);
  const more = card.getByRole('button', { name: /^(More|Less)$/ });
  // In the middle of the screen, clear of the sticky search row and a phone's bottom bar.
  await more.evaluate((b) => b.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(200);
  const mbox = await more.boundingBox();
  if (phone)
    check(
      width,
      '"More" is at least 44 × 44 px on a touch screen',
      !!mbox && mbox.width >= 44 && mbox.height >= 44,
      mbox ? `${Math.round(mbox.width)} × ${Math.round(mbox.height)}` : 'not found',
    );
  check(width, '"More" takes the tap at its centre', await shown(more));
  /** Whether every line of a card shows its whole text, inside the card. */
  const linesFull = (loc) =>
    loc.evaluate((c) => {
      const box = c.getBoundingClientRect();
      return [...c.querySelectorAll('.item-name, .sub, .item-meta, .item-meta .num')].every(
        (el) => {
          const r = el.getBoundingClientRect();
          return (
            el.scrollWidth <= el.clientWidth &&
            r.left >= box.left - 0.5 &&
            r.right <= box.right + 0.5 &&
            r.bottom <= box.bottom + 0.5
          );
        },
      );
    });
  const name = (await card.locator('.item-name').innerText()).trim();
  if (phone) await more.tap();
  else await more.click();
  check(
    width,
    `${phone ? 'tapping' : 'clicking'} "More" on "${name}" shows its full text in place`,
    (await more.getAttribute('aria-expanded')) === 'true' &&
      (await more.innerText()).trim() === 'Less' &&
      (await linesFull(card)) &&
      (await page.locator('dialog[open]').count()) === 0 &&
      (await page.getByRole('heading', { name: 'Catalog', level: 1 }).isVisible()),
  );
  await shot('more-open');
  await more.focus();
  await page.keyboard.press('Enter');
  check(
    width,
    'Enter on "Less" folds the card again',
    (await more.getAttribute('aria-expanded')) === 'false' &&
      (await more.innerText()).trim() === 'More' &&
      !(await linesFull(card)),
  );
  await page.keyboard.press('Space');
  check(
    width,
    'Space on "More" opens it again',
    (await more.getAttribute('aria-expanded')) === 'true' && (await linesFull(card)),
  );
  await page.keyboard.press('Space');

  // Every card with "More": each cut line reads whole after More, the card stays clear of the others, Less folds it.
  const every = await page.evaluate(async () => {
    const LINES = '.item-name, .sub, .item-meta, .item-meta .num';
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const toggle = (c) =>
      [...c.querySelectorAll('button')].find((x) => /^(More|Less)$/.test(x.textContent.trim()));
    const bad = [];
    let opened = 0;
    let lines = 0;
    for (const c of document.querySelectorAll('.catalog-page li.item')) {
      const b = toggle(c);
      if (!b) continue;
      const label = c.querySelector('.item-name')?.textContent ?? '?';
      const cut = [...c.querySelectorAll(LINES)].filter((el) => el.scrollWidth > el.clientWidth);
      b.click();
      await frame();
      opened++;
      lines += cut.length;
      const box = c.getBoundingClientRect();
      const whole = cut.every((el) => {
        const r = el.getBoundingClientRect();
        return (
          el.isConnected &&
          el.scrollWidth <= el.clientWidth &&
          r.left >= box.left - 0.5 &&
          r.right <= box.right + 0.5 &&
          r.bottom <= box.bottom + 0.5
        );
      });
      const clear = [...c.parentElement.children].every((o) => {
        if (o === c) return true;
        const r = o.getBoundingClientRect();
        return (
          r.bottom <= box.top + 0.5 ||
          r.top >= box.bottom - 0.5 ||
          r.right <= box.left + 0.5 ||
          r.left >= box.right - 0.5
        );
      });
      if (b.getAttribute('aria-expanded') !== 'true' || !whole || !clear)
        bad.push(`${label}${whole ? '' : ' (still cut)'}${clear ? '' : ' (overlaps)'}`);
      toggle(c).click();
      await frame();
      if (toggle(c)?.getAttribute('aria-expanded') !== 'false')
        bad.push(`${label} (Less did not fold)`);
    }
    return { opened, lines, bad };
  });
  check(
    width,
    'every cut card line reads in full after "More", and "Less" folds it',
    every.opened === mm.more && every.lines >= every.opened && every.bad.length === 0,
    `${every.opened} cards, ${every.lines} cut lines, ${every.bad.length} off: ${every.bad.slice(0, 3).join(' / ')}`,
  );

  // 6. Scrolled: only the search row stays on screen under the app bar.
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
    (await page.getByRole('article').count()) > 0 && (await page.getByRole('article').count()) < 20,
    `${await page.getByRole('article').count()} families`,
  );
  await search.fill('');
  await page.evaluate(() => window.scrollTo(0, 0));
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
