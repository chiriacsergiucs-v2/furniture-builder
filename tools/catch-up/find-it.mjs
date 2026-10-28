// Catch-up find-it in Chromium (ADR-066; user 2026-10-28 "All find it") for the light rows that need a real browser:
// layout, CSS, the 3D view and the network: N76 and N145 (one view container, ADR-081, ADR-144), N115 (heading
// scale, ADR-116), N127 and N132 (no foreign request, no CSP violation, ADR-126, ADR-131), N134 (folder backup,
// ADR-133), N135 (signed in at start, offline, ADR-134), N136 and N137 (sign-in screens, ADR-135, ADR-136), N140
// (sync status, ADR-139), N141 (device-only notice, ADR-140), N143 (accounts, ADR-142), N144 (shared-item preview,
// ADR-143). Against a production build made with a test backend URL; every request to that backend is answered here,
// so nothing leaves the machine:
//   VITE_SUPABASE_URL=https://catchup-test.supabase.co VITE_SUPABASE_ANON_KEY=sb_publishable_test pnpm build
//   pnpm exec vite preview --port 4173 &  node tools/catch-up/find-it.mjs http://localhost:4173/furniture-builder/ <out>
// From the bare app, by role and visible text, at 390, 1280 and 1600 px. Not part of `pnpm test`.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4173/furniture-builder/';
const out = process.argv[3] ?? 'dist-acceptance';
const BACKEND = 'catchup-test.supabase.co';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const results = [];
const check = (width, name, ok, detail = '') => {
  results.push({ width, name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${width}px ${name}${detail ? ` — ${detail}` : ''}`);
};

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const USER = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'me@example.com',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: { provider: 'email' },
  user_metadata: {},
  created_at: '2026-10-28T00:00:00Z',
};
const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
const SESSION = {
  access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER.id, exp, role: 'authenticated', email: USER.email })}.sig`,
  refresh_token: 'refresh-test',
  token_type: 'bearer',
  expires_in: 3600 * 24,
  expires_at: exp,
  user: USER,
};
const shareId = 'AAAAAAAAAAAAAAAAAAAAAA';

async function context(width, { signedIn = false, offline = false } = {}) {
  const phone = width < 500;
  const ctx = await browser.newContext({
    viewport: { width, height: phone ? 844 : 900 },
    hasTouch: phone,
    isMobile: phone,
  });
  const page = await ctx.newPage();
  const errors = [];
  const foreign = new Set();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' || /Content.Security.Policy/i.test(m.text())) errors.push(m.text());
  });
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.protocol.startsWith('http') && !['localhost', '127.0.0.1'].includes(u.hostname))
      foreign.add(u.hostname);
  });
  // The folder picker returns a folder of the origin private file system: a real directory handle, no OS dialog.
  await page.addInitScript(() => {
    window.showDirectoryPicker = async () =>
      (await navigator.storage.getDirectory()).getDirectoryHandle('backup-test', { create: true });
  });
  if (signedIn)
    await page.addInitScript(
      ([key, session, user]) => {
        localStorage.setItem(key, JSON.stringify(session));
        localStorage.setItem(
          'fb:account',
          JSON.stringify({ id: user.id, email: user.email, provider: 'email' }),
        );
      },
      ['sb-catchup-test-auth-token', SESSION, USER],
    );
  if (offline)
    await page.addInitScript((user) => {
      localStorage.setItem(
        'fb:account',
        JSON.stringify({ id: user.id, email: user.email, provider: 'email' }),
      );
      Object.defineProperty(navigator, 'onLine', { get: () => false });
    }, USER);
  // The test backend: answered here (records, shares, functions); nothing leaves the machine.
  let shared = null;
  await page.route(`https://${BACKEND}/**`, (route) => {
    const p = new URL(route.request().url()).pathname;
    const json = (body) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (p.endsWith('/rpc/open_share')) return json(shared ? [shared] : []);
    if (p.endsWith('/rpc/purge_trash')) return json(0);
    if (p.endsWith('/rest/v1/records') || p.endsWith('/rest/v1/shares')) return json([]);
    if (p.endsWith('/auth/v1/user')) return json(USER);
    return json({});
  });
  return { ctx, page, phone, errors, foreign, share: (item) => (shared = item) };
}
const noSideScroll = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const dialog = (page, name) => page.getByRole('dialog', { name });

async function newPiece(page) {
  await page.getByRole('button', { name: 'New single piece' }).click();
  await page
    .locator('dialog[open]')
    .getByRole('button', { name: /Sideboard/ })
    .first()
    .click();
  await page
    .locator('dialog[open]')
    .waitFor({ state: 'detached' })
    .catch(() => {});
  await page.waitForTimeout(800);
}
const checked = (page) =>
  page.getByRole('radiogroup', { name: 'View' }).getByRole('radio', { checked: true }).innerText();
const canvasShown = (page) =>
  page
    .locator('.view.three.active canvas')
    .first()
    .isVisible()
    .catch(() => false);
const sizes = (page) =>
  page.evaluate(() =>
    ['h1', 'h2', 'h3'].map((t) => [
      t,
      [...document.querySelectorAll(t)]
        .filter((e) => e.getClientRects().length)
        .map((e) => parseFloat(getComputedStyle(e).fontSize)),
    ]),
  );
const scaleOk = (rows) =>
  rows.every(([t, list]) => list.every((px) => px === { h1: 24, h2: 20, h3: 17 }[t]));

for (const width of [1280, 390, 1600]) {
  // ---- Signed out: views, headings, notice, backup, sign-in screens, no foreign request ----------------------------
  const a = await context(width);
  const { page, phone } = a;
  await page.goto(url);
  await page.waitForTimeout(600);
  const projSizes = await sizes(page);
  await newPiece(page);
  const def = await checked(page);
  check(
    width,
    'N145 default view: 2D below 1500 px, Both from 1500 px',
    def === (width >= 1500 ? 'Both' : '2D'),
    def,
  );
  for (const mode of ['Compose', 'Build & Preview']) {
    await page.getByRole('radio', { name: mode }).click();
    await page.waitForTimeout(300);
    const labels = await page
      .getByRole('radiogroup', { name: 'View' })
      .getByRole('radio')
      .allInnerTexts();
    check(
      width,
      `N76 N145 ${mode}: View reads 2D · 3D · Both`,
      labels.join(' · ') === '2D · 3D · Both',
      labels.join(' · '),
    );
    await page.getByRole('radio', { name: '3D', exact: true }).click();
    await page.waitForTimeout(1200);
    check(width, `N145 ${mode}: 3D shows the 3D view`, await canvasShown(page));
    await page.getByRole('radio', { name: 'Both' }).click();
    await page.waitForTimeout(800);
    const both =
      (await canvasShown(page)) && (await page.locator('.view.front.active').isVisible());
    check(width, `N76 N145 ${mode}: Both shows 2D and 3D`, both);
    if (phone) {
      const fronts = await page.getByText('Fronts', { exact: true }).isVisible();
      await page.locator('.stage-tools summary', { hasText: 'Options' }).click();
      const inOpts = await page.getByText('Exploded 3D').isVisible();
      await page.locator('.stage-tools summary', { hasText: 'Options' }).click();
      check(width, `N145 ${mode}: Fronts in the row, Exploded 3D behind Options`, fronts && inOpts);
    }
    check(width, `N145 ${mode}: no horizontal scroll`, await noSideScroll(page));
  }
  await page.getByRole('radio', { name: 'Compose' }).click();
  check(width, 'N145 the view stays when the mode changes', (await checked(page)) === 'Both');
  await page.screenshot({ path: `${out}/catch-up-views-${width}.png` });
  const edSizes = await sizes(page);

  await page.locator('a[href="#catalog"]').first().click();
  await page.waitForTimeout(800);
  const catSizes = await sizes(page);
  await page
    .locator('a[href="#"]', { hasText: 'Projects' })
    .first()
    .click()
    .catch(() => page.goto(url));
  await page.waitForTimeout(800);
  const notice = page.getByText(/Your designs are only on this device/);
  check(
    width,
    'N141 Projects: "Your designs are only on this device" with Back up',
    (await notice.isVisible()) &&
      (await page.getByRole('button', { name: 'Back up', exact: true }).isVisible()),
  );
  await page.screenshot({ path: `${out}/catch-up-notice-${width}.png` });

  // N134: Settings › Saved data › Choose backup folder → Last backup; Back up now.
  await page.locator('a[href="#editor"]').first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.locator('dialog[open]');
  const setSizes = await sizes(page);
  await settings.getByText('Saved data', { exact: true }).scrollIntoViewIfNeeded();
  await settings.getByRole('button', { name: 'Choose backup folder' }).click();
  const last = settings.getByText(/Last backup: .* — \d+ items?/);
  await last.waitFor({ timeout: 8000 }).catch(() => {});
  check(
    width,
    'N134 Settings › Saved data: Choose backup folder → "Last backup:"',
    await last.isVisible(),
    await last.innerText().catch(() => ''),
  );
  check(
    width,
    'N134 "Back up now" is offered',
    await settings.getByRole('button', { name: 'Back up now' }).isEnabled(),
  );
  await page.screenshot({ path: `${out}/catch-up-saved-data-${width}.png` });
  check(width, 'N134 no horizontal scroll', await noSideScroll(page));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const all = [...projSizes, ...edSizes, ...catSizes, ...setSizes];
  check(
    width,
    'N115 headings: h1 24, h2 20, h3 17 on Projects, editor, Catalog, Settings',
    scaleOk(all),
    JSON.stringify(all),
  );

  // N136, N137: the sign-in screens.
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  const signIn = dialog(page, 'Sign in');
  await signIn.waitFor();
  check(
    width,
    'N136 "Continue with Google" from the bare app',
    await signIn.getByRole('button', { name: 'Continue with Google' }).isVisible(),
  );
  await signIn.getByLabel('Email').focus();
  await page.keyboard.press('Tab');
  const ring = await page.evaluate(() => {
    // A focus ring is an outline or a box-shadow ring (fields use the latter).
    const s = getComputedStyle(document.activeElement);
    return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none';
  });
  check(width, 'N137 focus is visible in the dialog', ring);
  await page.screenshot({ path: `${out}/catch-up-sign-in-${width}.png` });
  await signIn.getByRole('button', { name: 'Forgot password?' }).click();
  const forgot = dialog(page, 'Forgot password');
  check(
    width,
    'N137 "Forgot password?" → "Send reset link"',
    await forgot.getByRole('button', { name: 'Send reset link' }).isVisible(),
  );
  check(width, 'N137 no horizontal scroll', await noSideScroll(page));
  check(
    width,
    'N127 N132 signed out: no request to any other origin',
    a.foreign.size === 0,
    [...a.foreign].join(', '),
  );
  check(
    width,
    'N132 no CSP violation or page error',
    a.errors.length === 0,
    a.errors.slice(0, 2).join(' | '),
  );
  await a.ctx.close();

  // ---- N135: a remembered account shows at once, offline, with no request ------------------------------------------
  const c = await context(width, { offline: true });
  await c.page.goto(url);
  await c.page.waitForTimeout(800);
  const initial = await c.page.getByRole('button', { name: 'Account', exact: true }).innerText();
  check(
    width,
    'N135 offline start shows the remembered account (initial "M") with no request',
    initial.trim() === 'M' && c.foreign.size === 0,
    `${initial} ${[...c.foreign]}`,
  );
  await c.ctx.close();

  // ---- Signed in (test backend answered locally): sync status, Account panel, shared-item preview ------------------
  const b = await context(width, { signedIn: true });
  await b.page.goto(url);
  await b.page.waitForTimeout(1500);
  const status = b.page.locator('.sync-status');
  check(
    width,
    'N140 the sync status is in the top bar',
    await status.isVisible(),
    await status.getAttribute('title'),
  );
  check(width, 'N140 no horizontal scroll', await noSideScroll(b.page));
  await b.page.getByRole('button', { name: 'Account', exact: true }).click();
  const acct = dialog(b.page, 'Account');
  await acct.waitFor();
  check(
    width,
    'N143 Account › "Add another account"',
    await acct.getByRole('button', { name: 'Add another account' }).isVisible(),
  );
  await b.page.screenshot({ path: `${out}/catch-up-account-${width}.png` });
  await b.page.keyboard.press('Escape');
  // A piece to share: the design as the app saved it.
  await newPiece(b.page);
  const design = await b.page.evaluate(
    () =>
      new Promise((res) => {
        const r = indexedDB.open('furniture-builder');
        r.onsuccess = () => {
          const g = r.result.transaction('designs').objectStore('designs').getAll();
          g.onsuccess = () => res(g.result[0]?.design);
        };
      }),
  );
  b.share({
    name: 'Shared sideboard',
    kind: 'design',
    body: design,
    body_schema: 3,
    updated_at: new Date().toISOString(),
  });
  await b.page.evaluate((id) => (location.hash = `#share=${id}`), shareId);
  const prev = dialog(b.page, 'Shared sideboard');
  await prev.waitFor({ timeout: 8000 }).catch(() => {});
  const okPrev =
    (await prev
      .getByText(/Piece · \d+ × \d+ × \d+ mm · \d+ parts/)
      .isVisible()
      .catch(() => false)) &&
    (await prev
      .getByRole('img', { name: /^Front view of / })
      .isVisible()
      .catch(() => false));
  check(width, 'N144 the link opens a preview: size, parts, front view', okPrev);
  await prev
    .getByRole('button', { name: 'Show in 3D' })
    .click()
    .catch(() => {});
  await b.page.waitForTimeout(1500);
  check(
    width,
    'N144 Show in 3D draws the shared piece',
    await prev
      .locator('canvas')
      .isVisible()
      .catch(() => false),
  );
  check(width, 'N144 no horizontal scroll', await noSideScroll(b.page));
  await b.page.screenshot({ path: `${out}/catch-up-preview-${width}.png` });
  await prev.getByRole('button', { name: 'Open a copy' }).click();
  await b.page.waitForTimeout(800);
  const count = await b.page.evaluate(
    () =>
      new Promise((res) => {
        const r = indexedDB.open('furniture-builder');
        r.onsuccess = () => {
          const g = r.result.transaction('designs').objectStore('designs').count();
          g.onsuccess = () => res(g.result);
        };
      }),
  );
  check(width, 'N144 "Open a copy" saves a new copy', count === 2, `${count} designs`);
  const other = [...b.foreign].filter((h) => h !== BACKEND);
  check(
    width,
    'N127 signed in: requests only to the build’s backend',
    other.length === 0,
    [...b.foreign].join(', '),
  );
  check(
    width,
    'N132 signed in: no CSP violation or page error',
    b.errors.length === 0,
    b.errors.slice(0, 2).join(' | '),
  );
  await b.ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
