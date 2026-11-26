// Find-it acceptance for hover preview, deep select, pin and the empty tap (ADR-269, backlog N287), run against a
// production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/pin-and-deep/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width. What jsdom cannot do (an SVG screen matrix, real pointer events) is checked
// here: the dashed hover outline, Ctrl-click to the innermost space, Shift+Enter up, the pin, the empty tap.
// Not part of `pnpm test`.
import { launchBrowser, previewUrl, outDir } from '../lib/harness.mjs';
import { goCompose } from '../lib/steps.mjs';
import { mkdirSync } from 'node:fs';

const url = previewUrl();
const out = outDir();
mkdirSync(out, { recursive: true });
const browser = await launchBrowser();
let failed = 0;
const check = (width, name, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${width}px ${name}${detail ? ` — ${detail}` : ''}`);
};

for (const width of [1280, 390]) {
  const phone = width < 500;
  const ctx = await browser.newContext({
    viewport: { width, height: phone ? 800 : 900 },
    hasTouch: phone,
    isMobile: phone,
  });
  // The canvas editor is the phone default and shows first-run hints since ADR-290; this script tests the sheet editor,
  // so it turns the canvas off and skips the hints, as the other scripts do (catch-up 2026-11-26).
  await ctx.addInitScript(() => {
    localStorage.setItem('fb:canvasEditor', 'off');
    localStorage.setItem('fb:canvas-coach', 'done');
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ck = (name, ok, detail) => check(width, name, ok, detail);

  // Bare app → New single piece → Sideboard (shelves | drawers | shelves) → Compose.
  await page.goto(url);
  await page.getByRole('button', { name: 'New single piece' }).click();
  await page
    .locator('dialog[open]')
    .getByRole('button', { name: /Sideboard/ })
    .first()
    .click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await goCompose(page);

  const spaces = page.locator('figure.elevation .el-space');
  const centre = async (i) => {
    const b = await spaces.nth(i).boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height * 0.25 };
  };

  if (phone) {
    // Touch has no hover: the outline never shows (ADR-269 item 1).
    const p = await centre(0);
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(200);
    ck('no hover outline on a touch screen', (await page.locator('.el-hover').count()) === 0);
  } else {
    const titleBefore = await page.locator('.inspector h2').first().innerText();
    const p = await centre(0);
    await page.mouse.move(p.x, p.y);
    await page
      .locator('.el-hover')
      .waitFor({ state: 'attached', timeout: 3000 })
      .catch(() => {});
    ck('hover outlines the space', (await page.locator('.el-hover').count()) === 1);
    ck(
      'hover leaves the drawer alone',
      (await page.locator('.inspector h2').first().innerText()) === titleBefore,
    );
    await page.mouse.move(2, 2);
    await page.waitForTimeout(200);
    ck(
      'the outline clears when the pointer leaves',
      (await page.locator('.el-hover').count()) === 0,
    );

    // Ctrl-click jumps to the innermost space in one click.
    await page.keyboard.down('Control');
    await page.mouse.click(p.x, p.y);
    await page.keyboard.up('Control');
    const left = page.getByRole('heading', { name: 'Left: Shelves' });
    ck('Ctrl-click selects the innermost space', await left.isVisible());

    // An empty tap keeps the selection (item 4): the svg corner is outside the piece.
    const svg = await page.locator('figure.elevation svg').first().boundingBox();
    await page.mouse.click(svg.x + 3, svg.y + 3);
    await page.waitForTimeout(200);
    ck('a tap outside the piece keeps the selection', await left.isVisible());

    // Shift+Enter goes up one level.
    await spaces.nth(0).focus();
    await page.keyboard.press('Shift+Enter');
    await page.waitForTimeout(200);
    ck('Shift+Enter selects the parent', !(await left.isVisible().catch(() => false)));

    // Pin: the drawer stays on the pinned space while another is selected.
    await page.keyboard.down('Control');
    await page.mouse.click(p.x, p.y);
    await page.keyboard.up('Control');
    const pin = page.getByRole('button', { name: 'Pin the drawer' });
    await pin.click();
    ck('the pin button is pressed', (await pin.getAttribute('aria-pressed')) === 'true');
    ck(
      'the head reads Pinned: Left: Shelves',
      await page.getByText('Pinned: Left: Shelves').isVisible(),
    );
    const r = await centre(2);
    await page.keyboard.down('Control');
    await page.mouse.click(r.x, r.y);
    await page.keyboard.up('Control');
    await page.waitForTimeout(200);
    ck('the drawer stays on the pinned space', await left.isVisible());
    await pin.click();
    ck('unpinned', (await pin.getAttribute('aria-pressed')) === 'false');
    ck(
      'About selecting is there',
      await page.getByRole('button', { name: 'About selecting' }).isVisible(),
    );
  }
  ck('no page errors', errors.length === 0, errors.join('; ').slice(0, 120));
  await page.screenshot({ path: `${out}/pin-and-deep-${width}.png` });
  await ctx.close();
}
await browser.close();
if (failed) {
  console.log(`${failed} check(s) failed`);
  process.exit(1);
}
console.log('all checks passed');
