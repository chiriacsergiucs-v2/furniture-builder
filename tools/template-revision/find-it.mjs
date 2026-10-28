// Find-it acceptance for template revisions (CLAUDE.md R3, backlog N94, ADR-096), run against a production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/template-revision/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// From the bare app at 1440 and 390 px, by visible text: a project piece shows its template and revision; after the
// template is edited on this device the piece shows "Template updated (revision 1 → 2)", the project panel and the
// Projects list count it, Keep mine hides it; a piece added after the edit shows revision 2. Not part of `pnpm test`.
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
  const shot = (name) =>
    page.screenshot({ path: `${out}/template-revision-${name}-${width}.png`, fullPage: true });
  const dlg = page.locator('dialog[open]');
  const click = async (loc) => {
    await loc.scrollIntoViewIfNeeded();
    await loc.click({ timeout: 3000 }).catch(() => loc.dispatchEvent('click'));
  };
  const btn = (name, exact = true) => page.getByRole('button', { name, exact });
  const nav = page.getByRole('navigation', { name: 'Places' });
  const place = (name) => nav.getByRole('link', { name });
  const plan = page.getByRole('figure', { name: /Room plan, seen from above/ });
  const pieces = plan.getByRole('button', { name: /^Base cabinet.*, \d+ by \d+ mm/ });
  const card = page.locator('section.piece-edit');
  const sheet = async (open) => {
    const peek = page.locator('.sheet-peek');
    if (!(await peek.isVisible().catch(() => false))) return;
    if (((await peek.getAttribute('aria-expanded')) === 'true') !== open) await peek.click();
    await page.waitForTimeout(250);
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
    await sheet(false);
  };
  const selectPiece = async (i) => {
    await sheet(false);
    const planRadio = page.getByRole('radio', { name: '2D' });
    if (await planRadio.isVisible().catch(() => false)) await planRadio.click();
    await click(pieces.nth(i));
    await page.waitForTimeout(200);
    await sheet(true);
  };

  // 1. Bare app → new project → one base cabinet from the catalog: its template and revision.
  await page.goto(url);
  // 0. A single piece opened from the catalog is saved in the Library (Projects → Single pieces).
  await click(place(/Catalog/));
  await page.getByRole('searchbox', { name: 'Search the catalog' }).fill('Base cabinet, doors');
  await page.waitForTimeout(300);
  await click(
    page
      .locator('article.family')
      .filter({ hasText: 'Base cabinet, doors' })
      .first()
      .getByRole('button', { name: 'Open', exact: true })
      .first(),
  );
  await page.locator('main.work').waitFor({ state: 'visible' });
  await page.waitForTimeout(800);
  await click(place(/Projects/));
  await click(btn('Create a new project'));
  await page.locator('dialog[open] input').fill(`Revisions ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await addBase();
  await selectPiece(0);
  const line = card.locator('.template-line');
  const text = (await line.textContent().catch(() => '')) ?? '';
  check(width, 'the card says "From …, revision 1"', /From .+, revision 1/.test(text), text);
  const family = (text.match(/From (.+?) — /) ?? [])[1] ?? '';
  check(width, 'the template name is shown', family.length > 0, family);

  // 2. Edit that template on this device (Catalog → Edit template → Save template).
  await sheet(false);
  await click(place(/Catalog/));
  await page.getByRole('searchbox', { name: 'Search the catalog' }).fill(family);
  await page.waitForTimeout(300);
  const fam = page.locator('article.family').filter({ hasText: family }).first();
  await click(fam.getByRole('button', { name: 'Edit template' }));
  await click(btn('Save template'));
  await page.waitForTimeout(500);
  check(
    width,
    'the template is saved as edited on this device',
    (await page.locator('article.family .chip.edited').count()) > 0,
  );

  // 3. Back in the project: the notice, the count in the panel and on the Projects list.
  await click(place(/Editor/));
  await page.locator('main.work').waitFor({ state: 'visible' });
  await selectPiece(0);
  const notice = card.locator('.template-notice');
  await notice.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  check(
    width,
    'the piece shows "Template updated (revision 1 → 2)"',
    (await notice.isVisible()) &&
      /Template updated \(revision 1 → 2\)/.test((await notice.textContent()) ?? ''),
    (await notice.textContent().catch(() => '')) ?? '',
  );
  check(width, '"Keep mine" is offered', await btn('Keep mine').isVisible());
  check(
    width,
    '"Replace with the new revision" is offered',
    await btn('Replace with the new revision').isVisible(),
  );
  check(
    width,
    'the project panel says "1 piece has a newer template"',
    await page
      .getByText(/1 piece has a newer template/)
      .first()
      .isVisible(),
  );
  await shot('newer');
  await sheet(false);
  await click(place(/Projects/));
  const row = page.locator('ul.library li', { hasText: `Revisions ${width}` });
  await row
    .first()
    .waitFor({ state: 'visible', timeout: 5000 })
    .catch(() => {});
  check(
    width,
    'the Projects list says the project has a piece with a newer template',
    /1 piece has a newer template/.test(
      (await row
        .first()
        .textContent()
        .catch(() => '')) ?? '',
    ),
  );
  const single = page
    .locator('ul.library li')
    .filter({ hasText: /Template updated \(revision 1 → 2\)/ });
  check(
    width,
    'Library: the saved single piece says "Template updated (revision 1 → 2)"',
    (await single.count()) > 0,
  );
  await shot('library');
  await click(place(/Editor/));
  await page.locator('main.work').waitFor({ state: 'visible' });

  // 4. Keep mine hides it.
  await selectPiece(0);
  await click(btn('Keep mine'));
  await page.waitForTimeout(250);
  check(width, 'Keep mine hides the notice', (await notice.count()) === 0);
  check(
    width,
    'the card still names the revision, kept',
    /revision 1 \(kept; the template is at revision 2\)/.test(
      (await line.textContent().catch(() => '')) ?? '',
    ),
  );
  check(
    width,
    'the panel count is gone',
    (await page.getByText(/piece has a newer template/).count()) === 0,
  );

  // 5. A piece added after the edit is up to date at revision 2.
  await addBase();
  await selectPiece(1);
  check(
    width,
    'a piece added after the edit shows "revision 2" and no notice',
    /From .+, revision 2$/.test(((await line.textContent().catch(() => '')) ?? '').trim()) &&
      (await notice.count()) === 0,
    (await line.textContent().catch(() => '')) ?? '',
  );
  await shot('current');

  // 6. Edited again: "Replace with the new revision" puts the new revision in the piece's place (ADR-098).
  await sheet(false);
  await click(place(/Catalog/));
  await page.getByRole('searchbox', { name: 'Search the catalog' }).fill(family);
  await page.waitForTimeout(300);
  await click(fam.getByRole('button', { name: 'Edit template' }));
  await click(btn('Save template'));
  await page.waitForTimeout(500);
  await click(place(/Editor/));
  await page.locator('main.work').waitFor({ state: 'visible' });
  await selectPiece(1);
  check(
    width,
    'edited again: "Template updated (revision 2 → 3)"',
    /revision 2 → 3/.test((await notice.textContent().catch(() => '')) ?? ''),
  );
  await click(btn('Replace with the new revision'));
  await dlg
    .getByRole('button', { name: 'Replace' })
    .click({ timeout: 1500 })
    .catch(() => {});
  await page.waitForTimeout(300);
  await selectPiece(1);
  check(
    width,
    'Replace with the new revision: the piece is at revision 3, no notice',
    /revision 3$/.test(((await line.textContent().catch(() => '')) ?? '').trim()) &&
      (await notice.count()) === 0,
    (await line.textContent().catch(() => '')) ?? '',
  );

  check(
    width,
    'no sideways scroll',
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  );
  check(width, 'no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
