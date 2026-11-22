// Find-it acceptance for the UI review fixes of 2026-11-23 (backlog N379, PR "UI review fixes: all departments"), run
// against a production build:
//   pnpm build && pnpm preview &  node tools/ui-review/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at 390 px (touch) and 1280 px (mouse) and finds each fix by role and visible text:
// the Catalog search shows a focus ring (A-1), the Information groups are 44 px tall on touch (A-2), the phone canvas
// keeps "Add a piece to the project" while a piece is selected (B-1), the 3D view region is named (B-4) and the
// optimizer's "Grain locked" toggle is 44 px tall on touch (C-4). Not part of `pnpm test`.
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
const height = async (loc) => (await loc.boundingBox())?.height ?? 0;

for (const width of [390, 1280]) {
  const phone = width < 500;
  const ctx = await browser.newContext({
    viewport: { width, height: phone ? 812 : 900 },
    hasTouch: phone,
    isMobile: phone,
  });
  // The first-run canvas hints dialog would cover the canvas at 390 px.
  await ctx.addInitScript(() => localStorage.setItem('fb:canvas-coach', 'done'));
  const page = await ctx.newPage();
  const places = page.getByRole('navigation', { name: 'Places' });
  const more = async (item) => {
    await page.locator('summary[aria-label="More"]').first().click();
    await page.getByRole('button', { name: item }).first().click({ timeout: 5000 });
    await page.waitForTimeout(400);
  };
  await page.goto(url, { waitUntil: 'networkidle' });

  // A-1: the Catalog search shows a focus ring.
  await places
    .getByRole('link', { name: /^Catalog/ })
    .first()
    .click();
  const search = page.getByRole('searchbox', { name: 'Search the catalog' }).first();
  await search.focus();
  const ring = await search.evaluate((e) => {
    const box = e.closest('.search');
    return box ? getComputedStyle(box).outlineStyle : 'no .search box';
  });
  check(`${width}px Catalog search shows a focus ring`, ring !== 'none', `outline-style ${ring}`);

  // A-2: the Information page groups, 44 px tall on touch.
  await more(/^Information and guides/);
  const group = page.locator('.info-domain > summary').first();
  await group.waitFor({ state: 'visible', timeout: 5000 });
  const gh = await height(group);
  check(
    `${width}px Information group "${(await group.innerText()).split('\n')[0]}" height`,
    phone ? gh >= 44 : gh > 0,
    `${gh} px`,
  );
  await page.keyboard.press('Escape');

  // C-4: the optimizer's "Grain locked" toggle.
  await page.goto(url, { waitUntil: 'networkidle' });
  await more(/^Cut list optimizer/);
  const grain = page.locator('label', { hasText: 'Grain locked' }).first();
  await grain.waitFor({ state: 'visible', timeout: 5000 });
  const grh = await height(grain);
  check(`${width}px "Grain locked" toggle height`, phone ? grh >= 44 : grh > 0, `${grh} px`);

  // B-1 and B-4: a project with one base cabinet.
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Create a new project', exact: true }).click();
  await page.locator('dialog[open] input').fill('UI review');
  await page.locator('dialog[open]').getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await page
    .getByRole('button', { name: /^Add a piece( to the project)?$/ })
    .first()
    .click();
  const dlg = page.locator('dialog[open]');
  await dlg.getByRole('searchbox', { name: 'Search the items' }).fill('Base cabinet');
  await dlg.locator('.start-group .row-btn').first().click();
  await page.waitForTimeout(600);
  const placeRight = page.getByRole('button', { name: 'Place to the right' });
  if (await placeRight.isVisible().catch(() => false)) await placeRight.click();
  await page.waitForTimeout(400);
  if (phone) {
    const edit = page.getByRole('button', { name: /^Edit Base cabinet/ }).first();
    const add = page.getByRole('button', { name: 'Add a piece to the project' }).first();
    check(
      '390px a piece is selected (its Edit chip shows)',
      await edit.isVisible().catch(() => false),
    );
    check(
      '390px "Add a piece to the project" stays on the chip rail while a piece is selected',
      await add.isVisible().catch(() => false),
    );
    await page.screenshot({ path: `${out}/ui-review-selected-390.png` });
  }
  // The 3D view is out of the accessibility tree until it is shown; without WebGL the radio is disabled, so the
  // wrapper's own role and name are read instead.
  await page.keyboard.press('Escape');
  const radio = page.getByRole('radio', { name: '3D', exact: true }).first();
  if (await radio.isEnabled().catch(() => false)) {
    await radio.click();
    await page.waitForTimeout(800);
    const three = page.getByRole('region', { name: '3D view' });
    check(`${width}px the 3D view region is named "3D view"`, (await three.count()) > 0);
  } else {
    const wrap = page.locator('.view.three').first();
    const [role, label] = [await wrap.getAttribute('role'), await wrap.getAttribute('aria-label')];
    check(
      `${width}px the 3D view wrapper is a region named "3D view" (no WebGL)`,
      role === 'region' && label === '3D view',
      `${role} / ${label}`,
    );
  }
  await ctx.close();
}

await browser.close();
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exit(failed ? 1 : 0);
