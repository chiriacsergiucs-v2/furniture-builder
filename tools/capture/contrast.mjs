// On-demand text-contrast check (G-509, N314; CLAUDE.md toggle `browser-on-demand`): at each width and theme, on the places,
// the More menu, the New dialog, Settings, Material and the first wizard step, the contrast of every visible text element
// (its colour against the first opaque background above it) against WCAG 2.2 AA (4.5:1, 3:1 for large text). Disabled
// controls are skipped (exempt, 1.4.3). A background image or gradient is not read, so those texts are listed as unread.
//   pnpm build:ci && pnpm preview &  node tools/capture/contrast.mjs [url] [out dir]
import { launchBrowser, previewUrl, outDir, WIDTHS } from '../lib/harness.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const url = previewUrl();
const out = outDir('docs/research/ui-capture');
mkdirSync(out, { recursive: true });

/** Runs in the page: contrast of every visible text element. */
function measure() {
  const parse = (c) => {
    const m = /rgba?\(([^)]+)\)/.exec(c);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1]
      .split(/[ ,/]+/)
      .filter(Boolean)
      .map(Number);
    return { r, g, b, a };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const over = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  });
  const backdrop = (el) => {
    let layers = [];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage !== 'none') return { unread: true };
      const bg = parse(cs.backgroundColor);
      if (bg && bg.a > 0) {
        layers.push(bg);
        if (bg.a === 1) break;
      }
    }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (const l of layers.reverse()) base = over(l, base);
    return base;
  };
  const results = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || seen.has(el) || !n.textContent.trim()) continue;
    seen.add(el);
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width < 2 || r.height < 2 || cs.visibility === 'hidden' || cs.display === 'none')
      continue;
    if (
      el.closest('details:not([open]) > :not(summary)') ||
      el.closest('[disabled],[aria-disabled="true"]')
    )
      continue;
    if (el.closest('script,style,svg') || Number(cs.opacity) === 0) continue;
    const fg = parse(cs.color);
    const bg = backdrop(el);
    if (!fg || bg.unread) {
      results.push({ text: n.textContent.trim().slice(0, 40), unread: true });
      continue;
    }
    const f = over(fg, bg);
    const L1 = lum(f),
      L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const px = parseFloat(cs.fontSize);
    const large = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
    results.push({
      text: n.textContent.trim().slice(0, 40),
      ratio: Math.round(ratio * 100) / 100,
      need: large ? 3 : 4.5,
      px,
    });
  }
  return results;
}

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
