// On-demand browser capture (CLAUDE.md toggle `browser-on-demand`, backlog N295). Run only when the user asks.
// Opens the production preview at each width, walks every link in the "Places" navigation and saves, per place:
// a full-page screenshot, and a JSON map of landmarks, headings and interactive elements (role, text, rect, visible,
// tab order). Per place it also captures the open More menu and the New… dialog. Meant for UI audits and visual
// checks; it asserts nothing and is not part of `pnpm test`.
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
    'header,nav,main,aside,footer,dialog,[role="dialog"],h1,h2,h3,summary,details,button,a[href],input,select,textarea,[role="radio"],[role="tab"],[role="switch"],[tabindex]';
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
    // Content of a closed <details> (a closed menu) is laid out but not shown; only its summary is.
    const closed = e.parentElement?.closest('details:not([open])');
    const hiddenByDetails = closed && !(e.tagName === 'SUMMARY' && e.parentElement === closed);
    const shown =
      r.width > 0 &&
      r.height > 0 &&
      cs.visibility !== 'hidden' &&
      cs.display !== 'none' &&
      !hiddenByDetails;
    return {
      tag: e.tagName.toLowerCase(),
      role: e.getAttribute('role') || '',
      name: (
        e.getAttribute('aria-label') ||
        [...(e.labels || [])].map((l) => l.textContent).join(' ') ||
        e.textContent ||
        ''
      )
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

/** Save the screenshot and the element map of the current screen as `<out>/<name>-<width>`. */
async function capture(page, width, place, state, name) {
  const base = `${out}/${name}-${width}`;
  // Full page only for the default screen; menus and dialogs are fixed overlays, so the viewport shows them whole.
  await page.screenshot({ path: `${base}.png`, fullPage: state === 'default' });
  const map = await page.evaluate(mapPage);
  writeFileSync(`${base}.json`, JSON.stringify({ place, state, ...map }, null, 2));
  summary.push({
    width,
    place,
    state,
    elements: map.elements.length,
    horizontalScroll: map.horizontalScroll,
  });
  console.log(
    `${width}px ${place} [${state}]: ${map.elements.length} elements${map.horizontalScroll ? ' — HORIZONTAL SCROLL' : ''}`,
  );
}

const browser = await launchBrowser();
const summary = [];
for (const width of WIDTHS) {
  const phone = width < 500;
  // A phone gets touch and the mobile flag, as in the find-it scripts, so `pointer: coarse` rules (44 px targets) apply.
  const ctx = await browser.newContext({
    viewport: { width, height: phone ? 812 : 900 },
    hasTouch: phone,
    isMobile: phone,
  });
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
    const name = slug(place);
    await capture(page, width, place, 'default', name);
    // The More menu (a <details> menu), open: its items are listed but never clicked, so no file is downloaded.
    const summaryEl = page.locator('summary[aria-label="More"]').first();
    if (await summaryEl.isVisible().catch(() => false)) {
      await summaryEl.click();
      await page.waitForTimeout(200);
      await capture(page, width, place, 'more-menu', `${name}-more-menu`);
      // The New… dialog, when the menu has it.
      const newBtn = page.getByRole('button', { name: /^New…/ }).first();
      if (await newBtn.isVisible().catch(() => false)) {
        await newBtn.click();
        await page.waitForTimeout(400);
        await capture(page, width, place, 'new-dialog', `${name}-new-dialog`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }
      // Close the menu if Escape did not.
      if (await page.locator('details.more[open]').count()) await summaryEl.click().catch(() => {});
    }
  }
  if (errors.length) console.log(`${width}px console/page errors:`, errors);
  await ctx.close();
}
writeFileSync(`${out}/summary.json`, JSON.stringify(summary, null, 2));
await browser.close();
