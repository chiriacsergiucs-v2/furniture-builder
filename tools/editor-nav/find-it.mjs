// Find-it acceptance for the editor and navigation follow-ups (CLAUDE.md R3, backlog N216, ADR-211), run against a
// production build:
//   pnpm build && pnpm preview --port 4311 &  node tools/editor-nav/find-it.mjs http://localhost:4311/furniture-builder/ <out dir>
// Starts from the bare app at 1280 and 390 px (touch) and finds everything by role and visible text:
//  - 390 px: dragging the "Resize the sheet" handle reaches Full screen, Half and Collapsed; arrow keys step; "Up one
//    level" selects the parent space; a bed in a project shows "Mattress width".
//  - both: a drag box on empty front view selects two pieces; "Lock boards" turns Boards off with its hint; "About
//    Select" opens; Gaps and Research show no "Back to the editor" with no design open; a closed New piece wizard
//    reopens with "Continue where you left off" on its step; Fill a wall and Fill the room have different glyphs; after
//    deleting a project and keeping its versions, History lists "Versions of deleted projects", "Restore as a new
//    project" opens it and Delete asks and removes one.
// Not part of `pnpm test`.
import { launchBrowser, previewUrl, outDir } from '../lib/harness.mjs';
import { openPieceEditor } from '../lib/steps.mjs';
import { mkdirSync } from 'node:fs';

const url = previewUrl('http://localhost:4311/furniture-builder/');
const out = outDir();
mkdirSync(out, { recursive: true });
const browser = await launchBrowser();
const results = [];
const check = (width, name, ok, detail = '') => {
  results.push({ width, name, ok: !!ok });
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
  const cdp = await ctx.newCDPSession(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const shot = (name) => page.screenshot({ path: `${out}/editor-nav-${name}-${width}.png` });
  const dlg = page.locator('dialog[open]');
  const btn = (name, exact = true) => page.getByRole('button', { name, exact });
  const click = async (loc) => {
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    await loc.click({ timeout: 3000 }).catch(() => loc.dispatchEvent('click'));
    await page.waitForTimeout(200);
  };
  const visible = (loc) => loc.isVisible().catch(() => false);
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const peek = page.locator('.sheet-peek');
  const sheet = async (open) => {
    if (!(await visible(peek))) return;
    if (((await peek.getAttribute('aria-expanded')) === 'true') !== open) await peek.click();
    await page.waitForTimeout(300);
  };
  const touch = (type, p) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y }] : [] });
  /** Press at `a`, move to `b` in steps and release: a finger on phones, the mouse on desktop. */
  const drag = async (a, b, steps = 12) => {
    if (phone) await touch('touchStart', a);
    else {
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
    }
    for (let i = 1; i <= steps; i++) {
      const p = { x: a.x + ((b.x - a.x) * i) / steps, y: a.y + ((b.y - a.y) * i) / steps };
      if (phone) await touch('touchMove', p);
      else await page.mouse.move(p.x, p.y);
      await page.waitForTimeout(16);
    }
    if (phone) await touch('touchEnd');
    else await page.mouse.up();
    await page.waitForTimeout(350);
  };
  const places = page.getByRole('navigation', { name: 'Places' });
  const home = async () => {
    await places.getByRole('link', { name: 'Projects' }).click();
    await page.waitForTimeout(300);
  };
  const more = async () => {
    await page.locator('details.more > summary').click();
    await page.waitForTimeout(200);
  };
  const newProject = async (name) => {
    await home();
    await click(btn('Create a new project'));
    await dlg.locator('input').first().fill(name);
    await dlg.getByRole('button', { name: 'Create project' }).click();
    await page.locator('main.work').waitFor({ state: 'visible' });
    await page.waitForTimeout(300);
  };
  const addPiece = async (query, hasText) => {
    await sheet(true);
    const all = page.getByRole('button', { name: /^All pieces \(\d+\)$/ });
    if (await visible(all)) await click(all);
    await click(btn('Add a piece'));
    await dlg.getByRole('searchbox', { name: 'Search the items' }).fill(query);
    await page.waitForTimeout(200);
    const rows = dlg.locator('.start-group .row-btn', hasText ? { hasText } : {});
    await rows.first().click();
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
    const place = btn('Place to the right');
    await place.waitFor({ state: 'visible', timeout: 1500 }).catch(() => {});
    if (await visible(place)) await click(place);
    await page.waitForTimeout(300);
  };
  const view = async (name) => {
    const r = page.getByRole('radio', { name, exact: true });
    if (await visible(r)) await r.click();
    await page.waitForTimeout(300);
  };

  await page.goto(url);
  await page.waitForTimeout(500);

  // 1. Bare app, nothing open: Gaps and Research have no Back to the editor.
  for (const [item, main] of [
    [/^Gaps/, 'Gaps'],
    [/^Feature Research/, 'Feature Research & Catalog'],
  ]) {
    await more();
    await click(page.getByRole('button', { name: item }));
    const m = page.getByRole('main', { name: main });
    await m.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    check(
      width,
      `${main}: no "Back to the editor" with no design open`,
      (await visible(m)) &&
        (await m.getByRole('button', { name: 'Back to the editor' }).count()) === 0,
    );
  }
  await shot('research-no-back');

  // 2. Start something new: Fill a wall and Fill the room have their own glyphs.
  await more();
  await click(page.getByRole('button', { name: /New…/ }));
  const start = page.getByRole('dialog', { name: 'Start something new' });
  const glyph = (name) =>
    start.getByRole('button', { name }).locator('.glyph path').first().getAttribute('d');
  const g = [
    await glyph(/^Project with several pieces/),
    await glyph(/^Fill a wall/),
    await glyph(/^Fill the room/),
  ];
  check(
    width,
    'Fill a wall, Fill the room and Project rows have different glyphs',
    g.every(Boolean) && new Set(g).size === 3,
  );
  await shot('start-new');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // 3. Wizard draft: Catalog → New piece → a type → Next → Close (kept as a draft) → New piece → Continue.
  await page.getByRole('link', { name: /Catalog/ }).click();
  await click(btn('New piece'));
  let wiz = page.getByRole('dialog', { name: 'New piece' });
  await wiz.getByRole('radio', { name: /Open shelving/ }).click();
  await wiz.getByRole('button', { name: 'Next', exact: true }).click();
  const step = (await wiz.locator('h3').first().textContent())?.trim();
  await wiz.getByRole('button', { name: 'Close', exact: true }).first().click();
  const ask = page.getByRole('dialog', { name: 'Confirm' });
  check(
    width,
    'closing asks "Close the wizard? Your answers stay as a draft…"',
    await visible(ask.getByText(/^Close the wizard\? Your answers stay as a draft/)),
  );
  await ask.getByRole('button', { name: 'Close', exact: true }).click();
  await page.waitForTimeout(300);
  await click(btn('New piece'));
  wiz = page.getByRole('dialog', { name: 'New piece' });
  const cont = wiz.getByRole('button', { name: 'Continue where you left off' });
  check(width, '"Continue where you left off" offered on reopening', await visible(cont));
  check(
    width,
    '"Start over" offered beside it',
    await visible(wiz.getByRole('button', { name: 'Start over' })),
  );
  await shot('wizard-draft');
  if (await visible(cont)) await cont.click();
  await page.waitForTimeout(200);
  const back = (await wiz.locator('h3').first().textContent())?.trim();
  check(
    width,
    'Continue returns to the step it was on',
    back === step && step !== 'Type',
    `${step} → ${back}`,
  );
  await wiz.getByRole('button', { name: 'Start over' }).count();
  await wiz.getByRole('button', { name: 'Close', exact: true }).first().click();
  await ask
    .getByRole('button', { name: 'Close', exact: true })
    .click()
    .catch(() => {});
  await page.waitForTimeout(300);

  // 4. A project with two base cabinets: About Select, the front-view drag box, Lock boards.
  await newProject(`Nav ${width}`);
  await addPiece('Base cabinet');
  await addPiece('Base cabinet');
  await page.keyboard.press('Escape');
  await sheet(false);
  await view('2D');
  const plan = page.getByRole('figure', { name: /Room plan, seen from above/ });
  const front = page.getByRole('figure', { name: /Room seen from the front/ });
  await front.scrollIntoViewIfNeeded().catch(() => {});
  const aboutSelect = front.getByRole('button', { name: 'About Select' });
  check(width, '"About Select" on the front view', await visible(aboutSelect));
  if (await visible(aboutSelect)) {
    await aboutSelect.click();
    const note = page.getByRole('note').filter({ hasText: /With Select on, each tap adds/ });
    check(
      width,
      '"About Select" opens and names the drag box',
      await visible(
        note.filter({ hasText: /A drag on empty space selects every piece it touches/ }),
      ),
    );
    await shot('about-select');
    await page.keyboard.press('Escape');
  }
  check(
    width,
    '"About Select" on the plan',
    await visible(plan.getByRole('button', { name: 'About Select' })),
  );

  // The drag box: from empty wall above the pieces down across both. A touch needs Select on.
  const hits = front.locator('rect.front-hit');
  check(width, 'two pieces in the front view', (await hits.count()) === 2, `${await hits.count()}`);
  if (phone) {
    const sel = front.getByRole('checkbox', { name: 'Select', exact: true });
    if (!(await sel.isChecked())) await click(sel);
  }
  const b0 = await hits.nth(0).boundingBox();
  const b1 = await hits.nth(1).boundingBox();
  if (b0 && b1) {
    const left = Math.min(b0.x, b1.x),
      right = Math.max(b0.x + b0.width, b1.x + b1.width),
      top = Math.min(b0.y, b1.y);
    // From empty space right of the pieces, near their top, to the middle of the left one.
    await drag({ x: right + 15, y: top + 15 }, { x: left + 15, y: top + b0.height / 2 });
  }
  const pressed = await hits.evaluateAll((rs) => rs.map((r) => r.getAttribute('aria-pressed')));
  check(
    width,
    'a front-view drag box selects both pieces',
    pressed.join() === 'true,true',
    pressed.join(),
  );
  await shot('front-box');
  if (phone) {
    // The selection opened the sheet: fold it to reach Select again.
    await sheet(false);
    const sel = front.getByRole('checkbox', { name: 'Select', exact: true });
    if (await sel.isChecked()) await click(sel);
  }

  // Lock boards from More actions; the piece's Settings show Boards off with its hint.
  await page.keyboard.press('Escape');
  await sheet(true);
  const list = page.getByRole('list', { name: 'Pieces' });
  await click(list.getByRole('button').first());
  const card = page.getByRole('region', { name: /^Selected piece: / });
  await click(card.getByRole('button', { name: 'More actions' }));
  const menu = page.getByRole('group', { name: 'More actions' });
  check(
    width,
    'More actions lists "Lock boards"',
    await visible(menu.getByRole('button', { name: 'Lock boards' })),
  );
  check(
    width,
    'More actions lists "Lock construction"',
    await visible(menu.getByRole('button', { name: 'Lock construction' })),
  );
  await shot('lock-menu');
  await click(menu.getByRole('button', { name: 'Lock boards' }));
  await openPieceEditor(page, card);
  await click(btn('Settings'));
  const settings = page.getByRole('dialog', { name: /^Settings/ });
  const boards = settings.locator('details#g-boards');
  if (!(await boards.evaluate((d) => d.open).catch(() => true)))
    await click(boards.locator('summary'));
  check(
    width,
    'Boards shows "Boards locked — unlock to change"',
    await visible(boards.getByText('Boards locked — unlock to change')),
  );
  check(
    width,
    'Boards controls are off',
    (await boards.locator('fieldset[disabled]').count()) === 1,
  );
  await shot('boards-locked');
  await settings.getByRole('button', { name: 'Close', exact: true }).first().click();
  await page.waitForTimeout(200);
  await click(page.getByRole('button', { name: /^Back to project / }));

  await shot('back-to-project');
  // 5. Versions of deleted projects: a project with two versions, deleted keeping them.
  await newProject(`Gone ${width}`);
  await addPiece('Base cabinet');
  await page.keyboard.press('Escape');
  await sheet(true);
  const history = page.locator('summary', { hasText: /^History/ }).first();
  await click(history);
  await click(btn('Save a version'));
  await page.waitForTimeout(400);
  await click(btn('Save a version'));
  await page.waitForTimeout(400);
  // The open project cannot be deleted: open another first, then delete it from Projects, keeping its versions.
  await newProject(`Other ${width}`);
  await home();
  // A small phone folds the row's buttons into its ⋯ menu (ADR-120).
  const rowMenu = page.getByLabel(`Actions for Gone ${width}`);
  if (await visible(rowMenu)) {
    await click(rowMenu);
    await click(rowMenu.locator('..').getByRole('button', { name: /^Delete/ }));
  } else await click(page.getByRole('button', { name: `Delete Gone ${width}` }));
  await page
    .getByRole('dialog', { name: 'Confirm' })
    .getByRole('button', { name: 'Delete', exact: true })
    .click();
  const keep = page
    .getByRole('dialog', { name: 'Confirm' })
    .getByRole('button', { name: 'Keep them' });
  await keep.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
  check(width, 'deleting the project asks about its versions ("Keep them")', await visible(keep));
  if (await visible(keep)) await keep.click();
  await page.waitForTimeout(400);
  await places.getByRole('link', { name: 'Editor' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await sheet(true);
  await click(page.locator('summary', { hasText: /^History/ }).first());
  const orphan = page.locator('summary', { hasText: /^Versions of deleted projects \(\d+\)$/ });
  await orphan.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
  const orphanText = (await orphan.textContent().catch(() => '')) ?? '';
  check(
    width,
    'History lists "Versions of deleted projects (2)"',
    orphanText.trim() === 'Versions of deleted projects (2)',
    orphanText,
  );
  await click(orphan);
  await shot('orphans');
  // The row's text and its Restore button do not overlap.
  const row = page.locator('li.version-row.orphan').first();
  const tb = await row.locator('span').first().boundingBox();
  const rb = await row.getByRole('button', { name: 'Restore as a new project' }).boundingBox();
  check(
    width,
    'a deleted project version row: text and Restore do not overlap',
    tb && rb && (tb.x + tb.width <= rb.x + 1 || rb.y >= tb.y + tb.height - 1),
  );
  check(
    width,
    'the Restore button shows its whole label',
    await row
      .getByRole('button', { name: 'Restore as a new project' })
      .evaluate((b) => b.scrollWidth <= b.clientWidth + 1),
  );
  await click(btn('Restore as a new project').first());
  await page.waitForTimeout(500);
  check(
    width,
    'Restore as a new project opens "Gone … (restored)"',
    await page.evaluate(
      (n) => [...document.querySelectorAll('input')].some((i) => i.value === n),
      `Gone ${width} (restored)`,
    ),
  );
  await sheet(true);
  const h2 = page.locator('summary', { hasText: /^History/ }).first();
  if (!(await h2.evaluate((s) => s.parentElement.open))) await click(h2);
  const o2 = page.locator('summary', { hasText: /^Versions of deleted projects/ });
  await o2.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
  check(width, 'the versions stay after Restore', ((await o2.textContent()) ?? '').includes('(2)'));
  if (!(await o2.evaluate((s) => s.parentElement.open))) await click(o2);
  await click(
    page
      .getByRole('list', { name: /^Versions of deleted projects/ })
      .getByRole('button', { name: /^Delete the version of / })
      .first(),
  );
  const conf = page.getByRole('dialog', { name: 'Confirm' });
  check(width, 'Delete asks first', await visible(conf.getByText(/It cannot be undone/)));
  await conf.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.waitForTimeout(500);
  check(
    width,
    'Delete removes only that one ("(1)")',
    (
      (await page
        .locator('summary', { hasText: /^Versions of deleted projects/ })
        .textContent()
        .catch(() => '')) ?? ''
    ).includes('(1)'),
  );
  await shot('orphan-deleted');

  if (phone) {
    // 6. Phones: the sheet handle. Drag up to Full screen, down to Half, down to Collapsed; arrow keys step.
    const handle = page.getByRole('slider', { name: 'Resize the sheet' });
    const work = page.locator('main.work');
    const value = () => handle.getAttribute('aria-valuetext');
    await sheet(true);
    check(width, '"Resize the sheet" handle on the peek row', await visible(handle), await value());
    const hb = async () => {
      const b = await handle.boundingBox();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    };
    let a = await hb();
    await drag(a, { x: a.x, y: 60 });
    check(
      width,
      'dragging up reaches Full screen',
      (await value()) === 'Full screen',
      await value(),
    );
    check(
      width,
      'the work area has sheet-full',
      ((await work.getAttribute('class')) ?? '').includes('sheet-full'),
    );
    await shot('sheet-full');
    a = await hb();
    await drag(a, { x: a.x, y: 844 * 0.6 });
    check(width, 'dragging down reaches Half', (await value()) === 'Half', await value());
    a = await hb();
    await drag(a, { x: a.x, y: 830 });
    check(
      width,
      'dragging further down reaches Collapsed',
      (await value()) === 'Collapsed',
      await value(),
    );
    await shot('sheet-collapsed');
    await handle.focus();
    await page.keyboard.press('ArrowUp');
    check(width, 'ArrowUp steps to Half', (await value()) === 'Half', await value());
    await page.keyboard.press('ArrowUp');
    check(width, 'ArrowUp steps to Full screen', (await value()) === 'Full screen', await value());
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    check(
      width,
      'ArrowDown steps back to Collapsed',
      (await value()) === 'Collapsed',
      await value(),
    );
    // A tap (under 8 px) toggles peek and half.
    a = await hb();
    await drag(a, { x: a.x, y: a.y - 3 }, 2);
    check(width, 'a tap on the handle opens to Half', (await value()) === 'Half', await value());

    // 7. Phones: a bed shows its mattress size.
    await addPiece('Bed', /^Bed\b/);
    await sheet(true);
    const card2 = page.getByRole('region', { name: /^Selected piece: / });
    await card2.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
    check(
      width,
      'a bed shows "Mattress width"',
      await visible(card2.getByLabel('Mattress width', { exact: true })),
    );
    check(
      width,
      'a bed shows "Mattress length"',
      await visible(card2.getByLabel('Mattress length', { exact: true })),
    );
    await shot('bed');

    // 8. Phones: Up one level on a space path (a single Wardrobe, Compose, its hanging space tapped).
    await home();
    await click(btn('New single piece'));
    await dlg
      .getByRole('button', { name: /Wardrobe/ })
      .first()
      .click();
    await page.waitForTimeout(300);
    await view('Compose');
    const crumbs = page.getByRole('navigation', { name: 'Where this space sits' });
    const seen = [];
    const current = async () =>
      (await visible(crumbs)) ? await crumbs.locator('[aria-current]').textContent() : null;
    for (let i = 0; i < 5 && seen.at(-1) !== 'Hanging'; i++) {
      await sheet(false);
      const sp = page.getByRole('button', { name: /^Hanging.* space/ }).first();
      const b = await sp.boundingBox();
      await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      await page.waitForTimeout(300);
      await sheet(true);
      seen.push(await current());
    }
    check(
      width,
      'taps reach the hanging space inside a column ("Hanging" on the path)',
      seen.at(-1) === 'Hanging' && !!seen.at(-2),
      seen.join(' › '),
    );
    const up = crumbs.getByRole('button', { name: 'Up one level' });
    check(width, '"Up one level" on the space path', await visible(up));
    await shot('up-level');
    if (await visible(up)) await up.click();
    await page.waitForTimeout(300);
    const now = await current();
    check(
      width,
      '"Up one level" selects the parent space',
      !!now && now === seen.at(-2),
      `${seen.join(' › ')} → ${now}`,
    );
  } else {
    check(
      width,
      'no "Resize the sheet" handle on desktop',
      (await page.getByRole('slider', { name: 'Resize the sheet' }).count()) === 0,
    );
  }

  check(width, 'no sideways scroll', await noSideScroll());
  check(width, 'no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
