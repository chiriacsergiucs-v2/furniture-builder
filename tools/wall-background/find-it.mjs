// Find-it acceptance for wall backgrounds (CLAUDE.md R3, backlog N146, ADR-145), run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/wall-background/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text: a new project gets a room; Settings ›
// Room › "Wall 1 background" › Picture takes a picture from the device ("Add a picture for Wall 1"), sized by
// "One picture covers, width/height" (hint "Set the real size"); Wall 4 gets a Colour. The 3D view shows the picture
// and the colour on the walls; "Solid walls" makes them opaque; the front view fills the back wall behind the piece.
// Not part of `pnpm test`.
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
// Share of pixels in a PNG that pass `test` ('blue': blue well above red; 'green': green well above red and blue),
// counted in the page. Hue tests, so the 3D lighting may darken or lighten the colour.
const share = (page, png, test) =>
  page.evaluate(
    async ({ data, test }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${data}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      const px = x.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < px.length; i += 4) {
        const [r, g, b] = [px[i], px[i + 1], px[i + 2]];
        if (test === 'blue' ? b - r > 50 : g - r > 15 && g - b > 15) n++;
      }
      return n / (px.length / 4);
    },
    { data: png.toString('base64'), test },
  );

for (const width of [1280, 390]) {
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
  const btn = (name) => page.getByRole('button', { name, exact: true });
  const dlg = page.locator('dialog[open]');
  const click = async (loc) => {
    await loc.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
    await loc.click({ timeout: 5000 });
  };
  const sheet = async (open) => {
    const peek = page.locator('.sheet-peek');
    if (phone && (await peek.isVisible().catch(() => false)))
      if ((await peek.getAttribute('aria-expanded')) === String(!open)) await peek.click();
    await page.waitForTimeout(200);
  };
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

  await page.goto(url);
  await click(btn('Create a new project'));
  await click(btn('Create project'));
  await sheet(true);
  await click(btn('Add a piece'));
  await dlg.getByRole('searchbox', { name: 'Search the items' }).fill('Sideboard');
  await dlg.locator('.start-group .row-btn').first().click();
  await dlg.waitFor({ state: 'detached' }).catch(() => {});
  if (await btn('Place to the right').isVisible()) await click(btn('Place to the right'));
  await sheet(true);
  await click(btn('Add the room'));
  await sheet(true);

  // Room editor: Wall 1 → Picture.
  const bg1 = page.getByLabel('Wall 1 background', { exact: true });
  await bg1.scrollIntoViewIfNeeded();
  check(width, 'Settings › Room shows "Wall 1 background"', await bg1.isVisible());
  await bg1.selectOption({ label: 'Picture' });
  const tilePng = Buffer.from(
    (
      await page.evaluate(() => {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const x = c.getContext('2d');
        x.fillStyle = '#f0ece4';
        x.fillRect(0, 0, 64, 64);
        x.fillStyle = '#4682a0';
        x.fillRect(2, 2, 60, 60);
        return c.toDataURL('image/png');
      })
    ).split(',')[1],
    'base64',
  );
  await page
    .getByLabel('Add a picture for Wall 1')
    .setInputFiles({ name: 'tiles.png', mimeType: 'image/png', buffer: tilePng });
  const thumb = page.getByRole('img', { name: 'Picture on Wall 1' });
  await thumb.waitFor({ timeout: 8000 }).catch(() => {});
  check(width, 'the picked picture shows next to "Replace picture"', await thumb.isVisible());
  const tw = page.getByLabel('One picture covers, width', { exact: true }).first();
  check(
    width,
    'one copy starts 1000 mm wide, with the hint "Set the real size"',
    (await tw.inputValue()) === '1000' && (await page.getByText('Set the real size').isVisible()),
    await tw.inputValue(),
  );
  await tw.fill('300');
  await tw.press('Enter');
  const th = page.getByLabel('One picture covers, height', { exact: true }).first();
  await th.fill('300');
  await th.press('Enter');
  // Wall 4 (the left wall, seen from the starting 3D view) → Colour.
  const bg4 = page.getByLabel('Wall 4 background', { exact: true });
  await bg4.selectOption({ label: 'Colour' });
  const col = page.getByLabel('Wall 4 colour');
  check(width, 'Wall 4 background › Colour shows "Wall 4 colour"', await col.isVisible());
  await col.fill('#4f9a3a');
  check(width, 'no horizontal page scroll with the room editor open', await noSideScroll());
  await page.screenshot({ path: `${out}/wall-background-editor-${width}.png` });

  // Front view: the back wall's picture fills behind the piece.
  await sheet(false);
  const front = page.getByRole('figure', { name: /Room seen from the front/ });
  await front.scrollIntoViewIfNeeded().catch(() => {});
  const fill = await front
    .locator('g.room-wall-bg rect')
    .first()
    .evaluate((e) => e.style.fill)
    .catch(() => '');
  check(width, 'the front view fills the back wall with its picture', /url\(/.test(fill), fill);
  await front.screenshot({ path: `${out}/wall-background-front-${width}.png` });

  // 3D: Build & Preview on a phone, the 3D view switch on both.
  const build = page.getByRole('radio', { name: /Build & Preview/ });
  if (await build.isVisible().catch(() => false)) await build.click();
  await page.getByRole('radio', { name: '3D', exact: true }).click();
  const canvas = page.locator('canvas').first();
  await page.waitForTimeout(2500);
  const solid = btn('Solid walls');
  check(
    width,
    '"Solid walls" is in the 3D toolbar, off at first',
    (await solid.getAttribute('aria-pressed')) === 'false',
  );
  const before = await canvas.screenshot({ path: `${out}/wall-background-3d-${width}.png` });
  const blue0 = await share(page, before, 'blue');
  await click(solid);
  await page.waitForTimeout(1500);
  const after = await canvas.screenshot({ path: `${out}/wall-background-3d-solid-${width}.png` });
  const blue1 = await share(page, after, 'blue');
  const green = await share(page, after, 'green');
  check(
    width,
    'Solid walls: the tile picture shows on Wall 1 in 3D, stronger than see-through',
    (await solid.getAttribute('aria-pressed')) === 'true' && blue1 > 0.05 && blue1 >= blue0,
    `${(blue0 * 100).toFixed(1)}% → ${(blue1 * 100).toFixed(1)}%`,
  );
  check(width, 'Wall 4 shows its colour in 3D', green > 0.02, `${(green * 100).toFixed(1)}%`);
  check(width, 'no horizontal page scroll in 3D', await noSideScroll());
  check(width, 'no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
