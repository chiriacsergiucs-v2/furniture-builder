// Find-it acceptance for ADR-051 and ADR-054…062, ADR-064 (check labels name the ADR) (backlog N46, N49–N57, N59), run against a production build:
//   npm run build && npx vite preview --port 4173 &  node tools/ensemble/find-it-adrs.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text. Not part of `npm test`.
import { launchBrowser, previewUrl, outDir } from '../lib/harness.mjs';
import { goBuild, goCompose, openPieceEditor, openTab, showPieces } from '../lib/steps.mjs';
import { mkdirSync, readFileSync } from 'node:fs';

const url = previewUrl();
const out = outDir();
mkdirSync(out, { recursive: true });
const browser = await launchBrowser();
const results = [];
const check = (width, name, ok, detail = '') => {
  results.push({ width, name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${width}px ${name}${detail ? ` — ${detail}` : ''}`);
};

for (const width of [1440, 375]) {
  const phone = width < 500;
  const ctx = await browser.newContext({
    viewport: { width, height: phone ? 812 : 900 },
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  // ADR-117: the selected piece's Position, Clearance, Finish and Merge are folded groups: open one by its title
  // (when it is on screen; a phone's closed sheet hides the whole card, which is read as before).
  const openGroup = async (title) => {
    const s = page
      .locator('details.group > summary')
      .filter({ hasText: new RegExp(`^${title}$`) })
      .first();
    if ((await s.isVisible()) && !(await s.evaluate((el) => el.parentElement.open)))
      await s.click({ timeout: 5000 });
  };
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const wide = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('body *')]
        .filter(
          (e) =>
            e.getBoundingClientRect().right > window.innerWidth + 1 &&
            getComputedStyle(e).position !== 'fixed',
        )
        .slice(0, 5)
        .map((e) => `${e.tagName}.${e.className}`)
        .join(', '),
    );
  const shot = (name) =>
    page.screenshot({ path: `${out}/adrs-${name}-${width}.png`, fullPage: true });
  const dlg = page.locator('dialog[open]');
  const pieces = page.locator('ul.pieces > li');
  // Sticky bars can cover a visible control on phones; then the click is sent to the control itself.
  const click = async (loc) => {
    await loc.scrollIntoViewIfNeeded();
    await loc.click({ timeout: 3000 }).catch(() => loc.dispatchEvent('click'));
  };
  const btn = (name, exact = true) => page.getByRole('button', { name, exact });
  const answer = async (text, label) => {
    const d = page.locator('dialog.confirm[open]');
    await d.locator('input').fill(text);
    await d.getByRole('button', { name: label }).click();
    await d.waitFor({ state: 'detached' }).catch(() => {});
  };
  const confirm = async (label) => {
    const d = page.locator('dialog.confirm[open]');
    await d.getByRole('button', { name: label }).click();
    await d.waitFor({ state: 'detached' }).catch(() => {});
  };
  // A phone's project panel is in the bottom sheet (ADR-091): open it from its peek before using the panel.
  const openSheet = async () => {
    const peek = page.locator('.sheet-peek');
    if (
      (await peek.isVisible().catch(() => false)) &&
      (await peek.getAttribute('aria-expanded')) === 'false'
    )
      await peek.click();
  };
  const addPiece = async (search) => {
    await openSheet();
    await click(btn('Add a piece'));
    await dlg.getByRole('searchbox', { name: 'Search the items' }).fill(search);
    await dlg.locator('.start-group .row-btn').first().click();
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
  };
  const selectPiece = async (i) => {
    await showPieces(page);
    await click(pieces.nth(i).getByRole('button').first());
    await openGroup('Position');
  };
  const field = (label) => page.getByLabel(label, { exact: true }).first();
  const setField = async (label, v) => {
    await openSheet();
    await openGroup('Position');
    const f = field(label);
    await f.scrollIntoViewIfNeeded();
    await f.fill(String(v));
    await f.press('Enter');
    await page.waitForTimeout(150);
  };
  const plan = page.getByRole('figure', { name: /Room plan, seen from above/ });
  /** Click the plan at room coordinates (mm). */
  const tapPlan = async (x, z) => {
    await plan.scrollIntoViewIfNeeded();
    const pt = await plan.locator(':scope > svg').evaluate(
      (svg, [x, z]) => {
        const m = svg.getScreenCTM();
        const p = new DOMPoint(x, z).matrixTransform(m);
        return { x: p.x, y: p.y };
      },
      [x, z],
    );
    await page.mouse.click(pt.x, pt.y);
    await page.waitForTimeout(150);
  };
  // The parts CSV is the Parts tab's "Download CSV" (was "Parts CSV"), shown in Build & Preview / the phone's
  // Cut list place (ADR-241); the drawing comes back afterwards so the piece list stays reachable.
  const partsCsv = async () => {
    await goBuild(page);
    await openTab(page, /^Parts/);
    const [d] = await Promise.all([page.waitForEvent('download'), click(btn('Download CSV'))]);
    const text = readFileSync(await d.path(), 'utf8');
    await goCompose(page);
    return text;
  };
  // Run parts (Suggest run parts, scribe, Keep up to date) are in the project's top-bar Settings dialog
  // (ADR-080, ADR-160: ProjectPanel mode 'configure').
  const openProjectSettings = async () => {
    await click(btn('Settings'));
    await dlg.getByRole('region', { name: 'Run parts' }).waitFor();
  };
  const closeDialog = async () => {
    await page.keyboard.press('Escape');
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
  };
  // The results tabs are in Build & Preview / the phone's Cut list place (ADR-241); a click on the open tab closes
  // it, so openTab clicks only when needed. `back` returns to the drawing (Compose / Editor).
  const checksText = async () => {
    await goBuild(page);
    await openTab(page, /^Checks/);
    await page.waitForTimeout(200);
    return page.locator('#panel-checks').innerText();
  };
  const back = () => goCompose(page);
  // Remove from project is under the selected piece's More actions since ADR-160.
  const removeSelected = async () => {
    await click(
      page
        .getByRole('region', { name: /^Selected piece: / })
        .getByRole('button', { name: 'More actions' })
        .first(),
    );
    await click(page.getByRole('button', { name: 'Remove from project' }));
    await confirm('Remove');
  };

  // Project from the bare app.
  await page.goto(url);
  await click(btn('Create a new project'));
  await answer(`ADRs ${width}`, 'Create project');
  await page.locator('main.work').waitFor({ state: 'visible' });

  // ADR-056: an added piece waits; "Place to the right" or a tap on the plan places it.
  await addPiece('Base cabinet');
  check(
    width,
    'ADR-056 banner "Tap the plan to place" after adding',
    await page.getByText('Tap the plan to place').isVisible(),
  );
  // Cancel takes the just-added piece out again (project undo) and ends placing.
  await click(btn('Cancel'));
  await page.waitForTimeout(150);
  check(
    width,
    'ADR-056 Cancel removes the just-added piece (0 pieces, banner gone)',
    (await pieces.count()) === 0 && !(await page.getByText('Tap the plan to place').isVisible()),
    `${await pieces.count()} pieces`,
  );
  await addPiece('Base cabinet');
  await click(btn('Place to the right'));
  await addPiece('Base cabinet');
  // A phone's plan fits the two pieces (about -150…1350 mm wide), so the tap goes in front of them there.
  const [tapX, tapZ] = phone ? [700, 800] : [2000, 300];
  await tapPlan(tapX, tapZ);
  await openSheet();
  await openGroup('Position');
  check(
    width,
    `ADR-056 tapped piece placed at the tapped point (From left ≈ ${tapX})`,
    Math.abs(Number(await field('From left').inputValue()) - tapX) <= 15,
    await field('From left').inputValue(),
  );
  await setField('From left', 600);
  await setField('From back', 0);
  await addPiece('Base cabinet');
  await click(btn('Place to the right'));
  await showPieces(page);
  check(width, 'three base cabinets in the project', (await pieces.count()) === 3);
  await shot('placed');

  // ADR-051: project undo/redo with the visible buttons.
  await selectPiece(2);
  // Remove from project is under the piece's More actions since ADR-160.
  await click(
    page
      .getByRole('region', { name: /^Selected piece: / })
      .getByRole('button', { name: 'More actions' })
      .first(),
  );
  await click(page.getByRole('button', { name: 'Remove from project' }));
  await confirm('Remove');
  await showPieces(page);
  check(width, 'ADR-051 piece removed', (await pieces.count()) === 2);
  await click(btn('Undo'));
  await showPieces(page);
  check(width, 'ADR-051 Undo brings it back', (await pieces.count()) === 3);
  await click(btn('Redo'));
  await showPieces(page);
  check(width, 'ADR-051 Redo removes it again', (await pieces.count()) === 2);
  await click(btn('Undo'));

  // ADR-054/0058: sides on the bottom → run plinth; scribe; automatic refresh after a gap change.
  for (let i = 0; i < 3; i++) {
    await selectPiece(i);
    await openPieceEditor(page);
    // The construction choices are in the piece editor's Settings (ADR-160, ADR-247).
    await click(btn('Settings'));
    await click(page.getByRole('radio', { name: 'Under the sides' }));
    await page.keyboard.press('Escape');
    await click(btn('Back to project', false));
  }
  await openProjectSettings();
  await click(dlg.getByRole('button', { name: 'Suggest run parts' }));
  const runList = dlg.getByRole('region', { name: 'Run parts' });
  check(
    width,
    "ADR-054 run parts list a Plinth replacing the pieces' own",
    /Plinth[\s\S]*replaces their own plinths/.test(await runList.innerText()),
  );
  const scribe = dlg.getByLabel('Scribe allowance for fillers', { exact: true });
  await scribe.fill('20');
  await scribe.press('Enter');
  await closeDialog();
  const plinthRows = (await partsCsv()).split('\n').filter((l) => /Plintă/.test(l));
  check(
    width,
    'ADR-054 Parts CSV: one plinth row, the run plinth, 1800 mm',
    plinthRows.length === 1 && /^Run: Plintă/.test(plinthRows[0]) && /;1800;/.test(plinthRows[0]),
    plinthRows.join(' | '),
  );
  await selectPiece(2);
  await setField('Gap to Base cabinet, 1 door on the left', 40);
  await openProjectSettings();
  const runText = await runList.innerText();
  check(
    width,
    'ADR-061 filler appears by itself after the gap change',
    /Filler[\s\S]*gap 40 mm \+ 20 mm scribe/.test(runText),
    runText.replace(/\n/g, ' ').slice(0, 200),
  );
  check(
    width,
    'ADR-061 "Keep run parts up to date" is on',
    await dlg.getByLabel('Keep run parts up to date').isChecked(),
  );
  await shot('run-parts');
  await closeDialog();

  // ADR-055: finish scope. A wardrobe away from the run must keep its own doors.
  await addPiece('Wardrobe');
  await click(btn('Place to the right'));
  await showPieces(page);
  check(width, 'ADR-055 wardrobe added away from the run', (await pieces.count()) === 4);
  await selectPiece(0);
  // A board no door uses yet, so "not on the chosen board" really means the wardrobe was left alone.
  const before = (await partsCsv()).split('\n').filter((l) => /: Ușă/.test(l));
  // The finish is the top-bar Material dialog since ADR-163/ADR-247 (was the card's Finish group, ADR-117):
  // Apply to "Group" (the run this item stands in, the old "This run"), Parts "Fronts", a Board, Apply material.
  await click(btn('Material'));
  const finish = dlg;
  check(
    width,
    'ADR-055 finish (Material dialog) open for the selected piece',
    await finish.getByRole('button', { name: 'Apply material' }).isVisible(),
  );
  const board = finish.getByLabel('Board', { exact: true });
  const opts = await board.locator('option').allTextContents();
  const free = (o) => !before.some((l) => l.includes(`;${o.split(',')[0]};`));
  const thick = opts.findIndex((o) => free(o) && /, 18 mm$/.test(o));
  const unused = thick >= 0 ? thick : opts.findIndex(free);
  const boardIndex = unused >= 0 ? unused : opts.length > 1 ? 1 : 0;
  const boardName = opts[boardIndex].split(',')[0];
  await click(finish.getByRole('radio', { name: 'Group', exact: true }));
  await click(finish.getByRole('button', { name: 'Fronts', exact: true }));
  await board.selectOption({ index: boardIndex });
  await click(finish.getByRole('button', { name: 'Apply material' }));
  const applied = await finish
    .getByRole('status')
    .innerText()
    .catch(() => '');
  check(
    width,
    'ADR-055 applied to the three pieces of the run',
    /Applied to 3 items/.test(applied),
    applied,
  );
  await closeDialog();
  const doorRows = (await partsCsv()).split('\n').filter((l) => /: Ușă/.test(l));
  // Piece names are printed in the print language, Romanian by default (ADR-212).
  const baseDoors = doorRows.filter((l) => /^Corp bază/.test(l));
  const wardrobeDoors = doorRows.filter((l) => /^Dulap de haine/.test(l));
  check(
    width,
    'ADR-055 Parts CSV: the base-cabinet doors are on the chosen board',
    baseDoors.length > 0 && baseDoors.every((l) => l.includes(`;${boardName};`)),
    `${boardName}: ${baseDoors.length} rows`,
  );
  check(
    width,
    'ADR-055 Parts CSV: the wardrobe doors (not in the run) are not',
    wardrobeDoors.length > 0 && wardrobeDoors.every((l) => !l.includes(`;${boardName};`)),
    wardrobeDoors.join(' | '),
  );

  // ADR-057: a wardrobe turned to face the run, 300 mm away → cannot open fully (warning, export allowed).
  await selectPiece(3);
  // Turned with the card's Turn buttons (ADR-160: two 90° turns; the 0/90/180/270 radios are gone).
  await click(btn('Turn 90° clockwise about its centre'));
  await click(btn('Turn 90° clockwise about its centre'));
  await setField('From left', 0);
  await setField('From back', 900);
  const checks1 = await checksText();
  check(width, 'ADR-057 Checks list "cannot open fully"', /cannot open fully/.test(checks1));
  check(
    width,
    'ADR-057 export stays allowed (Download CSV enabled)',
    await openTab(page, /^Parts/).then(() => btn('Download CSV').isEnabled()),
  );
  await back();

  // ADR-058: the room with an obstacle the run hits.
  await selectPiece(3);
  await removeSelected();
  await click(btn('Add the room'));
  const roomSec = page.getByRole('region', { name: 'Room' });
  // A set room is a closed fold named by its summary (ADR-160): open it before using its fields.
  const openRoom = async () => {
    const fold = roomSec.locator('details.room-fold');
    if ((await fold.count()) && !(await fold.evaluate((el) => el.open)))
      await click(fold.locator(':scope > summary'));
  };
  await openRoom();
  check(
    width,
    'ADR-058 room added: "Room height" and walls listed',
    (await roomSec.getByRole('textbox', { name: 'Room height', exact: true }).isVisible()) &&
      (await roomSec.getByRole('textbox', { name: 'Wall 4', exact: true }).isVisible()),
  );
  await click(roomSec.getByRole('button', { name: 'Add obstacle' }));
  const checks2 = await checksText();
  check(
    width,
    'ADR-058 Checks: base cabinet runs into the obstacle',
    /runs into Obstacle 1/.test(checks2),
  );
  check(
    width,
    'ADR-058 the plan draws the room outline',
    (await plan.locator('.room-outline .wall').count()) >= 4,
  );
  await back();
  await openRoom();
  await click(roomSec.getByRole('button', { name: 'Remove obstacle' }));
  await click(roomSec.getByRole('button', { name: 'Add window' }));
  await setField('Sill height', 500);
  check(
    width,
    'ADR-058 the plan shows the window',
    (await plan.locator('.room-window').count()) === 1,
  );
  const checks3 = await checksText();
  check(
    width,
    'ADR-058 Checks: cabinets against the window wall cover the window',
    /covers the window/.test(checks3),
  );
  await back();
  await openRoom();
  await click(roomSec.getByRole('button', { name: 'Remove window' }));

  // ADR-059: ready L-shape (six walls), then draw the room by tapping.
  await openRoom();
  await click(roomSec.getByRole('radio', { name: 'L-shape' }));
  check(
    width,
    'ADR-059 L-shape gives six walls',
    await roomSec.getByRole('textbox', { name: 'Wall 6', exact: true }).isVisible(),
  );
  await selectPiece(2);
  await setField('From left', 2200);
  await setField('From back', 2400);
  const checks4 = await checksText();
  check(
    width,
    'ADR-059 a piece in the L cut-out is outside the room',
    /outside the room/.test(checks4),
  );
  await back();
  await click(btn('Undo'));
  await click(btn('Undo'));
  await openRoom();
  await click(roomSec.getByRole('button', { name: 'Draw the room again' }));
  check(
    width,
    'ADR-059 drawing banner visible',
    await page.getByText('Tap the corners of the room').isVisible(),
  );
  for (const [x, z] of [
    [0, 0],
    [4200, 0],
    [4200, 3000],
    [0, 3000],
  ])
    await tapPlan(x, z);
  await click(btn('Close the room'));
  await openSheet();
  await openRoom();
  check(
    width,
    'ADR-059 drawn room has four walls of the tapped lengths',
    (await roomSec.getByRole('textbox', { name: 'Wall 4', exact: true }).isVisible()) &&
      !(await roomSec.getByRole('textbox', { name: 'Wall 5', exact: true }).count()) &&
      Math.abs(
        Number(
          await roomSec
            .getByRole('textbox', { name: 'Wall 1', exact: true })
            .inputValue({ timeout: 3000 })
            .catch(() => 'NaN'),
        ) - 4200,
      ) <= 20,
    await roomSec
      .getByRole('textbox', { name: 'Wall 1', exact: true })
      .inputValue({ timeout: 3000 })
      .catch(() => 'no Wall 1'),
  );
  await shot('room');

  // ADR-064 + ADR-062: Shopping list with my prices.
  // The Shopping list tab is in Build & Preview / the phone's Cut list place (ADR-241).
  await goBuild(page);
  await openTab(page, 'Shopping list');
  const shop = page.locator('#panel-shopping');
  await shop.getByRole('heading', { name: 'Boards' }).waitFor();
  // ADR-077: edge banding is listed by its named band; the starting boards name none, so their banding is listed
  // under "To choose before buying" as "Edge band for <board>" (an Edge banding section appears once named).
  const banding =
    (await shop.getByRole('heading', { name: 'Edge banding' }).isVisible()) ||
    (await shop
      .getByRole('region', { name: 'To choose before buying' })
      .getByText(/^Edge band for /)
      .first()
      .isVisible());
  check(
    width,
    'ADR-064 sections Boards, Edge banding (or its bands to choose), Hardware, Run parts',
    (await shop.getByRole('heading', { name: 'Boards' }).isVisible()) &&
      banding &&
      (await shop.getByRole('heading', { name: 'Hardware' }).isVisible()) &&
      (await shop.getByRole('heading', { name: 'Run parts' }).isVisible()),
    (await shop.getByRole('heading').allInnerTexts()).join(', '),
  );
  // The "not counted" line is the estimate's "Guidance: what is not counted" tip now; screws are counted only as
  // joints (guidance, ADR-209) and glue is not counted.
  await click(shop.getByRole('button', { name: 'Guidance: what is not counted' }));
  check(
    width,
    'ADR-064 "not counted" line for screws',
    await shop
      .getByText(/Screws, dowels and cams are counted only as joints[\s\S]*Glue is not counted/)
      .isVisible(),
  );
  await page.keyboard.press('Escape');
  // Sheets are counted once the layout is done: the Boards line then shows "sheets".
  const boardsTable = shop.getByRole('region', { name: 'Boards' });
  check(
    width,
    'ADR-062 Boards are counted in sheets from the layout',
    await boardsTable
      .getByText(/\d+ sheets/)
      .first()
      .waitFor({ timeout: 20000 })
      .then(
        () => true,
        () => false,
      ),
    (await boardsTable.innerText()).replace(/\n/g, ' ').slice(0, 160),
  );
  await click(shop.getByRole('button', { name: 'Prices' }));
  const unitBox = shop.getByLabel(/^Price unit of /).first();
  const priceBox = shop.getByLabel(/^Price of /).first();
  await unitBox.selectOption('sheet');
  await priceBox.fill('250');
  await priceBox.press('Tab');
  await page.waitForTimeout(200);
  const estSheet = await shop.locator('.estimate').innerText();
  check(
    width,
    'ADR-062 a price per sheet gives a non-zero estimate and lists the missing prices',
    /Estimate: [1-9][\d\s.,]* lei/.test(estSheet) && /missing/.test(estSheet),
    estSheet.replace(/\n/g, ' '),
  );
  await unitBox.selectOption('m2');
  await priceBox.fill('250');
  await priceBox.press('Tab');
  await page.waitForTimeout(200);
  const est = await shop.locator('.estimate').innerText();
  check(
    width,
    'ADR-062 a price per m² gives a non-zero estimate and lists the missing prices',
    /Estimate: [1-9][\d\s.,]* lei/.test(est) && /missing/.test(est) && est !== estSheet,
    est.replace(/\n/g, ' '),
  );
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    click(shop.getByRole('button', { name: 'Shopping list CSV' })),
  ]);
  const csv = readFileSync(await dl.path(), 'utf8');
  check(
    width,
    'ADR-064 Shopping list CSV downloads with sections',
    /Plăci/.test(csv) && /Feronerie/.test(csv),
  );
  await shot('shopping');

  // ADR-060: save as a project template, use it from Home.
  // Save as project template is in the project's Settings dialog (ADR-080), named in its own dialog (ADR-200).
  await back();
  await openProjectSettings();
  await click(dlg.getByRole('button', { name: 'Save as project template' }));
  const nameDlg = page.locator('dialog[open]').filter({ hasText: 'Name of the project template' });
  await nameDlg.getByLabel('Name of the project template').fill(`Template ${width}`);
  await nameDlg.getByRole('button', { name: 'Save template' }).click();
  check(
    width,
    'ADR-060 saved message',
    await page
      .getByText(/Saved as project template/)
      .waitFor({ timeout: 5000 })
      .then(
        () => true,
        () => false,
      ),
  );
  await closeDialog();
  // Home is the Projects place now (top-bar / bottom nav "Places").
  await page
    .getByRole('navigation', { name: 'Places' })
    .getByRole('link', { name: /^Projects/ })
    .click();
  await page.getByRole('heading', { name: 'Create from a project template' }).waitFor();
  await click(page.getByRole('button', { name: new RegExp(`Template ${width}`) }));
  // Named in the template's own Create project dialog (ADR-200).
  const createDlg = page.locator('dialog[open]').filter({ hasText: 'Name of the new project' });
  await createDlg.getByLabel('Name of the new project').fill(`From template ${width}`);
  await createDlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await showPieces(page);
  check(
    width,
    'ADR-060 new project from the template has the three pieces',
    (await pieces.count()) === 3,
  );
  await openProjectSettings();
  check(
    width,
    'ADR-060 run parts suggested again',
    /Worktop/.test(await dlg.getByRole('region', { name: 'Run parts' }).innerText()),
  );
  await closeDialog();

  // ADR-054 sink false front, in a single piece.
  // New is the top bar's More menu "New… piece or project" now.
  await click(page.locator('details.menu.more > summary'));
  await click(page.getByRole('button', { name: /^New…/ }));
  await dlg.getByRole('searchbox', { name: 'Search the items' }).fill('Chest of drawers');
  await dlg.locator('.start-group .row-btn').first().click();
  await dlg.waitFor({ state: 'detached' }).catch(() => {});
  await click(page.getByRole('radio', { name: '2D' }));
  await page
    .getByRole('button', { name: /drawers space/ })
    .first()
    .click();
  // A first tap selects the whole piece ("Tap the piece again to pick a space inside it"); the whole-piece card's
  // "Edit the interior" opens the drawers space and its options.
  const fixedTop = page.getByLabel('Top drawer is a fixed front (sink false front)');
  if (!(await fixedTop.isVisible())) await click(btn(/Edit the interior/, false));
  await click(fixedTop);
  // Results tabs are in Build & Preview / the phone's Cut list place (ADR-241).
  await goBuild(page);
  await openTab(page, 'Hardware');
  check(
    width,
    'ADR-054 fixed front: fixing listed as user-specified',
    await page.getByText('Fixing for the fixed (false) front').isVisible(),
  );
  await openTab(page, 'Shopping list');
  check(
    width,
    'ADR-064 "To choose before buying" lists the front fixing',
    await page
      .locator('#panel-shopping')
      .getByRole('heading', { name: 'To choose before buying' })
      .isVisible(),
  );

  check(width, 'no sideways scroll', await noSideScroll(), await wide());
  check(width, 'no page errors', errors.length === 0, errors.join(' / '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
