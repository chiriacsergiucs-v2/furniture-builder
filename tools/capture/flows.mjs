// On-demand capture of the flows the place-by-place capture does not reach (G-509, N314): a project, the wizard steps,
// Settings, Material and the dark theme. Same rules as `capture.mjs` (CLAUDE.md toggle `browser-on-demand`): run only when
// the user asks; it asserts nothing. Each state that cannot be reached is logged and skipped, never fatal.
//   pnpm build:ci && pnpm preview &  pnpm browser:capture-flows [url] [out dir]
import { launchBrowser, previewUrl, outDir, WIDTHS } from '../lib/harness.mjs';
import { mapPage } from '../lib/pagemap.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const url = previewUrl();
const out = outDir('docs/research/ui-capture/flows');
mkdirSync(out, { recursive: true });
const summary = [];

async function shot(page, width, scheme, name) {
  const base = `${out}/${name}-${width}-${scheme}`;
  await page.screenshot({ path: `${base}.png` });
  const map = await page.evaluate(mapPage);
  writeFileSync(`${base}.json`, JSON.stringify({ name, scheme, ...map }, null, 2));
  summary.push({
    width,
    scheme,
    name,
    elements: map.totalElements,
    horizontalScroll: map.horizontalScroll,
  });
  console.log(
    `${width}px ${scheme} ${name}: ${map.totalElements} elements${map.horizontalScroll ? ' — HORIZONTAL SCROLL' : ''}`,
  );
}
/** Run one state; a state that cannot be reached is logged and skipped. */
async function state(width, scheme, name, fn) {
  try {
    await fn();
  } catch (e) {
    console.log(`${width}px ${scheme} ${name}: SKIPPED — ${String(e.message).split('\n')[0]}`);
  }
}

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
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(url, { waitUntil: 'networkidle' });
    const places = page.getByRole('navigation', { name: 'Places' });
    const wait = (ms = 400) => page.waitForTimeout(ms);

    // A project: Projects → Create a new project → a name → the Editor.
    await state(width, scheme, 'project', async () => {
      await places.getByRole('link', { name: /Projects/ }).click();
      await page.getByRole('button', { name: 'Create a new project' }).click();
      const dlg = page.getByRole('dialog');
      await dlg.getByRole('textbox').fill('Audit project');
      await dlg.getByRole('button', { name: /^(OK|Create|Save)/ }).click();
      await wait(800);
      await shot(page, width, scheme, 'project-editor');
    });

    // Settings and Material from the header.
    await state(width, scheme, 'settings', async () => {
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      await wait();
      await shot(page, width, scheme, 'settings');
      await page.keyboard.press('Escape');
      await wait(200);
    });
    await state(width, scheme, 'material', async () => {
      await page.getByRole('button', { name: 'Material', exact: true }).click();
      await wait();
      await shot(page, width, scheme, 'material');
      await page.keyboard.press('Escape');
      await wait(200);
    });

    // The wizard, step by step, on its defaults, up to Review.
    await state(width, scheme, 'wizard', async () => {
      await page.locator('summary[aria-label="More"]').first().click();
      await page.getByRole('button', { name: /^New…/ }).first().click();
      await page.getByRole('button', { name: /^New piece, step by step/ }).click();
      await wait(600);
      for (let step = 1; step <= 12; step++) {
        await shot(page, width, scheme, `wizard-step-${String(step).padStart(2, '0')}`);
        // Next stays disabled on the Type step until a type is chosen: take the first one (Cabinet).
        if (step === 1) await page.getByRole('radio', { name: /^Cabinet \(closed box\)/ }).click();
        const next = page.getByRole('button', { name: 'Next', exact: true });
        if (!(await next.isVisible().catch(() => false)) || (await next.isDisabled())) break;
        await next.click();
        await wait(400);
      }
    });
    if (errors.length) console.log(`${width}px ${scheme} page errors:`, errors);
    await ctx.close();
  }
}
writeFileSync(`${out}/summary.json`, JSON.stringify(summary, null, 2));
await browser.close();
