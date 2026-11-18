// On-demand text-contrast check (G-509, N314; CLAUDE.md toggle `browser-on-demand`): at each width and theme, on the places,
// the More menu, the New dialog, Settings, Material and the first wizard step, the contrast of every visible text element
// (its colour against the first opaque background above it) against WCAG 2.2 AA (4.5:1, 3:1 for large text). Disabled
// controls are skipped (exempt, 1.4.3). A background image or gradient is not read, so those texts are listed as unread.
//   pnpm build:ci && pnpm preview &  node tools/capture/contrast.mjs [url] [out dir]
import { launchBrowser, previewUrl, outDir, WIDTHS } from '../lib/harness.mjs';
import { measure } from '../lib/contrast-measure.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const url = previewUrl();
const out = outDir('docs/research/ui-capture');
mkdirSync(out, { recursive: true });

const rows = [];
const browser = await launchBrowser();
for (const scheme of ['light', 'dark']) {
  for (const width of WIDTHS) {
    const phone = width < 500;
    const ctx = await browser.newContext({
      viewport: { width, height: phone ? 812 : 900 },
      hasTouch: phone,
      isMobile: phone,
      colorScheme: scheme,
    });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    const places = page.getByRole('navigation', { name: 'Places' });
    const wait = (ms = 400) => page.waitForTimeout(ms);
    const record = async (name) => {
      const res = await page.evaluate(measure);
      const read = res.filter((x) => !x.unread);
      const bad = read.filter((x) => x.ratio < x.need);
      rows.push({
        scheme,
        width,
        state: name,
        texts: read.length,
        unread: res.length - read.length,
        fail: bad.length,
        worst: bad.sort((a, b) => a.ratio - b.ratio).slice(0, 6),
      });
      console.log(
        `${width}px ${scheme} ${name}: ${read.length} texts, ${bad.length} below AA, ${res.length - read.length} unread`,
      );
    };
    const step = async (name, fn) => {
      try {
        await fn();
        await record(name);
      } catch (e) {
        console.log(`${width}px ${scheme} ${name}: SKIPPED — ${String(e.message).split('\n')[0]}`);
      }
    };
    await step('projects', async () => {});
    await step('catalog', async () => {
      await places.getByRole('link', { name: /Catalog/ }).click();
      await wait(500);
    });
    await step('editor', async () => {
      await places.getByRole('link', { name: /Editor/ }).click();
      await wait(500);
    });
    await step('more-menu', async () => {
      await page.locator('summary[aria-label="More"]').first().click();
      await wait(200);
    });
    await step('new-dialog', async () => {
      await page.getByRole('button', { name: /^New…/ }).first().click();
      await wait(500);
    });
    await step('wizard-type', async () => {
      await page.getByRole('button', { name: /^New piece, step by step/ }).click();
      await wait(600);
    });
    await page.keyboard.press('Escape').catch(() => {});
    await step('settings', async () => {
      await page.goto(url, { waitUntil: 'networkidle' });
      await places.getByRole('link', { name: /Projects/ }).click();
      await page.getByRole('button', { name: 'Create a new project' }).click();
      const dlg = page.getByRole('dialog');
      await dlg.getByRole('textbox').fill('Audit project');
      await dlg.getByRole('button', { name: /^(OK|Create|Save)/ }).click();
      await wait(800);
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      await wait();
    });
    await page.keyboard.press('Escape').catch(() => {});
    await step('material', async () => {
      await page.getByRole('button', { name: 'Material', exact: true }).click();
      await wait();
    });
    await ctx.close();
  }
}
writeFileSync(`${out}/contrast.json`, JSON.stringify(rows, null, 2));
await browser.close();
