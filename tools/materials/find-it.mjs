// Find-it acceptance for pictures on materials (CLAUDE.md R3, backlog N43, ADR-048), run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/materials/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text. Not part of `pnpm test`.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';

const url = process.argv[2] ?? 'http://localhost:4173/furniture-builder/';
const out = process.argv[3] ?? 'dist-acceptance';
mkdirSync(out, { recursive: true });

// A test picture: 64 × 64 px, red and blue stripes, colours no default board uses.
function png(w, h, px) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = px(x, y);
      raw.set([r, g, b], y * (w * 3 + 1) + 1 + x * 3);
    }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const picture = `${out}/stripes.png`;
writeFileSync(
  picture,
  png(64, 64, (x) => (Math.floor(x / 8) % 2 ? [20, 40, 230] : [230, 20, 20])),
);
const notPicture = `${out}/not-a-picture.png`;
writeFileSync(notPicture, 'this is text, not a picture');

const decorCsv = `${out}/my-decors.csv`;
writeFileSync(
  decorCsv,
  'manufacturer;type;code;name;thickness;color\nEgger;PAL;H1145;Bardolino Oak;18;#b59a7a\nKronospan;Kitchen worktop;K001;Craft Oak;38;#a07850\nBad;PAL;X;no colour;18;white\n',
);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const results = [];
const check = (width, name, ok, detail = '') => {
  results.push({ width, name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${width}px ${name}${detail ? ` — ${detail}` : ''}`);
};

/** Share of strongly red and strongly blue pixels in a screenshot, counted in the page. */
async function stripeShare(page, buf) {
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let red = 0,
      blue = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > 120 && d[i + 1] < 90 && d[i + 2] < 90) red++;
      if (d[i + 2] > 120 && d[i] < 90 && d[i + 1] < 110) blue++;
    }
    const n = d.length / 4;
    return { red: red / n, blue: blue / n };
  }, buf.toString('base64'));
}

for (const width of [1440, 375]) {
  const phone = width < 500;
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 812 : 900 } });
  const page = await ctx.newPage();
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
    page.screenshot({ path: `${out}/materials-${name}-${width}.png`, fullPage: true });
  const dlg = page.locator('dialog[open]');
  // The boards live in Settings › "Boards, sheets and saw cut" since ADR-080 (it was the Materials dialog).
  const openMaterials = async () => {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await dlg.getByRole('heading', { name: /^Settings: / }).waitFor();
    const boards = dlg.locator('details', {
      has: page.locator('summary', { hasText: 'Boards, sheets and saw cut' }),
    });
    if ((await boards.first().getAttribute('open')) === null)
      await dlg.locator('summary', { hasText: 'Boards, sheets and saw cut' }).first().click();
  };
  const moreMenu = async () => {
    await page.locator('summary[aria-label="More"]').click();
    return page.locator('details.more .menu-items');
  };
  const closeDialog = async () => {
    await page.keyboard.press('Escape');
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
  };
  // A phone shows the View switch in Build & Preview only, and the drawing on its own in Compose (ADR-080).
  const show3d = async (p = page) => {
    if (!(await p.getByRole('radio', { name: '3D' }).isVisible()))
      await p.getByRole('radio', { name: /Build & Preview/ }).click();
    await p.getByRole('radio', { name: '3D' }).click();
    await p.waitForTimeout(1500);
  };
  const showFront = async () => {
    if (phone) await page.getByRole('radio', { name: 'Compose' }).click();
    else await page.getByRole('radio', { name: 'Front' }).click();
    await page.waitForTimeout(300);
  };
  const canvasShare = async () =>
    stripeShare(page, await page.locator('.view.three canvas').screenshot());

  // 1. Bare app → New single piece → first Start from item → editor.
  await page.goto(url);
  await page.getByRole('button', { name: 'New single piece' }).click();
  await dlg.locator('.start-group .row-btn').first().click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await show3d();
  const before = await canvasShare();
  check(
    width,
    '3D before: no picture colours',
    before.red < 0.002 && before.blue < 0.002,
    JSON.stringify(before),
  );

  // 2. Materials → "Add a picture" on the body and front boards, found by visible text.
  await openMaterials();
  check(
    width,
    '"Add a picture" visible in Materials',
    await dlg.getByText('Add a picture').first().isVisible(),
  );
  for (const board of ['PAL 18 white', 'MDF 18 painted']) {
    await dlg.getByLabel(`Add a picture for ${board}`).setInputFiles(picture);
    await dlg.getByRole('img', { name: `Picture of ${board}` }).waitFor({ timeout: 10000 });
    check(
      width,
      `${board}: picture shown in Materials`,
      await dlg.getByRole('img', { name: `Picture of ${board}` }).isVisible(),
    );
  }
  check(
    width,
    '"One picture covers, along the grain" field visible',
    await dlg.getByText('One picture covers, along the grain').first().isVisible(),
  );
  check(
    width,
    '"Turn picture 90°" visible',
    await dlg.getByText('Turn picture 90°').first().isVisible(),
  );
  check(width, 'no sideways scroll (Materials)', await noSideScroll());
  await shot('dialog');

  // 3. A file that is not a picture: message, board keeps its picture, no crash.
  await dlg.getByLabel('Replace picture for PAL 18 white').setInputFiles(notPicture);
  const alert = dlg.getByRole('alert').filter({ hasText: 'could not be read as a picture' });
  await alert.waitFor({ timeout: 10000 }).catch(() => {});
  check(width, 'not a picture: message shown', await alert.isVisible());
  check(
    width,
    'not a picture: board keeps its picture',
    await dlg.getByRole('img', { name: 'Picture of PAL 18 white' }).isVisible(),
  );
  await closeDialog();

  // 4. 3D and front view show the picture.
  await page.waitForTimeout(1500);
  const after = await canvasShare();
  check(
    width,
    '3D shows the picture (red and blue stripes)',
    after.red > 0.02 && after.blue > 0.02,
    JSON.stringify(after),
  );
  await page.locator('.view.three canvas').screenshot({ path: `${out}/materials-3d-${width}.png` });
  await showFront();
  const patterned = await page
    .locator('figure.elevation polygon.el-panel')
    .evaluateAll((ps) => ps.filter((p) => p.style.fill.startsWith('url(')).length);
  check(width, 'front view fills boards with the picture', patterned > 0, `${patterned} parts`);
  // Measured over the boards only: on a phone the drawing area around the piece is larger (ADR-079).
  const boards = await page.locator('figure.elevation polygon.el-panel').evaluateAll((ps) => {
    const r = ps.map((p) => p.getBoundingClientRect());
    const x = Math.min(...r.map((b) => b.left)),
      y = Math.min(...r.map((b) => b.top));
    return {
      x,
      y,
      width: Math.max(...r.map((b) => b.right)) - x,
      height: Math.max(...r.map((b) => b.bottom)) - y,
    };
  });
  const frontShare = await stripeShare(page, await page.screenshot({ clip: boards }));
  check(
    width,
    'front view picture is drawn',
    frontShare.red > 0.01 && frontShare.blue > 0.01,
    JSON.stringify(frontShare),
  );
  await shot('front');

  // 5. Turn the picture: the 3D view changes and still shows it.
  await openMaterials();
  await dlg
    .locator('li')
    .filter({ hasText: 'Remove board' })
    .first()
    .getByText('Turn picture 90°')
    .click();
  await closeDialog();
  await show3d();
  const turned = await canvasShare();
  check(
    width,
    'turned picture still shown in 3D',
    turned.red > 0.02 && turned.blue > 0.02,
    JSON.stringify(turned),
  );

  // 6. Reload while offline: the picture comes back from this device.
  await page.waitForTimeout(1500); // autosave
  await ctx.setOffline(true);
  await page.reload();
  const home = page.getByRole('button', { name: 'New single piece' });
  if (await home.isVisible().catch(() => false)) {
    await page
      .locator('.row-btn')
      .filter({ hasText: /./ })
      .filter({ hasNotText: 'Mobila' })
      .first()
      .click();
  }
  await page.locator('main.work').waitFor({ state: 'visible' });
  await show3d();
  const offline = await canvasShare();
  check(
    width,
    'offline after reload: picture still in 3D',
    offline.red > 0.02 && offline.blue > 0.02,
    JSON.stringify(offline),
  );
  await openMaterials();
  check(
    width,
    'offline after reload: picture listed in Materials',
    await dlg.getByRole('img', { name: 'Picture of PAL 18 white' }).isVisible(),
  );
  await closeDialog();
  await ctx.setOffline(false);

  // 6b. Labels: Egger + Kitchen worktop on PAL 18 white; shown in the board choices; worktop warning in Checks.
  await openMaterials();
  const palRow = dlg
    .locator('li')
    .filter({ has: page.getByRole('img', { name: 'Picture of PAL 18 white' }) });
  await palRow.getByLabel('Manufacturer').selectOption({ label: 'Egger' });
  await palRow.getByLabel('Type', { exact: true }).selectOption({ label: 'Kitchen worktop' });
  check(
    width,
    'labels: Manufacturer and Type found and set',
    (await palRow.getByLabel('Manufacturer').inputValue()) === 'egger' &&
      (await palRow.getByLabel('Type', { exact: true }).inputValue()) === 'worktop',
  );
  check(
    width,
    'decor list: none yet, import offered',
    (await dlg.getByText(/Decor list: none/).isVisible()) &&
      (await dlg.getByText('Import decor list (CSV)').isVisible()),
  );
  check(
    width,
    'decor choice hidden without a list',
    (await dlg.getByLabel('Decor from your list').count()) === 0,
  );

  // 6c. Import the user's decor list: 2 decors, 1 bad row listed; choose a decor on MDF 18 painted.
  await dlg.getByLabel('Import decor list (CSV)').setInputFiles(decorCsv);
  await dlg
    .getByText(/2 decors imported from my-decors.csv/)
    .waitFor({ timeout: 5000 })
    .catch(() => {});
  check(
    width,
    'decor list imported, bad row reported',
    await dlg
      .getByText(/2 decors imported from my-decors.csv\. 1 row skipped: Row 4: color "white"/)
      .isVisible(),
  );
  const mdfRow = dlg
    .locator('li')
    .filter({ has: page.getByRole('img', { name: 'Picture of MDF 18 painted' }) });
  await mdfRow
    .getByLabel('Decor from your list')
    .selectOption({ label: 'Egger H1145 Bardolino Oak, 18 mm' });
  await page.waitForTimeout(300);
  check(
    width,
    'decor chosen: board renamed from the list',
    await dlg
      .locator('input.mat-name')
      .evaluateAll((xs) => xs.some((x) => x.value === 'Egger H1145 Bardolino Oak')),
  );
  // The board choices sit in Settings with the boards since ADR-080.
  const boardChoices = await dlg.locator('select option').allInnerTexts();
  await closeDialog();
  check(
    width,
    'board choices show labels',
    boardChoices.includes('PAL 18 white · Egger, Kitchen worktop') &&
      boardChoices.includes('Egger H1145 Bardolino Oak · Egger, PAL'),
  );
  {
    const t = page.getByRole('tab', { name: /Checks/ });
    if ((await t.getAttribute('aria-selected')) !== 'true') await t.dispatchEvent('click');
  }
  check(
    width,
    'worktop board on other parts: guidance warning',
    await page
      .getByText(/PAL 18 white is labelled kitchen worktop but is used for .*\(guidance\)/)
      .first()
      .isVisible(),
  );

  // 6d. Export the design file: pictures inside. Open it on "another device" (fresh browser): pictures shown.
  await page.waitForTimeout(1200);
  // ⋯ More › Files › Design file (ADR-078).
  const files = await moreMenu();
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    files.getByRole('button', { name: /Design file/ }).click(),
  ]);
  const filePath = `${out}/exported-${width}.json`;
  await dl.saveAs(filePath);
  const exported = JSON.parse(readFileSync(filePath, 'utf8'));
  check(
    width,
    'exported design file carries its pictures',
    Array.isArray(exported.pictures) && exported.pictures.length === 2,
    `${exported.pictures?.length} pictures`,
  );
  const other = await browser.newContext({ viewport: { width, height: phone ? 812 : 900 } });
  const op = await other.newPage();
  op.on('pageerror', (e) => errors.push(`other device: ${e.message}`));
  await op.goto(url);
  // The bare app opens on Projects, which has "Import a file" (ADR-078).
  await op.locator('main.projects-page input[type=file]').first().setInputFiles(filePath);
  await op.locator('main.work').waitFor({ state: 'visible' });
  await show3d(op);
  // A page screenshot clipped to the canvas: the import notice above it can move the element while it is taken.
  const there = await stripeShare(
    op,
    await op.screenshot({ clip: await op.locator('.view.three canvas').boundingBox() }),
  );
  check(
    width,
    'other device: imported file shows the pictures in 3D',
    there.red > 0.02 && there.blue > 0.02,
    JSON.stringify(there),
  );
  await other.close();

  // 6e. Replace a picture (the old one is now unused), then ⋯ More › Clean up unused pictures (G-059).
  await openMaterials();
  await dlg.getByLabel('Replace picture for PAL 18 white').setInputFiles(picture);
  await page.waitForTimeout(1500);
  await closeDialog();
  await page.waitForTimeout(1200); // autosave
  await (await moreMenu()).getByRole('button', { name: /Clean up unused pictures/ }).click();
  const confirmDlg = page
    .locator('dialog[open]')
    .filter({ hasText: /Delete 1 picture that no saved piece/ });
  await confirmDlg.waitFor({ timeout: 5000 }).catch(() => {});
  check(
    width,
    'cleanup asks before deleting 1 unused picture',
    await confirmDlg.isVisible().catch(() => false),
  );
  await confirmDlg.getByRole('button', { name: 'Delete pictures' }).click();
  check(
    width,
    'cleanup: 1 unused picture deleted',
    await page.getByText('1 unused picture deleted.').isVisible(),
  );
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.reload();
  if (
    await page
      .getByRole('button', { name: 'New single piece' })
      .isVisible()
      .catch(() => false)
  ) {
    await page.locator('.row-btn').filter({ hasNotText: 'Mobila' }).first().click();
  }
  await page.locator('main.work').waitFor({ state: 'visible' });
  await show3d();
  const kept = await canvasShare();
  check(
    width,
    'after cleanup: pictures in use still shown',
    kept.red > 0.02 && kept.blue > 0.02,
    JSON.stringify(kept),
  );

  // 7. Remove the picture: plain colour again.
  await openMaterials();
  await dlg
    .locator('li')
    .filter({ has: page.getByRole('img', { name: 'Picture of PAL 18 white' }) })
    .getByRole('button', { name: 'Remove picture' })
    .click();
  await dlg
    .locator('li')
    .filter({ has: page.getByRole('img', { name: 'Picture of Egger H1145 Bardolino Oak' }) })
    .getByRole('button', { name: 'Remove picture' })
    .click();
  check(
    width,
    'picture removed: "Add a picture" back',
    (await dlg.getByLabel('Add a picture for PAL 18 white').count()) === 1,
  );
  await closeDialog();
  await page.waitForTimeout(1000);
  const plain = await canvasShare();
  check(
    width,
    'picture removed: 3D shows no picture',
    plain.red < 0.002 && plain.blue < 0.002,
    JSON.stringify(plain),
  );

  check(width, 'no requests leave the device', remote.length === 0, remote.slice(0, 3).join(' '));
  check(width, 'no page errors', errors.length === 0, errors.join(' / '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
