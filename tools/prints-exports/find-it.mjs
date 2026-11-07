// Find-it acceptance for prints, exports and seller matching (CLAUDE.md R3, backlog N211, ADR-206), run against a
// production build:
//   pnpm build && pnpm preview --port 4306 &  node tools/prints-exports/find-it.mjs http://localhost:4306/furniture-builder/ <out dir>
// Starts from the bare app at 1280 and 390 px and finds everything by visible text:
//   1. a chest of drawers takes a Regency board with a shipped picture; its drawer fronts fill with the picture in the
//      front view; ⋯ › Front view drawing saves an SVG that embeds the picture as a JPEG data URL (G-001);
//   2. the 3D view's ⋯ › Export scene (.glb) saves `<name>-scene.glb`, starting with `glTF`, with the panels' meshes
//      and the board picture, and makes no fetch or XHR (G-021);
//   3. Assembly › Print assembly steps with the 3D view open prints one picture per step (G-343);
//   4. Parts › Client sheet prints one A4 page with the 3D still, the piece and the estimate (G-020);
//   5. a project with two base cabinets and suggested run parts: Shopping › Product on the worktop line (G-314);
//   6. G-316: five Regency boards with shipped pictures, each seen in 3D (screenshots `g316-<code>-<width>.png`).
// window.print is replaced by a counter so the print sheet stays on screen for checks; Chromium's own PDF printer
// counts the client sheet's pages. Not part of `pnpm test`.
import { launchBrowser, previewUrl, outDir } from '../lib/harness.mjs';
import { mkdirSync, readFileSync } from 'node:fs';

const url = previewUrl('http://localhost:4306/furniture-builder/');
const out = outDir('dist-acceptance/prints-exports');
mkdirSync(out, { recursive: true });

/** Regency 18 mm boards whose pictures the app ships (`public/sellers/regency/<id>.jpg`): wood, stone, plain. */
const BOARDS = [
  { code: 'P18KR.9763.BS', name: 'stejar magia' },
  { code: 'P18EG.H1715.ST12', name: 'nuc parona' },
  { code: 'P18KR.5527.SN', name: 'stejar piatra' },
  { code: 'P18EG.H1225.ST12', name: 'frasin trondheim' },
  { code: 'P18EG.H3195.ST19', name: 'fineline alb' },
  { code: 'P18KR.112.PE', name: 'gri 112' },
];

const browser = await launchBrowser();
const results = [];
const check = (width, name, ok, detail = '') => {
  results.push({ width, name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${width}px ${name}${detail ? ` — ${detail}` : ''}`);
};

for (const width of [1280, 390]) {
  const phone = width < 500;
  const ctx = await browser.newContext({
    viewport: { width, height: phone ? 844 : 900 },
    hasTouch: phone,
    isMobile: phone,
    acceptDownloads: true,
    // Every request shows up here (no service worker answering from its cache).
    serviceWorkers: 'block',
  });
  // The print dialog would block the page: count the calls instead, and keep the sheet on screen until afterprint.
  await ctx.addInitScript(() => {
    window.__prints = 0;
    window.print = () => {
      window.__prints++;
    };
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  const remote = [];
  const requests = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('request', (r) => {
    requests.push({ url: r.url(), type: r.resourceType() });
    const u = new URL(r.url());
    if (!['localhost', '127.0.0.1'].includes(u.hostname) && /^https?:$/.test(u.protocol))
      remote.push(r.url());
  });
  const dlg = page.locator('dialog[open]');
  const btn = (name, exact = true) => page.getByRole('button', { name, exact });
  const click = async (loc) => {
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    await loc.click({ timeout: 5000 }).catch(() => loc.dispatchEvent('click'));
  };
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const endPrint = async () => {
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await page.locator('.print-root').waitFor({ state: 'detached' });
  };
  const settingsBoards = async () => {
    await click(btn('Settings'));
    await dlg.getByRole('heading', { name: /^Settings: / }).waitFor();
    await dlg.getByText('Boards, sheets and saw cut', { exact: true }).click();
  };
  /** Settings › Boards: the first board takes the Regency product with this code (its shipped picture). */
  const pickBoard = async (code) => {
    await settingsBoards();
    const first = dlg
      .locator('li', { has: page.getByRole('button', { name: 'Product from a seller' }) })
      .first();
    await click(first.getByRole('button', { name: 'Product from a seller' }));
    const picker = page.getByRole('dialog', { name: /^Product from a seller for / });
    await picker.getByRole('searchbox').fill(code);
    const use = picker.locator('li', { hasText: code }).getByRole('button', { name: 'Use this' });
    await use
      .first()
      .waitFor({ timeout: 20000 })
      .catch(async (e) => {
        await page.screenshot({ path: `${out}/pick-failed-${code}-${width}.png` });
        throw e;
      });
    await click(use.first());
    await picker.waitFor({ state: 'detached' }).catch(() => {});
    await first.getByText(/^Seller product: /).waitFor({ timeout: 15000 });
    // The picture is the app's own copy: wait until the board shows it.
    await page.waitForTimeout(800);
    await click(dlg.getByRole('button', { name: 'Done' }));
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
  };
  const results3d = async () => {
    if (phone) await click(page.getByRole('radio', { name: /Build & Preview/ }));
    const three = page.getByRole('radio', { name: '3D', exact: true });
    if (await three.isVisible().catch(() => false)) await click(three);
    await page.locator('.view.three canvas').waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(2500);
  };
  const tab = async (name) => {
    await click(page.getByRole('tab', { name }));
    return page.getByRole('tabpanel');
  };

  // ---------------------------------------------------------------------------------------------------------------
  // 1. A chest of drawers with a seller board; its fronts and the SVG download carry the picture.
  // ---------------------------------------------------------------------------------------------------------------
  await page.goto(url);
  await click(btn('New single piece'));
  await click(dlg.getByRole('button', { name: /Chest of drawers/ }).first());
  await page.locator('main.work').waitFor({ state: 'visible' });
  await pickBoard(BOARDS[0].code);
  const front = page.locator('.view.front .elevation svg');
  await front.waitFor({ state: 'visible' });
  await page
    .waitForFunction(
      () => document.querySelectorAll('.view.front polygon.el-front[style*="url("]').length > 0,
      null,
      { timeout: 10000 },
    )
    .catch(() => {});
  const fronts = await page.evaluate(() => {
    const all = [...document.querySelectorAll('.view.front polygon.el-front')];
    return {
      all: all.length,
      pic: all.filter((p) => /url\(/.test(p.getAttribute('style') ?? '')).length,
    };
  });
  check(
    width,
    'front view: every drawer front fills with its board picture',
    fronts.all > 0 && fronts.pic === fronts.all,
    `${fronts.pic}/${fronts.all}`,
  );
  await front.screenshot({ path: `${out}/front-view-${width}.png` });

  await click(page.getByLabel('More', { exact: true }));
  const svgItem = btn(/^Front view drawing/, false);
  check(width, '⋯ has "Front view drawing"', await svgItem.isVisible());
  const [svgDl] = await Promise.all([page.waitForEvent('download'), click(svgItem)]);
  const svgFile = `${out}/${svgDl.suggestedFilename()}`;
  await svgDl.saveAs(svgFile);
  const svg = readFileSync(svgFile, 'utf8');
  const svgCheck = await page.evaluate((text) => {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    const bad = doc.querySelector('parsererror');
    const images = [...doc.querySelectorAll('pattern image')].map(
      (i) => i.getAttribute('href') ?? '',
    );
    const used = [...doc.querySelectorAll('polygon.el-front')].filter((p) =>
      /url\(/.test(p.getAttribute('style') ?? ''),
    ).length;
    return { valid: !bad, images, used };
  }, svg);
  check(width, 'the SVG file is valid XML', svgCheck.valid);
  check(
    width,
    'the SVG embeds the board picture as a JPEG data URL',
    svgCheck.images.length > 0 &&
      svgCheck.images.every((h) => h.startsWith('data:image/jpeg;base64,')),
    `${svgCheck.images.length} picture(s), ${Math.round(svg.length / 1024)} KB`,
  );
  check(width, 'the SVG fronts use the picture', svgCheck.used > 0, `${svgCheck.used}`);
  check(width, 'the SVG carries no device-only blob: URL', !svg.includes('blob:'));

  // ---------------------------------------------------------------------------------------------------------------
  // 2. 3D › ⋯ › Export scene (.glb)
  // ---------------------------------------------------------------------------------------------------------------
  await results3d();
  await page.locator('.view.three canvas').screenshot({ path: `${out}/three-${width}.png` });
  if (phone) await click(page.locator('details.view-options > summary'));
  const more3d = page
    .getByRole('group')
    .locator('summary[aria-label="More 3D actions"]')
    .or(page.locator('summary[aria-label="More 3D actions"]'));
  check(width, '3D toolbar has "More 3D actions" (⋯)', await more3d.first().isVisible());
  await click(more3d.first());
  const glbItem = btn(/^Export scene \(\.glb\)/, false);
  check(width, '⋯ has "Export scene (.glb)"', await glbItem.isVisible());
  const before = requests.length;
  const [glbDl] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    click(glbItem),
  ]);
  const glbFile = `${out}/${glbDl.suggestedFilename()}`;
  await glbDl.saveAs(glbFile);
  const glb = readFileSync(glbFile);
  check(
    width,
    'the file is named <name>-scene.glb',
    glbDl.suggestedFilename() === 'chest-of-drawers-scene.glb',
    glbDl.suggestedFilename(),
  );
  check(width, 'the .glb starts with glTF', glb.subarray(0, 4).toString() === 'glTF');
  const jsonLen = glb.readUInt32LE(12);
  const gltf = JSON.parse(glb.subarray(20, 20 + jsonLen).toString());
  const panels = await page.evaluate(() => Number(document.body.dataset.panels ?? 0));
  check(
    width,
    'the .glb holds the panels’ meshes with materials and the board picture',
    (gltf.meshes?.length ?? 0) >= 10 &&
      (gltf.materials?.length ?? 0) > 0 &&
      (gltf.images?.length ?? 0) > 0,
    `${gltf.meshes?.length} meshes, ${gltf.materials?.length} materials, ${gltf.images?.length} images${panels ? `, ${panels} panels` : ''}`,
  );
  const sent = requests.slice(before).filter((r) => r.type === 'fetch' || r.type === 'xhr');
  check(
    width,
    'Export scene makes no fetch or XHR',
    sent.length === 0,
    sent.map((r) => r.url).join(' '),
  );
  check(width, 'no sideways scroll (3D)', await noSideScroll());

  // ---------------------------------------------------------------------------------------------------------------
  // 3. Assembly › Print assembly steps with the 3D view open: one picture per step.
  // ---------------------------------------------------------------------------------------------------------------
  if (phone) await page.keyboard.press('Escape');
  let panel = await tab(/^Assembly/);
  await click(panel.getByRole('button', { name: 'Print assembly steps' }));
  await page.locator('.print-root').waitFor({ state: 'attached', timeout: 120000 });
  await page.waitForFunction(() => window.__prints > 0, null, { timeout: 30000 });
  const steps = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.print-root section.pr-piece tbody tr')].filter(
      (tr) => tr.querySelector('strong'),
    );
    return {
      steps: rows.length,
      pics: rows.filter((tr) => tr.querySelector('img.pr-step-pic')).length,
      png: [...document.querySelectorAll('.print-root img.pr-step-pic')].every((i) =>
        (i.getAttribute('src') ?? '').startsWith('data:image/png'),
      ),
      fallback: (document.querySelector('.print-root')?.textContent ?? '').includes(
        'Imaginile pașilor cer vizualizarea 3D',
      ),
    };
  });
  check(
    width,
    'the assembly print has one 3D picture per step',
    steps.steps > 0 && steps.pics === steps.steps && steps.png,
    `${steps.pics}/${steps.steps}`,
  );
  check(width, 'no "Step pictures need the 3D view" line with the 3D view open', !steps.fallback);
  await page.pdf({
    format: 'A4',
    printBackground: true,
    path: `${out}/assembly-print-${width}.pdf`,
  });
  await endPrint();

  // ---------------------------------------------------------------------------------------------------------------
  // 4. Parts › Client sheet: one A4 page with the 3D still.
  // ---------------------------------------------------------------------------------------------------------------
  panel = await tab(/^Parts/);
  const client = panel.getByRole('button', { name: 'Client sheet' });
  check(width, 'Parts has "Client sheet"', await client.isVisible());
  await click(client);
  await page.locator('.print-root').waitFor({ state: 'attached' });
  // The estimate fills in once the sheets are laid out and the seller catalog is read.
  await page.waitForTimeout(2500);
  const sheet = await page.evaluate(() => {
    const r = document.querySelector('.print-root');
    return {
      text: r?.textContent ?? '',
      img: r?.querySelector('.pr-client-pic img')?.getAttribute('src')?.slice(0, 22) ?? '',
    };
  });
  check(
    width,
    'client sheet: name, title, piece size, estimate',
    /Chest of drawers/.test(sheet.text) &&
      /Fișă pentru client/.test(sheet.text) &&
      /\d+ × \d+ × \d+/.test(sheet.text) &&
      /Preț estimat: /.test(sheet.text),
    sheet.text.slice(0, 160),
  );
  check(
    width,
    'client sheet picture is the 3D still',
    sheet.img.startsWith('data:image/png'),
    sheet.img,
  );
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    path: `${out}/client-sheet-${width}.pdf`,
  });
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
  check(width, 'the client sheet prints one A4 page', pages === 1, `${pages} page(s)`);
  await endPrint();

  // ---------------------------------------------------------------------------------------------------------------
  // 6. G-316: Regency boards with shipped pictures in 3D (screenshots looked at by eye; verdict in the backlog row).
  // ---------------------------------------------------------------------------------------------------------------
  const seen = [];
  for (const b of BOARDS.slice(0, 5)) {
    // Settings stays reachable with the 3D view open; the view redraws with the new board.
    await pickBoard(b.code);
    if (!(await page.locator('.view.three canvas').isVisible())) await results3d();
    await page.waitForTimeout(2500);
    const file = `${out}/g316-${b.code}-${width}.png`;
    await page.locator('.view.three canvas').screenshot({ path: file });
    seen.push(b.code);
  }
  check(width, 'G-316: five Regency boards seen in 3D', seen.length === 5, seen.join(', '));

  // ---------------------------------------------------------------------------------------------------------------
  // 5. A project with run parts: Shopping › Product on the worktop line.
  // ---------------------------------------------------------------------------------------------------------------
  await page.goto(url);
  await click(page.getByLabel('More', { exact: true }));
  await click(btn(/^New…/, false));
  await click(dlg.getByRole('button', { name: /Project with several pieces/ }));
  await page.locator('main.work').waitFor({ state: 'visible' });
  const compose = page.getByRole('radio', { name: 'Compose' });
  if (await compose.isVisible().catch(() => false)) await click(compose);
  for (let i = 0; i < 2; i++) {
    const peek = page.locator('.sheet-peek');
    if (
      (await peek.isVisible().catch(() => false)) &&
      (await peek.getAttribute('aria-expanded')) === 'false'
    )
      await click(peek);
    const all = page.getByRole('button', { name: /^All pieces \(\d+\)$/ });
    if (await all.isVisible().catch(() => false)) await click(all);
    await click(btn('Add a piece'));
    await dlg.getByRole('searchbox', { name: 'Search the items' }).fill('Base cabinet');
    await click(dlg.getByRole('button', { name: /Base cabinet, doors: 1 door/ }).first());
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
    const place = btn('Place to the right');
    await place.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
    if (await place.isVisible()) await click(place);
  }
  await click(btn('Settings'));
  const runParts = dlg.getByRole('region', { name: 'Run parts' });
  await click(runParts.getByRole('button', { name: 'Suggest run parts' }));
  await runParts
    .getByText(/^Worktop/)
    .first()
    .waitFor();
  await click(dlg.getByRole('button', { name: 'Done' }));
  await dlg.waitFor({ state: 'detached' }).catch(() => {});
  if (phone) await click(page.getByRole('radio', { name: /Build & Preview/ }));
  panel = await tab(/^Shopping/);
  const wtProduct = panel.getByRole('button', { name: /^Product for Worktop/ }).filter({
    hasNotText: 'fixings',
  });
  await wtProduct
    .first()
    .waitFor({ timeout: 15000 })
    .catch(() => {});
  check(
    width,
    'Shopping has "Product" on the worktop (run part) line',
    await wtProduct.first().isVisible(),
  );
  await click(wtProduct.first());
  const picker = page.getByRole('dialog', { name: /^Product for Worktop/ });
  await picker.getByRole('button', { name: 'Use this' }).first().waitFor({ timeout: 20000 });
  await click(picker.getByRole('button', { name: 'Use this' }).first());
  await picker.waitFor({ state: 'detached' }).catch(() => {});
  const priced = panel.locator('tr', { hasText: 'priced by its product' });
  await priced
    .first()
    .waitFor({ timeout: 15000 })
    .catch(() => {});
  check(
    width,
    'the worktop is then priced by its product (seller price)',
    (await priced.count()) > 0 && /seller price/.test(await priced.first().innerText()),
  );
  await page.screenshot({ path: `${out}/shopping-run-part-${width}.png`, fullPage: true });
  check(width, 'no sideways scroll (Shopping)', await noSideScroll());

  check(width, 'no requests leave the device', remote.length === 0, remote.slice(0, 3).join(' '));
  check(width, 'no page errors', errors.length === 0, errors.slice(0, 3).join(' / '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
