// Find-it acceptance for ADR-203 (keep project pieces safe while editing them), run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/piece-safety/find-it.mjs http://localhost:4173/furniture-builder/ <out dir> [widths]
// Starts from the bare app at 1280 and 390 px and finds everything by role and visible text:
//   1. Esc in the piece editor goes up one level (a hanging space → its divided bay → the whole piece → nothing).
//   2. A project of three base cabinets with "Handles for this run…": a piece opened from it shows
//      "Set by Handles for this run" in its Doors and handles.
//   3. A wizard-made project piece: its Settings show "Open in wizard"; "Update piece" changes that piece's width.
//   4. A piece turned 30° (] with Shift, ADR-169): tapped in 3D, its selection outline lies on the turned piece.
//   5. A display-only 3D model (a cube the script writes): in 3D Move mode a drag moves it and "Turn 90° ↺" turns it.
//   6. Deleting a project with a kept version asks "Also delete its 1 kept version?"; Esc keeps it.
// The script writes its own model file into <out dir>; no binary is committed. Not part of `pnpm test`.
import { launchBrowser, previewUrl, outDir } from '../lib/harness.mjs';
import { goBuild, goCompose, openPieceEditor } from '../lib/steps.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const url = previewUrl();
const out = outDir();
const widths = (process.argv[4] ?? '1280,390').split(',').map(Number);
// ONLY=4,5 runs just those sections (2 always runs: the later ones use its project).
const only = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : null;
const SKIP = Symbol('skip');
const want = (n) => {
  if (only && n !== 2 && !only.includes(n)) throw SKIP;
};
mkdirSync(out, { recursive: true });

/** A 0.6 m red cube as a GLB (12 triangles), as tools/models3d writes it. */
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
const cube = `${out}/Cube.glb`;
writeFileSync(cube, cubeGlb());

const browser = await launchBrowser();
const results = [];
const check = (width, name, ok, detail = '') => {
  results.push({ width, name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${width}px ${name}${detail ? ` — ${detail}` : ''}`);
};

for (const width of widths) {
  const phone = width < 500;
  const ctx = await browser.newContext({
    viewport: { width, height: phone ? 844 : 900 },
    hasTouch: phone,
    isMobile: phone,
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const errors = [];
  let section = '';
  page.on('pageerror', (e) => {
    errors.push(`${section}: ${e.message}`);
    if (process.env.STACKS) console.log(e.stack);
  });
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${section}: ${m.text()}`);
  });
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const shot = (name) =>
    page
      .screenshot({ path: `${out}/piece-safety-${name}-${width}.png`, timeout: 90000 })
      .catch(() => {});
  const dlg = page.locator('dialog[open]');
  const btn = (name, exact = true) => page.getByRole('button', { name, exact });
  const click = async (loc) => {
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    await loc.click({ timeout: 3000 }).catch(() => loc.dispatchEvent('click'));
  };
  /** On a phone the side panel is a sheet opened from its peek bar. */
  const sheet = async (open) => {
    const peek = page.locator('.sheet-peek');
    if (!(await peek.isVisible().catch(() => false))) return;
    if (((await peek.getAttribute('aria-expanded')) === 'true') !== open) await peek.click();
    await page.waitForTimeout(250);
  };
  const said = () =>
    (phone ? page.locator('.sheet-peek') : page.locator('aside.side')).innerText().catch(() => '');
  const compose = async () => {
    await goCompose(page);
    const r = page.getByRole('radio', { name: '2D' });
    if (await r.isVisible().catch(() => false)) await r.click();
    await page.waitForTimeout(250);
  };
  const plan = page.getByRole('figure', { name: /Room plan, seen from above/ });
  const planPiece = (i) =>
    plan.getByRole('button', { name: /^Base cabinet.*, \d+ by \d+ mm$/ }).nth(i);
  const addBase = async () => {
    await sheet(true);
    await click(btn('Add a piece'));
    await dlg.getByRole('searchbox', { name: 'Search the items' }).fill('Base cabinet');
    await dlg.locator('.start-group .row-btn').first().click();
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
    const place = btn('Place to the right');
    await place.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
    if (await place.isVisible()) await click(place);
    await page.waitForTimeout(150);
    await sheet(false);
  };
  /** Select project piece `i` on the plan and open it in the piece editor. */
  const editPiece = async (loc) => {
    await sheet(false);
    await compose();
    await click(loc);
    await page.waitForTimeout(250);
    await sheet(true);
    await openPieceEditor(page);
    await page.locator('figure.elevation').waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(250);
  };
  const backToProject = async () => {
    await sheet(true);
    const back = page.getByRole('button', { name: /Back to project|Back to the project/ }).first();
    await click(back);
    await page.waitForTimeout(300);
  };
  const three = page.locator('.view.three');
  const canvas = three.locator('canvas').first();
  // `tall`: on a phone, the Editor place's 3D view (it has the 3D/2D switch too, ADR-241), taller than the Cut list
  // place's, where the wrapped 3D toolbar and the drag note cover most of a piece and its Move ghost.
  const to3d = async (tall = false) => {
    if (phone && tall) {
      await goCompose(page);
      await sheet(false);
    } else if (phone) await goBuild(page);
    await page.getByRole('radio', { name: '3D', exact: true }).click();
    await canvas.waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(1500);
  };
  /** The 3D canvas as RGBA pixels. */
  const canvasPixels = async () => {
    const png = await canvas.screenshot({ timeout: 90000 });
    return page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      return {
        w: c.width,
        h: c.height,
        d: Array.from(g.getImageData(0, 0, c.width, c.height).data),
      };
    }, png.toString('base64'));
  };

  // ---------------------------------------------------------------------------------------------------------------
  section = 'esc';
  // 1. Esc goes up one level in the piece editor.
  await page.goto(url);
  try {
    want(1);
    await btn('New single piece').click();
    await dlg
      .getByRole('button', { name: /Wardrobe/ })
      .first()
      .click();
    await page.locator('main.work').waitFor({ state: 'visible' });
    await goCompose(page);
    const hanging = page.getByRole('button', { name: /^Hanging space, / });
    const tap = async () => {
      const b = await hanging.boundingBox();
      await page.mouse.click(b.x + b.width / 2, b.y + b.height * 0.25);
      await page.waitForTimeout(250);
    };
    await tap();
    await tap();
    await tap();
    check(
      width,
      'three taps select the hanging space',
      (await hanging.getAttribute('aria-pressed')) === 'true',
    );
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    let t = await said();
    check(
      width,
      'Esc: one level up, the divided bay around it',
      (await hanging.getAttribute('aria-pressed')) !== 'true' &&
        (phone ? t.includes('Selected: Divided space') : /Interior\s*\/?\s*Divided/.test(t)),
      t.replace(/\s+/g, ' ').slice(0, 80),
    );
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    t = await said();
    check(
      width,
      'Esc again: the whole piece',
      t.includes('Selected: Whole cabinet'),
      t.slice(0, 80),
    );
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    t = await said();
    check(
      width,
      'Esc again: nothing selected',
      !t.includes('Selected:') && (await page.locator('.el-selection').count()) === 0,
      t.replace(/\s+/g, ' ').slice(0, 80),
    );
    await shot('esc');
  } catch (e) {
    if (e !== SKIP) check(width, 'Esc section ran', false, String(e).slice(0, 200));
    await shot('error-1');
  }

  // ---------------------------------------------------------------------------------------------------------------
  section = 'run handle';
  // 2. A project with Handles for this run: the piece editor shows the run's handle read-only.
  await page.goto(url);
  const projectName = `Safety ${width}`;
  let current = projectName;
  await btn('Create a new project').click();
  await page.locator('dialog[open] input').fill(projectName);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  for (let i = 0; i < 3; i++) await addBase();
  try {
    want(2);
    await click(btn('Settings'));
    const runParts = dlg.getByRole('region', { name: 'Run parts' });
    await click(runParts.getByRole('button', { name: /Suggest run parts/ }));
    await click(runParts.getByRole('button', { name: 'Handles for this run…' }));
    const hg = runParts.getByRole('group', { name: 'Handles for this run' });
    await hg.getByLabel('Line height above the floor').fill('800');
    await click(hg.getByRole('button', { name: 'Add handles' }));
    check(
      width,
      'Settings › Run parts › Handles for this run is added',
      await runParts.getByText(/line 800 mm above the floor/).isVisible(),
    );
    await click(dlg.getByRole('button', { name: 'Done' }));
    await dlg.waitFor({ state: 'detached' }).catch(() => {});

    await editPiece(planPiece(1));
    const door = page.getByRole('button', { name: /space, / }).first();
    for (let i = 0; i < 3; i++) {
      if (
        await page
          .getByText('Set by Handles for this run')
          .isVisible()
          .catch(() => false)
      )
        break;
      await sheet(false);
      const b = await door.boundingBox();
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await page.waitForTimeout(300);
      await sheet(true);
    }
    const note = page.getByText('Set by Handles for this run');
    await note.scrollIntoViewIfNeeded().catch(() => {});
    check(
      width,
      'a piece of the run shows "Set by Handles for this run" in its Doors and handles',
      await note.isVisible().catch(() => false),
    );
    check(
      width,
      'its own handle choice is not offered there',
      !(await page
        .getByText('Handles on the doors')
        .isVisible()
        .catch(() => false)),
    );
    await shot('run-handle');
    await backToProject();
  } catch (e) {
    if (e !== SKIP) check(width, 'run handle section ran', false, String(e).slice(0, 200));
    await shot('error-2');
  }

  // ---------------------------------------------------------------------------------------------------------------
  section = 'wizard';
  // 3. A wizard-made project piece: Settings › Open in wizard › Update piece.
  try {
    want(3);
    await sheet(true);
    await click(btn('Add a piece'));
    await click(dlg.getByRole('button', { name: /New piece, step by step/ }));
    const wiz = page.getByRole('dialog', { name: 'New piece' });
    await wiz.getByRole('radio', { name: /Cabinet \(closed box\)/ }).click();
    for (let i = 0; i < 15; i++) {
      const add = wiz.getByRole('button', { name: 'Add to project' });
      if (await add.isVisible().catch(() => false)) {
        await click(add);
        break;
      }
      const next = wiz.getByRole('button', { name: 'Next' });
      await click(next);
      await page.waitForTimeout(150);
    }
    await wiz.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
    const place = btn('Place to the right');
    await place.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
    if (await place.isVisible()) await click(place);
    await page.waitForTimeout(300);
    await sheet(false);
    await compose();
    const pieces = plan.getByRole('button', { name: /, \d+ by \d+ mm$/ });
    const made = pieces.nth((await pieces.count()) - 1);
    await editPiece(made);
    await click(btn('Settings'));
    const openWiz = dlg.getByRole('button', { name: 'Open in wizard' });
    check(
      width,
      '"Open in wizard" shows in a project piece\'s Settings',
      await openWiz.isVisible().catch(() => false),
    );
    const w0 = Number(await dlg.getByRole('textbox', { name: 'Width' }).first().inputValue());
    await click(openWiz);
    const re = page.getByRole('dialog', { name: /^Wizard: / });
    await re.waitFor({ timeout: 5000 });
    await click(
      re.getByRole('list', { name: 'Wizard steps' }).getByRole('button', { name: 'Size' }),
    );
    const wBox = re.getByRole('textbox', { name: /^Width/ });
    await wBox.fill(String(w0 + 100));
    await wBox.press('Tab');
    await click(
      re.getByRole('list', { name: 'Wizard steps' }).getByRole('button', { name: 'Review' }),
    );
    await click(re.getByRole('button', { name: 'Update piece' }));
    await re.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
    await click(btn('Settings'));
    const w1 = Number(await dlg.getByRole('textbox', { name: 'Width' }).first().inputValue());
    check(width, '"Update piece" changed the project piece', w1 === w0 + 100, `${w0} → ${w1}`);
    await shot('wizard-updated');
    await click(dlg.getByRole('button', { name: 'Done' }));
    await backToProject();
  } catch (e) {
    if (e !== SKIP) check(width, 'wizard section ran', false, String(e).slice(0, 200));
    await shot('error-3');
  }

  // ---------------------------------------------------------------------------------------------------------------
  section = 'angled outline';
  // 4. A piece turned 30°, alone in its own project so its outline can be told from its neighbours': selected in 3D,
  //    its selection outline lies on the turned piece.
  try {
    want(4);
    current = `Angle ${width}`;
    await click(
      page
        .getByRole('link', { name: 'Projects' })
        .or(page.getByRole('button', { name: 'Projects', exact: true }))
        .first(),
    );
    await btn('Create a new project').click();
    await page.locator('dialog[open] input').fill(current);
    await dlg.getByRole('button', { name: 'Create project' }).click();
    await page.locator('main.work').waitFor({ state: 'visible' });
    await addBase();
    await sheet(false);
    await compose();
    // Shift+] turns the focused plan piece by 15° (ADR-169): twice is 30°.
    const floorOf = async () => {
      await click(planPiece(0));
      await page.waitForTimeout(200);
      await sheet(true);
      const m = /(\d+) × (\d+) mm of floor/.exec(await page.locator('aside.side').innerText());
      await sheet(false);
      return m ? `${m[1]} × ${m[2]}` : '';
    };
    const square = await floorOf();
    await planPiece(0).focus();
    await page.keyboard.press('Shift+]');
    await page.waitForTimeout(150);
    await planPiece(0).focus();
    await page.keyboard.press('Shift+]');
    await page.waitForTimeout(250);
    const angled = await floorOf();
    check(
      width,
      'Shift+] twice turns the piece 30° (its floor area grows)',
      !!square && !!angled && angled !== square,
      `${square} → ${angled}`,
    );
    await to3d(true);
    {
      // The Simple look draws fast enough in a software-rendered browser; on a phone it sits in a view menu.
      const simple = page.getByRole('radio', { name: 'Simple' }).filter({ visible: true }).first();
      const menu = page.locator('details.view-options').filter({ visible: true }).first();
      const inMenu = !(await simple.isVisible().catch(() => false)) && (await menu.count()) > 0;
      if (inMenu && !(await menu.evaluate((d) => d.open)))
        await menu.locator(':scope > summary').click();
      await simple.click();
      if (inMenu) await page.keyboard.press('Escape');
      await page.waitForTimeout(800);
    }
    // Nothing selected, then the turned piece tapped in 3D (the plan selection carries over): the outline appears.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
    const before = await canvasPixels();
    await shot('angled-unselected');
    // Select the turned piece (one tap on the plan: the whole piece), then back to 3D.
    await sheet(false);
    await compose();
    await click(planPiece(0));
    await page.waitForTimeout(250);
    await to3d(true);
    await page.waitForTimeout(800);
    const after = await canvasPixels();
    await shot('angled-selected');
    // The tool buttons, labels and the quick-count card sit over the canvas: their areas are left out (canvas px).
    const coverRects = () =>
      page.evaluate(() => {
        const c = document.querySelector('.view.three canvas');
        const cr = c.getBoundingClientRect();
        const k = c.width / cr.width;
        const out = [];
        for (const el of document.querySelectorAll('.view.three *')) {
          if (el === c || el.contains(c) || el.closest('canvas')) continue;
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
          out.push([
            (r.left - cr.left) * k,
            (r.top - cr.top) * k,
            (r.right - cr.left) * k,
            (r.bottom - cr.top) * k,
          ]);
        }
        // The quick-count card can sit outside .view.three; it is a region named after the counts. On a phone's
        // Editor place the sheet and the bottom nav lie over the canvas's foot (ADR-241), with a shadow above them.
        for (const el of document.querySelectorAll(
          '.quick-count, .count-card, [aria-label="Quick counts"], .sheet-peek, aside.side, nav[aria-label="Places"]',
        )) {
          const r = el.getBoundingClientRect();
          const shade = el.matches('.sheet-peek, aside.side, nav') ? 24 : 0;
          out.push([
            (r.left - cr.left) * k,
            (r.top - shade - cr.top) * k,
            (r.right - cr.left) * k,
            (r.bottom - cr.top) * k,
          ]);
        }
        return out;
      });
    const covered = await coverRects();
    // The outline is drawn in the selection colour (#2d5b4c) round the piece's box. Turned with the piece, the
    // region it encloses is the turned piece's own silhouette; left unturned (the bug G-172 fixed) it stands at 30° to
    // it. Measured as the overlap (intersection over union) of the two convex hulls on the canvas.
    const res = await page.evaluate(
      ({ a, b, covered }) => {
        const W = a.w,
          H = a.h;
        const at = (d, x, y) => (y * W + x) * 4;
        // The background: the colour at the canvas's left edge, half way down (the piece is framed in the middle;
        // the tool buttons sit over the top).
        const b0 = at(a.d, 4, Math.floor(H / 2));
        const bg = [a.d[b0], a.d[b0 + 1], a.d[b0 + 2]];
        const sil = [],
          line = [];
        const hidden = new Uint8Array(W * H);
        for (const [x0, y0, x1, y1] of covered)
          for (let y = Math.max(0, Math.floor(y0) - 2); y < Math.min(H, Math.ceil(y1) + 2); y++)
            for (let x = Math.max(0, Math.floor(x0) - 2); x < Math.min(W, Math.ceil(x1) + 2); x++)
              hidden[y * W + x] = 1;
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            if (hidden[y * W + x]) continue;
            const i = at(a.d, x, y);
            const dbg =
              Math.abs(a.d[i] - bg[0]) +
              Math.abs(a.d[i + 1] - bg[1]) +
              Math.abs(a.d[i + 2] - bg[2]);
            if (dbg > 30) sil.push([x, y]);
            const r = b.d[i],
              g = b.d[i + 1],
              bl = b.d[i + 2];
            const changed =
              Math.abs(a.d[i] - r) + Math.abs(a.d[i + 1] - g) + Math.abs(a.d[i + 2] - bl) > 60;
            if (changed && g > r + 15 && g >= bl && r < 100 && g < 150) line.push([x, y]);
          }
        const hull = (pts) => {
          const p = [...pts].sort((u, v) => u[0] - v[0] || u[1] - v[1]);
          if (p.length < 3) return p;
          const cross = (o, u, v) => (u[0] - o[0]) * (v[1] - o[1]) - (u[1] - o[1]) * (v[0] - o[0]);
          const lo = [],
            hi = [];
          for (const q of p) {
            while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
            lo.push(q);
          }
          for (const q of p.reverse()) {
            while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop();
            hi.push(q);
          }
          return lo.slice(0, -1).concat(hi.slice(0, -1));
        };
        const inside = (h, x, y) => {
          for (let k = 0; k < h.length; k++) {
            const o = h[k],
              u = h[(k + 1) % h.length];
            if ((u[0] - o[0]) * (y - o[1]) - (u[1] - o[1]) * (x - o[0]) < 0) return false;
          }
          return true;
        };
        if (line.length < 50 || sil.length < 50)
          return { line: line.length, sil: sil.length, iou: 0 };
        const hs = hull(sil),
          ho = hull(line);
        let both = 0,
          either = 0;
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            if (hidden[y * W + x]) continue;
            const s1 = inside(hs, x, y),
              s2 = inside(ho, x, y);
            if (s1 && s2) both++;
            if (s1 || s2) either++;
          }
        return { line: line.length, sil: sil.length, iou: either ? both / either : 0, hs };
      },
      { a: before, b: after, covered },
    );
    check(
      width,
      'tapped, the turned piece shows its selection outline in 3D',
      res.line > 200,
      `${res.line} outline px`,
    );
    check(
      width,
      "the outline is turned with the piece (it encloses the turned piece's silhouette)",
      res.line > 200 && res.iou >= 0.9,
      `overlap ${Math.round(res.iou * 100)}%`,
    );

    // The Move ghost: in Move mode, dragging the turned piece shows a translucent copy where it would land. Turned
    // like its boards, the copy has the piece's own shape; unturned it would stand at 30° to it.
    const tools = page.getByRole('toolbar', { name: 'Place pieces in 3D' });
    const move = tools.getByRole('button', { name: 'Move', exact: true });
    if ((await move.getAttribute('aria-pressed')) !== 'true') await click(move);
    await page.waitForTimeout(500);
    const held = await canvasPixels();
    const r = await canvas.boundingBox();
    const k = r.width / held.w;
    const xs = res.hs.map((q) => q[0]),
      ys = res.hs.map((q) => q[1]);
    const c0 = {
      x: r.x + ((Math.min(...xs) + Math.max(...xs)) / 2) * k,
      y: r.y + ((Math.min(...ys) + Math.max(...ys)) / 2) * k,
    };
    // A short drag, so the ghost stays inside the view.
    const dx = phone ? 30 : 50;
    let ghostImg;
    if (phone) {
      const touch = (type, q) =>
        cdp.send('Input.dispatchTouchEvent', { type, touchPoints: q ? [{ x: q.x, y: q.y }] : [] });
      await touch('touchStart', c0);
      for (let i = 1; i <= 10; i++) await touch('touchMove', { x: c0.x + (dx * i) / 10, y: c0.y });
      await page.waitForTimeout(300);
      ghostImg = await canvasPixels();
      await shot('angled-ghost');
      var ghostCover = await coverRects();
      await touch('touchEnd');
    } else {
      await page.mouse.move(c0.x, c0.y);
      await page.mouse.down();
      for (let i = 1; i <= 10; i++) await page.mouse.move(c0.x + (dx * i) / 10, c0.y);
      await page.waitForTimeout(300);
      ghostImg = await canvasPixels();
      await shot('angled-ghost');
      var ghostCover = await coverRects();
      await page.mouse.up();
    }
    await page.waitForTimeout(400);
    const gres = await page.evaluate(
      ({ a, b, covered, hs }) => {
        const W = a.w,
          H = a.h;
        const hidden = new Uint8Array(W * H);
        for (const [x0, y0, x1, y1] of covered)
          for (let y = Math.max(0, Math.floor(y0) - 2); y < Math.min(H, Math.ceil(y1) + 2); y++)
            for (let x = Math.max(0, Math.floor(x0) - 2); x < Math.min(W, Math.ceil(x1) + 2); x++)
              hidden[y * W + x] = 1;
        const pts = [];
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            if (hidden[y * W + x]) continue;
            const i = (y * W + x) * 4;
            const r = b.d[i],
              g = b.d[i + 1],
              bl = b.d[i + 2];
            const changed =
              Math.abs(a.d[i] - r) + Math.abs(a.d[i + 1] - g) + Math.abs(a.d[i + 2] - bl) > 30;
            // The ghost is the selection colour (or the snap green) at 28%: a green cast.
            if (changed && g > r + 4) pts.push([x, y]);
          }
        const hull = (q0) => {
          const p = [...q0].sort((u, v) => u[0] - v[0] || u[1] - v[1]);
          if (p.length < 3) return p;
          const cross = (o, u, v) => (u[0] - o[0]) * (v[1] - o[1]) - (u[1] - o[1]) * (v[0] - o[0]);
          const lo = [],
            hi = [];
          for (const q of p) {
            while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
            lo.push(q);
          }
          for (const q of p.reverse()) {
            while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop();
            hi.push(q);
          }
          return lo.slice(0, -1).concat(hi.slice(0, -1));
        };
        const inside = (h, x, y) => {
          for (let k = 0; k < h.length; k++) {
            const o = h[k],
              u = h[(k + 1) % h.length];
            if ((u[0] - o[0]) * (y - o[1]) - (u[1] - o[1]) * (x - o[0]) < 0) return false;
          }
          return true;
        };
        if (pts.length < 200) return { n: pts.length, iou: 0 };
        const hg = hull(pts);
        const mid = (h) => {
          const xs = h.map((q) => q[0]),
            ys = h.map((q) => q[1]);
          return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
        };
        // The ghost's shape laid over the piece's own: centred on it.
        const [gx, gy] = mid(hg),
          [px, py] = mid(hs);
        const moved = hg.map(([x, y]) => [x - gx + px, y - gy + py]);
        let both = 0,
          either = 0;
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            const s1 = inside(hs, x, y),
              s2 = inside(moved, x, y);
            if (s1 && s2) both++;
            if (s1 || s2) either++;
          }
        return { n: pts.length, iou: either ? both / either : 0 };
      },
      { a: held, b: ghostImg, covered: ghostCover, hs: res.hs },
    );
    check(
      width,
      'in Move mode, dragging the turned piece shows its ghost',
      gres.n >= 200,
      `${gres.n} ghost px`,
    );
    check(
      width,
      'the Move ghost is turned like the piece (same shape)',
      gres.n >= 200 && gres.iou >= 0.85,
      `overlap ${Math.round(gres.iou * 100)}%`,
    );
  } catch (e) {
    if (e !== SKIP) check(width, 'angled outline section ran', false, String(e).slice(0, 200));
    await shot('error-4');
  }

  // ---------------------------------------------------------------------------------------------------------------
  section = 'model';
  // 5. A display-only 3D model: dragged in 3D Move mode, then Turn 90° ↺.
  try {
    want(5);
    await sheet(false);
    await compose();
    await sheet(true);
    await click(btn('Add a piece'));
    const importBtn = dlg.getByRole('button', { name: 'Import 3D model' });
    await importBtn.scrollIntoViewIfNeeded();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), click(importBtn)]);
    await chooser.setFiles([cube]);
    const row = dlg.getByRole('button', { name: /^Cube 600 × 600 × 600 mm/ });
    await row.waitFor({ timeout: 15000 });
    await row.click();
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
    await page.waitForTimeout(300);
    const card = page.getByRole('region', { name: 'Selected 3D model: Cube' });
    const readModel = async () => {
      if (phone) {
        await compose();
        await sheet(true);
      }
      const x = Number(
        await card.getByLabel('From left', { exact: true }).inputValue({ timeout: 3000 }),
      );
      const turn = (
        (await card
          .getByRole('radiogroup', { name: 'Turn' })
          .getByRole('radio', { checked: true })
          .textContent({ timeout: 3000 })
          .catch(() => '')) ?? ''
      ).trim();
      if (phone) await sheet(false);
      return { x, turn };
    };
    section = 'model: read';
    const start = await readModel();
    check(
      width,
      'the model is in the project ("Selected 3D model: Cube")',
      Number.isFinite(start.x),
      `${start.x}`,
    );
    section = 'model: 3D';
    await to3d();
    const tools = page.getByRole('toolbar', { name: 'Place pieces in 3D' });
    const move = tools.getByRole('button', { name: 'Move', exact: true });
    if ((await move.getAttribute('aria-pressed')) !== 'true') await click(move);
    check(width, 'Move is on', (await move.getAttribute('aria-pressed')) === 'true');
    // Nothing selected, so its size handles (ADR-102) are not in the way; pressing it selects it and drags it.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    // The model sits right of the pieces; find its red faces and drag from there.
    const px = await canvasPixels();
    // A point on its red faces, left of the middle.
    const red = await page.evaluate((a) => {
      const pts = [];
      for (let y = 0; y < a.h; y++)
        for (let x = 0; x < a.w; x++) {
          const i = (y * a.w + x) * 4;
          if (a.d[i] > 90 && a.d[i] > a.d[i + 1] + 50) pts.push([x, y]);
        }
      if (!pts.length) return null;
      const xs = pts.map((q) => q[0]),
        ys = pts.map((q) => q[1]);
      const x0 = Math.min(...xs),
        x1 = Math.max(...xs),
        y0 = Math.min(...ys),
        y1 = Math.max(...ys);
      const gx = x0 + 0.3 * (x1 - x0),
        gy = y0 + 0.6 * (y1 - y0);
      let best = pts[0],
        bd = Infinity;
      for (const q of pts) {
        const d = (q[0] - gx) ** 2 + (q[1] - gy) ** 2;
        if (d < bd) [best, bd] = [q, d];
      }
      return { n: pts.length, x: best[0], y: best[1] };
    }, px);
    check(width, 'the model is drawn in 3D', !!red && red.n > 100, `${red?.n ?? 0} red px`);
    const r = await canvas.boundingBox();
    const scale = r.width / px.w;
    const a = { x: r.x + red.x * scale, y: r.y + red.y * scale };
    const dx = phone ? -60 : -120;
    const steps = 10;
    if (phone) {
      const touch = (type, p) =>
        cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y }] : [] });
      await touch('touchStart', a);
      for (let i = 1; i <= steps; i++)
        await touch('touchMove', { x: a.x + (dx * i) / steps, y: a.y });
      await page.waitForTimeout(250);
      await shot('model-dragging');
      await touch('touchEnd');
    } else {
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      for (let i = 1; i <= steps; i++) await page.mouse.move(a.x + (dx * i) / steps, a.y);
      await page.waitForTimeout(250);
      await shot('model-dragging');
      await page.mouse.up();
    }
    await page.waitForTimeout(500);
    section = 'model: after drag';
    const moved = await readModel();
    check(width, 'the 3D drag moved the model', moved.x !== start.x, `${start.x} → ${moved.x}`);
    if (phone) await to3d();
    const turnBtn = tools.getByRole('button', { name: /Turn 90° anticlockwise/ });
    check(
      width,
      '"Turn 90° ↺" shows over the 3D view for the selected model',
      await turnBtn.isVisible(),
    );
    section = 'model: turn';
    await click(turnBtn);
    await page.waitForTimeout(400);
    await shot('model-turned');
    section = 'model: read after turn';
    const end = await readModel();
    const quarter = (d) => ((parseInt(d, 10) + 90) % 360) + '°';
    check(
      width,
      'Turn 90° ↺ turned the model a quarter',
      end.turn === quarter(moved.turn),
      `${moved.turn} → ${end.turn}`,
    );
  } catch (e) {
    if (e !== SKIP) check(width, 'model section ran', false, String(e).slice(0, 200));
    await shot('error-5');
  }

  // ---------------------------------------------------------------------------------------------------------------
  section = 'delete';
  // 6. A kept version, then the project deleted from Projects: the versions are asked about; Esc keeps them.
  try {
    want(6);
    if (phone) await compose();
    await sheet(true);
    const history = page.locator('summary').filter({ hasText: /^History( · \d+ versions?)?$/ });
    if (!(await history.evaluate((s) => s.parentElement.open).catch(() => true)))
      await click(history);
    await click(btn('Save a version'));
    await page.getByRole('button', { name: 'Restore' }).first().waitFor({ timeout: 5000 });
    // Another project open, so this one can be deleted.
    const toProjects = page
      .getByRole('link', { name: 'Projects' })
      .or(page.getByRole('button', { name: 'Projects', exact: true }))
      .first();
    await click(toProjects);
    await btn('Create a new project').click();
    await page.locator('dialog[open] input').fill(`Other ${width}`);
    await dlg.getByRole('button', { name: 'Create project' }).click();
    await page.locator('main.work').waitFor({ state: 'visible' });
    await click(toProjects);
    const list = page.getByRole('main', { name: 'Projects' });
    if (phone) {
      await click(list.getByLabel(`Actions for ${current}`));
      await click(list.locator('details[open]').getByRole('button', { name: /^Delete/ }));
    } else await click(list.getByRole('button', { name: `Delete ${current}` }));
    await click(dlg.getByRole('button', { name: 'Delete', exact: true }));
    const ask = dlg.getByText('Also delete its 1 kept version?');
    await ask.waitFor({ timeout: 5000 }).catch(() => {});
    check(width, 'deleting it asks "Also delete its 1 kept version?"', await ask.isVisible());
    check(
      width,
      'with "Keep them" and "Delete versions"',
      (await dlg.getByRole('button', { name: 'Keep them' }).isVisible()) &&
        (await dlg.getByRole('button', { name: 'Delete versions' }).isVisible()),
    );
    await shot('delete-versions');
    await page.keyboard.press('Escape');
    await dlg.waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(400);
    check(
      width,
      'Esc: the project is gone',
      !(await list
        .getByText(current, { exact: true })
        .isVisible()
        .catch(() => false)),
    );
    const kept = await page.evaluate(
      (name) =>
        new Promise((resolve) => {
          const req = indexedDB.open(name);
          req.onsuccess = () => {
            const d = req.result;
            const tx = d.transaction('projectVersions', 'readonly');
            const c = tx.objectStore('projectVersions').count();
            c.onsuccess = () => resolve(c.result);
            c.onerror = () => resolve(-1);
          };
          req.onerror = () => resolve(-1);
        }),
      'furniture-builder',
    );
    check(width, 'Esc kept its version on this device', kept >= 1, `${kept} kept`);
  } catch (e) {
    if (e !== SKIP) check(width, 'delete section ran', false, String(e).slice(0, 200));
    await shot('error-6');
  }

  check(width, 'no sideways scroll', await noSideScroll());
  check(width, 'no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
