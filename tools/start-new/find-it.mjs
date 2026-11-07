// Production acceptance for ADR-193 (N198): start from the bare app at 390 and 1280 px and use visible controls —
// More → New… (Start something new), Fill a wall (wrong width + Enter, Refine → Back), Fill the room (wrong sizes on
// Next, Refine → Back, U → Rectangle, Rectangle → L, the cabinet depths on Walls, Use this mix), a failed save of
// "Project with several pieces", and no sideways scroll in the wizard dialog body (the footer at 760 px).
// Usage: node tools/start-new/find-it.mjs <url> <out dir>
import { launchBrowser, previewUrl, outDir } from '../lib/harness.mjs';
import { mkdirSync } from 'node:fs';
const url = previewUrl('http://127.0.0.1:4174/furniture-builder/');
const out = outDir('/tmp/furniture-start-new-acceptance');
mkdirSync(out, { recursive: true });
const browser = await launchBrowser({
  args: process.env.CHROMIUM_PATH
    ? ['--disable-gpu', '--disable-software-rasterizer', '--use-gl=disabled']
    : [],
});
let count = 0;
try {
  for (const width of [390, 1280]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 900 },
    });
    // A full or blocked browser storage, switched on by the test only (window.__failPut).
    await context.addInitScript(() => {
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...a) {
        if (window.__failPut) throw new DOMException('Storage is full', 'QuotaExceededError');
        return put.apply(this, a);
      };
    });
    const page = await context.newPage();
    const check = (name, ok) => {
      if (!ok) throw Error(`${width}px ${name}`);
      console.log(`PASS ${width}px ${name}`);
      count++;
    };
    const startNew = async () => {
      await page.locator('summary[aria-label="More"]').click();
      await page.getByRole('button', { name: /New…/ }).click();
      return page.getByRole('dialog', { name: 'Start something new' });
    };
    const body = (dlg) => dlg.locator('.dialog-body');
    const noSideScroll = (dlg) =>
      body(dlg).evaluate((b) => b.scrollWidth === b.clientWidth && b.scrollWidth > 0);
    const field = (dlg, label) => dlg.getByLabel(label, { exact: true });
    const stepBtn = (dlg, list, name) =>
      dlg.getByRole('list', { name: list }).getByRole('button', { name, exact: true });

    await page.goto(url);
    let start = await startNew();
    for (const name of [/^Project with several pieces/, /^Fill a wall/, /^Fill the room/])
      check(`New… row ${name.source}`, await start.getByRole('button', { name }).isVisible());

    // Fill a wall.
    await start.getByRole('button', { name: /^Fill a wall/ }).click();
    let dlg = page.getByRole('dialog', { name: 'Fill a wall' });
    check('Fill a wall: dialog body has no sideways scroll', await noSideScroll(dlg));
    const w = field(dlg, 'Width');
    await w.fill('abc');
    await w.press('Enter');
    const alert = dlg.getByRole('alert');
    check(
      'Fill a wall: width "abc" + Enter stays on Wall with an alert under the field',
      (await dlg.getByRole('heading', { name: 'Wall', exact: true }).isVisible()) &&
        (await alert.textContent()).includes('Width must be a whole number of mm above 0.') &&
        (await w.getAttribute('aria-invalid')) === 'true' &&
        (await w.getAttribute('aria-describedby')) === (await alert.getAttribute('id')),
    );
    check(
      'Fill a wall: header never echoes "abc"',
      (await dlg.getByText(/abc mm wall/i).count()) === 0,
    );
    await page.screenshot({ path: `${out}/wall-bad-width-${width}.png` });
    await w.fill('2400');
    await stepBtn(dlg, 'Fill a wall steps', 'Refine').click();
    await dlg.getByRole('button', { name: 'Back', exact: true }).click();
    await dlg.getByRole('button', { name: 'Use this mix' }).first().waitFor();
    check(
      'Fill a wall: Wall → Refine → Back shows cards for the typed width',
      await dlg.getByText('2400 mm wall · best 4, each checked for problems').isVisible(),
    );
    check('Fill a wall: suggestions body has no sideways scroll', await noSideScroll(dlg));
    await page.screenshot({ path: `${out}/wall-cards-${width}.png` });
    await dlg.getByRole('button', { name: 'Cancel', exact: true }).click();

    // Fill the room.
    start = await startNew();
    await start.getByRole('button', { name: /^Fill the room/ }).click();
    dlg = page.getByRole('dialog', { name: 'Fill the room' });
    check(
      'Fill the room: no "(ADR-059)" in the Room hint',
      (await dlg.getByText(/ADR-059/).count()) === 0,
    );
    check('Fill the room: dialog body has no sideways scroll', await noSideScroll(dlg));
    for (const bad of ['abc', '0', '-100']) {
      await field(dlg, 'Width').fill(bad);
      await dlg.getByRole('button', { name: 'Next', exact: true }).click();
      check(
        `Fill the room: width "${bad}" + Next stays on Room, alert names the field, no NaN`,
        (await dlg.getByRole('heading', { name: 'Room', exact: true }).isVisible()) &&
          (await dlg.getByRole('alert').textContent()).includes(
            'Width must be a whole number of mm above 0.',
          ) &&
          (await field(dlg, 'Width').getAttribute('aria-invalid')) === 'true' &&
          !(await dlg.textContent()).includes('NaN'),
      );
    }
    await page.screenshot({ path: `${out}/room-bad-width-${width}.png` });
    await field(dlg, 'Width').fill('3600');
    await stepBtn(dlg, 'Fill the room steps', 'Refine').click();
    await dlg.getByRole('button', { name: 'Back', exact: true }).click();
    await dlg.getByRole('button', { name: 'Use this mix' }).first().waitFor();
    // A card lists 3 warnings and "…and N more in the project." for the rest.
    const warns = await dlg
      .locator('.wf-card')
      .first()
      .locator('.wf-warnings > li')
      .allTextContents();
    const more = warns.map((x) => /and (\d+) more in the project/.exec(x)).find(Boolean);
    const total = warns.length - (more ? 1 : 0) + (more ? Number(more[1]) : 0);
    console.log(`  ${width}px first room card: ${total} warnings`);
    check(
      'Fill the room: Room → Refine → Back shows cards; first card has at most 4 warnings',
      (await dlg.getByText('4 walls · best 4, each checked for problems').isVisible()) &&
        total <= 4,
    );
    check(
      'Fill the room: card summary starts with "Wall 1:"',
      (await dlg.getByText(/^Wall 1: .*; Wall 2: /).count()) > 0,
    );
    await page.screenshot({ path: `${out}/room-cards-${width}.png` });
    // U (8 walls), one unticked → Rectangle → Show suggestions gives cards.
    await stepBtn(dlg, 'Fill the room steps', 'Room').click();
    await dlg.getByRole('radio', { name: 'U', exact: true }).click();
    await field(dlg, 'Cut offset').fill('600');
    await dlg.getByRole('button', { name: 'Next', exact: true }).click();
    let walls = dlg.getByRole('group', { name: 'Walls to fill' });
    check('Fill the room: U has 8 walls', (await walls.getByRole('checkbox').count()) === 8);
    await walls.getByRole('checkbox', { name: /^Wall 8,/ }).uncheck();
    check(
      'Fill the room: Walls step shows Cabinets, Depth and Tall cabinet depth',
      (await dlg.getByRole('heading', { name: 'Cabinets' }).isVisible()) &&
        (await field(dlg, 'Depth').isVisible()) &&
        (await field(dlg, 'Tall cabinet depth').isVisible()),
    );
    await page.screenshot({ path: `${out}/room-walls-${width}.png` });
    await dlg.getByRole('button', { name: 'Back', exact: true }).click();
    await dlg.getByRole('radio', { name: 'Rectangle', exact: true }).click();
    await dlg.getByRole('button', { name: 'Next', exact: true }).click();
    await dlg.getByRole('button', { name: 'Show suggestions', exact: true }).click();
    await dlg.getByRole('button', { name: 'Use this mix' }).first().waitFor();
    check(
      'Fill the room: U → Rectangle → Show suggestions gives cards',
      (await dlg.getByText(/A ticked wall is not a wall of this room/).count()) === 0,
    );
    // Rectangle (one unticked) → L: 6 ticked walls.
    await stepBtn(dlg, 'Fill the room steps', 'Walls').click();
    walls = dlg.getByRole('group', { name: 'Walls to fill' });
    await walls.getByRole('checkbox', { name: /^Wall 2,/ }).uncheck();
    await dlg.getByRole('button', { name: 'Back', exact: true }).click();
    await dlg.getByRole('radio', { name: 'L', exact: true }).click();
    await dlg.getByRole('button', { name: 'Next', exact: true }).click();
    const boxes = walls.getByRole('checkbox');
    const ticked = await boxes.evaluateAll((els) => els.map((e) => e.checked));
    check(
      'Fill the room: Rectangle → L shows 6 ticked walls',
      ticked.length === 6 && ticked.every(Boolean),
    );
    check('Fill the room: walls body has no sideways scroll', await noSideScroll(dlg));
    // Back to the rectangle and Use this mix: the project opens; its own room's Walls step asks the depths.
    await dlg.getByRole('button', { name: 'Back', exact: true }).click();
    await dlg.getByRole('radio', { name: 'Rectangle', exact: true }).click();
    await dlg.getByRole('button', { name: 'Next', exact: true }).click();
    await dlg.getByRole('button', { name: 'Show suggestions', exact: true }).click();
    await dlg.getByRole('button', { name: 'Use this mix' }).first().click();
    await dlg.waitFor({ state: 'hidden' });
    check('Fill the room: Use this mix closes the dialog', true);
    await page.locator('summary[aria-label="More"]').click();
    await page.getByRole('button', { name: /^Fill the room…/ }).click();
    dlg = page.getByRole('dialog', { name: 'Fill the room' });
    check(
      "Fill the room: a project's room Walls step shows Depth and Tall cabinet depth",
      (await dlg.getByText(/This project’s room/).isVisible()) &&
        (await field(dlg, 'Depth').isVisible()) &&
        (await field(dlg, 'Tall cabinet depth').isVisible()),
    );
    await page.screenshot({ path: `${out}/project-room-walls-${width}.png` });
    await dlg.getByRole('button', { name: 'Cancel', exact: true }).click();

    // A failed save of "Project with several pieces": the alert in the dialog, nothing opens.
    start = await startNew();
    const name = await page.title();
    await page.evaluate(() => (window.__failPut = true));
    await start.getByRole('button', { name: /^Project with several pieces/ }).click();
    await start.getByRole('alert').waitFor();
    check(
      'a rejected save shows the alert and opens nothing',
      (await start.getByRole('alert').textContent()).includes(
        'The project could not be saved in this browser’s storage.',
      ) &&
        (await start.isVisible()) &&
        (await page.title()) === name,
    );
    await page.screenshot({ path: `${out}/save-failed-${width}.png` });
    await page.evaluate(() => (window.__failPut = false));
    check(
      'no horizontal page scroll',
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    );
    await context.close();
  }
  console.log(`${count} checks passed`);
} finally {
  await browser.close();
}
