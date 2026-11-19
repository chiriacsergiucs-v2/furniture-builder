// Production acceptance for ADR-195 (N200): the catalog and template flows — honest revisions, visible storage errors,
// readable cards — from the bare app, by role and visible text, at 390 × 844 and 1280 × 900:
//   pnpm build && pnpm preview --port 4176 --strictPort &
//   node tools/catalog-flows/find-it.mjs http://127.0.0.1:4176/furniture-builder/ <out dir>
// Not part of `pnpm test`. Every check prints PASS or FAIL; the script exits 1 when any check fails.
import { launchBrowser, previewUrl, outDir } from '../lib/harness.mjs';
import { showAllRows } from '../lib/steps.mjs';
import { mkdirSync } from 'node:fs';

const url = previewUrl('http://127.0.0.1:4176/furniture-builder/');
const out = outDir('/tmp/furniture-catalog-flows-acceptance');
mkdirSync(out, { recursive: true });
const browser = await launchBrowser({
  args: process.env.CHROMIUM_PATH
    ? ['--disable-gpu', '--disable-software-rasterizer', '--use-gl=disabled']
    : [],
});
const failed = [];
let passed = 0;

/** IndexedDB writes to the templates store throw, as when the browser's storage is full. */
const failTemplateWrites = () => {
  const put = IDBObjectStore.prototype.put;
  window.__restorePut = () => (IDBObjectStore.prototype.put = put);
  IDBObjectStore.prototype.put = function (...args) {
    if (this.name === 'templates') throw new DOMException('Storage is full', 'QuotaExceededError');
    return put.apply(this, args);
  };
};
/** Reads of the templates store fail (init script: before the app reads anything). */
const failTemplateReads = () => {
  for (const proto of [IDBIndex.prototype, IDBObjectStore.prototype])
    for (const m of ['getAll', 'openCursor']) {
      const orig = proto[m];
      proto[m] = function (...args) {
        const store = this instanceof IDBIndex ? this.objectStore : this;
        if (store.name === 'templates') throw new DOMException('Unreadable', 'UnknownError');
        return orig.apply(this, args);
      };
    }
};

try {
  for (const width of [390, 1280]) {
    const phone = width < 500;
    const viewport = { width, height: phone ? 844 : 900 };
    const context = await browser.newContext({ viewport, hasTouch: phone, isMobile: phone });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const check = (name, ok, detail = '') => {
      console.log(`${ok ? 'PASS' : 'FAIL'} ${width}px ${name}${detail ? ` — ${detail}` : ''}`);
      if (ok) passed++;
      else failed.push(`${width}px ${name}`);
    };
    const shot = (name) => page.screenshot({ path: `${out}/catalog-flows-${name}-${width}.png` });
    const noSideScroll = () =>
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    const openCatalog = async () => {
      await page
        .getByRole('link', { name: /^Catalog/ })
        .first()
        .click();
      await page.getByRole('heading', { name: 'Catalog', level: 1 }).waitFor();
      await page.waitForTimeout(600);
    };
    const actions = async () => {
      if (phone) {
        const more = page.locator('summary', { hasText: 'More catalog actions' });
        if (!(await page.locator('details.catalog-more').getAttribute('open'))) await more.click();
      }
    };
    const family = (name) => page.getByRole('article', { name, exact: true }).first();
    /** On screen and not covered by the sticky bar or search row: the element at its centre is inside it. */
    const uncovered = (loc) =>
      loc.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const y = r.top + r.height / 2;
        if (r.height === 0 || y < 0 || y > window.innerHeight) return false;
        const hit = document.elementFromPoint(r.left + r.width / 2, y);
        return !!hit && (el === hit || el.contains(hit));
      });
    const search = page.getByRole('searchbox', { name: 'Search the catalog' });

    // 1. Bare app → Catalog: cards readable (ADR-195 item 4).
    await page.goto(url);
    await openCatalog();
    await shot('top');
    // The page as it opens (paged, N311), then every card opened for the checks that measure all of them.
    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    await showAllRows(page);
    const cards = await page.evaluate(() => {
      const list = [...document.querySelectorAll('.catalog-page li.item')];
      const tiles = list.filter((c) => c.querySelector('img.snap'));
      let notOneButton = 0;
      let leftovers = 0;
      for (const c of tiles) {
        if (c.querySelectorAll('button').length !== 1) notOneButton++;
        if (/RO: |Interior only|\bparts?\b|^default$/.test(c.textContent ?? '')) leftovers++;
      }
      const first = document.querySelector('.catalog-page ul.items');
      const columns = first
        ? new Set([...first.children].map((c) => Math.round(c.getBoundingClientRect().left))).size
        : 0;
      return { n: list.length, tiles: tiles.length, notOneButton, leftovers, columns };
    });
    check(
      'every buildable item is one tile button with a picture; no RO line, kind chip, parts count or default tag',
      cards.tiles > 100 && cards.notOneButton === 0 && cards.leftovers === 0,
      `${cards.tiles} tiles, ${cards.notOneButton} with more than one button, ${cards.leftovers} with old text`,
    );
    check(
      phone ? 'two tile columns on a phone' : 'four tile columns on a desktop',
      cards.columns === (phone ? 2 : 4),
      `${cards.columns} columns`,
    );
    if (phone) {
      check(
        'page under 17 000 px tall as it opens (paged, N311)',
        pageHeight < 17000,
        `${pageHeight} px`,
      );
    }
    check('no horizontal page scroll (catalog)', await noSideScroll());

    // 2. Search "flap": chip and heading counts equal the cards shown (item 3).
    await search.fill('flap');
    await page.waitForTimeout(300);
    const counts = await page.evaluate(() =>
      [...document.querySelectorAll('nav.group-index a')].map((a) => {
        const n = Number(a.querySelector('.count').textContent);
        const sec = document.getElementById(a.getAttribute('href').slice(1));
        return {
          label: a.textContent,
          n,
          head: Number(sec.querySelector('h2 .count').textContent.match(/\d+/)[0]),
          cards: sec.querySelectorAll('li.item').length,
        };
      }),
    );
    check(
      'search "flap": every chip and heading count equals its cards',
      counts.length > 0 && counts.every((c) => c.n === c.cards && c.head === c.cards),
      counts.map((c) => `${c.label}: ${c.cards} cards, heading ${c.head}`).join('; '),
    );
    await shot('search-flap');
    await search.fill('');

    // 3. "Save this piece as a template" is absent with no design open (item 5).
    await actions();
    check(
      '"Save this piece as a template" absent with no design open',
      (await page.getByRole('button', { name: 'Save this piece as a template' }).count()) === 0,
    );

    // 4. A safety-regulated card (item 7).
    const bunk = family('Bunk bed')
      .getByRole('listitem')
      .filter({ hasText: 'Two 90 × 200 mattresses' });
    const reason = bunk.getByText('Safety-regulated: you check it against the standards yourself');
    check('safety-regulated card says so, not "Not available yet"', await reason.isVisible());
    await bunk.scrollIntoViewIfNeeded();
    await shot('safety-card');
    await bunk.getByRole('button', { name: 'I check it myself' }).click();
    check(
      '"I check it myself" enables Open and ticks the catalog switch',
      (await bunk.getByRole('button', { name: /^Open / }).isEnabled()) &&
        (await page
          .getByRole('checkbox', { name: 'I check safety-regulated items myself' })
          .isChecked()),
    );
    check('no horizontal page scroll (safety card)', await noSideScroll());

    // 5. Template validation in the user's words (item 6).
    await family('Bookcase (with back)').getByRole('button', { name: 'Edit template' }).click();
    const editor = page.getByRole('region', { name: /^Edit template/ });
    await editor.waitFor();
    for (const box of await editor
      .getByRole('group', { name: /^Rooms/ })
      .getByRole('checkbox')
      .all())
      if (await box.isChecked()) await box.uncheck();
    await editor.getByLabel('Name', { exact: true }).fill('');
    const alert = editor.getByRole('alert');
    check(
      'no rooms and no name read as user sentences',
      (await alert.innerText()).trim() === 'Give the template a name. Tick at least one room.',
      (await alert.innerText()).trim(),
    );
    await shot('editor-problems');
    await editor.getByRole('button', { name: 'Cancel' }).click();

    // 6. Edit design → Cancel: nothing stored, back to the draft; → Save to template: one revision (item 1).
    await family('Bookcase (with back)').getByRole('button', { name: 'Edit template' }).click();
    await editor.getByLabel('Name', { exact: true }).fill('My bookcase');
    await editor.getByRole('button', { name: 'Edit design' }).first().click();
    const saveTo = page.getByRole('button', { name: 'Save to template' });
    await saveTo.waitFor();
    await page.waitForTimeout(500);
    await shot('template-mode');
    await page.locator('.path').getByRole('button', { name: 'Cancel' }).click();
    const back = page.getByRole('region', { name: 'Edit template My bookcase' });
    await back.waitFor();
    const rowsAfterCancel = await page.evaluate(
      () =>
        new Promise((res) => {
          const r = indexedDB.open('furniture-builder');
          r.onsuccess = () => {
            const q = r.result.transaction('templates').objectStore('templates').getAll();
            q.onsuccess = () => res(q.result.map((x) => x.template.revision));
          };
        }),
    );
    check(
      'Edit design → Cancel: the draft is back, nothing stored',
      (await back.getByLabel('Name', { exact: true }).inputValue()) === 'My bookcase' &&
        rowsAfterCancel.length === 0,
      `stored revisions: [${rowsAfterCancel}]`,
    );
    await back.getByRole('button', { name: 'Edit design' }).first().click();
    await saveTo.click();
    await page.getByRole('heading', { name: 'Catalog', level: 1 }).waitFor();
    await page.waitForTimeout(400);
    const rowsAfterSave = await page.evaluate(
      () =>
        new Promise((res) => {
          const r = indexedDB.open('furniture-builder');
          r.onsuccess = () => {
            const q = r.result.transaction('templates').objectStore('templates').getAll();
            q.onsuccess = () => res(q.result.map((x) => x.template.revision));
          };
        }),
    );
    check(
      'Edit design → Save to template: one row at revision 2, "Edited on this device"',
      rowsAfterSave.length === 1 &&
        rowsAfterSave[0] === 2 &&
        (await family('My bookcase').getByText('Edited on this device').isVisible()),
      `stored revisions: [${rowsAfterSave}]`,
    );

    // 7. A refused write: alert on the Catalog page, the draft stays open (item 2).
    await family('My bookcase').getByRole('button', { name: 'Edit template' }).click();
    await editor.getByLabel('Name', { exact: true }).fill('My bookcase 2');
    await page.evaluate(failTemplateWrites);
    await editor.getByRole('button', { name: 'Save template' }).click();
    const writeAlert = page
      .getByRole('alert')
      .filter({ hasText: 'The template could not be saved in this browser’s storage.' });
    await writeAlert.waitFor({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(300);
    const alertBox = await writeAlert.boundingBox();
    check(
      'refused write: alert text in view and uncovered, draft still open',
      (await writeAlert.isVisible()) &&
        (await uncovered(writeAlert.locator('span'))) &&
        (await page.getByRole('region', { name: 'Edit template My bookcase 2' }).isVisible()),
      alertBox ? `alert top ${Math.round(alertBox.y)} px` : 'no alert',
    );
    await page.evaluate(() => window.__restorePut());
    await shot('write-refused');
    check('no horizontal page scroll (storage alert)', await noSideScroll());
    await context.close();

    // 8. A refused read: a fresh page whose templates store cannot be read.
    const readCtx = await browser.newContext({ viewport, hasTouch: phone, isMobile: phone });
    await readCtx.addInitScript(failTemplateReads);
    const rp = await readCtx.newPage();
    await rp.goto(url);
    await rp
      .getByRole('link', { name: /^Catalog/ })
      .first()
      .click();
    const readAlert = rp
      .getByRole('alert')
      .filter({ hasText: 'Templates saved on this device could not be read.' });
    await readAlert.waitFor({ timeout: 5000 }).catch(() => {});
    check('refused read: alert on the Catalog page', await readAlert.isVisible());
    await rp.screenshot({ path: `${out}/catalog-flows-read-refused-${width}.png` });
    await readCtx.close();

    // 9. With a piece open: "Save this piece as a template" opens name/room/type and links to the family (item 5).
    const pc = await browser.newContext({ viewport, hasTouch: phone, isMobile: phone });
    const p2 = await pc.newPage();
    await p2.goto(url);
    await p2.getByRole('button', { name: 'New single piece', exact: true }).click();
    await p2
      .getByRole('dialog')
      .getByRole('button', { name: /Sideboard/ })
      .first()
      .click();
    await p2
      .getByRole('link', { name: /^Catalog/ })
      .first()
      .click();
    await p2.getByRole('heading', { name: 'Catalog', level: 1 }).waitFor();
    if (phone) await p2.locator('summary', { hasText: 'More catalog actions' }).click();
    await p2.getByRole('button', { name: 'Save this piece as a template' }).click();
    const dlg = p2.getByRole('dialog', { name: 'Save to catalog' });
    await dlg.getByLabel('Name', { exact: true }).fill('Hall sideboard');
    await dlg.getByLabel('Room', { exact: true }).selectOption({ label: 'Hallway' });
    check(
      'Save this piece as a template: name, room and type form',
      (await dlg.getByLabel('Type', { exact: true }).isVisible()) &&
        (await dlg.getByLabel('Room', { exact: true }).isVisible()),
    );
    await p2.screenshot({ path: `${out}/catalog-flows-save-form-${width}.png` });
    await dlg.getByRole('button', { name: 'Save', exact: true }).click();
    await p2.getByRole('link', { name: 'Show “Hall sideboard”' }).click();
    const fam = p2.getByRole('article', { name: 'Hall sideboard', exact: true });
    // The jump scrolls smoothly across the whole catalog: wait for it to settle.
    let box = null;
    for (let i = 0; i < 20; i++) {
      await p2.waitForTimeout(250);
      const next = await fam.boundingBox();
      if (box && next && Math.abs(next.y - box.y) < 1) break;
      box = next;
    }
    const famVisible = await fam.getByRole('heading', { name: /Hall sideboard/ }).evaluate((el) => {
      const r = el.getBoundingClientRect();
      const y = r.top + r.height / 2;
      const hit = document.elementFromPoint(r.left + 8, y);
      return y > 0 && y < window.innerHeight && !!hit && el.contains(hit);
    });
    check(
      'the confirmation links to the new family, its heading in view and uncovered',
      famVisible,
      box ? `top ${Math.round(box.y)} px` : 'not found',
    );
    await p2.screenshot({ path: `${out}/catalog-flows-saved-family-${width}.png` });
    await pc.close();

    check('no page errors', errors.length === 0, errors.slice(0, 2).join(' / '));
  }
} finally {
  await browser.close();
}
console.log(
  `${passed} passed, ${failed.length} failed${failed.length ? `: ${failed.join('; ')}` : ''}`,
);
process.exitCode = failed.length ? 1 : 0;
