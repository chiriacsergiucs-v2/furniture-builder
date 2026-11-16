// On-demand browser capture (CLAUDE.md toggle `browser-on-demand`, backlog N295). Run only when the user asks.
// Opens the production preview at each width, walks every link in the "Places" navigation and saves, per place:
// a full-page screenshot, and a JSON map of landmarks, headings and interactive elements (role, text, rect, visible,
// tab order). Per place it also captures the open More menu and the New… dialog. Meant for UI audits and visual
// checks; it asserts nothing and is not part of `pnpm test`.
//   pnpm build && pnpm preview &  pnpm browser:capture [url] [out dir]
import { launchBrowser, previewUrl, outDir, WIDTHS } from '../lib/harness.mjs';
import { mapPage } from '../lib/pagemap.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const url = previewUrl();
const out = outDir('docs/research/ui-capture');
mkdirSync(out, { recursive: true });

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'page';

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
    elements: map.totalElements,
    horizontalScroll: map.horizontalScroll,
  });
  console.log(
    `${width}px ${place} [${state}]: ${map.totalElements} elements${map.horizontalScroll ? ' — HORIZONTAL SCROLL' : ''}`,
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
