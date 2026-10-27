// Find-it acceptance for 3D models from the device (CLAUDE.md R3, backlog N71, ADR-076), run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/models3d/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text. The script writes its own small model
// files into <out dir> (a red cube as .glb, a .gltf that points outside itself); no binary model is committed.
// Not part of `pnpm test`.
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
const good = `${out}/Cube.glb`,
  bad = `${out}/Outside.gltf`;
writeFileSync(good, cubeGlb());
writeFileSync(
  bad,
  JSON.stringify({
    asset: { version: '2.0' },
    meshes: [{ primitives: [] }],
    buffers: [{ uri: 'https://example.com/model.bin', byteLength: 10 }],
  }),
);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const results = [];
const check = (width, name, ok, detail = '') => {
  results.push({ width, name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${width}px ${name}${detail ? ` — ${detail}` : ''}`);
};

const widths = (process.argv[4] ?? '1440,1280,390,375').split(',').map(Number);
for (const width of widths) {
  const phone = width < 500;
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 812 : 900 } });
  const page = await ctx.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('request', (r) => {
    if (!r.url().startsWith(new URL(url).origin) && !/^(data|blob):/.test(r.url()))
      requests.push(r.url());
  });
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const shot = (name) =>
    page
      .screenshot({
        path: `${out}/models3d-${name}-${width}.png`,
        fullPage: !phone,
        timeout: 90000,
      })
      .catch(() => {});
  const dlg = page.locator('dialog[open]');
  const btn = (name, exact = true) => page.getByRole('button', { name, exact });
  /** "Add a piece" sits in the side panel; on a phone that panel is a sheet opened from its peek bar. */
  const openAdd = async () => {
    const add = btn('Add a piece');
    if (!(await add.isVisible().catch(() => false))) await page.locator('.sheet-peek').click();
    await click(add);
  };
  const click = async (loc) => {
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    await loc.click({ timeout: 3000 }).catch(() => loc.dispatchEvent('click'));
  };
  const plan = page.getByRole('figure', { name: /Room plan, seen from above/ });
  const front = page.getByRole('figure', { name: /Room seen from the front/ });
  const onPlan = plan.getByRole('button', { name: /^Cube \(3D model\), 600 by 600 mm$/ });
  const onFront = front.getByRole('button', { name: /^Cube \(3D model\), 600 wide, 600 high$/ });
  /** Red pixels in the 3D canvas: the cube's own colour, so the model itself is drawn (not the fallback box). */
  const redPixels = async () => {
    const canvas = page.locator('.view.three canvas').first();
    if (!(await canvas.isVisible().catch(() => false))) return 0;
    // Software WebGL on a busy machine can be slow: allow a long time for one frame.
    const png = await canvas.screenshot({ timeout: 90000 }).catch(() => null);
    if (!png) return 0;
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
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 90 && d[i] > d[i + 1] + 50) n++;
      return n;
    }, png.toString('base64'));
  };
  const waitRed = async () => {
    for (let i = 0; i < 20; i++) {
      const n = await redPixels();
      if (n > 200) return n;
      await page.waitForTimeout(500);
    }
    return redPixels();
  };
  const show3d = async () => {
    await page.getByRole('radio', { name: /Build & Preview/ }).click();
    if (!phone) {
      const r = page.getByRole('radio', { name: '3D', exact: true });
      if (await r.isVisible().catch(() => false)) await r.click();
    }
    await page.locator('.view.three canvas').first().waitFor({ timeout: 30000 });
    // The simple look draws the same model with less work (no occlusion pass).
    const simple = page.getByRole('radio', { name: 'Simple' });
    if (await simple.isVisible().catch(() => false)) await simple.click();
  };
  const showPlan = async () => {
    await page.getByRole('radio', { name: 'Compose' }).click();
    const r = page.getByRole('radio', { name: 'Plan' });
    if (await r.isVisible().catch(() => false)) await r.click();
  };

  // 1. Bare app → new project → Add a piece → My 3D models.
  await page.goto(url);
  await btn('Create a new project').click();
  await page.locator('dialog[open] input').fill(`Models ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await openAdd();
  const head = dlg.getByRole('heading', { name: 'My 3D models' });
  await head.scrollIntoViewIfNeeded();
  check(width, '"Add a piece" → "My 3D models" is found', await head.isVisible());
  const importBtn = dlg.getByRole('button', { name: 'Import 3D model' });
  check(width, '"Import 3D model" is found', await importBtn.isVisible());

  // 2. Import a good and a bad file at once: the good one is listed, the bad one is refused with a message.
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), importBtn.click()]);
  await chooser.setFiles([good, bad]);
  const imported = dlg.getByText('Imported Cube.');
  await imported.waitFor({ timeout: 15000 }).catch(() => {});
  check(width, 'the .glb is imported ("Imported Cube.")', await imported.isVisible());
  const refused = dlg.getByRole('alert').filter({ hasText: 'uses files outside it' });
  check(
    width,
    'the .gltf with an outside URI is refused with a message',
    await refused.isVisible(),
    (await refused.textContent().catch(() => '')) ?? '',
  );
  const row = dlg.getByRole('button', { name: /^Cube 600 × 600 × 600 mm · 12 triangles/ });
  check(width, 'Cube is listed under My 3D models with its size', await row.isVisible());
  const thumb = row.locator('img');
  check(width, 'the listed model has a rendered thumbnail', (await thumb.count()) === 1);
  await shot('library');
  check(width, 'no sideways scroll (Add a piece)', await noSideScroll());

  // 3. Add it: it is on the plan and in the front view as a labelled box, and selected.
  await row.click();
  await dlg.waitFor({ state: 'detached' }).catch(() => {});
  await showPlan();
  await onPlan.waitFor({ timeout: 5000 }).catch(() => {});
  check(width, 'on the plan as "Cube (3D model), 600 by 600 mm"', await onPlan.isVisible());
  check(
    width,
    'in the front view as "Cube (3D model), 600 wide, 600 high"',
    (await onFront.count()) === 1,
  );
  const sel = page.getByRole('region', { name: 'Selected 3D model: Cube' });
  if (phone && !(await sel.isVisible().catch(() => false))) {
    const peek = page.locator('.sheet-peek');
    if (await peek.isVisible().catch(() => false)) await peek.click();
  }
  // The explanation sits behind the card's info button (ADR-111).
  await sel
    .getByRole('button', { name: 'About 3D models' })
    .click()
    .catch(() => {});
  check(
    width,
    '"Selected 3D model" shows with "Display only" behind "About 3D models"',
    (await sel.textContent().catch(() => ''))?.includes('Display only') ?? false,
  );
  await page.keyboard.press('Escape');
  await shot('plan');

  // 4. The parts list stays empty: a display-only item is never cut.
  check(width, 'no sideways scroll (plan)', await noSideScroll());

  // 5. It shows in 3D (its own red faces are drawn).
  await show3d().catch(() => {});
  const red = await waitRed();
  check(width, 'the model shows in 3D', red > 200, `${red} red pixels`);
  await shot('3d');

  // 6. Reload: the project and its model are still on this device.
  await page.waitForTimeout(1200);
  await page.reload();
  const card = page.getByRole('button', { name: new RegExp(`Models ${width}`) }).first();
  if (await card.isVisible({ timeout: 5000 }).catch(() => false)) await card.click();
  await page
    .locator('main.work')
    .waitFor({ state: 'visible', timeout: 10000 })
    .catch(() => {});
  await show3d().catch(() => {});
  const red2 = await waitRed();
  check(width, 'after a reload the model still shows in 3D', red2 > 200, `${red2} red pixels`);
  await showPlan();
  check(width, 'after a reload it is still on the plan', await onPlan.isVisible());

  // 7. Delete from the library is refused while the project uses it.
  await openAdd();
  await dlg.getByRole('button', { name: 'Delete Cube' }).first().click();
  await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
  const used = dlg.getByRole('alert').filter({ hasText: 'is used by' });
  await used.waitFor({ timeout: 5000 }).catch(() => {});
  check(
    width,
    'deleting a model in use is refused',
    await used.isVisible(),
    (await used.textContent().catch(() => '')) ?? '',
  );
  await shot('in-use');
  await page.keyboard.press('Escape');

  check(
    width,
    'no network request outside the app',
    requests.length === 0,
    requests.slice(0, 3).join(' | '),
  );
  check(width, 'no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
