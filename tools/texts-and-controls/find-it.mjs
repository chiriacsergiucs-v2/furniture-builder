// Find-it acceptance for ADR-202 (phone layout, true texts, segmented controls), run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/texts-and-controls/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text. Not part of `pnpm test`.
// - The Materials row (Settings › Boards, sheets and saw cut): no overlapping field, nothing past the row, no sideways
//   scroll, at 375, 390 and 1280 px (G-003).
// - Catalog: the By-room hint and the Brands empty text (G-362, G-096 as settled by ADR-210).
// - Wizard Doors: a five-option segmented control, every label whole; two rows at 390 px, one at 1280 px (G-357);
//   Review reads "Compartment widths: 0 mm" (G-360).
// - Arrow keys on Editor mode (G-361).
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

/** Overlaps between sibling fields of each Materials row, and fields running past their row. */
const materialsLayout = (page) =>
  page.evaluate(() => {
    const problems = [];
    const rows = [...document.querySelectorAll('dialog[open] .materials li')];
    const visible = (e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
    };
    const name = (e) =>
      (e.getAttribute('aria-label') || e.innerText || e.className || e.tagName)
        .trim()
        .split('\n')[0]
        .slice(0, 40);
    rows.forEach((li, k) => {
      const box = li.getBoundingClientRect();
      const groups = [li, ...li.querySelectorAll(':scope > .sheet-fields')];
      for (const g of groups) {
        const kids = [...g.children].filter(visible);
        for (const e of kids) {
          const r = e.getBoundingClientRect();
          if (r.left < box.left - 1 || r.right > box.right + 1)
            problems.push(`row ${k + 1}: "${name(e)}" runs past the row`);
        }
        for (let i = 0; i < kids.length; i++)
          for (let j = i + 1; j < kids.length; j++) {
            const a = kids[i].getBoundingClientRect();
            const b = kids[j].getBoundingClientRect();
            const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            if (w > 1 && h > 1)
              problems.push(`row ${k + 1}: "${name(kids[i])}" overlaps "${name(kids[j])}"`);
          }
      }
    });
    return { rows: rows.length, problems };
  });

for (const width of [375, 390, 1280]) {
  const phone = width < 500;
  const ctx = await browser.newContext({
    viewport: { width, height: phone ? 844 : 900 },
    hasTouch: phone,
    isMobile: phone,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const shot = (name) =>
    page.screenshot({ path: `${out}/texts-and-controls-${name}-${width}.png` });
  const dlg = page.locator('dialog[open]');
  const closeDialog = async () => {
    await page.keyboard.press('Escape');
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
  };

  // 1. Bare app → New single piece → Sideboard → editor; arrow keys on Editor mode.
  await page.goto(url);
  await page.getByRole('button', { name: 'New single piece' }).click();
  await dlg
    .getByRole('button', { name: /Sideboard/ })
    .first()
    .click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  const modes = page.getByRole('radiogroup', { name: 'Editor mode' });
  const modeState = () =>
    modes.evaluate((g) =>
      [...g.querySelectorAll('[role="radio"]')].map((r) => ({
        on: r.getAttribute('aria-checked') === 'true',
        stop: r.tabIndex === 0,
        focus: r === document.activeElement,
      })),
    );
  let ms = await modeState();
  const at = ms.findIndex((r) => r.on);
  check(
    width,
    'Editor mode: only the selected option is a Tab stop',
    at >= 0 && ms.every((r, i) => r.stop === (i === at)),
  );
  await modes.getByRole('radio').nth(at).focus();
  await page.keyboard.press('ArrowRight');
  ms = await modeState();
  const nx = (at + 1) % ms.length;
  check(
    width,
    'Editor mode: → moves, selects and takes the Tab stop',
    ms[nx].on && ms[nx].focus && ms.every((r, i) => r.stop === (i === nx)),
  );
  await page.keyboard.press('Home');
  ms = await modeState();
  check(width, 'Editor mode: Home goes to the first', ms[0].on && ms[0].focus);
  await page.keyboard.press('End');
  ms = await modeState();
  check(
    width,
    'Editor mode: End goes to the last',
    ms[ms.length - 1].on && ms[ms.length - 1].focus,
  );

  // 2. Settings › Boards, sheets and saw cut: the Materials rows.
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await dlg.getByRole('heading', { name: /^Settings: / }).waitFor();
  const boards = dlg.locator('details', {
    has: page.locator('summary', { hasText: 'Boards, sheets and saw cut' }),
  });
  if ((await boards.first().getAttribute('open')) === null)
    await dlg.locator('summary', { hasText: 'Boards, sheets and saw cut' }).first().click();
  await dlg.locator('.materials li').first().waitFor();
  await page.waitForTimeout(300);
  const layout = await materialsLayout(page);
  check(
    width,
    `Materials: ${layout.rows} rows, no overlapping field`,
    layout.rows > 0 && layout.problems.length === 0,
    layout.problems.slice(0, 6).join(' / '),
  );
  check(width, 'Materials: no sideways page scroll', await noSideScroll());
  check(
    width,
    'Materials: every row fits inside the dialog',
    await dlg.evaluate((d) => {
      const box = d.getBoundingClientRect();
      return [...d.querySelectorAll('.materials li')].every((li) => {
        const r = li.getBoundingClientRect();
        return (
          r.left >= box.left - 1 && r.right <= box.right + 1 && li.scrollWidth <= li.clientWidth + 1
        );
      });
    }),
  );
  await dlg.locator('.materials li').first().scrollIntoViewIfNeeded();
  await dlg
    .locator('.materials li')
    .first()
    .screenshot({ path: `${out}/texts-and-controls-materials-row-${width}.png` });
  await closeDialog();

  if (width === 375) {
    check(width, 'no page errors', errors.length === 0, errors.join(' / '));
    await ctx.close();
    continue;
  }

  // 3. Catalog: the By-room hint and the Brands empty text.
  await page.goto(url);
  await page
    .getByRole('link', { name: /Catalog/ })
    .first()
    .click();
  const group = page.getByRole('radiogroup', { name: 'Group by' });
  await group.getByRole('radio').first().click();
  check(
    width,
    'Catalog: the several-rooms hint under By room',
    await page
      .getByText(
        'A family can sit in several rooms, so the room counts add up to more than the total.',
      )
      .isVisible(),
  );
  await page.getByRole('tablist', { name: 'Source' }).getByRole('tab', { name: 'Brands' }).click();
  const empty = page.getByText(
    'No brands yet. Import your decor list under Boards to see its manufacturers here.',
  );
  await empty.waitFor({ timeout: 5000 }).catch(() => {});
  check(
    width,
    'Catalog › Brands: the empty text, no feed promise',
    (await empty.isVisible()) && !(await page.getByText(/weekly catalog feed/i).count()),
  );
  check(width, 'Catalog: no sideways page scroll', await noSideScroll());
  await shot('brands');

  // 4. Catalog → New piece → Cabinet; one divider with custom widths; Doors as a wrapping segmented control.
  await page
    .getByRole('tablist', { name: 'Source' })
    .getByRole('tab', { name: 'Templates' })
    .click();
  await page.getByRole('button', { name: 'New piece' }).click();
  const wiz = page.getByRole('dialog', { name: 'New piece' });
  await wiz.getByRole('radio', { name: /Cabinet \(closed box\)/ }).click();
  const next = () => wiz.getByRole('button', { name: 'Next', exact: true }).click();
  for (let i = 0; i < 10 && !(await wiz.getByRole('heading', { name: 'Dividers' }).count()); i++)
    await next();
  await wiz
    .getByRole('button', { name: /^More / })
    .first()
    .click();
  await wiz
    .getByRole('radiogroup', { name: 'Compartment widths' })
    .getByRole('radio', { name: 'Custom' })
    .click();
  for (let i = 0; i < 10 && !(await wiz.getByRole('heading', { name: 'Doors' }).count()); i++)
    await next();
  const doors = wiz.getByRole('radiogroup', { name: 'Doors' });
  await doors.waitFor();
  await doors.scrollIntoViewIfNeeded();
  const d = await doors.evaluate((g) => {
    const box = g.getBoundingClientRect();
    const btns = [...g.querySelectorAll('button')];
    return {
      cls: g.className,
      labels: btns.map((b) => b.innerText.trim()),
      clipped: btns
        .filter((b) => b.scrollWidth > b.clientWidth + 1 || /…|\.\.\.$/.test(b.innerText))
        .map((b) => b.innerText.trim()),
      outside: btns
        .filter((b) => {
          const r = b.getBoundingClientRect();
          return r.left < box.left - 1 || r.right > box.right + 1;
        })
        .map((b) => b.innerText.trim()),
      rows: new Set(btns.map((b) => Math.round(b.getBoundingClientRect().top))).size,
      oneLine: btns.every((b) => {
        const lh = parseFloat(getComputedStyle(b).lineHeight) || 20;
        const range = document.createRange();
        range.selectNodeContents(b);
        return range.getClientRects().length <= 1 || b.getBoundingClientRect().height < lh * 2.2;
      }),
    };
  });
  check(width, 'Doors: a segmented control with .segmented.wrap', d.cls === 'segmented wrap');
  check(
    width,
    'Doors: five whole labels',
    d.labels.join('|') === 'None|One door|Pair|Sliding pair|Per compartment' &&
      d.clipped.length === 0 &&
      d.outside.length === 0 &&
      d.oneLine,
    JSON.stringify(d),
  );
  check(
    width,
    phone ? 'Doors: wraps to a second row' : 'Doors: fits one row',
    phone ? d.rows >= 2 : d.rows === 1,
    `${d.rows} rows`,
  );
  check(width, 'wizard: no sideways page scroll', await noSideScroll());
  await doors.screenshot({ path: `${out}/texts-and-controls-doors-${width}.png` });

  // 5. Review: the short label.
  for (let i = 0; i < 20 && !(await wiz.getByRole('button', { name: 'Create piece' }).count()); i++)
    await next();
  const answers = wiz.getByRole('region', { name: 'Answers' });
  check(
    width,
    'Review reads "Compartment widths: 0 mm"',
    (await answers.getByText(/Compartment widths: 0 mm/).count()) > 0 &&
      (await answers.getByText(/Width of each compartment/).count()) === 0,
  );
  await shot('review');

  check(width, 'no page errors', errors.length === 0, errors.join(' / '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
