// Find-it acceptance for chair, installation and service clearances drawn on the plan (CLAUDE.md R3, backlog N68,
// ADR-073), run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/clearances/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at each width and finds everything by visible text: a desk gets a chair space depth the
// user types (no default), the Clearances toggle draws the zones, a chest in the chair space turns it into a warning
// (listed under Checks), a service zone behind the chest is a warning, a chest over the desk makes the bodies an
// error, and a wardrobe in a room lower than its diagonal warns, or errs once marked "Assembled lying down".
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

for (const width of [1440, 375]) {
  const phone = width < 500;
  const ctx = await browser.newContext({
    viewport: { width, height: phone ? 812 : 900 },
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
  const shot = (name) =>
    page.screenshot({ path: `${out}/clearances-${name}-${width}.png`, fullPage: true });
  const dlg = page.locator('dialog[open]');
  const click = async (loc) => {
    await loc.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
    await loc.click({ timeout: 3000 }).catch(() => loc.dispatchEvent('click'));
  };
  const btn = (name, exact = true) => page.getByRole('button', { name, exact });
  const mode = (name) => page.getByRole('radio', { name });
  const plan = page.getByRole('figure', { name: /Room plan, seen from above/ });
  const desk = plan.getByRole('button', { name: /^Desk.*, \d+ by \d+ mm$/ }).first();
  const chest = plan.getByRole('button', { name: /^Chest of drawers.*, \d+ by \d+ mm$/ }).first();
  // On a phone the project's pieces and the selected piece sit in the Compose sheet: tap its peek row to open it.
  const openSheet = async () => {
    const peek = page.locator('.sheet-peek');
    if (
      phone &&
      (await peek.isVisible().catch(() => false)) &&
      (await peek.getAttribute('aria-expanded')) === 'false'
    )
      await peek.click();
  };
  const closeSheet = async () => {
    const peek = page.locator('.sheet-peek');
    if (
      phone &&
      (await peek.isVisible().catch(() => false)) &&
      (await peek.getAttribute('aria-expanded')) === 'true'
    )
      await peek.click();
    await page.waitForTimeout(200);
  };
  const field = (label) => page.getByLabel(label, { exact: true }).first();
  const type = async (label, v) => {
    await openSheet();
    const f = field(label);
    await f.scrollIntoViewIfNeeded();
    await f.fill(String(v));
    await f.press('Enter');
    await page.waitForTimeout(150);
  };
  const add = async (search) => {
    await openSheet();
    await click(btn('Add a piece'));
    await dlg.getByRole('searchbox', { name: 'Search the items' }).fill(search);
    await dlg.locator('.start-group .row-btn').first().click();
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
    if (await btn('Place to the right').isVisible()) await click(btn('Place to the right'));
    await page.waitForTimeout(150);
  };
  const zone = (cls) => plan.locator(`g.zone.${cls}`);
  const toCompose = async () => {
    if (
      await mode('Compose')
        .isVisible()
        .catch(() => false)
    )
      await click(mode('Compose'));
    const planRadio = page.getByRole('radio', { name: 'Plan' });
    if (await planRadio.isVisible().catch(() => false)) await planRadio.click();
  };
  const checksText = async () => {
    await click(mode(/Build & Preview/));
    await page.waitForTimeout(300);
    await click(page.getByRole('tab', { name: /Checks/ }));
    await page.waitForTimeout(200);
    const t = (await page.locator('#panel-checks').textContent()) ?? '';
    await shot('checks');
    await toCompose();
    return t;
  };

  // 1. Bare app → new project → a desk.
  await page.goto(url);
  await click(btn('Create a new project'));
  await page.locator('dialog[open] input').fill(`Clearances ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await toCompose();
  await shot('start');
  await add('Desk');
  await toCompose();
  check(width, 'the desk is on the plan as "Desk…, W by D mm"', await desk.isVisible());
  const [, deskW, deskD] = /(\d+) by (\d+) mm$/.exec(await desk.getAttribute('aria-label')) ?? [];
  await click(desk);

  // 2. Chair space depth: empty until the user types it (no default), then a chair zone on the overlay.
  await openSheet();
  const chair = field('Chair space depth');
  check(
    width,
    'the selected desk has "Clearance zones" › "Chair space depth"',
    await chair.isVisible(),
  );
  check(width, 'the chair space depth has no default (empty)', (await chair.inputValue()) === '');
  const toggle = page.getByRole('checkbox', { name: 'Clearances', exact: true });
  check(width, 'the plan has a "Clearances" toggle, off', !(await toggle.isChecked()));
  await click(toggle);
  check(
    width,
    'Clearances on: the legend "No problem · Warning · Error" shows',
    (await page.getByText('No problem', { exact: true }).isVisible()) &&
      (await page.getByText('Warning', { exact: true }).isVisible()) &&
      (await page.getByText('Error', { exact: true }).isVisible()),
  );
  check(width, 'without a depth, no chair zone is drawn', (await zone('chair').count()) === 0);
  await type('Chair space depth', 700);
  check(
    width,
    'after typing 700 mm, "Chair space" is drawn on the plan',
    await plan.getByText('Chair space', { exact: true }).isVisible(),
  );
  check(width, 'the chair zone is hatched as no problem', (await zone('chair.none').count()) === 1);
  check(width, 'the desk body zone is drawn too', (await zone('body').count()) === 1);
  await closeSheet();
  await shot('chair-clear');

  // 3. A chest in the chair space: the chair zone becomes a warning, and Checks lists it.
  await add('Chest of drawers');
  await click(chest);
  await type('From left', 0);
  await type('From back', Number(deskD) + 200);
  check(
    width,
    'with a chest in it, the chair zone is a warning',
    (await zone('chair.warning').count()) === 1,
  );
  check(width, 'the chest drawer travel is drawn', (await zone('drawer').count()) > 0);
  await closeSheet();
  await shot('chair-blocked');
  const t1 = await checksText();
  check(
    width,
    'Checks says "Chair space of Desk… (700 mm): Chest of drawers is in the way."',
    /Chair space of Desk[^:]*\(700 mm\): Chest of drawers is in the way\./.test(t1),
  );

  // 3b. A service zone behind the chest, sized by the user: it reaches into the desk, so it is a warning.
  await click(chest);
  await openSheet();
  await click(
    page.getByRole('radiogroup', { name: 'Service zone' }).getByRole('radio', { name: 'Back' }),
  );
  check(
    width,
    '"Service zone" › Back asks for "Service zone depth", empty (no default)',
    (await field('Service zone depth').inputValue()) === '' &&
      (await zone('service').count()) === 0,
  );
  await type('Service zone depth', 300);
  check(
    width,
    'the service zone is drawn as a warning, labelled "Service zone"',
    (await zone('service.warning').count()) === 1 &&
      (await plan.getByText('Service zone', { exact: true }).count()) === 1,
  );
  await closeSheet();
  await shot('service');
  const ts = await checksText();
  check(
    width,
    'Checks says "Service zone (back) of Chest of drawers (300 mm): Desk… is in the way."',
    /Service zone \(back\) of Chest of drawers \(300 mm\): Desk[^.]* is in the way\./.test(ts),
  );

  // 4. The chest over the desk: both bodies are errors.
  await click(chest);
  await type('From back', 0);
  await type('From left', Math.round(Number(deskW) / 4));
  check(
    width,
    'pieces overlapping: body zones are drawn as errors',
    (await zone('body.error').count()) === 2,
  );
  await closeSheet();
  await shot('overlap-error');
  const t2 = await checksText();
  check(
    width,
    'Checks says they "overlap by … mm in the room" (wording since ADR-071)',
    /overlap by \d+ mm in the room/.test(t2),
  );

  // 4b. Installation: a wardrobe in a room 1 mm higher than the wardrobe cannot be tipped up (a warning), and
  // marked "Assembled lying down" it is an error.
  await add('Wardrobe');
  const wardrobe = plan.getByRole('button', { name: /^Wardrobe.*, \d+ by \d+ mm$/ }).first();
  await click(wardrobe);
  await openSheet();
  const takes =
    (await page.getByText(/^Takes \d+ × \d+ mm of floor, \d+ mm high\.$/).textContent()) ?? '';
  const [, , wd, wh] = /Takes (\d+) × (\d+) mm of floor, (\d+) mm high/.exec(takes) ?? [];
  const diagonal = Math.ceil(Math.hypot(Number(wh), Number(wd)));
  await click(btn('Add the room'));
  await type('Room height', Number(wh) + 1);
  const ti = await checksText();
  check(
    width,
    `Checks warns the wardrobe "cannot be tipped up" (needs ${diagonal} mm, room ${Number(wh) + 1} mm)`,
    new RegExp(
      `Wardrobe[^.]* cannot be tipped up from lying on its back: it needs ${diagonal} mm`,
    ).test(ti),
    takes,
  );
  await click(wardrobe);
  await openSheet();
  await click(page.getByRole('checkbox', { name: 'Assembled lying down', exact: true }));
  const te = await checksText();
  check(
    width,
    'marked "Assembled lying down", it becomes an error: "cannot be stood up"',
    /Wardrobe[^.]* is assembled lying down but cannot be stood up/.test(te),
  );
  await closeSheet();
  await shot('installation');

  // 5. Off again hides the overlay.
  await click(page.getByRole('checkbox', { name: 'Clearances', exact: true }));
  check(width, 'Clearances off hides the zones', (await plan.locator('g.zone').count()) === 0);

  check(width, 'no sideways scroll', await noSideScroll());
  check(width, 'no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
