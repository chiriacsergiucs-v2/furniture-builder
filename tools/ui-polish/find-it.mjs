// Find-it acceptance for the UI critique follow-up (backlog N87: gaps G-058 and G-059, 2026-10-26), run against a
// production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/ui-polish/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
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

/** Visible elements filled with the tape-measure yellow (--accent). */
const yellows = (page) =>
  page.evaluate(() => {
    const probe = document.createElement('i');
    probe.style.color = 'var(--accent)';
    document.body.append(probe);
    const accent = getComputedStyle(probe).color;
    probe.remove();
    return [...document.querySelectorAll('button, a, summary')]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return (
          r.width > 0 &&
          r.bottom > 0 &&
          r.top < innerHeight &&
          !e.closest('dialog:not([open]), details:not([open]) > :not(summary)') &&
          getComputedStyle(e).backgroundColor === accent
        );
      })
      .map((e) => e.innerText.trim().replace(/\s+/g, ' '));
  });

for (const width of [390, 1280]) {
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
  const shot = (name) => page.screenshot({ path: `${out}/ui-polish-${name}-${width}.png` });
  const dlg = page.locator('dialog[open]');
  const places = page.getByRole('navigation', { name: 'Places' });
  const more = page.locator('summary[aria-label="More"]');

  // 1. Projects: one yellow; the brand names the app on a phone; the picture clean-up is under ⋯ More.
  await page.goto(url);
  await page.getByRole('heading', { name: 'Projects', level: 1 }).waitFor();
  const y0 = await yellows(page);
  check(width, 'Projects: one yellow action', y0.length === 1, y0.join(' / '));
  if (phone)
    check(
      width,
      'phone bar shows "Furniture Builder"',
      await page.getByText('Furniture Builder', { exact: true }).isVisible(),
    );
  check(
    width,
    'Projects page has no "Clean up unused pictures"',
    !(await page.locator('main.projects-page').getByText('Clean up unused pictures').isVisible()),
  );
  await more.click();
  check(
    width,
    '⋯ More shows "Clean up unused pictures"',
    await page
      .locator('details.more .menu-items')
      .getByRole('button', { name: /Clean up unused pictures/ })
      .isVisible(),
  );
  await page.keyboard.press('Escape');

  // 2. A piece: New single piece → Wall cabinet. The parts summary names the unnamed edge bands once.
  await page.getByRole('button', { name: 'New single piece' }).click();
  check(
    width,
    'New: "Start from … ready items"',
    await dlg.getByText(/^\d+ ready items$/).isVisible(),
  );
  await dlg
    .getByRole('button', { name: /Wall cabinet/ })
    .first()
    .click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await page.getByRole('radio', { name: /Build & Preview/ }).click();
  await page.locator('.view.three canvas').waitFor({ state: 'visible', timeout: 20000 });
  check(
    width,
    'Parts summary: "Edge bands are not named yet." once',
    (await page.getByText(/Edge bands are not named yet\./).count()) === 1 &&
      (await page.getByText('Edge band: not named yet').count()) === 0,
  );
  const y1 = await yellows(page);
  check(
    width,
    'Editor: one yellow action (Download CSV)',
    y1.length === 1 && /Download CSV/.test(y1[0]),
    y1.join(' / '),
  );
  const current = await places
    .locator('[aria-current="page"]')
    .evaluate((e) => getComputedStyle(e).backgroundColor);
  check(
    width,
    'current place is green, not yellow',
    !y1.includes('Editor') && current !== 'rgba(0, 0, 0, 0)',
    current,
  );

  // 3. Hardware on a phone: the item column gets the room.
  await page.getByRole('tab', { name: /^Hardware/ }).click();
  await page.waitForTimeout(300);
  const share = await page.evaluate(() => {
    const t = document.querySelector('.hardware table.cut');
    const th = t?.querySelectorAll('th')[1];
    return t && th ? th.getBoundingClientRect().width / t.getBoundingClientRect().width : 0;
  });
  check(
    width,
    'Hardware: Item column ≥ 30 % of the table',
    share >= 0.3,
    `${Math.round(share * 100)} %`,
  );
  await shot('hardware');

  // 4. Quick counts over 3D (G-058): a phone folds the card to one row and remembers it; wide screens never fold.
  await page.getByRole('radio', { name: 'Compose' }).click();
  const svg = page.locator('.view.front svg').first();
  const b = await svg.boundingBox();
  if (phone) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height * 0.7);
  else await page.mouse.click(b.x + b.width / 2, b.y + b.height * 0.7);
  await page.waitForTimeout(300);
  await page.getByRole('radio', { name: /Build & Preview/ }).click();
  await page.waitForTimeout(1500);
  // On a phone the card is docked under the 3D view (G-070) and folds there (G-058); wide screens float it over 3D.
  const card = page
    .locator(phone ? '#count-dock' : '.view.three')
    .getByRole('group', { name: 'Quick counts' });
  const fold = card.getByRole('button', { name: 'Quick counts' });
  check(
    width,
    phone ? 'Quick counts card docked under 3D' : 'Quick counts card over 3D',
    await card.isVisible(),
  );
  if (phone) {
    check(
      width,
      'card has a "Quick counts" fold button, open',
      (await fold.isVisible()) && (await fold.getAttribute('aria-expanded')) === 'true',
    );
    await fold.click();
    await page.waitForTimeout(300);
    const h = (await card.boundingBox()).height;
    check(
      width,
      'folded card is one row',
      h <= 60 && !(await card.getByText('Shelves', { exact: true }).isVisible()),
      `${Math.round(h)} px`,
    );
    await shot('3d-folded');
    await page.reload();
    // A reload starts on Projects (ADR-078); the Editor place reopens the piece.
    await places.getByRole('link', { name: /Editor/ }).click();
    await page.locator('main.work').waitFor({ state: 'visible' });
    await page.getByRole('radio', { name: 'Compose' }).click();
    const b2 = await page.locator('.view.front svg').first().boundingBox();
    await page.touchscreen.tap(b2.x + b2.width / 2, b2.y + b2.height * 0.7);
    await page.waitForTimeout(300);
    await page.getByRole('radio', { name: /Build & Preview/ }).click();
    await page.waitForTimeout(1500);
    check(
      width,
      'fold is remembered after a reload',
      (await fold.getAttribute('aria-expanded')) === 'false',
    );
    await fold.click();
    check(
      width,
      'unfold shows the counts again',
      await card.getByText('Shelves', { exact: true }).isVisible(),
    );
  } else {
    check(width, 'no fold button on a wide screen', !(await fold.isVisible()));
  }

  // 5. Settings: the steps rail reads whole on a phone.
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await dlg.waitFor();
  const cut = await dlg
    .locator('.steps .lbl, .steps .meta')
    .evaluateAll((es) =>
      es.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent),
    );
  check(width, 'Settings: no step label or summary cut off', !cut.length, cut.join(', '));
  await shot('settings');
  await page.keyboard.press('Escape');
  await dlg.waitFor({ state: 'detached' }).catch(() => {});

  // 6. Catalog: Open is outline, kinds in words, a room's own families first, no white band, actions fold on a phone.
  await places.getByRole('link', { name: /Catalog/ }).click();
  await page.getByRole('heading', { name: 'Catalog', level: 1 }).waitFor();
  await page.waitForTimeout(500);
  const y2 = await yellows(page);
  check(
    width,
    'Catalog: one yellow action (New piece)',
    y2.length === 1 && /New piece/.test(y2[0]),
    y2.join(' / '),
  );
  check(
    width,
    'variant kind in words ("Interior only")',
    await page.getByText('Interior only').first().isVisible(),
  );
  const firstLiving = page.locator('section.catalog-group').first().locator('.family').first();
  check(
    width,
    'Living room lists its own families first',
    (await firstLiving.getByText(/^main room:/).count()) === 0,
    (await firstLiving.locator('h3, strong').first().innerText()).slice(0, 40),
  );
  const band = await page.evaluate(() => {
    const t = document.querySelector('.catalog-page .catalog-toolbar');
    return t
      ? [getComputedStyle(t).backgroundColor, getComputedStyle(document.body).backgroundColor]
      : [];
  });
  check(
    width,
    'catalog toolbar has the page colour (no white band)',
    band.length === 2 && band[0] === band[1],
    band.join(' vs '),
  );
  const safety = page.getByText(/^I check safety-regulated items/).first();
  if (phone) {
    check(
      width,
      'phone: "More catalog actions" visible, actions folded',
      (await page.getByText('More catalog actions').isVisible()) && !(await safety.isVisible()),
    );
    await page.getByText('More catalog actions').click();
    check(
      width,
      'phone: unfolding shows the safety choice and template actions',
      (await safety.isVisible()) &&
        (await page.getByText('Save this piece as a template').isVisible()),
    );
  } else {
    check(width, 'wide: catalog actions shown directly', await safety.isVisible());
  }
  check(width, 'no sideways scroll (Catalog)', await noSideScroll());
  await shot('catalog');

  // 7. Wizard: Type first; Skip says what it does.
  await page.getByRole('button', { name: 'New piece', exact: true }).click();
  await dlg.getByRole('heading', { name: 'New piece' }).waitFor();
  check(
    width,
    'wizard opens on Type',
    (await dlg.locator('.steps [aria-current="step"] .lbl').innerText()) === 'Type',
  );
  check(
    width,
    'Skip has a title',
    ((await dlg.getByRole('button', { name: 'Skip' }).getAttribute('title')) ?? '').startsWith(
      'Skip:',
    ),
  );
  await shot('wizard');
  await dlg.getByRole('button', { name: 'Cancel', exact: true }).click();
  await dlg.waitFor({ state: 'detached' }).catch(() => {});

  // 8. The brand goes to Projects; each row keeps its buttons on one line.
  if (
    !phone ||
    (await page.getByRole('link', { name: 'Furniture Builder, go to Projects' }).isVisible())
  ) {
    await page.getByRole('link', { name: 'Furniture Builder, go to Projects' }).click();
    check(
      width,
      'brand opens Projects',
      await page.getByRole('heading', { name: 'Projects', level: 1 }).isVisible(),
    );
  } else check(width, 'brand visible on the Catalog page', false);
  // One line: every child of a row overlaps the same horizontal band.
  const rows = await page.locator('main.projects-page ul.library > li').evaluateAll((lis) =>
    lis.map((li) => {
      const r = [...li.children].map((c) => c.getBoundingClientRect());
      return Math.max(...r.map((b) => b.top)) < Math.min(...r.map((b) => b.bottom));
    }),
  );
  check(
    width,
    'Projects rows: buttons on the row line',
    rows.length > 0 && rows.every(Boolean),
    JSON.stringify(rows),
  );
  await shot('projects');

  // 9. An empty project says so in 3D and under Checks.
  await page.getByRole('button', { name: 'Create a new project' }).click();
  await page.getByRole('textbox', { name: 'Name of the new project' }).fill(`Empty ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await page.getByRole('radio', { name: /Build & Preview/ }).click();
  await page.waitForTimeout(1500);
  check(
    width,
    'empty project: 3D says "Add pieces under Compose"',
    await page.getByText('Add pieces under Compose to see them in 3D.').isVisible(),
  );
  await page.getByRole('tab', { name: /^Checks/ }).click();
  check(
    width,
    'empty project: Checks says "Nothing to check yet", not "No problems found"',
    (await page.getByText(/Nothing to check yet/).isVisible()) &&
      !(await page.getByText(/No problems found/).isVisible()),
  );
  await shot('empty-project');

  check(width, 'no page errors', errors.length === 0, errors.join(' / '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
