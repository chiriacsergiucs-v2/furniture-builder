// Find-it acceptance for fastener counts (ADR-074, backlog N69), run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/fasteners/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
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

for (const width of [1440, 1280, 390, 375]) {
  const phone = width < 500;
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 } });
  const page = await ctx.newPage();
  // The 3D view keeps a software-rendered page busy; give clicks time.
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const ck = (name, ok, detail) => check(width, name, ok, detail);
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const shot = (name) =>
    page.screenshot({ path: `${out}/fasteners-${name}-${width}.png`, fullPage: true });
  const mode = (name) => page.getByRole('radio', { name });
  const side = page.locator('aside.side');
  const group = (name) => side.locator('details.group > summary', { hasText: name });
  const tab = (name) => page.getByRole('tab', { name });
  const panel = (id) => page.locator(`#panel-${id}`);

  // 1. A wardrobe from the bare app (hand count: 18 carcass joints, 1 back, on a plinth).
  await page.goto(url);
  await page.getByRole('button', { name: 'New single piece' }).click();
  await page
    .locator('dialog[open]')
    .getByRole('button', { name: /Wardrobe/ })
    .first()
    .click();
  await page.locator('main.work').waitFor({ state: 'visible' });

  // 2. Configure › Materials and Fasteners.
  await mode('Configure').click();
  await page.waitForTimeout(200);
  ck('Configure shows "Materials"', (await group(/^Materials$/).count()) > 0);
  const fast = group(/^Fasteners$/);
  ck('Configure shows "Fasteners"', (await fast.count()) === 1);
  await fast.scrollIntoViewIfNeeded();
  await fast.click();
  const fbody = side.locator('#g-fasteners');
  ck(
    'Fasteners lists the default joint types',
    (
      await Promise.all(
        [
          'Carcass joint',
          'Shelf pin',
          'Back fixing',
          'Hanging point',
          'Worktop fixing',
          'Foot',
        ].map((t) => fbody.getByText(t, { exact: true }).isVisible()),
      )
    ).every(Boolean),
  );
  ck(
    'Fasteners shows "18 joints here · guidance"',
    await fbody.getByText(/18 joints here · guidance/).isVisible(),
  );
  ck('no sideways scroll (Fasteners)', await noSideScroll());
  await fbody.scrollIntoViewIfNeeded();
  await shot('materials');

  // 3. Build & Preview › Hardware and Shopping list, before a fastener is chosen.
  await mode(/Build & Preview/).click();
  await tab('Hardware').click();
  ck(
    'Hardware shows "Fasteners — guidance"',
    await panel('hardware').getByRole('heading', { name: 'Fasteners — guidance' }).isVisible(),
  );
  ck(
    'Hardware shows 18 joints, "choose your fastener"',
    (await panel('hardware').getByText('18 joints').isVisible()) &&
      (await panel('hardware').getByText('choose your fastener').first().isVisible()),
  );
  await shot('hardware-before');
  await tab('Shopping list').click();
  const choose = panel('shopping').getByRole('region', { name: 'To choose before buying' });
  ck(
    'Shopping list: "Joint fixings: 18 joints — choose your fastener" under To choose before buying',
    await choose.getByText('Joint fixings: 18 joints — choose your fastener').isVisible(),
  );
  ck(
    'Shopping list line is labelled guidance',
    await choose
      .getByText(/^Guidance: counted from the model/)
      .first()
      .isVisible(),
  );
  ck('no sideways scroll (Shopping list)', await noSideScroll());
  await shot('shopping-before');

  // 4. Name a fastener: 2 per joint.
  await mode('Configure').click();
  await page.waitForTimeout(200);
  if (!(await side.locator('#g-fasteners').evaluate((d) => d.open))) await fast.click();
  const name = side.getByLabel('Carcass joint: your fastener');
  await name.scrollIntoViewIfNeeded();
  await name.fill('Confirmat 7 × 50');
  await name.press('Tab');
  const per = side.getByLabel('Carcass joint: how many per joint');
  await per.fill('2');
  await per.press('Tab');
  await page.waitForTimeout(200);

  // 5. The counted line in Hardware and Shopping list.
  await mode(/Build & Preview/).click();
  await tab('Hardware').click();
  ck(
    'Hardware shows "Confirmat 7 × 50, 2 per joint" → 36 pcs',
    (await panel('hardware').getByText('Confirmat 7 × 50, 2 per joint').isVisible()) &&
      (await panel('hardware').getByText('36 pcs').isVisible()),
  );
  await tab('Shopping list').click();
  const hw = panel('shopping').getByRole('region', { name: 'Hardware' });
  const row = hw.getByRole('row', { name: /Confirmat 7 × 50/ });
  ck(
    'Shopping list › Hardware: Confirmat 7 × 50, 36 pcs, guidance',
    (await row.isVisible()) &&
      /36 pcs/.test(await row.innerText()) &&
      /Guidance: counted from the model: 18 joints × 2/.test(await row.innerText()),
    (await row.count()) ? await row.innerText() : 'no row',
  );
  ck(
    'the joint line left To choose before buying',
    (await panel('shopping')
      .getByText(/^Joint fixings: /)
      .count()) === 0,
  );
  ck('no sideways scroll (after choosing)', await noSideScroll());
  await shot('shopping-after');

  // 6. Saved on this device: still there after a reload.
  const saved = await page.evaluate(
    () =>
      new Promise((res) => {
        const r = indexedDB.open('furniture-builder');
        r.onsuccess = () => {
          try {
            const g = r.result
              .transaction('prices')
              .objectStore('prices')
              .get('fastener:carcass-joint');
            g.onsuccess = () => res(g.result ?? null);
            g.onerror = () => res(null);
          } catch {
            res(null);
          }
        };
        r.onerror = () => res(null);
      }),
  );
  ck(
    'fastener saved on this device',
    saved?.text === 'Confirmat 7 × 50' && saved?.per === 2,
    JSON.stringify(saved),
  );
  ck('no page errors', errors.length === 0, errors.join(' / '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
