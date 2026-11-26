// Live-verify of the burst debt (catch-up 2026-11-26): the `burst-skipped: live-verify` and find-it items of the
// backlog rows N274, N286, N302, N318, N326, N338, N339, N342, N344, N345, N349, N350, N351, N358, N359 and N373,
// checked in Chromium against the published site (or any build), as a user finds them.
//   node tools/catch-up/live-verify.mjs https://chiriacsergiucs-v2.github.io/furniture-builder/ <out dir>
//   (or against a local build: pnpm build && pnpm preview &  node tools/catch-up/live-verify.mjs [url] [out dir])
// Every check starts from a fresh browser context (empty storage, a first visit) and finds things by role and visible
// text, at 390 and 1280 px unless the row is phone-only. Prints PASS/FAIL per check and exits 1 on any FAIL; a failing
// check saves a screenshot and the page's accessibility tree in the out dir. Not part of `pnpm test`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchBrowser, makeChecker, outDir, previewUrl, WIDTHS } from '../lib/harness.mjs';
import { goBuild, openTab } from '../lib/steps.mjs';

const url = previewUrl();
const out = outDir('dist-acceptance/live-verify');
mkdirSync(out, { recursive: true });
const browser = await launchBrowser();
const results = [];
const { check } = makeChecker(results);
const PHONE = 390;

/** A fresh context and page at `width` on the bare app (empty storage), with page errors collected. */
async function fresh(width) {
  const phone = width < 500;
  const ctx = await browser.newContext({
    viewport: { width, height: phone ? 844 : 900 },
    hasTouch: phone,
    isMobile: phone,
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.getByRole('heading', { name: 'Projects', level: 1 }).waitFor({ timeout: 20000 });
  return { ctx, page, errors };
}

/**
 * Runs one row's steps at `width` in a fresh context. A thrown step counts as a FAIL for `name` (the steps' own checks
 * print before it), and a failure saves a screenshot and the accessibility tree.
 */
async function run(row, width, name, steps) {
  const { ctx, page, errors } = await fresh(width);
  const before = results.filter((r) => !r.ok).length;
  try {
    await steps(page, (what, ok, detail) => check(width, `${row} ${what}`, ok, detail));
  } catch (e) {
    check(width, `${row} ${name}`, false, `step failed: ${String(e.message).split('\n')[0]}`);
  }
  if (errors.length) check(width, `${row} no page errors`, false, errors[0]);
  if (results.filter((r) => !r.ok).length > before) {
    const tag = `${row}-${width}`.replace(/[^\w-]+/g, '_');
    await page.screenshot({ path: `${out}/${tag}.png` }).catch(() => {});
    const tree = await page
      .locator('body')
      .ariaSnapshot()
      .catch(() => '');
    writeFileSync(`${out}/${tag}.aria.yml`, tree);
  }
  await ctx.close();
}

const visible = (l) => l.isVisible().catch(() => false);
const phoneOf = (page) => (page.viewportSize()?.width ?? 1280) < 500;

/** ⋯ More (the summary labelled More). */
const openMore = (page) => page.getByLabel('More', { exact: true }).first().click();

/** The canvas editor's first-run hints (ADR-289) on a phone: skipped when they show. */
async function skipHints(page) {
  const hints = page.getByRole('dialog', { name: 'Getting started' });
  await hints.waitFor({ timeout: 3000 }).catch(() => {});
  if (await visible(hints)) await hints.getByRole('button', { name: 'Skip' }).click();
}

/** Projects › New single piece › the first catalog item matching `name`, then the editor's drawing. */
async function newSingle(page, name) {
  await page.getByRole('button', { name: 'New single piece' }).click();
  await page.getByRole('dialog').getByRole('button', { name }).first().click();
  await page.getByRole('region', { name: 'Drawing' }).waitFor({ timeout: 15000 });
  if (phoneOf(page)) await skipHints(page);
}

/**
 * Phones: ⋯ More › "Canvas editor (preview)" switches the canvas editor (the phone default, ADR-290) off, back to the
 * bottom sheet the jsdom find-it tests use.
 */
async function sheetEditor(page, ok) {
  await openMore(page);
  await page.getByRole('button', { name: /Canvas editor \(preview\)/ }).click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  ok(
    'the canvas editor is off (no "Editor actions" rail)',
    !(await visible(page.getByRole('toolbar', { name: 'Editor actions' }))),
  );
}

/** Catalog › New piece: the wizard dialog. */
async function openWizard(page) {
  await page
    .getByRole('navigation', { name: 'Places' })
    .getByRole('link', { name: /Catalog/ })
    .click();
  await page.getByRole('button', { name: 'New piece', exact: true }).click();
  const wiz = page.getByRole('dialog', { name: 'New piece' });
  await wiz.waitFor();
  return wiz;
}

/** The wizard's step rail. */
const rail = (wiz) => wiz.getByRole('list', { name: 'Wizard steps' });

/** Settings (the top bar button) and its dialog. */
async function openSettings(page) {
  await page.getByRole('button', { name: 'Settings', exact: true }).first().click();
  const dlg = page.getByRole('dialog', { name: /^Settings/ });
  await dlg.waitFor();
  return dlg;
}

/**
 * Clicks `target` as a user would and says whether it could: false when it stays out of reach (outside the viewport
 * and not scrollable into view, or covered), instead of a 30 s timeout.
 */
async function reach(target) {
  return target
    .click({ timeout: 5000 })
    .then(() => true)
    .catch(() => false);
}

/** Types `value` into `field` over what it held, then leaves it (Tab). */
async function retype(field, value) {
  await field.fill('');
  await field.pressSequentially(value);
  await field.press('Tab');
}

/** N350's steps on a new Chest of drawers; `sheet` first switches a phone to the bottom sheet. */
async function commonThickness(page, ok, sheet = false) {
  await newSingle(page, /Chest of drawers/);
  if (sheet) await sheetEditor(page, ok);
  const dlg = await openSettings(page);
  const boards = dlg.getByText('Boards, sheets and saw cut', { exact: true }).first();
  const reached = await reach(boards);
  ok('"Boards, sheets and saw cut" can be reached and opened', reached);
  if (!reached) return;
  const group = dlg.getByRole('radiogroup', { name: 'Common thickness (mm)' }).first();
  await group.waitFor({ timeout: 5000 });
  let all = true;
  for (const mm of ['16', '18', '22'])
    all = all && (await visible(group.getByRole('radio', { name: mm, exact: true })));
  ok('16 · 18 · 22 show', all);
  await group.getByRole('radio', { name: '22', exact: true }).click();
  ok(
    '22 is checked',
    (await group.getByRole('radio', { name: '22', exact: true }).getAttribute('aria-checked')) ===
      'true',
  );
  const thickness = dlg.getByRole('textbox', { name: 'Thickness', exact: true }).first();
  ok('Thickness reads 22', (await thickness.inputValue()) === '22', await thickness.inputValue());
}

for (const width of WIDTHS) {
  // N274 + N351: More › Language › Русский; after the reload the main screen is in Russian, no English nav label.
  await run('N274+N351', width, 'Russian main screen', async (page, ok) => {
    await openMore(page);
    const group = page.getByRole('group', { name: 'Language', exact: true });
    await group.getByRole('button', { name: 'Русский' }).click();
    const places = page.getByRole('navigation', { name: 'Разделы' });
    await places.waitFor({ timeout: 15000 });
    ok('html lang is ru', (await page.locator('html').getAttribute('lang')) === 'ru');
    let ru = true;
    for (const n of ['Проекты', 'Каталог', 'Редактор'])
      ru = ru && (await visible(places.getByRole('link', { name: new RegExp(n) })));
    ok('nav shows Проекты, Каталог, Редактор', ru);
    ok(
      'main heading is Проекты',
      await visible(page.getByRole('heading', { name: 'Проекты', level: 1 })),
    );
    const english = [];
    for (const n of ['Projects', 'Catalog', 'Editor', 'Cut List'])
      if ((await page.getByRole('link', { name: new RegExp(`^${n}`) }).count()) > 0)
        english.push(n);
    if ((await page.getByRole('navigation', { name: 'Places' }).count()) > 0)
      english.push('Places');
    ok('no English nav label', english.length === 0, english.join(', '));
  });

  // N286: a space selected on the drawing is selected in the Structure tree, and a tree row selects its space.
  await run('N286', width, 'structure tree follows the selection', async (page, ok) => {
    await newSingle(page, /Sideboard/);
    const spaces = page
      .getByRole('figure', { name: /^Front view/ })
      .getByRole('button', { name: / space, \d+ by \d+ mm$/ });
    // The first tap selects the whole piece, the next one the space (ADR-083).
    await spaces.first().click({ force: true });
    if ((await spaces.first().getAttribute('aria-pressed')) !== 'true')
      await spaces.first().click({ force: true });
    ok(
      'the tapped space is selected',
      (await spaces.first().getAttribute('aria-pressed')) === 'true',
    );
    // A phone opens the Structure card from the chip rail; the Structure group starts closed there (ADR-268).
    if (phoneOf(page))
      await page
        .getByRole('toolbar', { name: 'Editor actions' })
        .getByRole('button', { name: 'Structure' })
        .click();
    const group = page
      .getByRole('complementary', { name: 'Compose' })
      .getByRole('group')
      .filter({ hasText: /^Structure/ })
      .first();
    await group.waitFor({ timeout: 5000 });
    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(300);
      if (await visible(page.getByRole('tree', { name: 'Whole piece tree' }))) break;
      await group.getByText('Structure', { exact: true }).first().click();
    }
    const tree = page.getByRole('tree', { name: 'Whole piece tree' });
    await tree.waitFor({ timeout: 5000 });
    ok('the "Whole piece tree" shows', await visible(tree));
    const sel = tree.locator('[role="treeitem"][aria-selected="true"]');
    const selName = (await sel.count()) ? await sel.first().textContent() : '';
    ok(
      'the selected row is the tapped (left) space',
      /^Left/.test(selName ?? '') && Number(await sel.first().getAttribute('aria-level')) > 1,
      selName ?? '',
    );
    const right = tree.getByRole('treeitem', { name: /^Right/ }).first();
    await right.click();
    ok('a row click selects that row', (await right.getAttribute('aria-selected')) === 'true');
    ok(
      'the drawing follows the row (right space pressed)',
      (await spaces.last().getAttribute('aria-pressed')) === 'true',
    );
  });

  // N302: Catalog › New piece › Cabinet (closed box): 4 suggestion cards, Show more brings more.
  await run('N302', width, 'suggestion cards', async (page, ok) => {
    const wiz = await openWizard(page);
    await wiz
      .getByRole('radiogroup', { name: 'Construction type' })
      .getByRole('radio', { name: /Cabinet \(closed box\)/ })
      .click();
    const region = wiz.getByRole('region', { name: 'Suggested combinations' });
    await region.waitFor();
    const uses = region.getByRole('button', { name: /^Use this: / });
    const n = await uses.count();
    ok('"Suggested combinations" shows 4 cards', n === 4, `${n}`);
    const more = region.getByRole('button', { name: /^Show more \(\d+\)$/ });
    ok('"Show more (N)" is offered', await visible(more));
    if (await visible(more)) {
      await more.click();
      ok('Show more adds cards', (await uses.count()) > 4, `${await uses.count()}`);
    }
  });

  // N326 (F-04): the wizard Review says why Create piece is off.
  await run('N326', width, 'disabled reason in Review', async (page, ok) => {
    const wiz = await openWizard(page);
    await wiz.getByRole('radio', { name: /Cabinet \(closed box\)/ }).click();
    await wiz.getByRole('button', { name: 'Next' }).click();
    await retype(wiz.getByRole('textbox', { name: /^Width/ }).first(), 'abc');
    await rail(wiz).getByRole('button', { name: 'Review' }).click();
    const create = wiz.getByRole('button', { name: 'Create piece' });
    ok('Create piece is off', await create.isDisabled());
    ok(
      '"Fix the problems listed under Checks first" shows',
      await visible(wiz.getByText('Fix the problems listed under Checks first').first()),
    );
  });

  // N344 + N345: every wizard step title and the labels Back panel, Modesty panel, Knob, Open; no "@@".
  await run('N344+N345', width, 'wizard step labels', async (page, ok) => {
    const wiz = await openWizard(page);
    const TITLES = ['Size', 'Type', 'Dividers', 'Contents', 'Doors', 'Base', 'Back', 'Review'];
    const LABELS = ['Back panel', 'Modesty panel', 'Knob', 'Open'];
    const seen = new Set();
    const found = new Set();
    let marker = false;
    // Cabinet, Open shelving, Wardrobe, Bed, Desk: the types whose steps carry the four labels.
    for (const index of [0, 1, 2, 3, 6]) {
      await rail(wiz).getByRole('button').first().click();
      await wiz
        .getByRole('radiogroup', { name: 'Construction type' })
        .getByRole('radio')
        .nth(index)
        .click();
      const names = (await rail(wiz).getByRole('button').allTextContents()).map((s) =>
        s.replace(/^\d+/, '').trim(),
      );
      for (const name of names) {
        await rail(wiz).getByRole('button', { name, exact: true }).click();
        if (await visible(wiz.getByRole('heading', { level: 3, name, exact: true })))
          seen.add(name);
        if ((await wiz.textContent())?.includes('@@')) marker = true;
        for (const l of LABELS)
          if (
            (await wiz.getByText(l, { exact: true }).count()) ||
            (await wiz.getByRole('radio', { name: l, exact: true }).count()) ||
            (await wiz.getByLabel(l, { exact: true }).count())
          )
            found.add(l);
      }
    }
    const missing = TITLES.filter((t) => !seen.has(t));
    ok('every step title shows as a heading', missing.length === 0, missing.join(', '));
    const lost = LABELS.filter((l) => !found.has(l));
    ok('Back panel, Modesty panel, Knob, Open show', lost.length === 0, lost.join(', '));
    ok('no "@@" marker shows', !marker);
  });

  // N338: the − / + of Plinth height (0 to 250 mm) are off at the limits.
  await run('N338', width, 'stepper limits', async (page, ok) => {
    await newSingle(page, /Sideboard/);
    const dlg = await openSettings(page);
    const field = dlg.getByLabel('Plinth height', { exact: true });
    const minus = dlg.getByRole('button', { name: 'Decrease Plinth height' });
    const plus = dlg.getByRole('button', { name: 'Increase Plinth height' });
    await retype(field, '100');
    ok('at 100 both are on', !(await minus.isDisabled()) && !(await plus.isDisabled()));
    await retype(field, '0');
    ok(
      'at 0 Decrease is off, Increase on',
      (await minus.isDisabled()) && !(await plus.isDisabled()),
    );
    await retype(field, '250');
    ok(
      'at 250 Increase is off, Decrease on',
      (await plus.isDisabled()) && !(await minus.isDisabled()),
    );
  });

  // N342: a file over 20 MB is refused with a visible message.
  await run('N342', width, 'too-large import', async (page, ok) => {
    const main = page.getByRole('main', { name: 'Projects' });
    const chooser = page.waitForEvent('filechooser');
    await main
      .getByRole('button', { name: 'Import a design, project or project template file' })
      .click();
    await (
      await chooser
    ).setFiles({
      name: 'big.json',
      mimeType: 'application/json',
      buffer: Buffer.alloc(20_000_001, 32),
    });
    const msg = page.getByText('That file is too large to import (over 20 MB).');
    await msg.waitFor({ timeout: 10000 }).catch(() => {});
    ok('"That file is too large to import (over 20 MB)." shows', await visible(msg));
    ok('Projects stays open', await visible(main));
  });

  // N349: ⋯ › Cut list optimizer; one typed part on the default board gives a sheet count.
  await run('N349', width, 'cut list optimizer', async (page, ok) => {
    await openMore(page);
    await page.getByRole('button', { name: /^Cut list optimizer/ }).click();
    const main = page.getByRole('main', { name: 'Cut list optimizer' });
    await main.waitFor({ timeout: 10000 });
    ok('the optimizer opens', await visible(main));
    ok(
      'the board is 2800 long',
      (await main.getByLabel('Sheet length (mm)').inputValue()) === '2800',
    );
    const part = main.getByRole('listitem', { name: 'Part 1' });
    await part.getByLabel('Length (mm)').fill('2000');
    await part.getByLabel('Width (mm)').fill('1500');
    await part.getByLabel('Qty').fill('2');
    const count = main.getByText('2 sheets', { exact: true });
    await count.waitFor({ timeout: 5000 }).catch(() => {});
    ok('"2 sheets" shows', await visible(count));
    ok('sheet 2 is drawn', await visible(main.getByRole('img', { name: 'Sheet 2: 1 parts' })));
  });

  // N350: Settings › Boards, sheets and saw cut › Common thickness (mm) › 22 sets Thickness to 22.
  await run('N350', width, 'common thickness picker', (page, ok) => commonThickness(page, ok));
  // N358: View › 3D mounts the lazy 3D preview with a drawing surface of non-zero size, and the model is drawn.
  await run('N358', width, '3D preview', async (page, ok) => {
    await newSingle(page, /Sideboard/);
    await page.getByRole('radiogroup', { name: 'View' }).getByRole('radio', { name: '3D' }).click();
    // The canvas mounts at the browser default 300 × 150 and is sized to its box a moment later.
    const view = page.getByRole('region', { name: '3D view' });
    await view.waitFor({ timeout: 20000 });
    const canvas = view.locator('canvas').first();
    let b = null;
    for (let i = 0; i < 40; i++) {
      b = await canvas.boundingBox().catch(() => null);
      if (b && !(b.width === 300 && b.height === 150) && b.width > 0 && b.height > 0) break;
      await page.waitForTimeout(250);
    }
    ok(
      'a 3D canvas mounts in "3D view", sized to its box',
      !!b && b.width > 0 && b.height > 0 && !(b.width === 300 && b.height === 150),
      JSON.stringify(b),
    );
    // The model is drawn: a screenshot of the canvas holds many colours, not one clear colour (the pixel count in the
    // page, as tools/materials/find-it.mjs does). Allow a few seconds for the first frames.
    await page.waitForTimeout(3000);
    const shot = await canvas.screenshot();
    const colours = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      const seen = new Set();
      for (let i = 0; i < d.length; i += 16)
        seen.add((d[i] >> 3) * 1024 + (d[i + 1] >> 3) * 32 + (d[i + 2] >> 3));
      return seen.size;
    }, shot.toString('base64'));
    ok('the 3D model is drawn (many colours in the canvas)', colours > 20, `${colours} colours`);
  });

  // N359 + N339 smoke: a piece's cut list lists parts; Shopping list CSV downloads a file.
  await run('N359', width, 'cut list and shopping CSV', async (page, ok) => {
    await newSingle(page, /Sideboard/);
    await goBuild(page);
    await openTab(page, /^Parts/);
    const rows = page.getByRole('tabpanel', { name: /^Parts/ }).getByRole('row');
    await rows.nth(1).waitFor({ timeout: 10000 });
    ok('the Parts tab lists rows', (await rows.count()) > 1, `${await rows.count()}`);
    await openTab(page, /^Shopping/);
    const csv = page.getByRole('button', {
      name: /Shopping list CSV|Download the shopping list as CSV/,
    });
    await csv.first().waitFor({ timeout: 10000 });
    const download = page.waitForEvent('download', { timeout: 10000 });
    await csv.first().click();
    const file = await download.catch(() => null);
    ok(
      'Shopping list CSV downloads a .csv',
      !!file && /\.csv$/.test(file.suggestedFilename()),
      file?.suggestedFilename() ?? 'no download',
    );
  });

  await run('N339', width, 'smoke: wizard piece and its cut list', async (page, ok) => {
    const wiz = await openWizard(page);
    await wiz.getByRole('radio', { name: /Cabinet \(closed box\)/ }).click();
    await rail(wiz).getByRole('button', { name: 'Review' }).click();
    await wiz.getByRole('button', { name: 'Create piece' }).click();
    await page.getByRole('region', { name: 'Drawing' }).waitFor({ timeout: 15000 });
    ok('the new piece opens in the editor', true);
    if (phoneOf(page)) await skipHints(page);
    await goBuild(page);
    await openTab(page, /^Parts/);
    const rows = page.getByRole('tabpanel', { name: /^Parts/ }).getByRole('row');
    await rows.nth(1).waitFor({ timeout: 10000 });
    ok('its cut list shows parts', (await rows.count()) > 1, `${await rows.count()}`);
  });
}

// Phone-only rows.
// N318 (F-25): a single piece in 2D shows no empty "Options" menu at 390 px.
await run('N318', PHONE, 'no empty Options in 2D', async (page, ok) => {
  await newSingle(page, /Sideboard/);
  const view = page.getByRole('radiogroup', { name: 'View' });
  ok(
    '2D is the view',
    (await view.getByRole('radio', { name: '2D' }).getAttribute('aria-checked')) === 'true' ||
      (await view.getByRole('radio', { name: '2D' }).isChecked()),
  );
  const options = page.getByText('Options', { exact: true });
  let shown = 0;
  for (let i = 0; i < (await options.count()); i++) if (await visible(options.nth(i))) shown++;
  ok('no "Options" menu beside 2D · 3D · Both', shown === 0, `${shown}`);
});

// N318 (G-519): Escape in the Save as project template form closes the form, not Settings.
async function escInForm(page, ok, sheet = false) {
  await page.getByRole('button', { name: 'Create a new project' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Create project' }).click();
  await page.getByRole('region', { name: 'Drawing' }).waitFor({ timeout: 15000 });
  await skipHints(page);
  if (sheet) await sheetEditor(page, ok);
  const peek = page
    .getByRole('complementary', { name: 'Compose' })
    .locator('[aria-expanded="false"]');
  if (sheet && (await visible(peek.first()))) await peek.first().click();
  await page.getByRole('button', { name: 'Add a piece' }).first().click();
  const add = page.getByRole('dialog', { name: 'Add a piece' });
  await add.getByRole('searchbox', { name: 'Search the items' }).fill('Base');
  await add
    .getByRole('button', { name: /Base cabinet, doors: 1 door/ })
    .first()
    .click();
  await add.waitFor({ state: 'hidden' });
  const place = page.getByRole('button', { name: 'Place to the right' });
  if (await visible(place)) await place.click();
  const settings = await openSettings(page);
  const save = settings.getByRole('button', { name: 'Save as project template' });
  const reached = await reach(save);
  ok('"Save as project template" can be reached in Settings', reached);
  if (!reached) return;
  const name = page.getByRole('textbox', { name: 'Name of the project template' });
  await name.click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  ok('the template form closed', !(await visible(name)));
  ok('Settings stays open', await visible(page.getByRole('dialog', { name: /^Settings/ })));
}
await run('N318', PHONE, 'Esc closes only the form', (page, ok) => escInForm(page, ok));
// The same with the canvas editor switched off (More › Canvas editor (preview)), the sheet the jsdom tests use; it
// does not replace the default-path check above.
await run('N318 (sheet editor)', PHONE, 'Esc closes only the form', (page, ok) =>
  escInForm(page, ok, true),
);
await run('N350 (sheet editor)', PHONE, 'common thickness picker', (page, ok) =>
  commonThickness(page, ok, true),
);

// N373: a first visit on a phone opens the canvas editor and shows "Getting started".
await run('N373', PHONE, 'first visit Getting started', async (page, ok) => {
  await page.getByRole('button', { name: 'New single piece' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Chest of drawers/ })
    .first()
    .click();
  const hints = page.getByRole('dialog', { name: 'Getting started' });
  await hints.waitFor({ timeout: 10000 }).catch(() => {});
  ok('"Getting started" shows', await visible(hints));
  ok(
    'the canvas editor shows (Editor actions, Selection path)',
    (await visible(page.getByRole('toolbar', { name: 'Editor actions' }))) &&
      (await visible(page.getByRole('navigation', { name: 'Selection path' }))),
  );
});

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
