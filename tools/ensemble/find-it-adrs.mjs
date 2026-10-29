// Find-it acceptance for ADR-051 and ADR-054…062, ADR-064 (check labels name the ADR) (backlog N46, N49–N57, N59), run against a production build:
//   npm run build && npx vite preview --port 4173 &  node tools/ensemble/find-it-adrs.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text. Not part of `npm test`.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4173/furniture-builder/';
const out = process.argv[3] ?? 'dist-acceptance';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
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
  const addPiece = async (search) => {
    await click(btn('Add a piece'));
    await dlg.getByRole('searchbox', { name: 'Search the items' }).fill(search);
    await dlg.locator('.start-group .row-btn').first().click();
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
  };
  const selectPiece = async (i) => {
    await click(pieces.nth(i).getByRole('button').first());
    await openGroup('Position');
  };
  const field = (label) => page.getByLabel(label, { exact: true }).first();
  const setField = async (label, v) => {
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
    const pt = await plan.locator('svg').evaluate(
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
  const partsCsv = async () => {
    const [d] = await Promise.all([page.waitForEvent('download'), click(btn('Parts CSV'))]);
    return readFileSync(await d.path(), 'utf8');
  };
  const checksText = async () => {
    await click(page.getByRole('tab', { name: /Checks/ }));
    await page.waitForTimeout(200);
    return page.locator('#panel-checks').innerText();
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
  await tapPlan(2000, 300);
  await openGroup('Position');
  check(
    width,
    'ADR-056 tapped piece placed at the tapped point (From left ≈ 2000)',
    Math.abs(Number(await field('From left').inputValue()) - 2000) <= 15,
    await field('From left').inputValue(),
  );
  await setField('From left', 600);
  await setField('From back', 0);
  await addPiece('Base cabinet');
  await click(btn('Place to the right'));
  check(width, 'three base cabinets in the project', (await pieces.count()) === 3);
  await shot('placed');

  // ADR-051: project undo/redo with the visible buttons.
  await selectPiece(2);
  await click(page.getByRole('button', { name: 'Remove from project' }));
  await confirm('Remove');
  check(width, 'ADR-051 piece removed', (await pieces.count()) === 2);
  await click(btn('Undo'));
  check(width, 'ADR-051 Undo brings it back', (await pieces.count()) === 3);
  await click(btn('Redo'));
  check(width, 'ADR-051 Redo removes it again', (await pieces.count()) === 2);
  await click(btn('Undo'));

  // ADR-054/0058: sides on the bottom → run plinth; scribe; automatic refresh after a gap change.
  for (let i = 0; i < 3; i++) {
    await selectPiece(i);
    await click(btn('Edit this piece'));
    await click(page.getByRole('radio', { name: 'Under the sides' }));
    await click(btn('Back to project'));
  }
  await click(btn('Suggest run parts'));
  const runList = page.getByRole('region', { name: 'Run parts' });
  check(
    width,
    "ADR-054 run parts list a Plinth replacing the pieces' own",
    /Plinth[\s\S]*replaces their own plinths/.test(await runList.innerText()),
  );
  const plinthRows = (await partsCsv()).split('\n').filter((l) => /Plintă/.test(l));
  check(
    width,
    'ADR-054 Parts CSV: one plinth row, the run plinth, 1800 mm',
    plinthRows.length === 1 && /^Run: Plintă/.test(plinthRows[0]) && /;1800;/.test(plinthRows[0]),
    plinthRows.join(' | '),
  );
  await setField('Scribe allowance for fillers', 20);
  await selectPiece(2);
  await setField('Gap to Base cabinet, 1 door on the left', 40);
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
    await page.getByLabel('Keep run parts up to date').isChecked(),
  );
  await shot('run-parts');

  // ADR-055: finish scope. A wardrobe away from the run must keep its own doors.
  await addPiece('Wardrobe');
  await click(btn('Place to the right'));
  check(width, 'ADR-055 wardrobe added away from the run', (await pieces.count()) === 4);
  await selectPiece(0);
  await openGroup('Finish');
  const finish = page.locator('.finish-fields');
  await finish.scrollIntoViewIfNeeded();
  check(
    width,
    'ADR-055 "Finish" group open in the selected piece (folded since ADR-117)',
    await finish.getByRole('button', { name: 'Apply finish' }).isVisible(),
  );
  const opts = await finish.getByLabel('Board').locator('option').allTextContents();
  // A board no door uses yet, so "not on the chosen board" really means the wardrobe was left alone.
  const before = (await partsCsv()).split('\n').filter((l) => /: Ușă/.test(l));
  const free = (o) => !before.some((l) => l.includes(`;${o.split(',')[0]};`));
  const thick = opts.findIndex((o) => free(o) && /, 18 mm$/.test(o));
  const unused = thick >= 0 ? thick : opts.findIndex(free);
  const boardIndex = unused >= 0 ? unused : opts.length > 1 ? 1 : 0;
  const boardName = opts[boardIndex].split(',')[0];
  await finish.getByLabel('Board').selectOption({ index: boardIndex });
  await click(finish.getByRole('radio', { name: 'This run' }));
  await click(finish.getByRole('button', { name: 'Apply finish' }));
  check(
    width,
    'ADR-055 applied to the three pieces of the run',
    /Applied to 3 pieces/.test(await finish.innerText()),
    (await finish.innerText()).replace(/\n/g, ' ').slice(-80),
  );
  const doorRows = (await partsCsv()).split('\n').filter((l) => /: Ușă/.test(l));
  const baseDoors = doorRows.filter((l) => /^Base cabinet/.test(l));
  const wardrobeDoors = doorRows.filter((l) => /^Wardrobe/.test(l));
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
  await click(page.getByRole('radio', { name: '180°' }));
  await setField('From left', 0);
  await setField('From back', 900);
  const checks1 = await checksText();
  check(width, 'ADR-057 Checks list "cannot open fully"', /cannot open fully/.test(checks1));
  check(
    width,
    'ADR-057 export stays allowed (Parts CSV enabled)',
    await btn('Parts CSV').isEnabled(),
  );
  await click(page.getByRole('tab', { name: /Parts/ }));

  // ADR-058: the room with an obstacle the run hits.
  await selectPiece(3);
  await click(page.getByRole('button', { name: 'Remove from project' }));
  await confirm('Remove');
  await click(btn('Add the room'));
  const roomSec = page.getByRole('region', { name: 'Room' });
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
  await click(page.getByRole('tab', { name: /Parts/ }));
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
  await click(page.getByRole('tab', { name: /Parts/ }));
  await click(roomSec.getByRole('button', { name: 'Remove window' }));

  // ADR-059: ready L-shape (six walls), then draw the room by tapping.
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
  await click(page.getByRole('tab', { name: /Parts/ }));
  await click(btn('Undo'));
  await click(btn('Undo'));
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
  check(
    width,
    'ADR-059 drawn room has four walls of the tapped lengths',
    (await roomSec.getByRole('textbox', { name: 'Wall 4', exact: true }).isVisible()) &&
      !(await roomSec.getByRole('textbox', { name: 'Wall 5', exact: true }).count()) &&
      Math.abs(
        Number(await roomSec.getByRole('textbox', { name: 'Wall 1', exact: true }).inputValue()) -
          4200,
      ) <= 20,
    await roomSec.getByRole('textbox', { name: 'Wall 1', exact: true }).inputValue(),
  );
  await shot('room');

  // ADR-064 + ADR-062: Shopping list with my prices.
  await click(page.getByRole('tab', { name: 'Shopping list' }));
  const shop = page.locator('#panel-shopping');
  await shop.getByRole('heading', { name: 'Boards' }).waitFor();
  check(
    width,
    'ADR-064 sections Boards, Edge banding, Hardware, Run parts',
    (await shop.getByRole('heading', { name: 'Boards' }).isVisible()) &&
      (await shop.getByRole('heading', { name: 'Edge banding' }).isVisible()) &&
      (await shop.getByRole('heading', { name: 'Hardware' }).isVisible()) &&
      (await shop.getByRole('heading', { name: 'Run parts' }).isVisible()),
  );
  check(
    width,
    'ADR-064 "not counted" line for screws',
    await shop.getByText(/Screws, dowels, cams and glue are not counted/).isVisible(),
  );
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
  await click(page.getByRole('tab', { name: /Parts/ }));
  await click(btn('Save as project template'));
  await answer(`Template ${width}`, 'Save template');
  await confirm('Cancel').catch(() => {});
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
  await page.getByRole('link', { name: 'Home' }).click();
  await page.getByRole('heading', { name: 'Create from a project template' }).waitFor();
  await click(page.getByRole('button', { name: new RegExp(`Template ${width}`) }));
  await answer(`From template ${width}`, 'Create project');
  await page.locator('main.work').waitFor({ state: 'visible' });
  check(
    width,
    'ADR-060 new project from the template has the three pieces',
    (await pieces.count()) === 3,
  );
  check(
    width,
    'ADR-060 run parts suggested again',
    /Worktop/.test(await page.getByRole('region', { name: 'Run parts' }).innerText()),
  );

  // ADR-054 sink false front, in a single piece.
  await click(btn('New'));
  await dlg.getByRole('searchbox', { name: 'Search the items' }).fill('Chest of drawers');
  await dlg.locator('.start-group .row-btn').first().click();
  await dlg.waitFor({ state: 'detached' }).catch(() => {});
  await click(page.getByRole('radio', { name: '2D' }));
  await page
    .getByRole('button', { name: /drawers space/ })
    .first()
    .click();
  await click(page.getByLabel('Top drawer is a fixed front (sink false front)'));
  await click(page.getByRole('tab', { name: 'Hardware' }));
  check(
    width,
    'ADR-054 fixed front: fixing listed as user-specified',
    await page.getByText('Fixing for the fixed (false) front').isVisible(),
  );
  await click(page.getByRole('tab', { name: 'Shopping list' }));
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
