// On-demand browser capture (CLAUDE.md toggle `browser-on-demand`, backlog N280). Run only when the user asks.
// Opens the production preview at each width, walks every link in the "Places" navigation and saves, per place:
// a full-page screenshot, and a JSON map of landmarks, headings and interactive elements (role, text, rect, visible,
// tab order). Meant for UI audits and visual checks; it asserts nothing and is not part of `pnpm test`.
//   pnpm build && pnpm preview &  pnpm browser:capture [url] [out dir]
import { launchBrowser, previewUrl, outDir, WIDTHS } from '../lib/harness.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const url = previewUrl();
const out = outDir('docs/research/ui-capture');
mkdirSync(out, { recursive: true });

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'page';

/** Runs in the page: every landmark, heading and interactive element with its box. */
function mapPage() {
  const sel =
    'header,nav,main,aside,footer,dialog,[role="dialog"],h1,h2,h3,button,a[href],input,select,textarea,[role="radio"],[role="tab"],[role="switch"],[tabindex]';
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const focusable = new Set(
    [...document.querySelectorAll('button,a[href],input,select,textarea,[tabindex]')]
      .filter((e) => e.tabIndex >= 0)
      .map((e, i) => [e, i])
      .map(([e, i]) => {
        e.dataset.captureTab = String(i + 1);
        return e;
      }),
  );
  const elements = [...document.querySelectorAll(sel)].map((e) => {
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    const shown =
      r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    return {
      tag: e.tagName.toLowerCase(),
      role: e.getAttribute('role') || '',
      name: (e.getAttribute('aria-label') || e.textContent || '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 60),
      x: Math.round(r.x),
      y: Math.round(r.y),
      w: Math.round(r.width),
      h: Math.round(r.height),
      visible: shown,
      inViewport: shown && r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw,
      position: cs.position,
      tabOrder: focusable.has(e) ? Number(e.dataset.captureTab) : null,
    };
  });
  return {
    viewport: { w: vw, h: vh },
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    horizontalScroll: document.documentElement.scrollWidth > vw + 1,
    elements,
  };
}

const browser = await launchBrowser();
const summary = [];
for (const width of WIDTHS) {
  const phone = width < 500;
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 812 : 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(url, { waitUntil: 'networkidle' });
  const nav = page.getByRole('navigation', { name: 'Places' });
  const places = (await nav.getByRole('link').allInnerTexts())
    .map((t) => t.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
  for (const place of [...new Set(places)]) {
    await nav.getByRole('link', { name: place }).first().click();
    await page.waitForTimeout(400);
    const base = `${out}/${slug(place)}-${width}`;
    await page.screenshot({ path: `${base}.png`, fullPage: true });
    const map = await page.evaluate(mapPage);
    writeFileSync(`${base}.json`, JSON.stringify({ place, ...map }, null, 2));
    summary.push({
      width,
      place,
      elements: map.elements.length,
      horizontalScroll: map.horizontalScroll,
    });
    console.log(
      `${width}px ${place}: ${map.elements.length} elements${map.horizontalScroll ? ' — HORIZONTAL SCROLL' : ''}`,
    );
  }
  if (errors.length) console.log(`${width}px console/page errors:`, errors);
  await ctx.close();
}
writeFileSync(`${out}/summary.json`, JSON.stringify(summary, null, 2));
await browser.close();
