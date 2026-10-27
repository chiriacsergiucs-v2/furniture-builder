// Find-it acceptance for the high-severity layout bugs from the 2026-10-27 critique (ADR-113, backlog N111), run
// against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/critique-bugs/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width (390 with touch, 1280 with a mouse) and finds everything by role and
// visible text. Not part of `pnpm test`.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4173/furniture-builder/';
const out = process.argv[3] ?? 'dist-acceptance';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const results = [];
const check = (width, name, ok, detail = '') => {
  results.push({ width, name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${width}px ${name}${detail ? ` — ${detail}` : ''}`);
};

/** Height of each located element, rounded (multi-line text areas are tall anyway and are left out). */
const heights = (loc) =>
  loc.evaluateAll((els) =>
    els
      .filter((e) => e.tagName !== 'TEXTAREA')
      .map((e) => Math.round(e.getBoundingClientRect().height)),
  );
/** Every element inside `el` (and its text) stays inside `el`'s box; returns the worst spill in px. */
const spill = (loc) =>
  loc.evaluate((root) => {
    const r = root.getBoundingClientRect();
    let worst = 0;
    const note = (b) => {
      if (!b.width || !b.height) return;
      worst = Math.max(
        worst,
        b.right - r.right,
        r.left - b.left,
        b.bottom - r.bottom,
        r.top - b.top,
      );
    };
    for (const e of root.querySelectorAll('*')) note(e.getBoundingClientRect());
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) {
      if (!w.currentNode.textContent.trim()) continue;
      const rg = document.createRange();
      rg.selectNodeContents(w.currentNode);
      for (const b of rg.getClientRects()) note(b);
    }
    return Math.round(worst);
  });

for (const width of [390, 1280]) {
  const phone = width < 500;
  const ctx = await browser.newContext({
    viewport: { width, height: phone ? 844 : 900 },
    hasTouch: phone,
    isMobile: phone,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const shot = (name) => page.screenshot({ path: `${out}/critique-bugs-${name}-${width}.png` });
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const dlg = page.locator('dialog[open]');
  const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  check(width, `pointer is ${phone ? 'coarse' : 'fine'}`, coarse === phone);
  /** Under touch every located control is at least 44 px tall; with a mouse only that it is there. */
  const tall = async (name, loc) => {
    const hs = await heights(loc);
    check(
      width,
      phone ? `${name} ≥ 44 px tall under touch` : `${name} found`,
      hs.length > 0 && (!phone || hs.every((h) => h >= 44)),
      hs.join(', ') || 'not found',
    );
  };
  const places = page.getByRole('navigation', { name: 'Places' });

  // 1. Bare app → "Create a new project": the ask-text input.
  await page.goto(url);
  await page.getByRole('heading', { name: 'Projects', level: 1 }).waitFor();
  await page.getByRole('button', { name: 'Create a new project', exact: true }).click();
  const ask = dlg.getByRole('textbox');
  await tall('the project-name input', ask);
  await ask.fill(`Bugs ${width}`);
  await shot('ask-text');
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });

  // 2. Settings › Run parts: nothing spills past its card.
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const runParts = dlg.getByRole('region', { name: 'Run parts' });
  await runParts.waitFor();
  await runParts.getByRole('button', { name: /^Suggest/ }).scrollIntoViewIfNeeded();
  const sp = await spill(runParts);
  check(
    width,
    'Settings › Run parts: no child wider than its card',
    sp <= 0,
    `worst spill ${sp} px`,
  );
  await shot('run-parts');
  await dlg.getByRole('button', { name: 'Close' }).click();

  // 3. New dialog: rows keep their height and never overlap.
  await places.getByRole('link', { name: 'Projects' }).click();
  await page.getByRole('heading', { name: 'Projects', level: 1 }).waitFor();
  await page.getByRole('button', { name: 'New single piece' }).click();
  await dlg.getByRole('button', { name: /New piece, step by step/ }).waitFor();
  const rows = dlg.locator('.dialog-body').getByRole('button');
  const n = await rows.count();
  let worst = 0;
  for (let i = 0; i < n; i++) {
    const b = rows.nth(i);
    if (!(await b.isVisible())) continue;
    worst = Math.max(worst, await spill(b));
  }
  // No two direct children of the dialog body overlap.
  const overlap = await dlg.locator('.dialog-body').evaluate((body) => {
    const kids = [...body.children].map((e) => e.getBoundingClientRect()).filter((r) => r.height);
    let o = 0;
    for (let i = 1; i < kids.length; i++) o = Math.max(o, kids[i - 1].bottom - kids[i].top);
    return Math.round(o);
  });
  check(
    width,
    `New dialog: each of ${n} row buttons contains its text`,
    n > 0 && worst <= 0,
    `worst spill ${worst} px`,
  );
  check(width, 'New dialog: sections do not overlap', overlap <= 0, `overlap ${overlap} px`);
  await shot('new-dialog');

  // 4. The wizard: step buttons and the Name input.
  await dlg.getByRole('button', { name: /New piece, step by step/ }).click();
  await dlg.getByRole('button', { name: 'Next', exact: true }).waitFor();
  const steps = dlg.getByRole('list', { name: 'Wizard steps' }).getByRole('button');
  await tall('the wizard step buttons', steps);
  await dlg.getByRole('button', { name: /Cabinet \(closed box\)/ }).click();
  await dlg.getByRole('button', { name: 'Next', exact: true }).click();
  await tall('the wizard Name input', dlg.getByLabel('Name', { exact: true }));
  await shot('wizard');
  await page.keyboard.press('Escape');
  if (await dlg.count()) await page.keyboard.press('Escape');
  await dlg.waitFor({ state: 'detached' }).catch(() => {});

  // 5. Catalog: the sticky filter row stays below the app bar after scrolling.
  await places.getByRole('link', { name: /Catalog/ }).click();
  await page.getByRole('heading', { name: 'Catalog', level: 1 }).waitFor();
  await page.waitForTimeout(500);
  await page.mouse.wheel(0, 3000);
  await page.waitForTimeout(500);
  // The search row is the sticky part on a phone (ADR-116); "Templates" stays sticky on desktop.
  const tab = phone
    ? page.getByRole('searchbox', { name: 'Search the catalog' })
    : page.getByRole('tab', { name: 'Templates' });
  const vis = await tab.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      top: Math.round(r.top),
      scrolled: Math.round(window.scrollY),
      ok: !!hit && el.contains(hit),
    };
  });
  check(
    width,
    phone
      ? 'Catalog scrolled: the sticky search row is visible below the app bar'
      : 'Catalog scrolled: "Templates" in the filter row is visible below the app bar',
    vis.ok && vis.top >= 0 && (!phone || vis.scrolled > 0),
    `top ${vis.top}, page scrolled ${vis.scrolled}`,
  );
  await shot('catalog-scrolled');

  // 6. Template editor: inputs ≥ 44 px under touch and a named trash button.
  await page.getByRole('button', { name: 'Edit template' }).first().click();
  const editor = page.getByRole('region', { name: /^Edit template / });
  await editor.waitFor();
  await tall('the template-editor inputs', editor.getByRole('textbox'));
  const trash = editor.getByRole('button', { name: 'Remove variant' });
  check(width, 'the trash button is found as "Remove variant"', (await trash.count()) > 0);
  if (phone) {
    const tb = (await trash.count()) ? await trash.first().boundingBox() : null;
    check(
      width,
      '"Remove variant" ≥ 44 × 44 under touch',
      !!tb && tb.width >= 44 && tb.height >= 44,
      tb ? `${Math.round(tb.width)} × ${Math.round(tb.height)}` : 'not found',
    );
  }
  await editor.scrollIntoViewIfNeeded();
  await shot('template-editor');

  // 7. A single piece's Settings head: "Whole cabinet" stays on one line.
  await places.getByRole('link', { name: 'Projects' }).click();
  await page.getByRole('button', { name: 'New single piece' }).click();
  await dlg.locator('.start-group').getByRole('button').first().click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const whole = dlg.getByRole('heading', { name: 'Whole cabinet' });
  await whole.waitFor();
  const wh = await whole.evaluate((e) => {
    const lh = parseFloat(getComputedStyle(e).lineHeight);
    return { h: e.getBoundingClientRect().height, lh };
  });
  check(
    width,
    'Settings head "Whole cabinet" on one line',
    wh.h < wh.lh * 1.5,
    `${Math.round(wh.h)} px for a ${Math.round(wh.lh)} px line`,
  );
  await shot('settings-head');
  await dlg.getByRole('button', { name: 'Close' }).click();

  check(width, 'no sideways scroll', await noSideScroll());
  check(width, 'no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
