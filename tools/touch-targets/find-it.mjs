// Find-it acceptance for touch targets (backlog N326, audit F-03 and F-21; ADR-114 control rule), run against a
// production build:
//   pnpm build:ci && pnpm preview &  node tools/touch-targets/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at 390 px with touch (isMobile, hasTouch), visits Projects, Catalog, the editor, a project,
// Settings, Material and every wizard step, and lists each visible interactive element under 44 px in height or
// width. A checkbox or radio inside a label (or with a `for` label) counts by its label's box, the target a finger
// hits. Fails when any element is listed, except the documented exceptions in EXEMPT. Also checks 390 px has no
// sideways scroll and that 1280 px (mouse) keeps the 38 px control height. Not part of `pnpm test`.
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

// A documented exception: a selector and why (repo rule or WCAG 2.5.8, 24 px). None yet.
const EXEMPT = ['input[type=file]']; // 1×1 hidden file input: its visible button opens it (button is measured)

const scan = (page, exempt) =>
  page.evaluate((exempt) => {
    const SEL =
      'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=tab], [role=radio], [role=checkbox], [role=switch], [role=menuitem], [role=button]';
    const name = (e) =>
      (e.getAttribute('aria-label') || e.innerText || e.title || e.value || e.name || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 40);
    const tag = (e) =>
      `${e.tagName.toLowerCase()}${e.type && e.tagName === 'INPUT' ? '[' + e.type + ']' : ''}${typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 3).join('.') : ''}`;
    const seen = new Set();
    const bad = [];
    let n = 0;
    for (const e of document.querySelectorAll(SEL)) {
      if (e.closest('svg, [hidden], .sr-only, [inert]')) continue;
      if (exempt.some((s) => e.matches(s))) continue;
      let box = e;
      if (e.matches('input[type=checkbox], input[type=radio]')) {
        const lab = e.closest('label') || (e.id && document.querySelector(`label[for="${e.id}"]`));
        if (lab) box = lab;
      }
      // A text input in a bordered field (.mm, .search) fills the field's inside (44 px minus its 2 px border): the
      // field is the target. Documented exception: the border strip itself is not part of the input.
      let innerShort = false;
      if (e.matches('input') && e.closest('.mm, .search')) {
        box = e.closest('.mm, .search');
        innerShort = e.getBoundingClientRect().height < box.getBoundingClientRect().height - 2.5;
      }
      if (seen.has(box)) continue;
      const r = box.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (!e.checkVisibility({ visibilityProperty: true })) continue;
      // Not scrolled into the page at all (clipped by an ancestor with zero size) is skipped above; others count.
      seen.add(box);
      n++;
      if (r.height < 43.5 || r.width < 43.5 || innerShort)
        bad.push(`${tag(e)} "${name(e)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    return { n, bad, wide: document.documentElement.scrollWidth > window.innerWidth + 1 };
  }, exempt);

{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 812 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  const wait = (ms = 400) => page.waitForTimeout(ms);
  const places = page.getByRole('navigation', { name: 'Places' });
  const dlg = page.locator('dialog[open]');
  const state = async (label, fn) => {
    try {
      await fn();
      await wait();
      const a = await scan(page, EXEMPT);
      check(
        `390 ${label}: every interactive element at least 44 × 44`,
        a.bad.length === 0,
        `${a.n} measured; ${a.bad.length} under${a.bad.length ? ': ' + a.bad.join(' | ') : ''}`,
      );
      check(`390 ${label}: no sideways scroll`, !a.wide);
    } catch (e) {
      check(`390 ${label}: reachable`, false, String(e.message).split('\n')[0]);
    }
  };
  await page.goto(url, { waitUntil: 'networkidle' });
  await state('Projects', async () => {});
  await state('Catalog', async () => {
    await places.getByRole('link', { name: /Catalog/ }).click();
  });
  await state('Editor', async () => {
    await places.getByRole('link', { name: /Editor/ }).click();
  });
  await state('More menu', async () => {
    await page.locator('summary[aria-label="More"]').first().click();
  });
  await state('New dialog', async () => {
    await page.getByRole('button', { name: /^New…/ }).first().click();
  });
  await state('Wizard step 1', async () => {
    await page.getByRole('button', { name: /^New piece, step by step/ }).click();
  });
  for (let step = 2; step <= 12; step++) {
    const first = step === 2;
    if (first) await page.getByRole('radio', { name: /^Cabinet \(closed box\)/ }).click();
    const next = page.getByRole('button', { name: 'Next', exact: true });
    if (!(await next.isVisible().catch(() => false)) || (await next.isDisabled())) break;
    await next.click();
    await state(`Wizard step ${step}`, async () => {});
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.goto(url, { waitUntil: 'networkidle' });
  await state('Project editor', async () => {
    await places.getByRole('link', { name: /Projects/ }).click();
    await page.getByRole('button', { name: 'Create a new project' }).click();
    await dlg.getByRole('textbox').fill('Touch project');
    await dlg.getByRole('button', { name: /^(OK|Create|Save)/ }).click();
    await wait(800);
  });
  await state('Settings', async () => {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
  });
  await page.keyboard.press('Escape').catch(() => {});
  await state('Material', async () => {
    await page.getByRole('button', { name: 'Material', exact: true }).click();
  });
  await ctx.close();
}

{
  // 1280 px with a mouse keeps the 38 px control height (unchanged).
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  const h = await page.evaluate(() =>
    ['--control-h', '--control-h-sm'].map((t) =>
      getComputedStyle(document.documentElement).getPropertyValue(t).trim(),
    ),
  );
  check(
    '1280 mouse: --control-h 38px, --control-h-sm 30px',
    h.join(' ') === '38px 30px',
    h.join(' '),
  );
  await ctx.close();
}
await browser.close();
if (failed) {
  console.log(`${failed} check(s) failed`);
  process.exit(1);
}
