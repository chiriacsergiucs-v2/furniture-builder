// Find-it acceptance for the doubled top (ADR-105, backlog N103), run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/doubled-top/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text. Not part of `pnpm test`.
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

for (const width of [1440, 390]) {
  const phone = width < 500;
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);
  const errors = [];
  const remote = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (
      !['localhost', '127.0.0.1'].includes(u.hostname) &&
      !u.protocol.startsWith('blob') &&
      !u.protocol.startsWith('data')
    )
      remote.push(r.url());
  });
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const shot = (name) =>
    page.screenshot({ path: `${out}/doubled-top-${name}-${width}.png`, fullPage: true });
  const mode = (name) => page.getByRole('radio', { name });
  const dlg = page.locator('dialog[open]');
  const openConstruction = async () => {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await dlg.waitFor({ state: 'visible' });
    const g = dlg.locator('details.group', {
      has: page.locator('summary', { hasText: 'Construction' }),
    });
    if (!(await g.evaluate((d) => d.open))) await g.locator('summary').first().click();
    return g;
  };
  const closeSettings = async () => {
    await dlg.getByRole('button', { name: 'Done', exact: true }).click();
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
  };
  /** Build & Preview › Parts: how many parts are labelled "Top". */
  const topCount = async () => {
    await mode(/Build & Preview/).dispatchEvent('click');
    const t = page.getByRole('tab', { name: /Parts/ });
    if ((await t.getAttribute('aria-selected')) !== 'true') await t.dispatchEvent('click');
    await page.locator('td.labels').first().waitFor();
    return page.locator('tr').evaluateAll((rows) =>
      rows
        .filter((r) => {
          const l = r.querySelector('td.labels');
          return l && l.childNodes[0]?.textContent?.split(', ').includes('Top');
        })
        .reduce((n, r) => n + Number(r.querySelector('td.num')?.textContent ?? 0), 0),
    );
  };

  // 1. Bare app → New single piece → Chest of drawers → editor.
  await page.goto(url);
  await page.getByRole('button', { name: 'New single piece' }).click();
  await dlg
    .getByRole('button', { name: /Chest of drawers/ })
    .first()
    .click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  const before = await topCount();
  check(width, 'Parts lists one "Top" before', before === 1, `${before}`);

  // 2. Settings › Construction › "Top layers" › "Doubled".
  await mode('Compose').dispatchEvent('click');
  await openConstruction();
  const layers = dlg.getByRole('radiogroup', { name: 'Top layers' });
  await layers.scrollIntoViewIfNeeded();
  check(width, '"Top layers" found under Construction', await layers.isVisible());
  check(
    width,
    '"Single" is chosen by default',
    (await layers.getByRole('radio', { name: 'Single' }).getAttribute('aria-checked')) === 'true',
  );
  await layers.getByRole('radio', { name: 'Doubled' }).click();
  check(
    width,
    '"Doubled" is chosen',
    (await layers.getByRole('radio', { name: 'Doubled' }).getAttribute('aria-checked')) === 'true',
  );
  check(width, 'no sideways scroll (Settings)', await noSideScroll());
  await shot('settings');

  // 3. "Two rails" hides the choice; back to a full panel shows it again.
  await dlg.getByRole('radio', { name: 'Two rails' }).click();
  check(width, '"Top layers" hidden for a rails top', (await layers.count()) === 0);
  await dlg.getByRole('radio', { name: 'A full panel' }).click();
  check(
    width,
    '"Doubled" kept after switching back to a full panel',
    (await layers.getByRole('radio', { name: 'Doubled' }).getAttribute('aria-checked')) === 'true',
  );
  await closeSettings();

  // 4. Parts now list "Top" twice.
  const after = await topCount();
  check(width, 'Parts list "Top" × 2 after Doubled', after === 2, `${after}`);
  check(width, 'no sideways scroll (Parts)', await noSideScroll());
  await shot('parts');

  // 5. A corner cabinet has the same choice and doubles its top(s).
  await page.goto(url);
  await page.getByRole('button', { name: 'New single piece' }).click();
  await dlg
    .getByRole('button', { name: /Blind corner: Blind left/ })
    .first()
    .click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  const cBefore = await topCount();
  await mode('Compose').dispatchEvent('click');
  await openConstruction();
  const cLayers = dlg.getByRole('radiogroup', { name: 'Top layers' });
  await cLayers.scrollIntoViewIfNeeded();
  check(width, 'corner: "Top layers" found under Construction', await cLayers.isVisible());
  await cLayers.getByRole('radio', { name: 'Doubled' }).click();
  await closeSettings();
  const cAfter = await topCount();
  check(
    width,
    'corner: Parts list twice as many "Top" after Doubled',
    cBefore > 0 && cAfter === 2 * cBefore,
    `${cBefore} → ${cAfter}`,
  );

  check(width, 'no requests leave the device', remote.length === 0, remote.slice(0, 3).join(' '));
  check(width, 'no page errors', errors.length === 0, errors.join(' / '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
