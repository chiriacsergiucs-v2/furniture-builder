// Find-it acceptance for one control height and button labels that never wrap (ADR-113, backlog N112), run against a
// production build:
//   pnpm build && pnpm exec vite preview --port 4173 &  node tools/control-rule/find-it.mjs http://localhost:4173/furniture-builder/ <out dir>
// Starts from the bare app at 1280 px (mouse) and 390 px (touch) and walks Projects, Catalog, the editor (Compose and
// Build & Preview, a single piece and a project) and Settings. In every state it measures each visible button, tab
// and segmented label against its line height (one line each), and each control's height: 38 px with a mouse, 30 in
// toolbars and tables (`--control-h`, `--control-h-sm`), and at least 44 × 44 with touch. Not part of `pnpm test`.
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

// Every visible button, tab and segmented option in the page (or under `scope`): its label lines and its size. A
// label wraps when one of its text runs breaks over two line boxes (a `.sub` line under a name is a second run, not
// a wrap). Text links (`.link`, `.btn.link`) sit in sentences and may wrap; they are not buttons. The Projects list's
// row names (G-139) are text beside the row's icon buttons, not a button label.
const audit = (page, scope) =>
  page.evaluate((scope) => {
    // Toolbars and tables: the only places for the small height (`--control-h-sm`).
    const TOOLBARS =
      '.bar, .stage-tools, .plan-tools, .view-tools, .view-options-panel, .catalog-toolbar, .family-tools, .price-tools, .bulk-bar, .count-stepper, table, [role=toolbar]';
    const roots = scope ? [...document.querySelectorAll(scope)] : [document.body];
    // The breadcrumb's steps read as links with a mouse; with touch they are 44 px targets like any control.
    const coarse = matchMedia('(pointer: coarse)').matches;
    const seen = new Set();
    const wraps = [];
    const icons = [];
    const sizes = [];
    const name = (e) =>
      (e.getAttribute('aria-label') || e.innerText || e.title || e.value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 48);
    const tag = (e) =>
      `${e.tagName.toLowerCase()}${typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).join('.') : ''}`;
    const shown = (e) => {
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height || e.closest('svg, [hidden], .sr-only')) return false;
      return e.checkVisibility({ visibilityProperty: true, opacityProperty: false });
    };
    const isLink = (e) =>
      e.matches('.link, .btn.link, .danger-link, a:not(.btn)') || (!coarse && e.closest('.crumbs'));
    const exempt = (e) => e.closest('ul.library .row-btn');
    for (const root of roots) {
      const controls = root.querySelectorAll(
        'button, [role=tab], [role=radio], summary.btn, label.btn, a.btn, select, input.input, .field > input, .mm, .counter, .search',
      );
      for (const e of controls) {
        if (seen.has(e) || !shown(e) || isLink(e)) continue;
        seen.add(e);
        const r = e.getBoundingClientRect();
        // Label lines: each text run must sit on one line box.
        if (e.matches('button, [role=tab], [role=radio], summary, label, a') && !exempt(e)) {
          const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            const t = walker.currentNode;
            if (!t.textContent.trim() || !shown(t.parentElement)) continue;
            const range = document.createRange();
            range.selectNodeContents(t);
            const rects = [...range.getClientRects()].filter((q) => q.width > 0.5);
            const tops = new Set(rects.map((q) => Math.round(q.top)));
            const lh =
              parseFloat(getComputedStyle(t.parentElement).lineHeight) ||
              parseFloat(getComputedStyle(t.parentElement).fontSize) * 1.2;
            const b = range.getBoundingClientRect();
            if (tops.size > 1 || b.height > lh * 1.5)
              wraps.push(
                `"${t.textContent.trim().slice(0, 40)}" in ${tag(e)} ${Math.round(r.width)}×${Math.round(r.height)}: ${tops.size} lines, ${Math.round(b.height)} px for line height ${Math.round(lh)}`,
              );
          }
        }
        // A label too long for its box ends in an ellipsis (its text span is cut, not the button's content) and
        // shows its full text in `title` once the pointer is on it.
        if (e.matches('button, [role=tab], [role=radio], .btn') && !exempt(e)) {
          if (e.scrollWidth > e.clientWidth + 1)
            wraps.push(
              `"${name(e)}" in ${tag(e)} is clipped (${e.scrollWidth} px in ${e.clientWidth})`,
            );
          else if ([...e.querySelectorAll('span')].some((x) => x.scrollWidth > x.clientWidth + 1)) {
            e.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
            if (!e.title) wraps.push(`"${name(e)}" in ${tag(e)} is cut and has no title`);
          }
        }
        // List rows and two-line buttons (a name and a sub-line), the card's fold row, chips and the 3D handles keep
        // their own height: they are measured for touch only. Stepper buttons and inner inputs belong to their field.
        const kind = e.matches(
          '.row-btn, .btn.stack, .steps button, .cs-fold, .chip, .model-handle, .front-hit',
        )
          ? 'row'
          : e.closest('.segmented') && e.matches('button')
            ? 'seg-option'
            : e.closest('.mm, .counter, .cs-counter') && e.matches('button')
              ? 'step'
              : e.matches('.mm input, .search input')
                ? 'inner'
                : 'control';
        // Icon buttons are square and named by an aria-label.
        if (
          e.matches('.btn.icon') &&
          (!e.getAttribute('aria-label') || Math.abs(r.width - r.height) > 1)
        )
          icons.push(
            `${tag(e)} "${name(e)}" ${Math.round(r.width)}×${Math.round(r.height)}${e.getAttribute('aria-label') ? '' : ', no aria-label'}`,
          );
        sizes.push({
          what: `${tag(e)} "${name(e)}"`,
          kind,
          w: r.width,
          h: r.height,
          small: !!e.closest(TOOLBARS),
        });
      }
      for (const s of root.querySelectorAll('.segmented')) {
        if (seen.has(s) || !shown(s)) continue;
        seen.add(s);
        const r = s.getBoundingClientRect();
        sizes.push({
          what: `${tag(s)} "${name(s)}"`,
          kind: 'segmented',
          w: r.width,
          h: r.height,
          small: !!s.closest(TOOLBARS),
          rows: new Set(
            [...s.querySelectorAll('button')].map((b) => Math.round(b.getBoundingClientRect().top)),
          ).size,
        });
      }
    }
    return { wraps, sizes, icons, coarse };
  }, scope);

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
  const shot = (name) => page.screenshot({ path: `${out}/control-rule-${name}-${width}.png` });
  const noSideScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const dlg = page.locator('dialog[open]');
  const peek = page.locator('.sheet-peek');
  const sheet = async (open) => {
    if (phone && (await peek.getAttribute('aria-expanded')) !== String(open)) await peek.click();
    await page.waitForTimeout(250);
  };
  // Folded groups in the side panel open so their buttons are measured too.
  const unfold = () =>
    page.evaluate(() => {
      for (const d of document.querySelectorAll('main.work .side details')) d.open = true;
    });
  const heights = new Set();
  // Measure one state: no wrapped label, every control on the rhythm.
  const state = async (label, scope) => {
    await page.waitForTimeout(250);
    const a = await audit(page, scope);
    await shot(label.replace(/[^a-z0-9]+/gi, '-').toLowerCase());
    check(
      width,
      `${label}: no button, tab or segmented label over one line`,
      a.wraps.length === 0,
      a.wraps.slice(0, 6).join(' | '),
    );
    const bad = [];
    for (const s of a.sizes) {
      if (phone) {
        if (s.kind === 'inner') continue;
        if (s.kind === 'segmented') continue;
        if (s.h < 43.5 || (s.w < 43.5 && s.kind !== 'step'))
          bad.push(`${s.what} ${Math.round(s.w)}×${Math.round(s.h)}`);
        if (s.kind === 'step' && s.w < 43.5)
          bad.push(`${s.what} ${Math.round(s.w)}×${Math.round(s.h)}`);
      } else {
        if (s.kind === 'row' || s.kind === 'inner' || s.kind === 'step' || s.kind === 'seg-option')
          continue;
        const want = s.kind === 'segmented' ? [38, 30] : s.small ? [30, 38] : [38];
        heights.add(Math.round(s.h));
        if (!want.some((h) => Math.abs(s.h - h) < 0.6))
          bad.push(`${s.what} h ${Math.round(s.h * 10) / 10} (want ${want.join(' or ')})`);
      }
    }
    check(
      width,
      phone
        ? `${label}: every control at least 44 × 44 with touch`
        : `${label}: every control 38 px tall (30 in toolbars and tables)`,
      bad.length === 0,
      `${a.sizes.length} measured${bad.length ? '; ' + bad.slice(0, 8).join(' | ') : ''}`,
    );
    const nIcons = a.sizes.filter((x) => x.what.startsWith('button.btn.icon')).length;
    check(
      width,
      `${label}: icon buttons square with an aria-label`,
      a.icons.length === 0,
      `${nIcons} icon buttons${a.icons.length ? '; ' + a.icons.slice(0, 6).join(' | ') : ''}`,
    );
    return a;
  };
  // One row at this width: all the elements share a top and none is cut.
  const oneRow = async (name, loc) => {
    const info = await loc.evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return { top: Math.round(r.top), right: r.right, cut: e.scrollWidth > e.clientWidth + 1 };
      }),
    );
    const tops = new Set(info.map((i) => i.top));
    check(
      width,
      `${name} fit one row`,
      info.length > 0 && tops.size === 1 && info.every((i) => !i.cut && i.right <= width + 0.5),
      `${info.length} found, ${tops.size} rows${info.some((i) => i.cut) ? ', cut' : ''}`,
    );
  };
  const oneLine = async (name, loc) => {
    const r = await loc.evaluate((e) => {
      const tops = new Set();
      const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const range = document.createRange();
        range.selectNodeContents(walker.currentNode);
        for (const q of range.getClientRects()) if (q.width > 0.5) tops.add(Math.round(q.top));
      }
      return {
        lines: tops.size,
        cut: e.scrollWidth > e.clientWidth + 1,
        h: e.getBoundingClientRect().height,
      };
    });
    check(
      width,
      `"${name}" on one line`,
      r.lines === 1 && !r.cut,
      `${r.lines} lines, ${Math.round(r.h)} px tall`,
    );
  };

  // 1. Bare app: Projects.
  await page.goto(url);
  await page.getByRole('heading', { name: 'Projects', level: 1 }).waitFor();
  const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  check(
    width,
    phone ? 'touch screen (pointer: coarse)' : 'mouse (pointer: fine)',
    coarse === phone,
  );
  const token = await page.evaluate(() =>
    ['--control-h', '--control-h-sm', '--touch'].map((t) =>
      getComputedStyle(document.documentElement).getPropertyValue(t).trim(),
    ),
  );
  check(
    width,
    `tokens --control-h ${phone ? 44 : 38}, --control-h-sm ${phone ? 44 : 30}, no --touch`,
    token[0] === (phone ? '44px' : '38px') && token[1] === (phone ? '44px' : '30px') && !token[2],
    token.join(' / '),
  );
  await state('Projects (empty)');

  // 2. A project with three pieces side by side; Compose.
  await page.getByRole('button', { name: 'Create a new project', exact: true }).click();
  await dlg.locator('input').fill(`Rule ${width}`);
  await dlg.getByRole('button', { name: 'Create project' }).click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await page.getByRole('radio', { name: 'Compose' }).click();
  await sheet(true);
  await state('Project, Compose (empty)');
  const addPiece = async (search, name) => {
    await sheet(true);
    await page.getByRole('button', { name: 'Add a piece', exact: true }).click();
    await dlg.getByRole('searchbox', { name: 'Search the items' }).fill(search);
    await dlg.getByRole('button', { name }).first().click();
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
    const place = page.getByRole('button', { name: 'Place to the right', exact: true });
    if (await place.isVisible().catch(() => false)) await place.click();
    await page.waitForTimeout(300);
  };
  await addPiece('Base cabinet', /Base cabinet, doors: 1 door \+ shelf/);
  await addPiece('Base cabinet', /Base cabinet, doors: Drawer over door/);
  await addPiece('Base cabinet', /Base cabinet, doors: 1 door \+ shelf/);
  await sheet(true);
  await state('Project, Compose (three pieces)');
  // The middle piece has a neighbour on each side: both merge buttons show.
  await page.locator('ul.pieces > li').nth(1).getByRole('button').first().click();
  await sheet(true);
  await unfold();
  const mergeR = page.getByRole('button', { name: /^Merge with right piece/ });
  const mergeL = page.getByRole('button', { name: /^Merge with left piece/ });
  check(
    width,
    '"Merge with right piece" and "Merge with left piece", each with the neighbour\'s name',
    (await mergeR.count()) === 1 &&
      (await mergeL.count()) === 1 &&
      /Base cabinet, 1 door/.test(await mergeR.innerText()) &&
      /Base cabinet, 1 door/.test(await mergeL.innerText()),
  );
  await mergeR.scrollIntoViewIfNeeded();
  await oneLine('Merge with right piece', mergeR.locator('.lbl'));
  await oneLine('Merge with left piece', mergeL.locator('.lbl'));
  await state('Project, selected piece (all groups open)');

  // 3. Project Settings: Run parts.
  await sheet(false);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await dlg.waitFor();
  const suggest = dlg.getByRole('button', { name: 'Suggest run parts', exact: true });
  await suggest.scrollIntoViewIfNeeded();
  check(
    width,
    '"Suggest run parts" with the full text in its title',
    (await suggest.isVisible()) &&
      /worktop, plinth, fillers and covers/.test((await suggest.getAttribute('title')) ?? ''),
  );
  await oneLine('Suggest run parts', suggest);
  await state('Project Settings', 'dialog[open]');
  await page.keyboard.press('Escape');
  await dlg.waitFor({ state: 'detached' }).catch(() => {});

  // 4. Build & Preview, project: the mode switch and the five result tabs, then each tab's panel.
  const bp = page.getByRole('radio', { name: 'Build & Preview' });
  await oneLine('Build & Preview', bp);
  await bp.click();
  await page.waitForTimeout(800);
  const tabs = page
    .getByRole('tablist')
    .filter({ has: page.getByRole('tab', { name: /^Parts/ }) })
    .getByRole('tab');
  check(
    width,
    'result tabs: Parts, Sheets, Hardware, Shopping, Checks',
    (await tabs.allInnerTexts()).map((t) => t.replace(/\s*\d+$/, '').trim()).join(',') ===
      'Parts,Sheets,Hardware,Shopping,Checks',
    (await tabs.allInnerTexts()).join(','),
  );
  await oneRow('the five result tabs', tabs);
  check(
    width,
    'the Shopping tab keeps the accessible name "Shopping list"',
    (await page.getByRole('tab', { name: 'Shopping list', exact: true }).count()) === 1,
  );
  for (const t of ['Parts', 'Sheets', 'Hardware', 'Shopping list', 'Checks']) {
    const tab = page.getByRole('tab', { name: new RegExp(`^${t}`) });
    // The 3D view keeps the page busy in a headless browser: the tab gets the click event itself.
    if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.dispatchEvent('click');
    await page.waitForTimeout(500);
    await state(`Project, Build & Preview › ${t}`);
  }

  // 5. A single piece from the bare app: Compose (nothing, the whole piece, a space), Settings, Build & Preview.
  await page.goto(url);
  await page.getByRole('heading', { name: 'Projects', level: 1 }).waitFor();
  await page.getByRole('button', { name: 'New single piece' }).click();
  await dlg
    .getByRole('button', { name: /Wall cabinet/ })
    .first()
    .click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  await page.getByRole('radio', { name: 'Compose' }).click();
  await sheet(true);
  await unfold();
  await state('Piece, Compose (whole piece)');
  await sheet(false);
  const svg = page.locator('.view.front svg').first();
  const tap = async (fy) => {
    const b = await svg.boundingBox();
    if (phone) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height * fy);
    else await page.mouse.click(b.x + b.width / 2, b.y + b.height * fy);
    await page.waitForTimeout(450);
  };
  await tap(0.6);
  await tap(0.6);
  await state('Piece, Compose (drawing, a space selected)');
  await sheet(true);
  await unfold();
  await state('Piece, Compose (space editor)');
  await sheet(false);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await dlg.waitFor();
  await state('Piece Settings', 'dialog[open]');
  await page.keyboard.press('Escape');
  await dlg.waitFor({ state: 'detached' }).catch(() => {});
  await page.getByRole('radio', { name: 'Build & Preview' }).click();
  await page.waitForTimeout(800);
  await oneRow('the five result tabs (piece)', page.getByRole('tab'));
  for (const t of ['Parts', 'Sheets', 'Hardware', 'Shopping list', 'Checks']) {
    const tab = page.getByRole('tab', { name: new RegExp(`^${t}`) });
    if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.dispatchEvent('click');
    await page.waitForTimeout(500);
    await state(`Piece, Build & Preview › ${t}`);
  }

  // 6. Projects with rows, then the Catalog (templates, its actions, Saved, Brands).
  const places = page.getByRole('navigation', { name: 'Places' });
  await places.getByRole('link', { name: 'Projects' }).click();
  await page.getByRole('heading', { name: 'Projects', level: 1 }).waitFor();
  await state('Projects (with rows)');
  await places.getByRole('link', { name: /Catalog/ }).click();
  await page.getByRole('heading', { name: 'Catalog', level: 1 }).waitFor();
  await page.waitForTimeout(500);
  await state('Catalog (templates)');
  await page.getByRole('button', { name: 'Edit template' }).first().click();
  await page.locator('.template-editor').waitFor();
  await state('Catalog (edit template)', '.template-editor');
  await page.locator('.template-editor').getByRole('button', { name: 'Cancel' }).click();
  const more = page.getByText('More catalog actions');
  if (await more.isVisible().catch(() => false)) {
    await more.click();
    await state('Catalog (more actions open)');
    await more.click();
  }
  await page.getByRole('tab', { name: 'Saved on this device' }).click();
  await state('Catalog (saved on this device)');
  await page.getByRole('tab', { name: 'Brands' }).click();
  await state('Catalog (brands)');

  check(
    width,
    `heights in use: ${[...heights].sort((a, b) => a - b).join(', ') || 'touch'}`,
    !phone || true,
  );
  check(width, 'no sideways scroll', await noSideScroll());
  check(width, 'no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
