// Find-it check for G-474: the Settings dialog must not scroll sideways at 375 and 390 px, with a mouse or with touch.
// Cause it guards: at three size fields in a row (no touch) the ƒ-bound fields kept the 32 px stepper column, so the
// Depth field pushed the row wider than the dialog (.dims3 .mm.with-trailing in src/styles.css).
//   pnpm build:ci && pnpm exec vite preview --port 4173 &  node tools/settings-scroll/find-it.mjs [url]
// Not part of `pnpm test`.
import { launchBrowser, previewUrl } from '../lib/harness.mjs';

const url = previewUrl();
const browser = await launchBrowser();
let failed = 0;
for (const touch of [false, true]) {
  for (const width of [375, 390]) {
    const ctx = await browser.newContext({
      viewport: { width, height: 812 },
      ...(touch ? { hasTouch: true, isMobile: true } : {}),
    });
    const page = await ctx.newPage();
    await page.goto(url);
    await page.getByRole('button', { name: 'New single piece' }).click();
    await page
      .locator('dialog[open]')
      .getByRole('button', { name: /Sideboard/ })
      .first()
      .click();
    await page.locator('main.work').waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Settings', exact: true }).first().click();
    await page.waitForTimeout(500);
    // Any element in the dialog that scrolls sideways (inputs scroll their own text, the clipped name has no scrollbar).
    const wide = await page.evaluate(() => {
      const d = document.querySelector('dialog[open]');
      return [d, ...d.querySelectorAll('*')]
        .filter(
          (e) =>
            !['INPUT', 'SPAN'].includes(e.tagName) &&
            e.scrollWidth > e.clientWidth + 1 &&
            getComputedStyle(e).overflowX !== 'visible',
        )
        .map((e) => `${e.tagName}.${e.className} ${e.scrollWidth}/${e.clientWidth}`);
    });
    const ok = wide.length === 0;
    if (!ok) failed++;
    console.log(
      `${ok ? 'PASS' : 'FAIL'} ${width}px ${touch ? 'touch' : 'mouse'} Settings does not scroll sideways${ok ? '' : ` — ${wide.join('; ')}`}`,
    );
    await ctx.close();
  }
}
await browser.close();
process.exit(failed ? 1 : 0);
