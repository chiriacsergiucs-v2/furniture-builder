// Find-it acceptance for kitchen cut-outs, worktop corners and placement precision (ADR-205), run against a
// production build:
//   pnpm build && pnpm preview --port 4305 &  node tools/kitchen-corners/find-it.mjs http://localhost:4305/furniture-builder/ <out dir>
// Starts from the bare app at 390 and 1280 px. Two catalog pieces (Base cabinet, Wall cabinet) are exported with the
// app's own Design file button and laid out as an L kitchen in a project file imported through More → Import a file:
// two base units on the back wall, two turned a quarter along the left wall, a wall unit over the back run, and a pipe
// behind the first base unit. From there everything is found by role and visible text: Suggest run parts, the
// **Worktop corner** card with **Mitred joint**, **Butt joint** and **Runs through**, **Add hob…** with its typed
// size, the plan's dashed hob outline, **Cut the back around it** under Checks, the front view's wall-unit drag
// snapping to the worktop line (**Snapped to the worktop line**) and placing freely with Alt, and the **Clearances**
// button in the 3D view drawing the zones. Not part of `pnpm test`.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4305/furniture-builder/';
const out = process.argv[3] ?? 'dist-acceptance';
mkdirSync(out, { recursive: true });
const schema = Number(
  /PROJECT_SCHEMA = (\d+)/.exec(readFileSync('src/core/project.ts', 'utf8'))[1],
);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const results = [];
const check = (width, name, ok, detail = '') => {
  results.push({ width, name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${width}px ${name}${detail ? ` — ${detail}` : ''}`);
};

/** Share of clearly green, amber or red pixels in a PNG (the zone colours), measured in the page. */
async function zoneShare(page, buf) {
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let tinted = 0;
    for (let i = 0; i < d.length; i += 4) {
      const [r, gr, b] = [d[i], d[i + 1], d[i + 2]];
      // Green (#3f8f5a), amber (#d99a00) or red (#c0392b) over the light scene: one channel well above blue.
      if ((gr - b > 25 && gr > r) || (r - b > 60 && gr - b > 25) || (r - gr > 60 && r - b > 60))
        tinted++;
    }
    return tinted / (d.length / 4);
  }, buf.toString('base64'));
}

for (const width of [390, 1280]) {
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
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const shot = (name) =>
    page.screenshot({ path: `${out}/kitchen-corners-${name}-${width}.png`, fullPage: true });
  const dlg = page.locator('dialog[open]');
  const btn = (name, exact = true) => page.getByRole('button', { name, exact });
  const click = async (loc) => {
    await loc.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
    await loc.click({ timeout: 3000 }).catch(() => loc.dispatchEvent('click'));
  };
  const sheet = async (open = true) => {
    const peek = page.locator('.sheet-peek');
    if (!phone || !(await peek.isVisible().catch(() => false))) return;
    if ((await peek.getAttribute('aria-expanded')) !== String(open)) await peek.click();
    await page.waitForTimeout(200);
  };
  const exported = async (name) => {
    await page.locator('summary[aria-label="More"]').click();
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name }).click();
    const download = await downloading;
    const parts = [];
    for await (const chunk of await download.createReadStream()) parts.push(chunk);
    return JSON.parse(Buffer.concat(parts).toString());
  };
  const pieceDesign = async (name) => {
    await page.goto(url);
    await page.getByRole('button', { name: 'New single piece', exact: true }).click();
    await dlg.getByRole('button', { name }).first().click();
    await page.locator('main.work').waitFor({ state: 'visible' });
    return exported(/^Design file/);
  };
  const mode = async (name) => {
    const r = page.getByRole('radio', { name });
    if (await r.isVisible().catch(() => false)) await r.click();
    await page.waitForTimeout(300);
  };

  // 1. Bare app: two catalog pieces, exported with the app's own Design file button.
  const base = await pieceDesign(/^Base cabinet/);
  const wall = await pieceDesign(/^Wall cabinet/);
  const deep = base.product.params.depth;
  const now = new Date().toISOString();
  const item = (id, design, extra) => ({
    id,
    design: { ...design, id: `${id}-design` },
    quantity: 1,
    rotationY: 0,
    placement: { kind: 'floor' },
    ...extra,
  });
  const bw = base.product.params.width;
  const project = {
    schemaVersion: schema,
    id: `kitchen-${width}`,
    name: `L kitchen ${width}`,
    createdAt: now,
    updatedAt: now,
    room: {
      height: 2600,
      outline: [
        [0, 0],
        [3000, 0],
        [3000, 3000],
        [0, 3000],
      ],
      features: [
        {
          id: 'pipe-1',
          kind: 'pipe',
          wall: 0,
          from: bw + 200,
          width: 100,
          sill: 300,
          height: 100,
          depth: 0,
          label: 'Pipe 1',
        },
      ],
    },
    items: [
      item('back-1', base, { position: { x: 0, y: 0, z: 0 } }),
      item('back-2', base, { position: { x: bw, y: 0, z: 0 } }),
      item('side-1', base, { rotationY: 90, position: { x: 0, y: 0, z: deep + 20 } }),
      item('side-2', base, { rotationY: 90, position: { x: 0, y: 0, z: deep + 20 + bw } }),
      item('wall-1', wall, {
        position: { x: bw, y: 1400, z: 0 },
        placement: { kind: 'wall', height: 1400 },
      }),
    ],
  };
  await page.goto(url);
  await page.locator('summary[aria-label="More"]').click();
  await page.getByLabel('Import a file', { exact: true }).setInputFiles({
    name: 'kitchen.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await page.locator('main.work').waitFor({ state: 'visible' });
  await mode('Compose');
  await sheet(true);
  await shot('imported');

  // 2. Settings › Run parts: Suggest also plans the side-wall run, and the corner card asks for a joint.
  await sheet(false);
  const openSettings = async () => {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await dlg.waitFor();
  };
  const closeSettings = async () => {
    await dlg.getByRole('button', { name: 'Done', exact: true }).click();
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
  };
  await openSettings();
  const runs = dlg.getByRole('region', { name: 'Run parts' });
  await runs.scrollIntoViewIfNeeded().catch(() => {});
  const suggest = runs.getByRole('button', { name: /^Suggest (run parts|again)$/ });
  check(width, '"Suggest run parts" is in the Run parts panel', await suggest.isVisible());
  await click(suggest);
  // Parts made on import ask before they are suggested again.
  const confirm = page.getByRole('dialog', { name: 'Confirm' });
  if (
    await confirm.waitFor({ timeout: 1500 }).then(
      () => true,
      () => false,
    )
  )
    await confirm.getByRole('button', { name: 'Suggest again', exact: true }).click();
  await page.waitForTimeout(400);
  const corner = runs.locator('li.worktop-corner').first();
  check(
    width,
    '"Worktop corner" card is shown for the L',
    await corner
      .getByText('Worktop corner', { exact: true })
      .isVisible()
      .catch(() => false),
  );
  check(
    width,
    'the corner says export is blocked until a joint is chosen',
    await corner
      .getByText('Joint not chosen yet: export is blocked until you choose one.')
      .isVisible()
      .catch(() => false),
  );
  const mitred = corner.getByRole('button', { name: 'Mitred joint', exact: true });
  const butt = corner.getByRole('button', { name: 'Butt joint', exact: true });
  check(
    width,
    '"Mitred joint" and "Butt joint" are offered',
    (await mitred.isVisible()) && (await butt.isVisible()),
  );
  await shot('corner');
  await click(butt);
  const through = corner.getByRole('group', { name: 'Runs through' });
  check(
    width,
    '"Butt joint" asks which worktop "Runs through"',
    await through.isVisible().catch(() => false),
  );
  await click(through.getByRole('radio').first());
  await page.waitForTimeout(200);
  check(
    width,
    'with Runs through chosen the corner is no longer blocked',
    !(await corner
      .getByText('Joint not chosen yet: export is blocked until you choose one.')
      .isVisible()
      .catch(() => false)),
  );
  await click(mitred);
  check(
    width,
    '"Mitred joint" is pressed after the tap',
    (await mitred.getAttribute('aria-pressed')) === 'true',
  );
  await shot('mitred');

  // 3. Add hob…: typed size, listed, and drawn dashed on the plan.
  const addHob = dlg.getByRole('button', { name: 'Add hob…', exact: true });
  await addHob.scrollIntoViewIfNeeded().catch(() => {});
  check(width, '"Add hob…" is offered with the run parts', await addHob.isVisible());
  await click(addHob);
  const hobForm = dlg.getByRole('group', { name: 'Hob over a base unit' });
  await hobForm.getByLabel('Cut-out width', { exact: true }).fill('560');
  await hobForm.getByLabel('Cut-out depth', { exact: true }).fill('490');
  await click(hobForm.getByRole('button', { name: 'Add hob', exact: true }));
  await page.waitForTimeout(300);
  check(
    width,
    'the hob is listed with the size typed',
    await dlg
      .getByText(/cut-out 560 × 490/)
      .first()
      .isVisible()
      .catch(() => false),
  );
  await shot('hob');
  await closeSettings();
  await mode('2D');
  const plan = page.getByRole('figure', { name: /Room plan, seen from above/ });
  await plan.scrollIntoViewIfNeeded().catch(() => {});
  check(
    width,
    'the plan outlines the hob cut-out and draws the joint line',
    (await plan.locator('g.kitchen-marks g.cutout.hob rect').count()) === 1 &&
      (await plan.locator('g.kitchen-marks line, g.kitchen-marks path').count()) >= 1,
  );
  await shot('plan');

  // 4. Checks: the pipe behind the first base unit, and "Cut the back around it".
  const showChecks = async () => {
    const build = page.getByRole('radio', { name: /Build & Preview/ });
    if (phone && (await build.isVisible().catch(() => false))) await build.click();
    const checks = page.getByRole('tab', { name: /Checks/ });
    await checks.waitFor({ timeout: 5000 }).catch(() => {});
    if (
      (await checks.isVisible().catch(() => false)) &&
      (await checks.getAttribute('aria-selected')) !== 'true'
    )
      await checks.click();
    await page.waitForTimeout(300);
  };
  await showChecks();
  const warn = page.getByText(
    /Pipe behind Base cabinet.*\(Pipe 1\): cut the back or move the piece\./,
  );
  check(
    width,
    'the pipe warning is listed under Checks',
    await warn
      .first()
      .isVisible()
      .catch(() => false),
  );
  const warnItem = page.locator('.checks button', { hasText: /Pipe behind Base cabinet/ }).first();
  check(
    width,
    'the warning offers "Show on the plan and see repairs"',
    await warnItem
      .getByText('Show on the plan and see repairs')
      .isVisible()
      .catch(() => false),
  );
  await click(warnItem);
  const banner = page.getByRole('region', { name: 'Problem and repairs' });
  await banner.waitFor({ timeout: 5000 }).catch(() => {});
  const cutBack = banner.getByRole('radio', { name: /^Cut the back around it/ });
  await cutBack.scrollIntoViewIfNeeded().catch(() => {});
  check(
    width,
    '"Cut the back around it" is offered as a repair',
    await cutBack.isVisible().catch(() => false),
  );
  await shot('checks');
  await click(cutBack);
  await click(banner.getByRole('button', { name: 'Apply', exact: true }));
  await page.waitForTimeout(500);
  await showChecks();
  check(width, 'after the cut the pipe warning is gone', (await warn.count()) === 0);

  // 5. Front view: drag the wall unit down near the worktop line; it snaps and names the line; Alt places freely.
  await mode('Compose');
  await sheet(false);
  let fv = page.getByRole('figure', { name: 'Room seen from the front. Select a piece.' });
  if (!(await fv.isVisible().catch(() => false))) await mode(/Build & Preview/);
  fv = page.getByRole('figure', { name: 'Room seen from the front. Select a piece.' });
  await fv.scrollIntoViewIfNeeded().catch(() => {});
  const wallRect = fv.getByRole('button', { name: /^Wall cabinet, \d+ wide, \d+ high$/ }).first();
  check(width, 'the front view shows the wall unit', await wallRect.isVisible().catch(() => false));
  if ((await wallRect.getAttribute('aria-pressed')) !== 'true') await click(wallRect);
  await page.waitForTimeout(300);
  // Selecting may open the phone's sheet over the view: close it and bring the wall unit into view.
  await sheet(false);
  await wallRect.scrollIntoViewIfNeeded().catch(() => {});
  const box = await wallRect.boundingBox();
  const hmm = Number(/(\d+) high$/.exec((await wallRect.getAttribute('aria-label')) ?? '')?.[1]);
  const pxPerMm = box && hmm ? box.height / hmm : 0;
  const status = fv.locator('.plan-drag-note[role=status]');
  let snapped = '',
    free = '';
  if (box && pxPerMm) {
    const cx = box.x + box.width / 2,
      cy = box.y + box.height / 2;
    // From 1400 mm down to about 15 mm above the worktop line (the base height and a worktop about 40 mm thick).
    const by = (1400 - (base.product.params.height + 55)) * pxPerMm;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(cx, cy + (by * i) / 10);
    await page.waitForTimeout(150);
    snapped = (await status.textContent().catch(() => '')) ?? '';
    await shot('height-snap');
    await page.keyboard.down('Alt');
    await page.mouse.move(cx, cy + by + 2);
    await page.waitForTimeout(150);
    free = (await status.textContent().catch(() => '')) ?? '';
    await page.keyboard.up('Alt');
    await page.mouse.move(cx, cy + by);
    await page.mouse.up();
    await page.waitForTimeout(300);
  }
  check(
    width,
    'the front-view height drag says "Snapped to the worktop line, … mm"',
    /^Snapped to the worktop line, \d+ mm$/.test(snapped.trim()),
    snapped,
  );
  check(
    width,
    'with Alt held it places freely ("From floor … mm")',
    /^From floor \d+ mm$/.test(free.trim()),
    free,
  );
  const hung = Number(/(\d+) mm$/.exec(snapped.trim())?.[1]);
  const released = await fv
    .getByRole('button', { name: /^Wall cabinet, \d+ wide, \d+ high$/ })
    .first()
    .boundingBox();
  check(
    width,
    'released, the wall unit hangs on the worktop line',
    !!released && !!box && Math.abs(released.y - (box.y + (1400 - hung) * pxPerMm)) < 3,
  );

  // 6. 3D: the Clearances button draws the zones as coloured boxes.
  await mode('Compose');
  await mode('3D');
  await sheet(false);
  const canvas = page.locator('.view.three canvas').first();
  await canvas.waitFor({ timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const zonesBtn = page.getByRole('button', { name: 'Clearances', exact: true });
  check(width, '"Clearances" is on the 3D toolbar', await zonesBtn.isVisible().catch(() => false));
  const before = await zoneShare(page, await canvas.screenshot());
  await click(zonesBtn);
  await page.waitForTimeout(1200);
  const after = await zoneShare(page, await canvas.screenshot());
  await shot('3d-zones');
  check(
    width,
    'Clearances in 3D draws the zones (coloured boxes appear)',
    (await zonesBtn.getAttribute('aria-pressed')) === 'true' && after > before + 0.01,
    `${before.toFixed(3)} → ${after.toFixed(3)}`,
  );

  check(
    width,
    'no sideways scroll',
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  );
  check(width, 'no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
