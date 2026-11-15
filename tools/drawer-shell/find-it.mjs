// Find-it acceptance for keeping the drawer still (ADR-267, backlog N285), run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/drawer-shell/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text. Checks what jsdom cannot: the drawer
// head keeps its place while the body scrolls, and the selection tint animation is off under reduced motion.
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
  // A short window so the drawer body has something to scroll.
  const height = phone ? 700 : 560;
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const ck = (name, ok, detail) => check(width, `${name} (motion ${reducedMotion})`, ok, detail);

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

    // Tap the left shelf bay until it is selected (outside in, one level per tap, ADR-083).
    // The leaves are listed left to right: the first one is the left shelf bay.
    const left = page.locator('figure.elevation .el-space').first();
    const heading = page.getByRole('heading', { name: 'Left: Shelves' });
    const crumbs = page.getByRole('navigation', { name: 'Where this space sits' });
    const named = () => crumbs.innerText().then((t) => t.includes('Left: Shelves'));
    for (let i = 0; i < 4 && !(await named().catch(() => false)); i++) {
      const b = await left.boundingBox();
      await page.mouse.click(b.x + b.width / 2, b.y + b.height * 0.25);
      await page.waitForTimeout(300);
    }
    // The phone sheet hides the title row (ADR-160): the peek row names the selection there, checked below.
    if (!phone) ck('title reads Left: Shelves', await heading.isVisible());
    ck('path shows Left: Shelves', (await crumbs.innerText()).includes('Left: Shelves'));
    if (phone) {
      const peek = await page.locator('.sheet-peek').innerText();
      ck('peek row names the bay', peek.includes('Left: Shelves'), peek.slice(0, 60));
    }

    // The head keeps its place while the drawer body scrolls.
    const head = page.locator('.insp-sticky');
    const before = await head.boundingBox();
    const scrolled = await head.evaluate((el) => {
      let p = el.parentElement;
      while (p && p.scrollHeight <= p.clientHeight + 1) p = p.parentElement;
      if (!p) return 0;
      p.scrollTop = 200;
      return p.scrollTop;
    });
    await page.waitForTimeout(150);
    const after = await head.boundingBox();
    ck('drawer body scrolled', scrolled > 0, `scrollTop ${scrolled}`);
    ck(
      'drawer head did not move',
      Math.abs(after.y - before.y) < 1.5,
      `top ${Math.round(before.y)} → ${Math.round(after.y)}`,
    );
    await page.screenshot({ path: `${out}/drawer-shell-${width}-${reducedMotion}.png` });

    // The selection tint plays once, and not under reduced motion.
    const animation = await page
      .locator('.insp-sticky .cue-bar')
      .evaluate((el) => getComputedStyle(el).animationName);
    ck(
      reducedMotion === 'reduce' ? 'tint animation off' : 'tint animation defined',
      reducedMotion === 'reduce' ? animation === 'none' : animation === 'drawer-cue',
      animation,
    );
    ck('no page errors', errors.length === 0, errors.join('; ').slice(0, 120));
    await ctx.close();
  }
}
await browser.close();
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exit(failed ? 1 : 0);
