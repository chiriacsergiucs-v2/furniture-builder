// Find-it acceptance for ADR-209 (kitchen run follow-ups, backlog N214), run against a production build:
//   pnpm build && pnpm preview --port 4309 &  node tools/kitchen-follow-ups/find-it.mjs http://localhost:4309/furniture-builder/ <out dir>
// Starts from the bare app at 390 and 1280 px and finds everything by role and visible text: Settings › Run parts —
// Add trim… with a Moulding profile, a Ceiling filler, the worktop's Edge profile, the ƒ buttons by the overhangs, a
// sink's From left / From front; the 3D view with the ceiling filler and a picked problem's box ("After repair");
// Fasteners in project Settings; Parts with "Guidance: drilling positions from your values". Screenshots go to the out
// dir. Not part of `pnpm test`.
import { launchBrowser, previewUrl, outDir } from '../lib/harness.mjs';
import { goBuild, goCompose } from '../lib/steps.mjs';
import { mkdirSync } from 'node:fs';

const url = previewUrl('http://localhost:4309/furniture-builder/');
const out = outDir();
mkdirSync(out, { recursive: true });
const browser = await launchBrowser();
const results = [];
const check = (width, name, ok, detail = '') => {
  results.push({ width, name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${width}px ${name}${detail ? ` — ${detail}` : ''}`);
};
const flat = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

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
  const btn = (name, exact = true) => page.getByRole('button', { name, exact });
  const dlg = page.locator('dialog[open]');
  const click = async (l) => {
    await l.scrollIntoViewIfNeeded();
    await l.click({ timeout: 10000 });
  };
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const shot = (name) =>
    page.screenshot({ path: `${out}/kitchen-follow-ups-${name}-${width}.png`, fullPage: false });
  const openSheet = async () => {
    const peek = page.locator('.sheet-peek');
    if ((await peek.isVisible()) && (await peek.getAttribute('aria-expanded')) === 'false')
      await peek.click();
  };
  const addPiece = async (search) => {
    await openSheet();
    await click(btn('Add a piece'));
    await dlg.getByRole('searchbox', { name: 'Search the items' }).fill(search);
    await dlg.locator('.start-group .row-btn').first().click();
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
    if (await btn('Place to the right').isVisible()) await click(btn('Place to the right'));
    await page.waitForTimeout(150);
  };
  const settingsOpen = async () => {
    await click(page.getByRole('button', { name: 'Settings', exact: true }));
    await dlg.getByRole('heading', { name: /^Settings: / }).waitFor();
  };
  const done = async () => {
    await click(dlg.getByRole('button', { name: 'Done', exact: true }));
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
  };

  // 1. Bare app → new project → the room, two base cabinets and two wall cabinets side by side.
  await page.goto(url);
  await click(btn('Create a new project'));
  await page.locator('dialog[open] input').fill(`Kitchen ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await openSheet();
  const addRoom = page.getByRole('region', { name: 'Room' }).getByRole('button', {
    name: 'Add the room',
  });
  await click(addRoom);
  await page.waitForTimeout(200);
  for (const s of ['Base cabinet', 'Base cabinet', 'Wall cabinet', 'Wall cabinet'])
    await addPiece(s);

  // 2. Settings: a variable "lip" = 30 for the overhang; Run parts: Suggest run parts.
  await settingsOpen();
  await dlg.getByLabel('New variable', { exact: true }).fill('lip');
  await dlg.getByLabel('Value or formula', { exact: true }).fill('30');
  await click(dlg.getByRole('button', { name: 'Add variable', exact: true }));
  const runParts = dlg.getByRole('region', { name: 'Run parts' });
  await click(runParts.getByRole('button', { name: /Suggest run parts/ }));
  await page.waitForTimeout(200);
  const list = runParts.locator('ul.run-list');
  const row = (text) => list.locator(':scope > li', { hasText: text }).first();

  // 3. Add trim… → Crown → Moulding profile typed; the strip takes the profile's size, no height needed.
  await click(runParts.getByRole('button', { name: 'Add trim…' }));
  const trim = runParts.getByRole('group', { name: 'Add a trim' });
  await click(trim.getByRole('radio', { name: 'Crown' }));
  const profile = trim.getByRole('textbox', { name: 'Moulding profile' });
  check(width, 'Add trim… has "Moulding profile"', await profile.isVisible());
  check(
    width,
    'the profile has a drawing to tap points on',
    await trim.getByRole('img', { name: /Moulding profile drawing/ }).isVisible(),
  );
  const boxes = trim.locator('fieldset.run-pick').getByRole('checkbox');
  for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).check();
  await profile.fill('0,0; 20,0; 20,45; 0,60');
  await profile.press('Enter');
  check(
    width,
    'the profile says "Profile 20 × 60 mm: the strip takes this size."',
    await trim.getByText('Profile 20 × 60 mm: the strip takes this size.').isVisible(),
  );
  await shot('profile');
  await click(trim.getByRole('button', { name: 'Add trim', exact: true }));
  await page.waitForTimeout(200);
  const crownText = flat(await row('Crown').innerText());
  check(width, 'the Crown is listed 60 high and 20 deep', /× 60 × 20\b/.test(crownText), crownText);

  // 4. The ceiling-filler path: the room has a height, so it closes the gap up to the ceiling.
  await click(runParts.getByRole('button', { name: 'Add trim…' }));
  const trim2 = runParts.getByRole('group', { name: 'Add a trim' });
  await click(trim2.getByRole('radio', { name: 'Ceiling filler' }));
  check(
    width,
    'Ceiling filler goes "up to the room height"',
    await trim2.getByText(/^From the top of the units up to the room height/).isVisible(),
  );
  const boxes2 = trim2.locator('fieldset.run-pick').getByRole('checkbox');
  for (let i = 0; i < (await boxes2.count()); i++) await boxes2.nth(i).check();
  await click(trim2.getByRole('button', { name: 'Add trim', exact: true }));
  await page.waitForTimeout(200);
  check(width, 'a Ceiling filler is listed in Run parts', await row('Ceiling filler').isVisible());

  // 5. The worktop: Edge profile Rounded, Edge size 10 mm; ƒ next to the overhangs binds the front one to "lip".
  const edge = row('Worktop').getByRole('radiogroup', { name: 'Edge profile' });
  check(
    width,
    'the worktop has "Edge profile": Square, Rounded, Bevelled',
    (await edge.isVisible()) &&
      (await edge.getByRole('radio', { name: 'Bevelled' }).count()) === 1 &&
      (await edge.getByRole('radio', { name: 'Square' }).isChecked()),
  );
  await click(edge.getByRole('radio', { name: 'Rounded' }));
  const size = row('Worktop').getByRole('textbox', { name: 'Edge size (mm)' });
  check(width, 'Rounded asks for "Edge size (mm)"', await size.isVisible());
  await size.fill('10');
  await size.press('Tab');
  await page.waitForTimeout(150);
  await click(row('Worktop').getByRole('button', { name: /^Overhang: 20 mm front/ }));
  const fFront = row('Worktop').getByRole('button', { name: 'Bind Front overhang to a variable' });
  const fSide = row('Worktop').getByRole('button', { name: 'Bind Side overhang to a variable' });
  check(
    width,
    'ƒ buttons next to both overhangs',
    (await fFront.isVisible()) && (await fSide.isVisible()),
  );
  await click(fFront);
  const bind = page.getByRole('dialog', { name: 'Bind Front overhang' });
  await click(bind.getByRole('button', { name: /^lip = 30/ }));
  await click(bind.getByRole('button', { name: 'Bind', exact: true }));
  await page.waitForTimeout(200);
  const wtText = flat(await row('Worktop').innerText());
  check(
    width,
    'the front overhang follows "lip" (30 mm)',
    /lip = 30/.test(wtText) && /overhang 30 mm front/.test(wtText),
    wtText,
  );

  // 6. A sink: From left and From front, empty = centred.
  await click(runParts.getByRole('button', { name: 'Add sink…' }));
  const sg = runParts.getByRole('group', { name: 'Sink over a base unit' });
  await sg.getByRole('textbox', { name: 'Cut-out width' }).fill('500');
  await sg.getByRole('textbox', { name: 'Cut-out depth' }).fill('400');
  await click(sg.getByRole('button', { name: 'Add sink', exact: true }));
  await page.waitForTimeout(200);
  const left = runParts.getByRole('textbox', { name: 'From left' });
  const front = runParts.getByRole('textbox', { name: 'From front' });
  check(
    width,
    '"From left" and "From front" fields, placeholder "centred"',
    (await left.isVisible()) &&
      (await front.isVisible()) &&
      (await left.getAttribute('placeholder')) === 'centred',
  );
  await left.fill('40');
  await left.press('Enter');
  await front.fill('60');
  await front.press('Enter');
  await page.waitForTimeout(150);
  await shot('run-parts');
  check(width, 'no sideways scroll (Run parts)', await noSideScroll());

  // 7. Fasteners in project Settings: "From each end (mm)", labelled guidance.
  const fastSummary = dlg.locator('summary', { hasText: /^Fasteners$/ });
  check(width, 'project Settings shows "Fasteners"', await fastSummary.isVisible());
  await click(fastSummary);
  await dlg
    .getByRole('textbox', { name: 'Carcass joint: your fastener' })
    .fill('Confirmat (my choice)');
  await dlg.getByRole('textbox', { name: 'Carcass joint: your fastener' }).press('Tab');
  const edgeField = dlg.getByRole('textbox', { name: 'From each end (mm)' });
  check(width, 'Fasteners has "From each end (mm)"', await edgeField.isVisible());
  check(
    width,
    'it is labelled guidance with no diameter, depth or screw given',
    await dlg
      .getByText(
        /^Guidance: with your fastener named and this typed, Parts shows drilling positions/,
      )
      .isVisible(),
  );
  await edgeField.fill('50');
  await edgeField.press('Tab');
  await page.waitForTimeout(150);
  await shot('fasteners');
  await done();

  // 8. The 3D view: the ceiling filler, the shaped crown and the holed, rounded worktop are drawn.
  const three = page.getByRole('radio', { name: '3D', exact: true });
  if (await three.isVisible().catch(() => false)) await click(three);
  else await goBuild(page);
  const canvas = page.locator('.view.three canvas');
  await canvas.waitFor({ timeout: 20000 }).catch(() => {});
  check(width, 'the 3D view is drawn', await canvas.isVisible());
  await page.waitForTimeout(1500);
  await canvas.screenshot({ path: `${out}/kitchen-follow-ups-3d-${width}.png` }).catch(() => {});

  // 9. A problem picked under Checks is drawn in 3D: its box and the chosen repair's "After repair" outline.
  const plan2d = page.getByRole('radio', { name: '2D', exact: true });
  if (await plan2d.isVisible().catch(() => false)) await click(plan2d);
  else await goCompose(page);
  const plan = page.getByRole('figure', { name: /Room plan, seen from above/ });
  const bases = plan.getByRole('button', { name: /^Base cabinet.*, \d+ by \d+ mm$/ });
  await bases.nth(1).focus();
  await page.keyboard.press('Shift+ArrowLeft');
  await page.waitForTimeout(300);
  const checksTab = page.getByRole('tab', { name: /Checks/ });
  if (!(await checksTab.isVisible().catch(() => false))) await goBuild(page);
  if ((await checksTab.getAttribute('aria-selected')) !== 'true') await click(checksTab);
  const item = page.locator('.checks button', { hasText: /overlap by \d+ mm/ }).first();
  check(width, 'Checks lists the overlap', await item.isVisible());
  await click(item);
  await page.waitForTimeout(300);
  const banner = page.getByRole('region', { name: 'Problem and repairs' });
  const bannerText = flat(await banner.innerText().catch(() => ''));
  check(
    width,
    'the plan shows "Problem and repairs" with a repair',
    /Move /.test(bannerText),
    bannerText,
  );
  // The 3D view opens with the problem already picked (the case that lost the label before the fix).
  if (await three.isVisible().catch(() => false)) await click(three);
  await canvas.waitFor({ timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const after3d = page.locator('.view.three .repair-preview-3d', { hasText: 'After repair' });
  await after3d
    .first()
    // A loaded machine can take longer than 5 s to place the 3D label (seen 2026-11-10: present, not yet shown).
    .waitFor({ state: 'visible', timeout: 15000 })
    .catch(() => {});
  check(
    width,
    'the problem and its repair are drawn in 3D ("After repair")',
    (await after3d.count()) > 0 && (await after3d.first().isVisible()),
    `${await after3d.count()} label(s)`,
  );
  await page
    .locator('.view.three')
    .screenshot({ path: `${out}/kitchen-follow-ups-problem-3d-${width}.png` })
    .catch(() => {});
  // Put the piece back (one undo), so the parts below are the kitchen's.
  await btn('Undo').click();
  await page.waitForTimeout(300);

  // 10. Build & Preview › Parts: the drilling guidance and the notes of the new parts.
  await goBuild(page);
  const partsTab = page.getByRole('tab', { name: /^Parts/ });
  if ((await partsTab.getAttribute('aria-selected')) !== 'true') await click(partsTab);
  await page.waitForTimeout(300);
  const guidance = page.getByText('Guidance: drilling positions from your values').first();
  await guidance.scrollIntoViewIfNeeded().catch(() => {});
  check(
    width,
    'Parts shows "Guidance: drilling positions from your values"',
    await guidance.isVisible(),
  );
  check(
    width,
    'Parts draws the drilling dots on the part outline',
    (await page.locator('.fixing-sketch circle.dot').count()) > 0,
  );
  const body = flat(await page.locator('body').innerText());
  for (const [what, re] of [
    ['the rounded edge note', /rounded edge R10 mm/],
    ['the profile note', /profile 20 × 60 mm, drawn by you/],
    ['the placed sink note', /sink cut-out 500 × 400 mm at 40 mm from left and 60 mm from front/],
    ['the Ceiling filler row', /Run: Ceiling filler/],
  ])
    check(width, `Parts has ${what}`, re.test(body));
  await shot('parts');
  check(width, 'no sideways scroll (Parts)', await noSideScroll());
  check(width, 'no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
