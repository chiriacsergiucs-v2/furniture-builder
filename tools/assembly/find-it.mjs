// Find-it acceptance for the assembly steps (CLAUDE.md R3, backlog N177, ADR-174), run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/assembly/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text: a new project with a base cabinet;
// Build & Preview › Assembly lists the steps with the guidance line; Show step lights the step's parts in the 3D view
// (the viewer reports how many parts are lit on <body data-lit>); ← → move between steps; a second piece gets its
// own section. Not part of `pnpm test`.
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
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const shot = (name) => page.screenshot({ path: `${out}/assembly-${name}-${width}.png` });
  const dlg = page.locator('dialog[open]');
  const click = async (loc) => {
    await loc.scrollIntoViewIfNeeded();
    await loc.click({ timeout: 3000 }).catch(() => loc.dispatchEvent('click'));
  };
  const btn = (name, exact = true) => page.getByRole('button', { name, exact });
  const sheet = async (open) => {
    const peek = page.locator('.sheet-peek');
    if (!(await peek.isVisible().catch(() => false))) return;
    if (((await peek.getAttribute('aria-expanded')) === 'true') !== open) await peek.click();
    await page.waitForTimeout(200);
  };
  const add = async (search, row) => {
    await sheet(true);
    const all = page.getByRole('button', { name: /^All pieces \(\d+\)$/ });
    if (await all.isVisible().catch(() => false)) await click(all);
    await click(btn('Add a piece'));
    await dlg.getByRole('searchbox', { name: 'Search the items' }).fill(search);
    await dlg.locator('.start-group .row-btn', { hasText: row }).first().click();
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
    const place = btn('Place to the right');
    await place.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
    if (await place.isVisible()) await click(place);
    await page.waitForTimeout(150);
    await sheet(false);
  };
  const lit = () => page.evaluate(() => Number(document.body.dataset.lit ?? '0'));

  // 1. Bare app → new project → a base cabinet → Build & Preview › 3D › Assembly.
  await page.goto(url);
  await click(btn('Create a new project'));
  await page.locator('dialog[open] input').fill(`Assembly ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await add('Base cabinet', /^Base cabinet/);
  await click(page.getByRole('radio', { name: /Build & Preview/ }));
  const three = page.getByRole('radio', { name: '3D', exact: true });
  if (await three.isVisible().catch(() => false)) await click(three);
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 20000 });
  const tab = page.getByRole('tab', { name: /^Assembly/ });
  check(width, 'the results have an "Assembly" tab', await tab.isVisible());
  await click(tab);
  const panel = page.getByRole('tabpanel');
  await panel.getByRole('region', { name: /^Assembly: Base cabinet/ }).waitFor();
  const section = panel.getByRole('region', { name: /^Assembly: Base cabinet/ });
  const steps = section.locator('ol.assembly-steps > li');
  const n = await steps.count();
  check(width, 'the piece has an ordered step list (4 or more steps)', n >= 4, `${n}`);
  const titles = [];
  for (let i = 0; i < n; i++)
    titles.push((await steps.nth(i).locator('strong').textContent()) ?? '');
  const at = (name) => titles.indexOf(name);
  check(
    width,
    'bottom → sides → top → back → doors and fronts, in that order',
    at('Bottom') >= 0 &&
      at('Bottom') < at('Sides to the bottom') &&
      at('Sides to the bottom') < at('Top') &&
      at('Top') < at('Back') &&
      at('Back') < at('Doors and fronts'),
    titles.join(' | '),
  );
  check(
    width,
    'the guidance line is on the tab',
    await panel.getByText(/Guidance: order from the parts' positions/).isVisible(),
  );
  check(
    width,
    'a step names its parts with sizes and its carcass joints',
    /\d+ ×.*side.*\d+ × \d+ × \d+ mm/i.test(
      (await steps.nth(at('Sides to the bottom')).textContent()) ?? '',
    ) && /carcass joint/.test((await steps.nth(at('Sides to the bottom')).textContent()) ?? ''),
  );
  await shot('tab');

  // 2. Show step lights the step's parts in 3D; ← → move; Show every part again clears.
  check(width, 'nothing lit before Show step', (await lit()) === 0, `${await lit()}`);
  await click(steps.nth(at('Sides to the bottom')).getByRole('button', { name: 'Show step' }));
  await page.waitForTimeout(400);
  check(width, 'Show step lights the two sides in 3D', (await lit()) === 2, `${await lit()}`);
  check(
    width,
    'the shown step is marked current',
    (await steps.nth(at('Sides to the bottom')).getAttribute('aria-current')) === 'step',
  );
  await shot('lit');
  await steps.nth(at('Sides to the bottom')).getByRole('button', { name: 'Show step' }).focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  const nextTitle = titles[at('Sides to the bottom') + 1];
  check(
    width,
    `→ moves to the next step (${nextTitle})`,
    (await steps.nth(at('Sides to the bottom') + 1).getAttribute('aria-current')) === 'step',
  );
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(300);
  check(
    width,
    '← moves back',
    (await steps.nth(at('Sides to the bottom')).getAttribute('aria-current')) === 'step',
  );
  await click(panel.getByRole('button', { name: 'Show every part again' }));
  await page.waitForTimeout(300);
  check(width, 'Show every part again clears the highlight', (await lit()) === 0, `${await lit()}`);
  check(
    width,
    'a "Print assembly steps" button is there',
    await panel.getByRole('button', { name: 'Print assembly steps' }).isVisible(),
  );

  // 3. A second piece: its own section.
  await click(page.getByRole('radio', { name: 'Compose' }));
  await add('Chest', /^Chest/);
  await click(page.getByRole('radio', { name: /Build & Preview/ }));
  const tab2 = page.getByRole('tab', { name: /^Assembly/ });
  // On a phone the tabs fold; a tap on the open tab would fold them again.
  if ((await tab2.getAttribute('aria-selected')) !== 'true') await click(tab2);
  const sections = page.getByRole('tabpanel').getByRole('region', { name: /^Assembly: / });
  check(
    width,
    'each piece of the project has its own section',
    (await sections.count()) === 2,
    `${await sections.count()}`,
  );
  check(width, 'no sideways scroll', await noSideScroll());
  check(width, 'no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
