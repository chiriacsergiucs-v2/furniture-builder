// On-demand capture, pass 3 (G-509): the states passes 1 and 2 did not reach — a project with pieces (the plan, the piece
// list, a selected piece, populated Settings, the results), the room tools, the 3D view, the Information and Gaps pages,
// Copy code, and the signed-out Account, Share and Assistant screens. Same rules as `flows.mjs` (CLAUDE.md toggle
// `browser-on-demand`): run only when the user asks; it asserts nothing. A state that cannot be reached is logged as
// SKIPPED and the run goes on. Each state also gets a text-contrast reading (`tools/lib/contrast-measure.mjs`).
//
// The online screens exist only in a build with a backend URL (`VITE_SUPABASE_URL`, ADR-127). Give a second preview
// built with a placeholder origin as the third argument or `CAPTURE_ONLINE_URL`; without it those states are skipped.
// Every request to an origin other than localhost is aborted and logged (`blocked-requests.json`), so the run contacts
// nothing remote.
//   pnpm build:ci && pnpm preview &
//   VITE_SUPABASE_URL=https://backend.invalid VITE_SUPABASE_ANON_KEY=placeholder pnpm exec vite build --outDir dist-online
//   pnpm exec vite preview --outDir dist-online --port 4174 &
//   pnpm browser:capture-flows3 [url] [out dir] [online url]
import { launchBrowser, previewUrl, outDir, WIDTHS, SCHEMES } from '../lib/harness.mjs';
import { mapPage } from '../lib/pagemap.mjs';
import { measure } from '../lib/contrast-measure.mjs';
import { goBuild, goCompose, openTab, showPieces } from '../lib/steps.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const url = previewUrl();
const out = outDir('docs/research/ui-capture/flows3');
const onlineUrl = process.argv[4] ?? process.env.CAPTURE_ONLINE_URL;
mkdirSync(out, { recursive: true });
const summary = [];
const skipped = [];
const contrast = [];
const blocked = [];

const local = (u) => {
  try {
    const { protocol, hostname } = new URL(u);
    if (protocol === 'data:' || protocol === 'blob:') return true;
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return true;
  }
};

async function newPage(browser, width, scheme) {
  const phone = width < 500;
  const ctx = await browser.newContext({
    viewport: { width, height: phone ? 812 : 900 },
    hasTouch: phone,
    isMobile: phone,
    colorScheme: scheme,
    serviceWorkers: 'block',
  });
  // No request leaves this machine (G-509 item 3): anything not on localhost is aborted and logged.
  await ctx.route('**/*', (route) => {
    const u = route.request().url();
    if (local(u)) return route.continue();
    blocked.push({ width, scheme, url: u, method: route.request().method() });
    console.log(`${width}px ${scheme} BLOCKED ${route.request().method()} ${u}`);
    return route.abort('blockedbyclient');
  });
  // The first-run canvas hints dialog blocks clicks at 390 px; mark it seen (ui-review 2026-11-23).
  await ctx.addInitScript(() => localStorage.setItem('fb:canvas-coach', 'done'));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { ctx, page, errors, phone };
}

async function shot(page, width, scheme, name) {
  const base = `${out}/${name}-${width}-${scheme}`;
  await page.screenshot({ path: `${base}.png` });
  const map = await page.evaluate(mapPage);
  writeFileSync(`${base}.json`, JSON.stringify({ name, scheme, ...map }, null, 2));
  const res = await page.evaluate(measure);
  const read = res.filter((x) => !x.unread);
  const bad = read.filter((x) => x.ratio < x.need).sort((a, b) => a.ratio - b.ratio);
  contrast.push({
    scheme,
    width,
    state: name,
    texts: read.length,
    unread: res.length - read.length,
    fail: bad.length,
    worst: bad.slice(0, 6),
  });
  summary.push({
    width,
    scheme,
    name,
    elements: map.totalElements,
    horizontalScroll: map.horizontalScroll,
    contrastFail: bad.length,
  });
  console.log(
    `${width}px ${scheme} ${name}: ${map.totalElements} elements, ${read.length} texts, ${bad.length} below AA${map.horizontalScroll ? ' — HORIZONTAL SCROLL' : ''}`,
  );
}

/** Run one state; a state that cannot be reached is logged and skipped. */
async function state(width, scheme, name, fn) {
  try {
    await fn();
  } catch (e) {
    const why = String(e.message).split('\n')[0];
    skipped.push({ width, scheme, name, why });
    console.log(`${width}px ${scheme} ${name}: SKIPPED — ${why}`);
  }
}

// The app's real phone default, the canvas editor (ADR-290), not the sheet the harness sets for older scripts (G-589).
const browser = await launchBrowser({ appDefault: true });
for (const scheme of SCHEMES) {
  for (const width of WIDTHS) {
    // --- Offline build: a project with pieces, the room, 3D, Information, Gaps, Copy code. ---
    const { ctx, page, errors, phone } = await newPage(browser, width, scheme);
    const wait = (ms = 400) => page.waitForTimeout(ms);
    const dlg = page.locator('dialog[open]');
    const btn = (name, exact = true) => page.getByRole('button', { name, exact });
    const sheet = async (open) => {
      const peek = page.locator('.sheet-peek');
      if (!(await peek.isVisible().catch(() => false))) return;
      if (((await peek.getAttribute('aria-expanded')) === 'true') !== open) await peek.click();
      await wait(250);
    };
    const escape = async () => {
      await page.keyboard.press('Escape').catch(() => {});
      await wait(200);
      // The phone's sheet dialogs (Settings, Material) are cards Escape leaves open: their Close button shuts them.
      const close = dlg.getByRole('button', { name: 'Close', exact: true }).first();
      if (await close.isVisible().catch(() => false)) {
        await close.click();
        await wait(200);
      }
    };
    const more = async (item) => {
      await page.locator('summary[aria-label="More"]').first().click();
      await wait(200);
      await page.getByRole('button', { name: item }).first().click({ timeout: 3000 });
      await wait(600);
    };
    const addBase = async () => {
      // On the phone canvas a selected piece replaces the Add chip; Escape clears the selection (ui-review 2026-11-23).
      if (phone) await escape();
      await sheet(true);
      // The phone canvas editor names it "Add a piece to the project" (ui-review 2026-11-23).
      await page
        .getByRole('button', { name: /^Add a piece( to the project)?$/ })
        .first()
        .click({ timeout: 5000 });
      await dlg.getByRole('searchbox', { name: 'Search the items' }).fill('Base cabinet');
      // The catalog finder's tiles (the default since G-582), or the grouped rows when the finder is off.
      await dlg.locator('.finder-tile, .start-group .row-btn').first().click();
      await dlg.waitFor({ state: 'detached' }).catch(() => {});
      const place = btn('Place to the right');
      await place.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
      if (await place.isVisible()) await place.click();
      await wait(300);
    };
    let seeded = false;
    await page.goto(url, { waitUntil: 'networkidle' });

    // A project with two base cabinets, added through the UI (Add a piece → Base cabinet, twice).
    await state(width, scheme, 'project-plan', async () => {
      await btn('Create a new project').click();
      await page.locator('dialog[open] input').fill('Audit pass 3');
      await dlg.getByRole('button', { name: 'Create project' }).click();
      await page.locator('main.work').waitFor({ state: 'visible' });
      await addBase();
      await addBase();
      await showPieces(page);
      const n = await page.locator('ul.pieces li').count();
      // The phone canvas editor has no piece list; the pieces are on the canvas (ui-review 2026-11-23).
      if (n < 2 && !phone) throw new Error(`the piece list shows ${n} pieces, 2 expected`);
      seeded = true;
      await sheet(false);
      await wait(300);
      await shot(page, width, scheme, 'project-plan');
    });
    const needPieces = () => {
      if (!seeded) throw new Error('no project with pieces');
    };
    await state(width, scheme, 'piece-list', async () => {
      needPieces();
      await showPieces(page);
      await shot(page, width, scheme, 'piece-list');
    });
    await state(width, scheme, 'piece-selected', async () => {
      needPieces();
      if (phone) {
        // The phone canvas has no piece list: tap the first piece on the plan (G-589).
        await escape();
        await page.locator('g.plan-piece').first().click({ timeout: 3000 });
      } else {
        await showPieces(page);
        await page
          .getByRole('list', { name: 'Pieces' })
          .first()
          .getByRole('button')
          .first()
          .click();
      }
      await wait(400);
      await shot(page, width, scheme, 'piece-selected');
    });
    await state(width, scheme, 'settings-populated', async () => {
      needPieces();
      await showPieces(page);
      await sheet(false);
      await btn('Settings').click({ timeout: 3000 });
      await wait();
      await shot(page, width, scheme, 'settings-populated');
      await escape();
    });

    // The room tools: the empty Room section, the room added (fold open), the drawing mode, Fill the room.
    const roomSection = page.getByRole('region', { name: 'Room', exact: true }).first();
    const showRoom = async () => {
      // The phone canvas keeps the Room section in the project's card: clear the selection, then the chip rail's
      // "Edit <project>" opens it (G-589).
      if (phone && !(await roomSection.isVisible().catch(() => false))) {
        await escape();
        await page.locator('.chip.edit-open').first().click({ timeout: 3000 });
        await wait(300);
      }
      await showPieces(page);
      await roomSection.scrollIntoViewIfNeeded({ timeout: 3000 });
      await wait(200);
    };
    await state(width, scheme, 'room-empty', async () => {
      needPieces();
      await showRoom();
      await shot(page, width, scheme, 'room-empty');
    });
    await state(width, scheme, 'room-added', async () => {
      needPieces();
      await showRoom();
      await roomSection.getByRole('button', { name: 'Add the room' }).click({ timeout: 3000 });
      await wait(500);
      // A closed fold on the sheet editor and the desktop; a flat card on the phone canvas (ADR-160, G-589).
      const fold = roomSection.locator('.room-fold').first();
      if (await fold.evaluate((el) => el.tagName === 'DETAILS' && !el.open))
        await fold.locator('summary').first().click();
      await wait(300);
      await fold.scrollIntoViewIfNeeded();
      await shot(page, width, scheme, 'room-added');
    });
    await state(width, scheme, 'room-draw', async () => {
      needPieces();
      await showRoom();
      await roomSection
        .getByRole('button', { name: 'Draw the room again' })
        .click({ timeout: 3000 });
      await wait(600);
      await shot(page, width, scheme, 'room-draw');
      // Leave the drawing without a change (Close the room stays disabled with no corner tapped).
      await btn('Cancel')
        .first()
        .click({ timeout: 3000 })
        .catch(() => {});
      await escape();
    });
    await state(width, scheme, 'room-fill-dialog', async () => {
      needPieces();
      await sheet(false);
      await more(/^Fill the room…/);
      await dlg.first().waitFor({ state: 'visible', timeout: 3000 });
      await shot(page, width, scheme, 'room-fill-dialog');
      await escape();
    });

    // The 3D view of the project, and its ⋯ menu.
    await state(width, scheme, '3d-view', async () => {
      needPieces();
      await sheet(false);
      if (phone) await goBuild(page);
      const r = page.getByRole('radio', { name: '3D', exact: true }).first();
      if ((await r.getAttribute('aria-checked')) !== 'true') await r.click({ timeout: 3000 });
      await page
        .locator('.view.three canvas')
        .first()
        .waitFor({ state: 'visible', timeout: 30000 });
      await wait(2000);
      await shot(page, width, scheme, '3d-view');
    });
    await state(width, scheme, '3d-more-menu', async () => {
      needPieces();
      await page.locator('summary[aria-label="More 3D actions"]').first().click({ timeout: 3000 });
      await wait(300);
      await shot(page, width, scheme, '3d-more-menu');
      await page.locator('summary[aria-label="More 3D actions"]').first().click();
      await wait(200);
    });
    await state(width, scheme, 'results-parts', async () => {
      needPieces();
      await goBuild(page);
      await wait(300);
      await openTab(page, 'Parts');
      await wait(500);
      // On a phone the results sit under the 3D view: bring the parts table up.
      await page
        .locator('table')
        .first()
        .scrollIntoViewIfNeeded({ timeout: 3000 })
        .catch(() => {});
      await wait(300);
      await shot(page, width, scheme, 'results-parts');
      await goCompose(page);
      await wait(300);
    });

    // Copy code: the offline way to share a design (no account needed).
    await state(width, scheme, 'copy-code', async () => {
      await sheet(false);
      await more(/^Copy code/);
      await dlg.first().waitFor({ state: 'visible', timeout: 3000 });
      await shot(page, width, scheme, 'copy-code');
      await escape();
    });

    // Information and guides, Gaps; the Feature Research page is looked for and logged when it is not there.
    await state(width, scheme, 'info', async () => {
      await sheet(false);
      await more(/^Information and guides/);
      await page.getByRole('heading', { name: 'Information and guides', level: 1 }).waitFor();
      await shot(page, width, scheme, 'info');
    });
    await state(width, scheme, 'info-domain-open', async () => {
      const s = page.locator('details.info-domain > summary').first();
      if (!(await s.evaluate((el) => el.parentElement.open))) await s.click({ timeout: 3000 });
      await s.scrollIntoViewIfNeeded();
      await wait(300);
      await shot(page, width, scheme, 'info-domain-open');
    });
    await state(width, scheme, 'gaps', async () => {
      // The Gaps button sits on the Information page (on a phone the More menu would cover it, G-589).
      await btn(/^Gaps/, false).first().click({ timeout: 3000 });
      await page.getByRole('heading', { name: 'Gaps', level: 1 }).waitFor();
      await shot(page, width, scheme, 'gaps');
    });
    await state(width, scheme, 'research', async () => {
      await page.locator('summary[aria-label="More"]').first().click();
      await wait(200);
      const found = await page
        .getByRole('button', { name: /Research/ })
        .count()
        .catch(() => 0);
      await escape();
      if (!found) throw new Error('no Research entry in the More menu or anywhere on the page');
      await more(/Research/);
      await shot(page, width, scheme, 'research');
    });
    if (errors.length) console.log(`${width}px ${scheme} page errors:`, errors);
    await ctx.close();

    // --- Build with a backend URL, signed out: Account, Share, Assistant (no request leaves localhost). ---
    const online = [
      'account-sign-in',
      'account-create',
      'account-forgot',
      'account-privacy',
      'share-link-invalid',
      'share-link-unreachable',
      'assistant-off',
      'assistant-consent',
      'assistant-signed-out',
    ];
    if (!onlineUrl) {
      for (const name of online)
        await state(width, scheme, name, async () => {
          throw new Error(
            'no build with a backend URL given (third argument or CAPTURE_ONLINE_URL)',
          );
        });
      continue;
    }
    const o = await newPage(browser, width, scheme);
    const p = o.page;
    const odlg = p.locator('dialog[open]');
    const owait = (ms = 400) => p.waitForTimeout(ms);
    const oesc = async () => {
      await p.keyboard.press('Escape').catch(() => {});
      await owait(200);
    };
    await p.goto(onlineUrl, { waitUntil: 'networkidle' }).catch(() => {});
    await state(width, scheme, 'account-sign-in', async () => {
      await p
        .getByRole('button', { name: 'Account', exact: true })
        .first()
        .click({ timeout: 3000 });
      await odlg.getByRole('heading', { name: 'Sign in' }).first().waitFor({ timeout: 3000 });
      await owait();
      await shot(p, width, scheme, 'account-sign-in');
    });
    await state(width, scheme, 'account-create', async () => {
      await odlg.getByRole('button', { name: 'Create account', exact: true }).first().click();
      await owait();
      await shot(p, width, scheme, 'account-create');
      await odlg.getByRole('button', { name: 'I have an account' }).click();
      await owait(200);
    });
    await state(width, scheme, 'account-forgot', async () => {
      await odlg.getByRole('button', { name: 'Forgot password?' }).click({ timeout: 3000 });
      await owait();
      await shot(p, width, scheme, 'account-forgot');
      await odlg.getByRole('button', { name: 'Back to sign in' }).click();
      await owait(200);
    });
    await state(width, scheme, 'account-privacy', async () => {
      await odlg.getByRole('button', { name: 'Privacy notice' }).click({ timeout: 3000 });
      await owait();
      await shot(p, width, scheme, 'account-privacy');
      await oesc();
    });
    // A share link with a malformed id (answered on the device) and one with a well-formed id (its fetch is blocked).
    await state(width, scheme, 'share-link-invalid', async () => {
      await p.goto(`${onlineUrl}#share=bad`, { waitUntil: 'networkidle' });
      await odlg.first().waitFor({ state: 'visible', timeout: 5000 });
      await owait(800);
      await shot(p, width, scheme, 'share-link-invalid');
      await oesc();
    });
    await state(width, scheme, 'share-link-unreachable', async () => {
      await p.goto(`${onlineUrl}#share=AAAAAAAAAAAAAAAAAAAAAAAAAA`, { waitUntil: 'networkidle' });
      await odlg.first().waitFor({ state: 'visible', timeout: 5000 });
      await owait(2500);
      await shot(p, width, scheme, 'share-link-unreachable');
      await oesc();
    });
    await state(width, scheme, 'assistant-off', async () => {
      await p.goto(onlineUrl, { waitUntil: 'networkidle' });
      await p.locator('summary[aria-label="More"]').first().click();
      await owait(200);
      await p
        .getByRole('button', { name: /^Assistant/ })
        .first()
        .click({ timeout: 3000 });
      await odlg.first().waitFor({ state: 'visible', timeout: 3000 });
      await owait();
      await shot(p, width, scheme, 'assistant-off');
    });
    await state(width, scheme, 'assistant-consent', async () => {
      await odlg.getByRole('checkbox', { name: 'Use the assistant on this device' }).check();
      await owait();
      await shot(p, width, scheme, 'assistant-consent');
    });
    await state(width, scheme, 'assistant-signed-out', async () => {
      await odlg.getByRole('button', { name: 'Accept and start' }).click({ timeout: 3000 });
      await owait();
      await shot(p, width, scheme, 'assistant-signed-out');
      await oesc();
    });
    if (o.errors.length) console.log(`${width}px ${scheme} page errors (online build):`, o.errors);
    await o.ctx.close();
  }
}
writeFileSync(`${out}/summary.json`, JSON.stringify({ captured: summary, skipped }, null, 2));
writeFileSync(`${out}/contrast.json`, JSON.stringify(contrast, null, 2));
writeFileSync(`${out}/blocked-requests.json`, JSON.stringify(blocked, null, 2));
console.log(
  `captured ${summary.length}, skipped ${skipped.length}, blocked requests ${blocked.length}`,
);
await browser.close();
