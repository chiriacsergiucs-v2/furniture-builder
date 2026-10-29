// Find-it acceptance for fitted and straightened wall pictures (CLAUDE.md R3, backlog N147, ADR-146), run against a
// production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/wall-picture-fit/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text: a new project gets a room and a
// picture on Wall 1 ("Covers: From left 0 · From floor 0 · W 3000 × H 2500 mm"); "Straighten photo" › drag a handle ›
// "Apply" changes the picture in the front view and in 3D, "Reset" restores it; 3D › "Adjust wall picture" › tap
// Wall 1 › dragging the wall changes "From left", a handle changes "W … × H …", Undo restores it, "Fill wall" fills the
// wall again; the front view follows; with Adjust off the 3D view behaves as before. Not part of `pnpm test`.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4173/furniture-builder/';
const out = process.argv[3] ?? 'dist-acceptance';
/** Snapping range on the wall (SNAP_RANGE, ADR-070): a shift must go past it to show. */
const SNAP = 60;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const results = [];
const check = (width, name, ok, detail = '') => {
  results.push({ width, name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${width}px ${name}${detail ? ` — ${detail}` : ''}`);
};
// Share of pixels that differ between two PNGs of the same size, counted in the page.
const differ = (page, a, b) =>
  page.evaluate(
    async ({ a, b }) => {
      const load = async (d) => {
        const img = new Image();
        img.src = `data:image/png;base64,${d}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const x = c.getContext('2d');
        x.drawImage(img, 0, 0);
        return x.getImageData(0, 0, c.width, c.height).data;
      };
      const [p, q] = [await load(a), await load(b)];
      if (p.length !== q.length) return 1;
      let n = 0;
      for (let i = 0; i < p.length; i += 4)
        if (
          Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]) + Math.abs(p[i + 2] - q[i + 2]) >
          30
        )
          n++;
      return n / (p.length / 4);
    },
    { a: a.toString('base64'), b: b.toString('base64') },
  );

for (const width of [1280, 390]) {
  const phone = width < 500;
  const ctx = await browser.newContext({
    viewport: { width, height: phone ? 844 : 900 },
    hasTouch: phone,
    isMobile: phone,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const btn = (name) => page.getByRole('button', { name, exact: true });
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
  const view = async (name) => {
    // On a phone the 3D view is under Build & Preview and the room editor under Compose.
    const mode = page.getByRole('radio', { name: name === '3D' ? /Build & Preview/ : /Compose/ });
    if (await mode.isVisible().catch(() => false)) await mode.click();
    await page.getByRole('radio', { name, exact: true }).click();
    await page.waitForTimeout(name === '3D' ? 2500 : 500);
  };
  const frontImage = () =>
    page
      .getByRole('figure', { name: /Room seen from the front/ })
      .locator('image.wall-picture')
      .first();

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

  // A photo of the wall taken at an angle: a blue tiled wall, its corners at (15 %, 90 %), (87.5 %, 78 %),
  // (82.5 %, 15 %), (20 %, 7 %) of the photo, on a beige background.
  const photo = Buffer.from(
    (
      await page.evaluate(() => {
        const c = document.createElement('canvas');
        c.width = 800;
        c.height = 600;
        const x = c.getContext('2d');
        x.fillStyle = '#cdc8be';
        x.fillRect(0, 0, 800, 600);
        x.fillStyle = '#4682a0';
        x.beginPath();
        [
          [120, 540],
          [700, 470],
          [660, 90],
          [160, 40],
        ].forEach(([a, b], k) => (k ? x.lineTo(a, b) : x.moveTo(a, b)));
        x.fill();
        return c.toDataURL('image/png');
      })
    ).split(',')[1],
    'base64',
  );
  const bg1 = page.getByLabel('Wall 1 background', { exact: true });
  await bg1.scrollIntoViewIfNeeded();
  await bg1.selectOption({ label: 'Picture' });
  await page
    .getByLabel('Add a picture for Wall 1')
    .setInputFiles({ name: 'wall.png', mimeType: 'image/png', buffer: photo });
  await page
    .getByRole('img', { name: 'Picture on Wall 1' })
    .waitFor({ timeout: 8000 })
    .catch(() => {});
  const covers = page.getByText(/^Covers:/).first();
  check(
    width,
    'a new picture covers the whole wall: "Covers: From left 0 · From floor 0 · W 3000 × H 2500 mm"',
    /From left 0 · From floor 0 · W 3000 × H 2500 mm/.test((await covers.textContent()) ?? ''),
    await covers.textContent(),
  );
  check(width, 'no horizontal page scroll with the room editor open', await noSideScroll());

  // Front view before straightening.
  await sheet(false);
  const raw = await frontImage()
    .getAttribute('href')
    .catch(() => null);
  check(width, 'the front view draws the picture on the back wall', !!raw);
  await view('3D');
  const canvas = page.locator('canvas').first();
  await click(btn('Solid walls'));
  await page.waitForTimeout(1200);
  const shot0 = await canvas.screenshot({ path: `${out}/wall-picture-3d-before-${width}.png` });

  // Straighten photo › drag the top-left handle onto the wall's corner › Apply.
  await view('2D');
  await sheet(true);
  await click(page.getByRole('button', { name: 'Straighten photo on Wall 1' }));
  check(
    width,
    '"Straighten photo" opens "Straighten the photo on Wall 1"',
    await dlg.getByText('Straighten the photo on Wall 1').isVisible(),
  );
  const box = await dlg.locator('.straighten-photo').boundingBox();
  const targets = {
    'Bottom-left': [120, 540],
    'Bottom-right': [700, 470],
    'Top-right': [660, 90],
    'Top-left': [160, 40],
  };
  for (const [name, [tx, ty]] of Object.entries(targets)) {
    const h = dlg.getByRole('button', { name: `${name} corner of the wall` });
    const b = await h.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + (tx / 800) * box.width, box.y + (ty / 600) * box.height, {
      steps: 5,
    });
    await page.mouse.up();
  }
  await page.screenshot({ path: `${out}/wall-picture-straighten-${width}.png` });
  await click(dlg.getByRole('button', { name: 'Apply' }));
  await page.waitForTimeout(1500);
  check(
    width,
    'after Apply the editor says "straightened"',
    /straightened/.test((await covers.textContent()) ?? ''),
  );
  await sheet(false);
  const straight = await frontImage()
    .getAttribute('href')
    .catch(() => null);
  check(width, 'Apply changes the picture in the front view', !!straight && straight !== raw);
  await page
    .getByRole('figure', { name: /Room seen from the front/ })
    .screenshot({ path: `${out}/wall-picture-front-${width}.png` });
  await view('3D');
  await page.waitForTimeout(1200);
  const shot1 = await canvas.screenshot({ path: `${out}/wall-picture-3d-straight-${width}.png` });
  const d01 = await differ(page, shot0, shot1);
  check(
    width,
    'Apply changes the picture on the wall in 3D',
    d01 > 0.02,
    `${(d01 * 100).toFixed(1)}% of pixels`,
  );

  // Reset restores it.
  await view('2D');
  await sheet(true);
  await click(page.getByRole('button', { name: 'Straighten photo on Wall 1' }));
  await click(dlg.getByRole('button', { name: 'Reset' }));
  await page.waitForTimeout(800);
  await sheet(false);
  check(
    width,
    'Reset restores the picture in the front view',
    (await frontImage()
      .getAttribute('href')
      .catch(() => null)) === raw,
  );
  await view('3D');
  await page.waitForTimeout(1200);
  const shot2 = await canvas.screenshot({ path: `${out}/wall-picture-3d-reset-${width}.png` });
  const d02 = await differ(page, shot0, shot2);
  check(
    width,
    'Reset restores the picture on the wall in 3D',
    d02 < 0.01,
    `${(d02 * 100).toFixed(2)}% differ`,
  );

  // Adjust wall picture.
  const adjust = btn('Adjust wall picture');
  check(
    width,
    '"Adjust wall picture" is in the 3D toolbar, off at first',
    (await adjust.getAttribute('aria-pressed')) === 'false',
  );
  await click(adjust);
  const note = page.locator('.three-drag-note').first();
  check(
    width,
    'Adjust on: "Tap a wall with a picture to adjust it"',
    /Tap a wall with a picture/.test((await note.textContent()) ?? ''),
  );
  const cb = await canvas.boundingBox();
  const tx = cb.x + cb.width / 2,
    ty = cb.y + cb.height * 0.25;
  if (phone) await page.touchscreen.tap(tx, ty);
  else await page.mouse.click(tx, ty);
  await page.waitForTimeout(600);
  const text = async () => (await note.textContent()) ?? '';
  const t0 = await text();
  check(
    width,
    'tapping Wall 1 shows "Wall 1 picture: From left 0 · From floor 0 · W 3000 × H 2500 mm"',
    /Wall 1 picture: From left 0 · From floor 0 · W 3000 × H 2500 mm/.test(t0),
    t0,
  );
  await page.mouse.move(tx, ty);
  await page.mouse.down();
  await page.mouse.move(tx - 90, ty + 20, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(600);
  const t1 = await text();
  const left = (s) => Number(/From left (-?\d+)/.exec(s)?.[1]);
  check(
    width,
    'dragging the wall changes "From left"',
    left(t1) < -SNAP && /W 3000 × H 2500/.test(t1),
    t1,
  );
  // Zoom out so the handles are in view, then drag one.
  // (A wheel event on the canvas: phones pinch, which a mobile viewport here cannot.)
  for (let k = 0; k < 6; k++)
    await canvas.evaluate((c) =>
      c.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY: 400,
          clientX: c.clientWidth / 2,
          clientY: c.clientHeight / 2,
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
  await page.waitForTimeout(800);
  await canvas.screenshot({ path: `${out}/wall-picture-3d-zoomed-${width}.png` });
  let stretched = '';
  for (const name of [
    'top-right corner',
    'right edge',
    'bottom-right corner',
    'top edge',
    'top-left corner',
    'left edge',
    'bottom edge',
    'bottom-left corner',
  ]) {
    const h = page.getByRole('button', { name: `Stretch the picture: ${name}` });
    const b = await h.boundingBox().catch(() => null);
    if (
      !b ||
      b.x < cb.x + 30 ||
      b.y < cb.y + 140 ||
      b.x > cb.x + cb.width - 60 ||
      b.y > cb.y + cb.height - 90
    )
      continue;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x - 40, b.y + 40, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(600);
    stretched = `${name}: ${await text()}`;
    break;
  }
  const t2 = await text();
  check(
    width,
    'a handle changes "W … × H …"',
    !!stretched && !/W 3000 × H 2500/.test(t2),
    stretched || 'no handle in view',
  );
  await canvas.screenshot({ path: `${out}/wall-picture-3d-adjust-${width}.png` });
  await click(page.getByRole('button', { name: 'Undo' }));
  await page.waitForTimeout(600);
  check(
    width,
    'one Undo restores the size before the stretch',
    (await text()) === t1,
    await text(),
  );
  // The front view follows the fitted picture.
  await click(
    page
      .getByRole('toolbar', { name: 'Place pieces in 3D' })
      .getByRole('button', { name: 'Fill wall' }),
  );
  await page.waitForTimeout(600);
  check(
    width,
    '"Fill wall" shows "From left 0 · From floor 0 · W 3000 × H 2500 mm"',
    /From left 0 · From floor 0 · W 3000 × H 2500 mm/.test(await text()),
    await text(),
  );
  await click(page.getByRole('button', { name: 'Undo' }));
  await page.waitForTimeout(400);
  await view('2D');
  const fx = Number(
    await frontImage()
      .getAttribute('x')
      .catch(() => NaN),
  );
  check(
    width,
    'the front view shows the shifted picture',
    fx === left(t1),
    `x ${fx}, From left ${left(t1)}`,
  );
  await view('3D');
  await click(btn('Adjust wall picture'));
  check(
    width,
    'Adjust off: no picture label or handles',
    (await page.locator('.three-drag-note').count()) === 0 &&
      (await page.getByRole('button', { name: /Stretch the picture/ }).count()) === 0,
  );
  await click(btn('Move'));
  check(
    width,
    'Adjust off: Move still turns on as before',
    (await btn('Move').getAttribute('aria-pressed')) === 'true',
  );
  check(width, 'no horizontal page scroll in 3D', await noSideScroll());
  check(width, 'no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
