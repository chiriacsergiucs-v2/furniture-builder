// Find-it acceptance for room surfaces, plan tracing, placed 3D models and AR (CLAUDE.md R3, backlog N213, ADR-208),
// run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/room-surfaces/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at 1280 and 390 px and finds everything by role and visible text: a new project with a
// sideboard and a room; Wall 1 › Colour (its 50 mm band on the plan); Room › "Floor background" (Colour, then a
// Picture); Room › "Plan picture" › "Add a plan picture" › "Set the scale" (two taps on the plan) › "Known length"
// (the picture's size on the plan follows) › "Show the plan picture" › "Remove the plan picture"; a 3D model from My
// 3D models "Placed" › "On a piece", dragged on the plan (lifted onto the floor, one undo step); the 3D toolbar's ⋯
// menu with "View in AR" (navigator.xr stubbed: the request must be `immersive-ar` with `hit-test` required) and
// "Export for AR (.usdz)" (a zip holding a .usda, no request leaves the device); Render › "Engine: {name}" and the
// first 8 samples; and the wall behind the sideboard opened with "Edit this piece". Not part of `pnpm test`.
// Not checked here: AR on a real phone (Android View in AR, iPhone AR Quick Look); that needs the devices.
import { launchBrowser, previewUrl, outDir } from '../lib/harness.mjs';
import { openPieceEditor } from '../lib/steps.mjs';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const url = previewUrl();
const out = outDir();
mkdirSync(out, { recursive: true });

/** A 0.6 m red cube as a GLB (12 triangles), written into <out dir>; no binary model is committed. */
function cubeGlb(m = 0.6) {
  const pos = new Float32Array([
    0,
    0,
    0,
    m,
    0,
    0,
    m,
    m,
    0,
    0,
    m,
    0,
    0,
    0,
    m,
    m,
    0,
    m,
    m,
    m,
    m,
    0,
    m,
    m,
  ]);
  const idx = new Uint16Array([
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 6, 2, 3, 7, 6, 0, 4, 7, 0, 7, 3, 1, 2,
    6, 1, 6, 5,
  ]);
  const bin = Buffer.concat([Buffer.from(pos.buffer), Buffer.from(idx.buffer)]);
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.85, 0.05, 0.05, 1] } }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: pos.byteLength },
      { buffer: 0, byteOffset: pos.byteLength, byteLength: idx.byteLength },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 8,
        type: 'VEC3',
        min: [0, 0, 0],
        max: [m, m, m],
      },
      { bufferView: 1, componentType: 5123, count: 36, type: 'SCALAR' },
    ],
  };
  let text = Buffer.from(JSON.stringify(json));
  text = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)]);
  const head = Buffer.alloc(12);
  head.writeUInt32LE(0x46546c67, 0);
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(12 + 8 + text.length + 8 + bin.length, 8);
  const chunk = (type, data) => {
    const h = Buffer.alloc(8);
    h.writeUInt32LE(data.length, 0);
    h.writeUInt32LE(type, 4);
    return Buffer.concat([h, data]);
  };
  return Buffer.concat([head, chunk(0x4e4f534a, text), chunk(0x004e4942, bin)]);
}
const cube = `${out}/Cube.glb`;
writeFileSync(cube, cubeGlb());

const browser = await launchBrowser();
const results = [];
const check = (width, name, ok, detail = '') => {
  results.push({ width, name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${width}px ${name}${detail ? ` — ${detail}` : ''}`);
};
const notes = [];

for (const width of [1280, 390]) {
  const phone = width < 500;
  const ctx = await browser.newContext({
    viewport: { width, height: phone ? 844 : 900 },
    serviceWorkers: 'block',
    acceptDownloads: true,
  });
  // WebXR stand-in: immersive AR is "supported"; a session request is recorded, then refused (no AR hardware here).
  await ctx.addInitScript(() => {
    window.__xr = [];
    Object.defineProperty(navigator, 'xr', {
      configurable: true,
      value: {
        isSessionSupported: async (mode) => mode === 'immersive-ar',
        requestSession: async (mode, init) => {
          window.__xr.push({
            mode,
            requiredFeatures: init?.requiredFeatures,
            optionalFeatures: init?.optionalFeatures,
            domOverlay: !!init?.domOverlay,
          });
          throw new DOMException('No AR hardware in this test browser', 'NotSupportedError');
        },
      },
    });
  });
  const page = await ctx.newPage();
  const errors = [];
  const remote = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    // WebGPU probing in a headless browser may log adapter warnings; only errors from the app count.
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (/^https?:$/.test(u.protocol) && u.origin !== new URL(url).origin) remote.push(r.url());
  });
  const btn = (name, exact = true) => page.getByRole('button', { name, exact });
  const dlg = page.locator('dialog[open]');
  const click = async (loc) => {
    await loc.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
    await loc.click({ timeout: 5000 });
  };
  const sheet = async (open) => {
    const peek = page.locator('.sheet-peek');
    if (phone && (await peek.isVisible().catch(() => false)))
      if ((await peek.getAttribute('aria-expanded')) === String(!open)) await peek.click();
    await page.waitForTimeout(200);
  };
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const pngOf = (w, h, paint) =>
    page
      .evaluate(
        ({ w, h, paint }) => {
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          const x = c.getContext('2d');
          x.fillStyle = '#ffffff';
          x.fillRect(0, 0, w, h);
          x.strokeStyle = paint;
          x.fillStyle = paint;
          x.lineWidth = 4;
          if (paint === '#8a5a2b') x.fillRect(0, 0, w, h);
          else {
            x.strokeRect(2, 2, w - 4, h - 4);
            x.beginPath();
            x.moveTo(w / 2, 0);
            x.lineTo(w / 2, h);
            x.stroke();
          }
          return c.toDataURL('image/png');
        },
        { w, h, paint },
      )
      .then((d) => Buffer.from(d.split(',')[1], 'base64'));
  const plan = page.getByRole('figure', { name: /Room plan, seen from above/ });
  /** Screen point of a room point (mm) on the plan, through the plan's own drawing. */
  const screenOf = (x, z) =>
    plan.evaluate(
      (fig, { x, z }) => {
        const svg = fig.querySelector('.room-outline').ownerSVGElement;
        const p = new DOMPoint(x, z).matrixTransform(svg.getScreenCTM());
        return { x: p.x, y: p.y };
      },
      { x, z },
    );

  // 1. Bare app → new project → a sideboard → Add the room → Wall 1 colour.
  await page.goto(url);
  await click(btn('Create a new project'));
  await click(btn('Create project'));
  await sheet(true);
  await click(btn('Add a piece'));
  await dlg.getByRole('searchbox', { name: 'Search the items' }).fill('Sideboard');
  await dlg.locator('.start-group .row-btn').first().click();
  await dlg.waitFor({ state: 'detached' }).catch(() => {});
  if (await btn('Place to the right').isVisible()) await click(btn('Place to the right'));
  await sheet(true);
  await click(btn('Add the room'));
  await sheet(true);
  // The room is a closed fold (ADR-160) whose summary names it: open it.
  const fold = page.locator('details.room-fold');
  if (!(await fold.evaluate((d) => d.open).catch(() => true)))
    await click(fold.locator('summary').first());
  await page.getByLabel('Wall 1 background', { exact: true }).selectOption({ label: 'Colour' });
  await page.getByLabel('Wall 1 colour').fill('#4682a0');
  await page.waitForTimeout(300);
  check(
    width,
    'Wall 1 with a colour gets its band on the plan',
    (await plan.locator('rect.wall-band').count()) === 1,
  );

  // 2. Room › Floor background: None / Colour / Picture.
  const floorBg = page.getByLabel('Floor background', { exact: true });
  await floorBg.scrollIntoViewIfNeeded();
  check(width, 'Room shows "Floor background"', await floorBg.isVisible());
  const opts = await floorBg.locator('option').allInnerTexts();
  check(
    width,
    'Floor background offers None · Colour · Picture',
    opts.join(' · ') === 'None · Colour · Picture',
  );
  await floorBg.selectOption({ label: 'Colour' });
  await page.getByLabel('Floor colour').fill('#a0805a');
  await page.waitForTimeout(300);
  const floorFill = await plan
    // The fill itself, not the clip path's outline inside <defs>.
    .locator('.room-floor-finish > polygon')
    .first()
    .evaluate((e) => getComputedStyle(e).fill)
    .catch(() => '');
  check(
    width,
    'the plan fills the floor with its colour',
    /160, 128, 90/.test(floorFill),
    floorFill,
  );
  await floorBg.selectOption({ label: 'Picture' });
  await page.getByLabel('Add a picture for the floor').setInputFiles({
    name: 'oak.png',
    mimeType: 'image/png',
    buffer: await pngOf(64, 64, '#8a5a2b'),
  });
  const floorThumb = page.getByRole('img', { name: 'Picture on the floor' });
  await floorThumb.waitFor({ timeout: 8000 }).catch(() => {});
  check(
    width,
    'the floor picture is picked ("Picture on the floor")',
    await floorThumb.isVisible(),
  );
  await page.waitForTimeout(300);
  check(
    width,
    'the plan fills the floor with its picture',
    (await plan.locator('.room-floor-finish image').count()) === 1,
  );
  check(width, 'no horizontal page scroll with the room editor open', await noSideScroll());

  // 3. Room › Plan picture › Add a plan picture › Set the scale › Known length.
  const section = page.getByRole('region', { name: 'Plan picture' });
  await section.scrollIntoViewIfNeeded();
  check(width, 'Room shows "Plan picture"', await section.isVisible());
  await section.getByLabel('Add a plan picture').setInputFiles({
    name: 'plan.png',
    mimeType: 'image/png',
    buffer: await pngOf(400, 300, '#202020'),
  });
  const planImg = plan.locator('image.plan-picture');
  await planImg.waitFor({ state: 'attached', timeout: 8000 }).catch(() => {});
  const w0 = Number(await planImg.getAttribute('width').catch(() => 0));
  check(
    width,
    'the plan picture lies under the plan at half opacity (10 mm per pixel until scaled)',
    w0 === 4000 && (await planImg.getAttribute('opacity')) === '0.5',
    `width ${w0} mm`,
  );
  await click(section.getByRole('button', { name: 'Set the scale' }));
  check(
    width,
    '"Set the scale" shows "Tap a corner of the plan, then the other end of a wall you know."',
    await page
      .getByRole('status')
      .filter({ hasText: 'Tap a corner of the plan, then the other end of a wall you know.' })
      .isVisible(),
  );
  // Two taps: room (0, 0) and (2000, 0) are picture pixels (0, 0) and (200, 0) at 10 mm per pixel.
  await sheet(false);
  await plan.scrollIntoViewIfNeeded();
  for (const [x, z] of [
    [0, 0],
    [2000, 0],
  ]) {
    const s = await screenOf(x, z);
    await page.mouse.click(s.x, s.y);
    await page.waitForTimeout(200);
  }
  check(
    width,
    'two taps set the scale (the banner goes)',
    !(await page
      .getByText(/of 2$/)
      .isVisible()
      .catch(() => false)),
  );
  await sheet(true);
  const known = section.getByRole('textbox', { name: 'Known length' });
  await known.fill('3000');
  await known.press('Enter');
  await page.waitForTimeout(300);
  const w1 = Number(await planImg.getAttribute('width').catch(() => 0));
  // 200 px is 3000 mm: 15 mm per pixel, the 400 px picture 6000 mm wide (a tap may land a pixel off).
  check(
    width,
    '"Known length" 3000 mm over the two taps scales the picture (15 mm per pixel)',
    Math.abs(w1 - 6000) <= 90,
    `width ${w1} mm`,
  );
  const decimals = ((await plan.textContent()) ?? '').match(/\d+\.\d+/g) ?? [];
  check(
    width,
    'the plan, framed around the scaled picture, measures in whole mm',
    decimals.length === 0,
    decimals.slice(0, 3).join(', '),
  );
  await known.fill('0');
  check(
    width,
    'a bad known length is shown as a problem, not applied',
    (await known.getAttribute('aria-invalid')) === 'true',
  );
  await known.press('Escape');
  await known.press('Tab');
  check(
    width,
    '"Draw the room again" traces over the picture',
    await btn('Draw the room again').isVisible(),
  );
  await sheet(false);
  await plan.screenshot({ path: `${out}/room-surfaces-plan-${width}.png` });
  await sheet(true);
  const show = section.getByRole('checkbox', { name: 'Show the plan picture' });
  await show.uncheck({ force: true });
  await page.waitForTimeout(200);
  check(width, '"Show the plan picture" off hides it', (await planImg.count()) === 0);
  await show.check({ force: true });
  await page.waitForTimeout(200);
  await click(section.getByRole('button', { name: 'Remove the plan picture' }));
  await click(dlg.getByRole('button', { name: 'Remove', exact: true }));
  await page.waitForTimeout(300);
  check(
    width,
    '"Remove the plan picture" removes it',
    (await planImg.count()) === 0 && (await section.getByLabel('Add a plan picture').count()) === 1,
  );

  // 4. A 3D model from My 3D models, Placed › On a piece; dragged on the plan it is lifted onto the floor.
  await click(btn('Add a piece'));
  const importBtn = dlg.getByRole('button', { name: 'Import 3D model' });
  await importBtn.scrollIntoViewIfNeeded();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), importBtn.click()]);
  await chooser.setFiles([cube]);
  await dlg
    .getByText('Imported Cube.')
    .waitFor({ timeout: 15000 })
    .catch(() => {});
  await dlg.getByRole('button', { name: /^Cube 600 × 600 × 600 mm/ }).click();
  await dlg.waitFor({ state: 'detached' }).catch(() => {});
  await sheet(true);
  const card = page.getByRole('region', { name: 'Selected 3D model: Cube' });
  const placed = card.getByRole('radiogroup', { name: 'Placed' });
  await placed.scrollIntoViewIfNeeded().catch(() => {});
  check(
    width,
    'the model card shows "Placed": Floor · Wall · On a piece · Anywhere',
    (await placed.getByRole('radio').allInnerTexts()).join(' · ') ===
      'Floor · Wall · On a piece · Anywhere',
  );
  await click(placed.getByRole('radio', { name: 'On a piece' }));
  const onPiece = async () =>
    (await placed.getByRole('radio', { name: 'On a piece' }).getAttribute('aria-checked')) ===
    'true';
  const onOrAbove = card.getByRole('combobox', { name: 'On or above' });
  check(
    width,
    'Placed › On a piece: it stands on the sideboard ("On or above")',
    (await onPiece()) &&
      /Sideboard/.test((await onOrAbove.locator('option:checked').innerText()) ?? ''),
  );
  await sheet(false);
  const front = page.getByRole('figure', { name: /Room seen from the front/ });
  const onFront = front.getByRole('button', { name: /^Cube \(3D model\), 600 wide, 600 high$/ });
  const sideFront = front.getByRole('button', { name: /Sideboard/ }).first();
  const fb = await onFront.boundingBox().catch(() => null);
  const sb = await sideFront.boundingBox().catch(() => null);
  check(
    width,
    'in the front view the model stands on top of the sideboard',
    !!fb && !!sb && Math.abs(fb.y + fb.height - sb.y) <= 3,
    fb && sb
      ? `model bottom ${Math.round(fb.y + fb.height)}, sideboard top ${Math.round(sb.y)}`
      : '',
  );
  await front.screenshot({ path: `${out}/room-surfaces-front-${width}.png` });
  const onPlan = plan.getByRole('button', { name: /^Cube \(3D model\), 600 by 600 mm$/ });
  await onPlan.scrollIntoViewIfNeeded();
  const pb = await onPlan.boundingBox();
  const tgt = await screenOf(2200, 1200);
  await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++)
    await page.mouse.move(
      pb.x + pb.width / 2 + ((tgt.x - pb.x - pb.width / 2) * i) / 10,
      pb.y + pb.height / 2 + ((tgt.y - pb.y - pb.height / 2) * i) / 10,
    );
  await page.mouse.up();
  await page.waitForTimeout(300);
  await sheet(true);
  const floorNow =
    (await placed.getByRole('radio', { name: 'Floor' }).getAttribute('aria-checked')) === 'true';
  check(width, 'dragged on the plan, the model is lifted off the piece onto the floor', floorNow);
  await sheet(false);
  await click(page.getByRole('button', { name: 'Undo', exact: true }));
  await page.waitForTimeout(300);
  await sheet(true);
  check(width, 'one Undo puts it back on the piece (one undo step)', await onPiece());

  // 5. 3D: the ⋯ menu with View in AR (stubbed WebXR) and Export for AR (.usdz).
  await sheet(false);
  const build = page.getByRole('radio', { name: /Build & Preview/ });
  if (await build.isVisible().catch(() => false)) await build.click();
  const r3d = page.getByRole('radio', { name: '3D', exact: true });
  if (await r3d.isVisible().catch(() => false)) await r3d.click();
  await page.locator('.view.three canvas').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(2000);
  const more = page.getByRole('group', { name: 'More 3D actions' });
  const openMore = async () => {
    if (!(await more.isVisible().catch(() => false)))
      await page.locator('details.three-more > summary').click();
  };
  await openMore();
  check(
    width,
    'the 3D toolbar ⋯ shows "Export for AR (.usdz)"',
    await more.getByRole('button', { name: 'Export for AR (.usdz)' }).isVisible(),
  );
  check(
    width,
    'the 3D toolbar ⋯ shows "View in AR" (immersive-ar supported)',
    await more.getByRole('button', { name: 'View in AR' }).isVisible(),
  );
  const clipped = await more
    .getByRole('button')
    .evaluateAll((bs) =>
      bs.filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent),
    );
  check(width, 'the ⋯ menu labels are not clipped', clipped.length === 0, clipped.join(', '));
  await page.screenshot({ path: `${out}/room-surfaces-3d-menu-${width}.png` });
  const before = remote.length;
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    more.getByRole('button', { name: 'Export for AR (.usdz)' }).click(),
  ]);
  const file = `${out}/${download.suggestedFilename()}`;
  await download.saveAs(file);
  const bytes = readFileSync(file);
  check(
    width,
    'Export for AR downloads <name>.usdz: a zip holding model.usda',
    download.suggestedFilename().endsWith('.usdz') &&
      bytes.subarray(0, 2).toString() === 'PK' &&
      bytes.includes(Buffer.from('model.usda')) &&
      bytes.includes(Buffer.from('#usda 1.0')),
    `${download.suggestedFilename()} ${bytes.length} bytes`,
  );
  check(width, 'Export for AR makes no request off the device', remote.length === before);
  await openMore();
  await more.getByRole('button', { name: 'View in AR' }).click();
  await page.waitForTimeout(500);
  const xr = await page.evaluate(() => window.__xr);
  check(
    width,
    'View in AR requests an immersive-ar session with hit-test required, dom-overlay, anchors, depth-sensing and light-estimation optional',
    xr.length === 1 &&
      xr[0].mode === 'immersive-ar' &&
      JSON.stringify(xr[0].requiredFeatures) === '["hit-test"]' &&
      JSON.stringify(xr[0].optionalFeatures) ===
        '["dom-overlay","anchors","depth-sensing","light-estimation"]',
    JSON.stringify(xr),
  );
  check(
    width,
    'a refused AR session says so ("AR could not start on this device.")',
    await page
      .getByRole('alert')
      .filter({ hasText: 'AR could not start on this device.' })
      .isVisible(),
  );

  // 6. Render › Engine: WebGPU with an adapter, WebGL 2 without; the first 8 samples.
  const hasAdapter = await page.evaluate(async () => {
    try {
      return !!(await navigator.gpu?.requestAdapter());
    } catch {
      return false;
    }
  });
  const expected = hasAdapter ? 'WebGPU' : 'WebGL 2';
  // A phone keeps Render under the view's Options (N82).
  const renderBtn = page.getByRole('button', { name: 'Render' });
  if (!(await renderBtn.isVisible().catch(() => false)))
    await page
      .locator('details.view-options')
      .evaluateAll((ds) => ds.forEach((d) => (d.open = true)))
      .catch(() => {});
  await click(renderBtn);
  await dlg.getByRole('heading', { name: 'Render a picture' }).waitFor();
  const engine = dlg.getByText(/^Engine: /);
  await engine.waitFor({ timeout: 10000 }).catch(() => {});
  const engineText = (await engine.textContent().catch(() => '')) ?? '';
  check(
    width,
    `Render shows "Engine: ${expected}"`,
    engineText === `Engine: ${expected}`,
    engineText,
  );
  notes.push(
    `${width}px: this browser has ${hasAdapter ? 'a' : 'no'} WebGPU adapter → ${engineText}`,
  );
  page.setDefaultTimeout(600000);
  await dlg.getByRole('radio', { name: '1280 × 720' }).click();
  await dlg.getByRole('button', { name: 'Start' }).click();
  const progress = dlg.getByText(/Rendering… \d+ \/ 256 samples/);
  await progress.waitFor({ timeout: 300000 }).catch(() => {});
  let n = 0;
  for (let i = 0; i < 300 && n < 8; i++) {
    const s = (await progress.textContent().catch(() => '')) ?? '';
    n = Number(/Rendering… (\d+)/.exec(s)?.[1] ?? 0);
    if (n < 8) await page.waitForTimeout(2000);
  }
  check(width, `${expected} render reaches 8 samples`, n >= 8, `${n} samples`);
  await dlg
    .locator('.render-canvas')
    .screenshot({ path: `${out}/room-surfaces-render-${width}.png` })
    .catch(() => {});
  await dlg
    .getByRole('button', { name: 'Cancel' })
    .click()
    .catch(() => {});
  await dlg
    .getByRole('button', { name: 'Start' })
    .waitFor()
    .catch(() => {});
  page.setDefaultTimeout(30000);
  await page.keyboard.press('Escape');
  await dlg.waitFor({ state: 'detached' }).catch(() => {});

  // 7. The wall behind a single piece: the sideboard opened from the project shows Wall 1 behind it.
  const compose = page.getByRole('radio', { name: 'Compose' });
  if (await compose.isVisible().catch(() => false)) await compose.click();
  const r2d = page.getByRole('radio', { name: '2D' });
  if (await r2d.isVisible().catch(() => false)) await r2d.click();
  await sheet(true);
  const all = page.getByRole('button', { name: /^All pieces \(\d+\)$/ });
  if (await all.isVisible().catch(() => false)) await all.click();
  await click(
    page
      .getByRole('list', { name: 'Pieces' })
      .getByRole('button', { name: /Sideboard/ })
      .first(),
  );
  await sheet(true);
  await openPieceEditor(page);
  await sheet(false);
  const behind = page.getByRole('img', { name: 'Wall 1 behind the piece' });
  await behind.waitFor({ state: 'attached', timeout: 8000 }).catch(() => {});
  const fill = await behind
    .locator(':scope > g > rect')
    .first()
    .evaluate((e) => getComputedStyle(e).fill)
    .catch(() => '');
  check(
    width,
    'the piece opened from the project shows "Wall 1 behind the piece" in its colour',
    /70, 130, 160/.test(fill),
    fill,
  );
  await page.screenshot({ path: `${out}/room-surfaces-wall-behind-${width}.png` });
  check(width, 'no horizontal page scroll', await noSideScroll());
  check(width, 'no request leaves the device', remote.length === 0, remote.slice(0, 3).join(' '));
  check(width, 'no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}
await browser.close();
for (const n of notes) console.log(`NOTE ${n}`);
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
