// Find-it for audit F-01 (UI flow audit 2026-11-15), run against a production build:
//   pnpm build:ci && pnpm preview &  node tools/more-menu/find-it.mjs [url] [out dir]
// On a touch phone at 390x812 and 390x667 the More menu scrolls inside its own box: it must show a scroll cue while
// entries lie beyond the edge, and its last entry must be reachable above the bottom navigation. The last entry was Gaps
// until Gaps moved to Information (234f34d, 2026-11-17); the check now takes whatever entry is last (catch-up 2026-11-26).
import { launchBrowser, previewUrl, outDir } from '../lib/harness.mjs';
import { mkdirSync } from 'node:fs';

const url = previewUrl();
const out = outDir();
mkdirSync(out, { recursive: true });
const browser = await launchBrowser();
let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

for (const height of [812, 667]) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  await page.goto(url);
  await page.getByRole('heading', { name: 'Projects', level: 1 }).waitFor({ timeout: 10000 });
  await page.locator('summary[aria-label="More"]').tap();
  const menu = page.locator('details.more .menu-items');
  await menu.waitFor();
  const m = await menu.evaluate((el) => ({
    scrollable: el.scrollHeight > el.clientHeight + 1,
    bg: getComputedStyle(el).backgroundImage,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }));
  const tag = `390x${height}`;
  if (height === 667)
    check(`${tag} menu overflows its box`, m.scrollable, `${m.scrollHeight} > ${m.clientHeight}`);
  if (m.scrollable)
    check(`${tag} scroll cue present`, /radial-gradient/.test(m.bg), m.bg.slice(0, 60));
  await page.screenshot({ path: `${out}/more-menu-${tag}-top.png` });
  const last = menu.getByRole('button').last();
  await menu.evaluate((el) => (el.scrollTop = el.scrollHeight));
  const lastName = (await last.textContent())?.trim();
  const g = await last.boundingBox();
  const nav = await page.getByRole('navigation', { name: 'Places' }).boundingBox();
  check(
    `${tag} last entry (${lastName}) reachable above the bottom nav`,
    !!g && !!nav && g.y + g.height <= nav.y + 1,
    `${g?.y}+${g?.height} vs nav ${nav?.y}`,
  );
  await page.screenshot({ path: `${out}/more-menu-${tag}-end.png` });
  await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
