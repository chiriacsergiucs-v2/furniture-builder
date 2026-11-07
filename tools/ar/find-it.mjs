// Find-it acceptance for AR grounding, corner placement and fine-tune (CLAUDE.md R3; ADR-213, ADR-214, ADR-215;
// N218 to N220), run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/ar/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at 1280 and 390 px and finds everything by role and visible text: a piece, the 3D view,
// ⋯ › "View in AR", the hints while looking for the floor, a wall hit that shows nothing, "Point: Centre" cycling,
// "Room corner" with its two hints and "Cancel corner", two floor taps that place it, the fine-tune buttons and step
// switch, "Place again" and "Exit AR". WebXR is a stand-in session: frames come from a timer, the hit-test result is
// whatever the script sets, taps are `select` events. Not part of `pnpm test`. Not checked here: a real phone (G-482).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4173/furniture-builder/';
const out = process.argv[3] ?? 'dist-acceptance';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const results = [];
const check = (width, name, ok, detail = '') => {
  results.push({ width, name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${width}px ${name}${detail ? ` — ${detail}` : ''}`);
};

/** A WebXR stand-in good enough for three's WebXRManager: a session, a base layer, frames on a timer. */
function xrStub() {
  window.__xr = [];
  window.__hit = null;
  const listeners = {};
  const session = {
    enabledFeatures: ['hit-test', 'dom-overlay', 'anchors'],
    inputSources: [],
    renderState: {},
    addEventListener: (t, f) => (listeners[t] ??= new Set()).add(f),
    removeEventListener: (t, f) => listeners[t]?.delete(f),
    fire: (t) => listeners[t]?.forEach((f) => f({ type: t, inputSource: {} })),
    updateRenderState: (s) => Object.assign(session.renderState, s),
    requestReferenceSpace: async () => ({}),
    requestHitTestSource: async () => ({ cancel() {} }),
    requestAnimationFrame: (cb) =>
      setTimeout(
        () =>
          cb(performance.now(), {
            getViewerPose: () => null,
            getHitTestResults: () =>
              window.__hit
                ? [
                    {
                      getPose: () => ({ transform: { matrix: new Float32Array(window.__hit) } }),
                      createAnchor: async () => {
                        window.__anchors = (window.__anchors ?? 0) + 1;
                        return { anchorSpace: {}, delete() {} };
                      },
                    },
                  ]
                : [],
            trackedAnchors: new Set(),
            getPose: () => null,
          }),
        30,
      ),
    cancelAnimationFrame: (id) => clearTimeout(id),
    end: async () => session.fire('end'),
  };
  window.__xrSession = session;
  Object.defineProperty(navigator, 'xr', {
    configurable: true,
    value: {
      isSessionSupported: async (mode) => mode === 'immersive-ar',
      requestSession: async (mode, init) => {
        window.__xr.push({
          mode,
          requiredFeatures: init?.requiredFeatures,
          optionalFeatures: init?.optionalFeatures,
        });
        return session;
      },
    },
  });
  // No layers API: three takes the XRWebGLLayer path.
  delete window.XRWebGLBinding;
  window.XRWebGLLayer = class {
    constructor(_s, gl, init) {
      window.__layerInit = init;
      this.framebufferWidth = gl.drawingBufferWidth;
      this.framebufferHeight = gl.drawingBufferHeight;
      this.framebuffer = null;
      this.ignoreDepthValues = true;
    }
    getViewport() {
      return { x: 0, y: 0, width: this.framebufferWidth, height: this.framebufferHeight };
    }
    static getNativeFramebufferScaleFactor() {
      return 1.5;
    }
  };
  for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext])
    if (C) C.prototype.makeXRCompatible = async () => {};
}

/** Column-major 4×4: a floor (up = +y) or a wall (up turned to +z) at (x, y, z). */
const floorAt = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
const wallAt = (x, y, z) => [1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, x, y, z, 1];

for (const width of [1280, 390]) {
  const phone = width < 500;
  const ctx = await browser.newContext({
    viewport: { width, height: phone ? 844 : 900 },
    serviceWorkers: 'block',
  });
  await ctx.addInitScript(xrStub);
  const page = await ctx.newPage();
  const errors = [];
  const remote = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (!['localhost', '127.0.0.1'].includes(u.hostname) && /^https?:$/.test(u.protocol))
      remote.push(r.url());
  });
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const dlg = page.locator('dialog[open]');
  const hint = page.locator('.ar-overlay .ar-hint');
  const btn = (name) => page.locator('.ar-overlay').getByRole('button', { name, exact: true });
  const hintIs = async (text) => {
    await hint
      .filter({ hasText: text })
      .waitFor({ timeout: 5000 })
      .catch(() => {});
    return (await hint.innerText()).trim() === text;
  };
  const setHit = (m) => page.evaluate((m) => (window.__hit = m), m);
  const tap = () => page.evaluate(() => window.__xrSession.fire('select'));

  // 1. Bare app → a piece → 3D view → ⋯ › View in AR.
  await page.goto(url);
  await page.getByRole('button', { name: 'New single piece' }).click();
  await dlg.locator('.start-group .row-btn').first().click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  // A phone shows 3D in Build & Preview (ADR-079) once the editor sheet is folded down.
  const peek = page.locator('.sheet-peek');
  if (phone && (await peek.isVisible().catch(() => false)))
    if ((await peek.getAttribute('aria-expanded')) === 'true') await peek.click();
  const build = page.getByRole('radio', { name: /Build & Preview/ });
  if (await build.isVisible().catch(() => false)) await build.click();
  const r3d = page.getByRole('radio', { name: '3D', exact: true });
  if (await r3d.isVisible().catch(() => false)) await r3d.click();
  await page.locator('.view.three canvas').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.locator('details.three-more > summary').click();
  await page
    .getByRole('group', { name: 'More 3D actions' })
    .getByRole('button', { name: 'View in AR' })
    .click();
  const xr = await page.evaluate(() => window.__xr);
  check(
    width,
    'View in AR asks for anchors (optional, ADR-213)',
    xr.length === 1 && xr[0].optionalFeatures?.includes('anchors'),
    JSON.stringify(xr),
  );
  check(
    width,
    'the XR framebuffer uses the native scale (ADR-213)',
    (await page.evaluate(() => window.__layerInit?.framebufferScaleFactor)) === 1.5,
  );
  check(
    width,
    'hint "Looking for the floor — move the phone slowly."',
    await hintIs('Looking for the floor — move the phone slowly.'),
  );
  for (const name of ['Point: Centre', 'Room corner', 'Exit AR'])
    check(width, `"${name}" visible while placing`, await btn(name).isVisible());

  // 2. A wall hit shows nothing; a steady floor shows "Tap to place it on the outline."
  await setHit(wallAt(0, 0.6, -1.5));
  await page.waitForTimeout(600);
  check(
    width,
    'a wall hit keeps "Looking for the floor"',
    await hintIs('Looking for the floor — move the phone slowly.'),
  );
  await setHit(floorAt(0, -1.3, -1.5));
  check(
    width,
    'a steady floor: hint "Tap to place it on the outline."',
    await hintIs('Tap to place it on the outline.'),
  );

  // 3. Point switch.
  await btn('Point: Centre').click();
  check(width, 'Point switch → "Point: Back-left"', await btn('Point: Back-left').isVisible());
  await btn('Point: Back-left').click();
  check(width, 'Point switch → "Point: Back-right"', await btn('Point: Back-right').isVisible());
  await btn('Point: Back-right').click();
  check(width, 'Point switch → back to "Point: Centre"', await btn('Point: Centre').isVisible());

  // 4. Room corner: hint, Cancel corner, then two taps.
  await btn('Room corner').click();
  check(
    width,
    'Room corner: hint "Tap the floor in the room corner."',
    await hintIs('Tap the floor in the room corner.'),
  );
  check(width, '"Cancel corner" visible', await btn('Cancel corner').isVisible());
  await btn('Cancel corner').click();
  check(
    width,
    'Cancel corner: back to "Tap to place it on the outline."',
    await hintIs('Tap to place it on the outline.'),
  );
  await btn('Room corner').click();
  await hintIs('Tap the floor in the room corner.');
  await tap();
  check(
    width,
    'first tap: hint "Tap the floor along the wall the back goes against."',
    await hintIs('Tap the floor along the wall the back goes against.'),
  );
  await setHit(floorAt(1, -1.3, -1.5));
  await page.waitForTimeout(600);
  await tap();
  const placed = 'Placed at full size. Fine-tune with the arrows, or Place again.';
  check(width, `second tap places it: hint "${placed}"`, await hintIs(placed));
  check(
    width,
    'an anchor was made for the placement',
    (await page.evaluate(() => window.__anchors ?? 0)) >= 1,
  );

  // 5. Fine-tune.
  for (const name of [
    '← Left',
    '→ Right',
    '↑ Back',
    '↓ Forward',
    'Turn left by the step',
    'Turn right by the step',
    'Step: 1 cm / 1°',
    'Turn 90° ↻',
    'Place again',
    'Exit AR',
  ])
    check(width, `"${name}" visible once placed`, await btn(name).isVisible());
  await btn('→ Right').click();
  await btn('Turn right by the step').click();
  await btn('Step: 1 cm / 1°').click();
  check(width, 'step switch → "Step: 10 cm / 15°"', await btn('Step: 10 cm / 15°').isVisible());
  await btn('← Left').click();
  check(width, 'no horizontal page scroll in AR', await noSideScroll());
  await page.screenshot({ path: `${out}/ar-placed-${width}.png` });

  // 6. Place again, tap, Exit AR.
  await btn('Place again').click();
  check(
    width,
    'Place again: hint "Tap to place it on the outline."',
    await hintIs('Tap to place it on the outline.'),
  );
  await tap();
  check(width, 'a tap places it again', await hintIs(placed));
  await btn('Exit AR').click();
  await page
    .locator('.ar-overlay')
    .waitFor({ state: 'hidden', timeout: 5000 })
    .catch(() => {});
  check(width, 'Exit AR hides the overlay', !(await page.locator('.ar-overlay').isVisible()));
  check(width, 'no request leaves the device', remote.length === 0, remote.slice(0, 3).join(' '));
  check(width, 'no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
