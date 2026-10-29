// Find-it acceptance for the one-tap Move to actions (CLAUDE.md R3, backlog N148, ADR-147), run against a production
// build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/move-to/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text: a project with two base cabinets and
// the room, the selected piece's Position group, the "Move to" buttons (To wall … Align front →), an off button saying
// why when tapped, **To ceiling** making the piece wall-hung under the ceiling, one **Undo** putting it back, and in the
// 3D view with **Move** on, **Move to…** showing the same buttons, where **To ceiling** and **Down** move the piece.
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
const LABELS = [
  'To wall',
  'To left piece',
  'To right piece',
  'Into corner',
  'Centre',
  'To ceiling',
  'Down',
  'Align top ←',
  'Align top →',
  'Align front ←',
  'Align front →',
];

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
  const shot = (name) => page.screenshot({ path: `${out}/move-to-${name}-${width}.png` });
  const dlg = page.locator('dialog[open]');
  const btn = (name, exact = true) => page.getByRole('button', { name, exact });
  const click = async (loc) => {
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    await loc.click({ timeout: 3000 }).catch(() => loc.dispatchEvent('click'));
  };
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  // On a phone the project's pieces sit in the Compose sheet: open it to read or tap, close it to see the view.
  const sheet = async (open) => {
    const peek = page.locator('.sheet-peek');
    if (!(await peek.isVisible().catch(() => false))) return;
    if (((await peek.getAttribute('aria-expanded')) === 'true') !== open) await peek.click();
    await page.waitForTimeout(200);
  };
  const addBase = async () => {
    await sheet(true);
    await click(btn('Add a piece'));
    await dlg.getByRole('searchbox', { name: 'Search the items' }).fill('Base cabinet');
    await dlg.locator('.start-group .row-btn').first().click();
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
    const place = btn('Place to the right');
    await place.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
    if (await place.isVisible()) await click(place);
    await page.waitForTimeout(150);
  };
  const openPosition = async () => {
    const s = page
      .locator('details.group > summary')
      .filter({ hasText: /^Position$/ })
      .first();
    if ((await s.isVisible()) && !(await s.evaluate((el) => el.parentElement.open))) await click(s);
  };
  const panel = page.getByRole('group', { name: 'Move to' }).first();
  /** The selected piece's "Placed" choice and underside height, read from the Position group. */
  const placed = async () => {
    await sheet(true);
    await openPosition();
    const kind = (
      (await page
        .getByRole('radiogroup', { name: 'Placed' })
        .getByRole('radio', { checked: true })
        .textContent({ timeout: 3000 })
        .catch(() => '')) ?? ''
    ).trim();
    const field = page.getByLabel('Underside above the floor', { exact: true }).first();
    const y = (await field.isVisible().catch(() => false)) ? Number(await field.inputValue()) : 0;
    return { kind, y };
  };

  // 1. Bare app → new project → two base cabinets → the room.
  await page.goto(url);
  await click(btn('Create a new project'));
  await page.locator('dialog[open] input').fill(`Move to ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await addBase();
  await addBase();
  await sheet(true);
  const room = page.getByRole('region', { name: 'Room' });
  await click(room.getByRole('button', { name: 'Add the room' }));
  await page.waitForTimeout(300);

  // 2. The panel's Move to buttons.
  await openPosition();
  await panel.scrollIntoViewIfNeeded().catch(() => {});
  check(width, 'a "Move to" group is in the piece panel', await panel.isVisible());
  const found = [];
  for (const l of LABELS)
    if (await panel.getByRole('button', { name: l, exact: true }).isVisible()) found.push(l);
  check(width, 'all 11 Move to buttons are there', found.length === 11, found.join(', '));

  // 3. An off button says why when tapped: the new piece touches the one on its left.
  await click(panel.getByRole('button', { name: 'To left piece', exact: true }));
  await page.waitForTimeout(200);
  const why = panel.getByRole('status');
  const whyText = (await why.textContent().catch(() => '')) ?? '';
  check(
    width,
    'tapping an off button says why',
    /^To left piece: Already touching /.test(whyText),
    whyText,
  );
  await shot('panel');

  // 4. To ceiling: wall-hung with its top at the ceiling; Undo puts it back.
  const start = await placed();
  await click(panel.getByRole('button', { name: 'To ceiling', exact: true }));
  await page.waitForTimeout(300);
  const up = await placed();
  check(
    width,
    'To ceiling hangs it on the wall at 2500 − 820 mm',
    up.kind === 'Wall' && up.y === 1680,
    `${start.kind} → ${up.kind} at ${up.y}`,
  );
  await shot('ceiling');
  await click(btn('Undo'));
  await page.waitForTimeout(300);
  const undone = await placed();
  check(width, 'one Undo puts it back on the floor', undone.kind === 'Floor', undone.kind);
  check(width, 'no sideways scroll (panel)', await noSideScroll());

  // 5. The 3D view: Move on → Move to… → the same buttons; To ceiling and Down move the piece.
  await sheet(false);
  await page.getByRole('radio', { name: '3D', exact: true }).first().click();
  const canvas = page.locator('.view.three canvas');
  await canvas.waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(1200);
  const tools = page.getByRole('toolbar', { name: 'Place pieces in 3D' });
  await click(tools.getByRole('button', { name: 'Move', exact: true }));
  const open3d = tools.getByRole('button', { name: 'Move to…', exact: true });
  check(width, '"Move to…" shows over the 3D view in Move mode', await open3d.isVisible());
  await click(open3d);
  const three = tools.getByRole('group', { name: 'Move to' });
  check(
    width,
    'Move to… opens the same buttons over the 3D view',
    (await three.getByRole('button').count()) === 11,
  );
  await click(three.getByRole('button', { name: 'To ceiling', exact: true }));
  await page.waitForTimeout(400);
  await shot('three-ceiling');
  const up3d = await placed();
  check(width, 'To ceiling in 3D hangs it on the wall', up3d.kind === 'Wall', up3d.kind);
  await sheet(false);
  if (!(await three.isVisible().catch(() => false))) {
    await click(open3d);
  }
  await click(three.getByRole('button', { name: 'Down', exact: true }));
  await page.waitForTimeout(400);
  await shot('three-down');
  const down3d = await placed();
  check(width, 'Down in 3D puts it back on the floor', down3d.kind === 'Floor', down3d.kind);

  check(width, 'no sideways scroll', await noSideScroll());
  check(width, 'no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
