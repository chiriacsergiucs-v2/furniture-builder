// Find-it acceptance for editing an imported 3D model's width, height and depth (CLAUDE.md R3, backlog N100, ADR-102),
// run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/model-size/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text: imports a 0.6 m cube (written by the
// script, no binary committed), types sizes with Keep proportions off and on, resets, undoes, and drags the height
// handle in 3D in Move mode. Not part of `pnpm test`.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4173/furniture-builder/';
const out = process.argv[3] ?? 'dist-acceptance';
mkdirSync(out, { recursive: true });

/** A 0.6 m red cube as a GLB (12 triangles). */
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
    materials: [
      { pbrMetallicRoughness: { baseColorFactor: [0.85, 0.05, 0.05, 1] }, doubleSided: true },
    ],
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
const good = `${out}/Cube.glb`;
writeFileSync(good, cubeGlb());

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const results = [];
const check = (width, name, ok, detail = '') => {
  results.push({ width, name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${width}px ${name}${detail ? ` — ${detail}` : ''}`);
};

const widths = (process.argv[4] ?? '1440,390').split(',').map(Number);
for (const width of widths) {
  const phone = width < 500;
  const ctx = await browser.newContext({
    viewport: { width, height: phone ? 812 : 900 },
    hasTouch: phone,
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const shot = (name) =>
    page
      .screenshot({ path: `${out}/model-size-${name}-${width}.png`, timeout: 90000 })
      .catch(() => {});
  const dlg = page.locator('dialog[open]');
  const btn = (name, exact = true) => page.getByRole('button', { name, exact });
  const click = async (loc) => {
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    await loc.click({ timeout: 3000 }).catch(() => loc.dispatchEvent('click'));
  };
  const sel = page.getByRole('region', { name: 'Selected 3D model: Cube' });
  /** On a phone the side panel is a sheet opened from its peek bar. */
  const panel = async () => {
    if (phone && !(await sel.isVisible().catch(() => false))) {
      const peek = page.locator('.sheet-peek');
      if (await peek.isVisible().catch(() => false)) await peek.click();
    }
  };
  const compose = async () => {
    await page.getByRole('radio', { name: /Compose/ }).click();
    const r = page.getByRole('radio', { name: '2D' });
    if (await r.isVisible().catch(() => false)) await r.click();
    await page.waitForTimeout(200);
    await panel();
  };
  const field = (label) => sel.getByLabel(label, { exact: true });
  const size = async () => {
    await compose();
    const v = async (l) =>
      Number(
        await field(l)
          .inputValue({ timeout: 3000 })
          .catch(() => 'NaN'),
      );
    return `${await v('Width')}×${await v('Height')}×${await v('Depth')}`;
  };
  const type = async (label, value) => {
    const f = field(label);
    await f.scrollIntoViewIfNeeded();
    await f.fill(String(value));
    await f.press('Enter');
    await page.waitForTimeout(200);
  };
  const front = page.getByRole('figure', { name: /Room seen from the front/ });
  const plan = page.getByRole('figure', { name: /Room plan, seen from above/ });
  const keep = sel.getByLabel('Keep proportions');

  // 1. Bare app → new project → Add a piece → My 3D models → import the cube and add it.
  await page.goto(url);
  await btn('Create a new project').click();
  await page.locator('dialog[open] input').fill(`Size ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  const add = btn('Add a piece');
  if (!(await add.isVisible().catch(() => false))) await page.locator('.sheet-peek').click();
  await click(add);
  const importBtn = dlg.getByRole('button', { name: 'Import 3D model' });
  await importBtn.scrollIntoViewIfNeeded();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), importBtn.click()]);
  await chooser.setFiles([good]);
  const row = dlg.getByRole('button', { name: /^Cube 600 × 600 × 600 mm/ });
  await row.waitFor({ timeout: 15000 }).catch(() => {});
  await row.click();
  await dlg.waitFor({ state: 'detached' }).catch(() => {});
  await compose();

  // 2. The selected model shows Width, Height, Depth and Keep proportions (on); no Reset size yet.
  for (const l of ['Width', 'Height', 'Depth'])
    check(
      width,
      `"${l}" field is found`,
      await field(l)
        .isVisible()
        .catch(() => false),
    );
  check(width, '"Keep proportions" is found and on', await keep.isChecked().catch(() => false));
  check(
    width,
    'no "Reset size" before a change',
    !(await sel.getByRole('button', { name: 'Reset size' }).isVisible()),
  );
  await shot('fields');
  check(width, 'no sideways scroll (fields)', await noSideScroll());

  // 3. Keep proportions off: typing a height changes only the height, on the plan and in the front view too.
  await keep.uncheck();
  await type('Height', 1200);
  check(
    width,
    'Keep off, Height 1200 → 600×1200×600',
    (await size()) === '600×1200×600',
    await size(),
  );
  check(
    width,
    'front view shows "600 wide, 1200 high"',
    (await front
      .getByRole('button', { name: /^Cube \(3D model\), 600 wide, 1200 high$/ })
      .count()) === 1,
  );
  check(
    width,
    'plan box stays "600 by 600 mm"',
    (await plan.getByRole('button', { name: /^Cube \(3D model\), 600 by 600 mm$/ }).count()) === 1,
  );

  // 4. Keep proportions on: typing a width scales the other two from the stretched size.
  await keep.check();
  await type('Width', 300);
  check(width, 'Keep on, Width 300 → 300×600×300', (await size()) === '300×600×300', await size());

  // 5. Undo: one step back per change.
  await click(btn('Undo'));
  await page.waitForTimeout(200);
  check(width, 'Undo once → 600×1200×600', (await size()) === '600×1200×600', await size());

  // 6. Reset size returns the imported size.
  const reset = sel.getByRole('button', { name: 'Reset size' });
  check(width, '"Reset size" is found after a change', await reset.isVisible());
  await click(reset);
  await page.waitForTimeout(200);
  check(width, 'Reset size → 600×600×600', (await size()) === '600×600×600', await size());
  await shot('reset');

  // 7. 3D, Move mode: the height handle is found; dragging it up with Keep off changes only the height.
  await keep.uncheck();
  await page.getByRole('radio', { name: /Build & Preview/ }).click();
  if (!phone) {
    const r = page.getByRole('radio', { name: '3D', exact: true });
    if (await r.isVisible().catch(() => false)) await r.click();
  }
  const three = page.locator('.view.three');
  await three.locator('canvas').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  const tools = page.getByRole('toolbar', { name: 'Place pieces in 3D' });
  const move = tools.getByRole('button', { name: 'Move', exact: true });
  check(
    width,
    '"Move" is found over the 3D view of a project with only a model',
    await move.isVisible(),
  );
  await click(move);
  const hHandle = btn('Resize height');
  await hHandle.waitFor({ timeout: 10000 }).catch(() => {});
  check(
    width,
    '"Resize width", "Resize height", "Resize depth" handles are found',
    (await btn('Resize width').isVisible()) &&
      (await hHandle.isVisible()) &&
      (await btn('Resize depth').isVisible()),
  );
  const hb = await hHandle.boundingBox();
  const note = three.getByText(/^\d+ × \d+ × \d+ mm \(W × H × D\)$/);
  let seen = '';
  if (hb) {
    const a = { x: hb.x + hb.width / 2, y: hb.y + hb.height / 2 };
    const steps = 10,
      dy = -60;
    const at = (i) => ({ x: a.x, y: a.y + (dy * i) / steps });
    if (phone) {
      const touch = (t, p) =>
        cdp.send('Input.dispatchTouchEvent', {
          type: t,
          touchPoints: p ? [{ x: p.x, y: p.y }] : [],
        });
      await touch('touchStart', a);
      for (let i = 1; i <= steps; i++) await touch('touchMove', at(i));
      await page.waitForTimeout(250);
      seen = (await note.textContent({ timeout: 1000 }).catch(() => '')) ?? '';
      await shot('drag');
      await touch('touchEnd');
    } else {
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      for (let i = 1; i <= steps; i++) await page.mouse.move(at(i).x, at(i).y);
      await page.waitForTimeout(250);
      seen = (await note.textContent({ timeout: 1000 }).catch(() => '')) ?? '';
      await shot('drag');
      await page.mouse.up();
    }
  }
  check(
    width,
    'while dragging, the label shows "W × H × D mm"',
    /^600 × \d+ × 600 mm/.test(seen),
    seen,
  );
  await page.waitForTimeout(300);
  const after = await size();
  const [w, h, d] = after.split('×').map(Number);
  check(
    width,
    'after the drag only the height grew (Keep off)',
    w === 600 && d === 600 && h > 600,
    after,
  );
  await click(btn('Undo'));
  await page.waitForTimeout(200);
  check(
    width,
    'Undo once after the drag → 600×600×600',
    (await size()) === '600×600×600',
    await size(),
  );
  check(width, 'no sideways scroll (3D)', await noSideScroll());
  check(width, 'no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
