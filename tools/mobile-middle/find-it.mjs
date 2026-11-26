// Find-it acceptance for the phone editor middle ground (ADR-295, backlog N383), run against a production build:
//   pnpm build && pnpm preview &  node tools/mobile-middle/find-it.mjs [url] [out dir] [--json report.json]
// Starts every context from the bare app at 390×844 and 844×390, finds the edit bar, the one scrolling panel, the jump
// index, Results, Settings and Material by role and visible text, counts the taps to every control, and compares the
// quick-count card box with its host in 3D. Writes `<out dir>/mobile-middle-taps.json` and screenshots
// `<out dir>/mm-<w>x<h>-<step>.png`. Exit 1 when any check fails; a failing step is a FAIL, never a crash.
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchBrowser, makeChecker, outDir, previewUrl } from '../lib/harness.mjs';

const url = previewUrl();
const out = outDir();
const jsonAt = process.argv.indexOf('--json');
const jsonPath = jsonAt > -1 ? process.argv[jsonAt + 1] : undefined;
mkdirSync(out, { recursive: true });
const results = [];
const { check } = makeChecker(results);
const TIMEOUT = 10_000;
const PORTRAIT = { width: 390, height: 844 };
const LANDSCAPE = { width: 844, height: 390 };
const SECTIONS = [
  'Structure',
  'Divide this space',
  'Contents',
  'Doors and handles',
  'Layouts',
  'Construction',
  'Drawers and runners',
  'Boards, sheets and saw cut',
  'Fasteners',
  'Checks',
  'Hardware',
];
const taps = []; // one row per control: { state, surface, label, tag, taps }
const reached = new Map(); // section -> states where a block with that title was found

const browser = await launchBrowser({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

const tag = (vp) => `${vp.width}x${vp.height}`;
const msg = (e) => String(e?.message ?? e).split('\n')[0];
// A failing step is a FAIL line, not a crash.
const step = async (w, name, fn) => {
  try {
    await fn();
  } catch (e) {
    check(w, `${name} (script error)`, false, msg(e));
  }
};
const tap = async (loc) => {
  try {
    await loc.tap({ timeout: TIMEOUT });
  } catch {
    await loc.click({ timeout: TIMEOUT });
  }
};

// A fresh context and page from the bare app: New single piece › Chest of drawers › skip the hints.
const freshPage = async (vp) => {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(TIMEOUT);
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.goto(url);
  await page.getByRole('button', { name: 'New single piece' }).click();
  await page
    .locator('dialog[open]')
    .getByRole('button', { name: /Chest of drawers/ })
    .first()
    .click();
  await page.locator('main.work').waitFor({ state: 'visible' });
  const hints = page.getByRole('dialog', { name: 'Getting started' });
  try {
    await hints.waitFor({ state: 'visible', timeout: 1500 });
    await hints.getByRole('button', { name: 'Skip' }).click();
  } catch {
    /* no hints */
  }
  await page.waitForTimeout(200);
  return { ctx, page };
};
// The first tap selects the piece, the second the space inside it (ADR-083).
const selectPiece = async (page) => {
  await page.locator('.el-space').first().click({ force: true });
  await page.waitForTimeout(300);
};
const selectSpace = async (page) => {
  await selectPiece(page);
  await page.locator('.el-space').first().click({ force: true });
  await page.waitForTimeout(300);
};
const select = (page, state) => (state === 'space' ? selectSpace(page) : selectPiece(page));

const bar = (page) => page.getByRole('toolbar', { name: 'Editor bar' });
const editBtn = (page) => bar(page).getByRole('button', { name: /^Edit/ });
const panel = (page) => page.getByRole('complementary', { name: 'Compose' });
const visible = async (loc) =>
  loc
    .first()
    .isVisible()
    .catch(() => false);
const openEdit = async (page) => {
  await tap(editBtn(page));
  await panel(page).waitFor({ state: 'visible' });
  await page.waitForTimeout(250);
};
const shot = (page, vp, name) =>
  page.screenshot({ path: `${out}/mm-${tag(vp)}-${name}.png` }).catch(() => {});

// Every control in `root` that is shown (it has a box; a closed <details> has none), outside the head and edit bar,
// with its accessible label: aria-label, aria-labelledby, label[for], wrapping label, text, placeholder, title.
const listControls = (page, rootSel) =>
  page.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (!root) return null;
    const text = (e) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const labelOf = (e) => {
      const al = e.getAttribute('aria-label');
      if (al) return al.trim();
      const by = e.getAttribute('aria-labelledby');
      if (by) {
        const t = by
          .split(/\s+/)
          .map((id) => text(document.getElementById(id)))
          .join(' ')
          .trim();
        if (t) return t;
      }
      if (e.id) {
        const l = document.querySelector(`label[for="${CSS.escape(e.id)}"]`);
        if (l && text(l)) return text(l);
      }
      const w = e.closest('label');
      if (w && text(w)) return text(w);
      return (
        (e.tagName === 'SELECT' ? '' : text(e)) ||
        e.getAttribute('placeholder') ||
        e.getAttribute('title') ||
        '(unlabelled)'
      );
    };
    const skip =
      '[role="toolbar"][aria-label="Editor bar"], .lens-head, .card-head, [data-card-head], header, .sheet-peek';
    return [...root.querySelectorAll('input, select, textarea, button')]
      .filter((e) => e.type !== 'hidden' && !e.closest(skip))
      .filter((e) => {
        const r = e.getBoundingClientRect();
        const cs = getComputedStyle(e);
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
      })
      .map((e) => ({ label: labelOf(e), tag: e.tagName.toLowerCase() }));
  }, rootSel);

// Section titles shown in `rootSel`: aria-label groups, .group-title, .card-title, headings, and the Results buttons
// (Hardware is a button in the Results block).
const collectTitles = (page, rootSel) =>
  page.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (!root) return [];
    const t = (e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim();
    const out = [];
    for (const e of root.querySelectorAll(
      'section[aria-label], div[aria-label], fieldset[aria-label]',
    ))
      out.push(e.getAttribute('aria-label'));
    for (const e of root.querySelectorAll('.group-title, .card-title, h1,h2,h3,h4,h5,h6,summary'))
      out.push(t(e));
    for (const b of root.querySelectorAll('section[aria-label="Results"] button')) out.push(t(b));
    return out;
  }, rootSel);
const markReached = (where, titles) => {
  for (const sec of SECTIONS)
    if (titles.some((x) => x.trim().toLowerCase() === sec.toLowerCase()))
      reached.set(sec, [...new Set([...(reached.get(sec) ?? []), where])]);
};

const record = (w, state, surface, n, list) => {
  const seen = new Set();
  for (const c of list ?? []) {
    const key = `${c.tag}|${c.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    taps.push({ state, surface, label: c.label, tag: c.tag, taps: n });
  }
  check(
    w,
    `${state}: ${surface} lists controls in ${n} tap(s)`,
    (list?.length ?? 0) > 0,
    `${seen.size} controls`,
  );
};

// ---- the three surfaces of one state, each from a fresh bare app --------------------------------------------------
const editSurface = async (vp, state) => {
  const w = tag(vp);
  const { ctx, page } = await freshPage(vp);
  try {
    await select(page, state);
    await openEdit(page);
    record(w, state, 'Edit panel', 1, await listControls(page, 'aside[aria-label="Compose"]'));
    // Expanded at once: no <details>; each titled block shows after a scroll.
    const details = await page.locator('aside[aria-label="Compose"] details').count();
    check(w, `${state}: no <details> inside the Edit panel`, details === 0, `${details} found`);
    const blocks = panel(page).locator('[data-lens-key]');
    const n = await blocks.count();
    let bad = [];
    const titles = [];
    for (let i = 0; i < n; i++) {
      const b = blocks.nth(i);
      await b.scrollIntoViewIfNeeded();
      const info = await b.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const h = el.querySelector('h1,h2,h3,h4,h5,h6,summary,[class*="title"]');
        const body = [...el.children].some((c) => c !== h && c.getBoundingClientRect().height > 0);
        return {
          key: el.getAttribute('data-lens-key'),
          title: (h?.textContent ?? el.getAttribute('data-lens-key') ?? '').trim(),
          h: r.height,
          body,
        };
      });
      titles.push(info.title);
      if (!(await b.isVisible()) || info.h <= 0 || !info.body) bad.push(info.key);
    }
    check(
      w,
      `${state}: ${n} titled blocks, each visible with content after scrolling`,
      n > 0 && bad.length === 0,
      bad.join(', '),
    );
    markReached(`${state} panel`, [
      ...titles,
      ...(await collectTitles(page, 'aside[aria-label="Compose"]')),
    ]);
    // Jump index: fixed order, disabled ones give a reason.
    const jump = panel(page).getByRole('combobox', { name: 'Jump to section' });
    const opts = await jump.evaluate((s) =>
      [...s.options]
        .filter((o) => o.value !== '' && !o.hidden)
        .map((o) => ({ t: o.text.trim(), d: o.disabled })),
    );
    jumpOrders[state] = opts.map((o) => o.t.split(' — ')[0]);
    const noReason = opts.filter((o) => o.d && !o.t.includes(' — ')).map((o) => o.t);
    check(
      w,
      `${state}: Jump to section lists ${opts.length} options, disabled ones give a reason`,
      opts.length > 0 && noReason.length === 0,
      noReason.join(', '),
    );
    // Scrolling alone reaches Hardware.
    if (state === 'space') await hardwareByScroll(page, w);
  } catch (e) {
    check(w, `${state}: Edit panel (script error)`, false, msg(e));
  }
  await ctx.close();
};
const jumpOrders = {};

const hardwareByScroll = async (page, w) => {
  const found = await page.evaluate(async () => {
    const aside = document.querySelector('aside[aria-label="Compose"]');
    const scrollers = [aside, ...aside.querySelectorAll('*')].filter((e) => {
      const o = getComputedStyle(e).overflowY;
      return (o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight + 1;
    });
    const sc = scrollers.sort((a, b) => b.scrollHeight - a.scrollHeight)[0] ?? aside;
    const inView = () => {
      const pr = sc.getBoundingClientRect();
      return [...aside.querySelectorAll('button')].some((b) => {
        if (b.textContent.trim() !== 'Hardware') return false;
        const r = b.getBoundingClientRect();
        return (
          r.height > 0 &&
          r.top >= Math.max(0, pr.top) - 1 &&
          r.bottom <= Math.min(innerHeight, pr.bottom) + 1
        );
      });
    };
    sc.scrollTop = 0;
    let steps = 0;
    while (steps < 200) {
      await new Promise((r) => setTimeout(r, 40));
      if (inView()) return { ok: true, steps, h: sc.scrollHeight };
      const before = sc.scrollTop;
      sc.scrollTop += Math.max(60, Math.floor(sc.clientHeight * 0.6));
      steps++;
      if (sc.scrollTop === before) break;
    }
    await new Promise((r) => setTimeout(r, 40));
    return { ok: inView(), steps, h: sc.scrollHeight };
  });
  check(
    w,
    'a Hardware button is found by scrolling the panel only',
    found.ok,
    `${found.steps} steps, ${found.h} px tall`,
  );
};

const sheetSurface = async (vp, state, button) => {
  const w = tag(vp);
  const { ctx, page } = await freshPage(vp);
  try {
    await select(page, state);
    await tap(page.getByRole('button', { name: button, exact: true }).first());
    await page.waitForTimeout(500);
    const root = await page.evaluate(() => {
      const vis = (e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const cand = [
        ...document.querySelectorAll(
          'dialog[open], [role="dialog"], aside:not([aria-label="Compose"])',
        ),
      ].filter(vis);
      const slot = document.querySelector('#sheet-slot');
      const el = slot && vis(slot) && slot.children.length ? slot : cand[cand.length - 1];
      if (!el) return null;
      el.setAttribute('data-mm-root', '1');
      return '[data-mm-root="1"]';
    });
    check(w, `${state}: ${button} opens into a sheet`, !!root);
    const details = await page
      .locator('main.work details')
      .evaluateAll((l) => l.filter((e) => e.getBoundingClientRect().height > 0 || e.open).length);
    check(
      w,
      `${state}: no <details> in main.work with ${button} open`,
      details === 0,
      `${details} found`,
    );
    markReached(`${state} ${button}`, root ? await collectTitles(page, root) : []);
    record(w, state, button, 1, await listControls(page, root ?? 'main.work'));
  } catch (e) {
    check(w, `${state}: ${button} (script error)`, false, msg(e));
  }
  await ctx.close();
};

const resultsSurface = async (vp, state) => {
  const w = tag(vp);
  const { ctx, page } = await freshPage(vp);
  try {
    await select(page, state);
    await openEdit(page);
    const res = panel(page).locator('[data-lens-key]', { hasText: 'Results' }).first();
    const group = (await res.count()) ? res : panel(page);
    const names = ['Parts', 'Sheets', 'Hardware', 'Assembly', 'Shopping'];
    const missing = [];
    for (const n of names)
      if (!(await group.getByRole('button', { name: n, exact: true }).count())) missing.push(n);
    check(
      w,
      `${state}: Results has Parts, Sheets, Hardware, Assembly, Shopping`,
      missing.length === 0,
      missing.join(', '),
    );
    const hw = group.getByRole('button', { name: 'Hardware', exact: true }).first();
    await hw.scrollIntoViewIfNeeded();
    await tap(hw);
    await page.waitForTimeout(500);
    const out2 = page.locator('.output').first();
    await out2.waitFor({ state: 'visible' });
    const text = ((await out2.innerText()) ?? '').toLowerCase();
    const selected = await page
      .getByRole('tab', { name: 'Hardware' })
      .first()
      .getAttribute('aria-selected')
      .catch(() => null);
    check(
      w,
      `${state}: Hardware (tap 2) shows the hardware output`,
      selected === 'true' || text.includes('hardware'),
    );
    if (state === 'space') await shot(page, vp, 'hardware');
    await page.evaluate(() => document.querySelector('.output')?.setAttribute('data-mm-root', '1'));
    record(w, state, 'Results output', 2, await listControls(page, '[data-mm-root="1"]'));
  } catch (e) {
    check(w, `${state}: Results (script error)`, false, msg(e));
  }
  await ctx.close();
};

// ---- 3D: the quick-count card fits its host -----------------------------------------------------------------------
const counters = async (vp) => {
  const w = tag(vp);
  const { ctx, page } = await freshPage(vp);
  try {
    await selectSpace(page);
    await page.getByRole('radio', { name: '3D', exact: true }).click();
    await page.waitForTimeout(2500);
    const fold = page.getByRole('button', { name: 'Quick counts', exact: true });
    if ((await fold.count()) && (await fold.first().getAttribute('aria-expanded')) === 'false') {
      await tap(fold.first());
      await page.waitForTimeout(300);
    }
    const card = page.getByRole('group', { name: 'Quick counts' }).first();
    await card.waitFor({ state: 'visible' });
    const r = await card.evaluate((el) => {
      const b = (e) => {
        const r = e.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom };
      };
      const cb = b(el);
      const dock = el.closest('#count-dock');
      let host = dock;
      let hostName = '#count-dock';
      if (!host) {
        const cv = document.querySelector('canvas');
        let p = cv?.parentElement ?? null;
        hostName = '3D pane';
        while (p) {
          const r = p.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && p.contains(el)) break;
          p = p.parentElement;
        }
        host = p ?? cv?.parentElement ?? null;
        if (!p) hostName = 'canvas parent';
      }
      const hb = host ? b(host) : null;
      const kids = [...el.querySelectorAll('button, output')]
        .map((e) => ({
          n: (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 24),
          t: e.tagName,
          ...b(e),
        }))
        .filter((k) => k.w > 0 && k.h > 0);
      return { cb, hb, hostName, kids, vw: innerWidth, vh: innerHeight };
    });
    const e = 0.5;
    const inside = (c, o) => c.x >= o.x - e && c.y >= o.y - e && c.r <= o.r + e && c.b <= o.b + e;
    const viewport = { x: 0, y: 0, r: r.vw, b: r.vh };
    const fmt = (o) =>
      o ? `[${o.x.toFixed(1)},${o.y.toFixed(1)} ${o.w.toFixed(1)}x${o.h.toFixed(1)}]` : 'none';
    check(
      w,
      '3D: quick-count card box is inside the viewport',
      inside(r.cb, viewport),
      `card ${fmt(r.cb)} viewport ${r.vw}x${r.vh}`,
    );
    const outsideKids = r.kids.filter((k) => !inside(k, r.cb));
    check(
      w,
      '3D: every card button and output is inside the card box',
      outsideKids.length === 0,
      outsideKids.map((k) => `${k.n} ${fmt(k)}`).join('; ') + ` card ${fmt(r.cb)}`,
    );
    check(
      w,
      `3D: card box is inside its host (${r.hostName})`,
      !!r.hb && inside(r.cb, r.hb),
      `card ${fmt(r.cb)} host ${fmt(r.hb)}`,
    );
    const btns = r.kids.filter((k) => k.t === 'BUTTON');
    const overlaps = [];
    for (let i = 0; i < btns.length; i++)
      for (let j = i + 1; j < btns.length; j++) {
        const a = btns[i];
        const c = btns[j];
        if (
          Math.min(a.r, c.r) - Math.max(a.x, c.x) > e &&
          Math.min(a.b, c.b) - Math.max(a.y, c.y) > e
        )
          overlaps.push(`${a.n} ${fmt(a)} x ${c.n} ${fmt(c)}`);
      }
    check(w, '3D: no two stepper controls overlap', overlaps.length === 0, overlaps.join('; '));
    await shot(page, vp, '3d-counters');
  } catch (e) {
    check(w, '3D counters (script error)', false, msg(e));
  }
  await ctx.close();
};

// ---- editor screenshots, the edit bar and the open/close robustness -----------------------------------------------
const editorFlow = async (vp) => {
  const w = tag(vp);
  const portrait = vp.width === 390;
  const { ctx, page } = await freshPage(vp);
  try {
    await selectSpace(page);
    await shot(page, vp, 'editor');
    if (vp.width > 760) {
      // Desktop layout (the canvas editor is phone-only, <= 760 px): Compose is the always-visible side panel.
      console.log(`INFO ${w} Edit x3 / goBack checks: n/a at desktop layout`);
      check(
        w,
        'no chip rail and no "Editor actions" toolbar',
        (await page.getByRole('toolbar', { name: 'Editor actions' }).count()) === 0 &&
          (await page.locator('.chip-rail').count()) === 0,
      );
      check(w, 'Compose side panel is visible', await visible(panel(page)));
      const sx = await page.evaluate(() => {
        const page = document.documentElement.scrollWidth <= innerWidth + 1;
        const stage = document.querySelector('main.work') ?? document.body;
        const bad = [...stage.querySelectorAll('*')]
          .filter((e) => {
            const r = e.getBoundingClientRect();
            const ox = getComputedStyle(e).overflowX;
            return (
              r.height > 0 &&
              (ox === 'auto' || ox === 'scroll') &&
              e.scrollWidth > e.clientWidth + 1
            );
          })
          .map((e) => ({
            name: `${e.tagName.toLowerCase()}.${String(e.className).trim().replace(/\s+/g, '.')}`,
            tools:
              !!e.closest('[role="radiogroup"], .stage-tools') ||
              !!e.querySelector('[role="radio"]'),
          }));
        return { page, bad };
      });
      check(w, 'no horizontal page scroll', sx.page);
      const info = sx.bad.filter((x) => x.tools).map((x) => x.name);
      if (info.length)
        console.log(`INFO ${w} stage-tools radio row scrolls sideways: ${info.join(', ')}`);
      const other = sx.bad.filter((x) => !x.tools).map((x) => x.name);
      check(
        w,
        'no element in the stage scrolls sideways (except the stage-tools radio row)',
        other.length === 0,
        other.join(', '),
      );
      await page.setViewportSize(PORTRAIT);
      await page.waitForTimeout(500);
      await page.setViewportSize(vp);
      await page.waitForTimeout(500);
      check(
        w,
        'rotation 844 to 390 and back keeps the editor and Compose, no errors',
        (await visible(panel(page))) &&
          (await visible(page.locator('main.work'))) &&
          page.errors.length === 0,
        page.errors.join(' | '),
      );
      await ctx.close();
      return;
    }
    const b = bar(page);
    await b.waitFor({ state: 'visible' });
    check(
      w,
      'edit bar has "Find an action" and an Edit button',
      (await visible(b.getByRole('button', { name: 'Find an action' }))) &&
        (await visible(editBtn(page))),
    );
    check(
      w,
      'no chip rail (no "Editor actions" toolbar, no .chip-rail)',
      (await page.getByRole('toolbar', { name: 'Editor actions' }).count()) === 0 &&
        (await page.locator('.chip-rail').count()) === 0,
    );
    const scroll = await page.evaluate(() => {
      const bar = document.querySelector('[role="toolbar"][aria-label="Editor bar"]');
      const own = bar ? bar.scrollWidth <= bar.clientWidth + 1 : false;
      const stage = document.querySelector('main.work') ?? document.body;
      const lim = innerHeight - 120;
      const bad = [...stage.querySelectorAll('*')]
        .filter((e) => {
          const r = e.getBoundingClientRect();
          if (r.height <= 0 || r.bottom < lim) return false;
          const ox = getComputedStyle(e).overflowX;
          return (ox === 'auto' || ox === 'scroll') && e.scrollWidth > e.clientWidth + 1;
        })
        .map((e) => e.className || e.tagName);
      return { own, bad };
    });
    check(w, 'the edit bar does not scroll sideways', scroll.own);
    check(
      w,
      'nothing in the bottom 120 px of the stage scrolls sideways',
      scroll.bad.length === 0,
      scroll.bad.join(', '),
    );

    // Open, close, open: aria-expanded alternates.
    const ex = async () => editBtn(page).getAttribute('aria-expanded');
    const seq = [await ex()];
    for (let i = 0; i < 3; i++) {
      await tap(editBtn(page));
      await page.waitForTimeout(350);
      seq.push(await ex());
    }
    check(
      w,
      'Edit ×3 alternates aria-expanded (false, true, false, true)',
      seq.join() === 'false,true,false,true',
      seq.join(','),
    );
    check(w, 'after Edit ×3 the panel is visible', await visible(panel(page)));
    await shot(page, vp, 'panel-open');

    // Panel open: tap a different space keeps it open.
    // The new chest has one space: Stacked (Divide this space, in the open panel) makes a second one first.
    if ((await page.locator('.el-space').count()) < 2)
      await panel(page)
        .getByRole('button', { name: 'Stacked', exact: true })
        .first()
        .click()
        .catch(() => {});
    await page.waitForTimeout(400);
    const n = await page.locator('.el-space').count();
    if (n > 1) {
      await page
        .locator('.el-space')
        .nth(1)
        .evaluate((el) => {
          const r = el.getBoundingClientRect();
          const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          if (top && (top === el || el.contains(top))) return;
          for (const t of ['pointerdown', 'pointerup', 'click'])
            el.dispatchEvent(
              new MouseEvent(t, { bubbles: true, clientX: r.x + 2, clientY: r.y + 2 }),
            );
        });
      await page.waitForTimeout(100);
      await page
        .locator('.el-space')
        .nth(1)
        .click({ force: true })
        .catch(() => {});
      await page.waitForTimeout(400);
    }
    check(
      w,
      'panel stays open after tapping a different space',
      n > 1 && (await visible(panel(page))) && (await ex()) === 'true',
      `${n} spaces`,
    );

    // Back closes the panel and the app stays on the editor.
    await page.goBack({ timeout: 5000 }).catch(() => null);
    await page.waitForTimeout(500);
    check(
      w,
      'goBack closes the panel (aria-expanded false)',
      (await ex()) === 'false' && !(await visible(panel(page))),
    );
    check(w, 'goBack leaves the app on the editor', await visible(page.locator('main.work')));

    // Rotation and back: no crash, aria-expanded matches the panel.
    await tap(editBtn(page));
    await page.waitForTimeout(350);
    const other = portrait ? LANDSCAPE : PORTRAIT;
    await page.setViewportSize(other);
    await page.waitForTimeout(500);
    await page.setViewportSize(vp);
    await page.waitForTimeout(500);
    const exp = await ex();
    const vis = await visible(panel(page));
    check(
      w,
      'rotation and back: no crash, Edit aria-expanded matches the panel',
      (exp === 'true') === vis && page.errors.length === 0,
      `aria-expanded=${exp} panel visible=${vis} errors=${page.errors.join(' | ')}`,
    );
  } catch (e) {
    check(w, 'editor flow (script error)', false, msg(e));
  }
  await ctx.close();
};

// ---- run ----------------------------------------------------------------------------------------------------------
for (const vp of [PORTRAIT, LANDSCAPE]) {
  await step(tag(vp), 'editor flow', () => editorFlow(vp));
  await step(tag(vp), '3D counters', () => counters(vp));
}
// The tap table is read at phone portrait.
for (const state of ['piece', 'space']) {
  await step(tag(PORTRAIT), `${state} Edit panel`, () => editSurface(PORTRAIT, state));
  for (const button of ['Settings', 'Material'])
    await step(tag(PORTRAIT), `${state} ${button}`, () => sheetSurface(PORTRAIT, state, button));
  await step(tag(PORTRAIT), `${state} Results`, () => resultsSurface(PORTRAIT, state));
}

const w0 = tag(PORTRAIT);
const orderP = jumpOrders.piece ?? [];
const orderS = jumpOrders.space ?? [];
check(
  w0,
  'Jump to section keeps one fixed order (piece vs space)',
  orderP.length > 0 && orderP.join('|') === orderS.join('|'),
  `piece: ${orderP.join(', ')} | space: ${orderS.join(', ')}`,
);
for (const s of SECTIONS)
  check(
    w0,
    `section "${s}" is reachable`,
    reached.has(s),
    reached.has(s) ? `in ${reached.get(s).join(', ')}` : 'not found',
  );
check(
  w0,
  'every control needs at most 2 taps',
  taps.length > 0 && taps.every((t) => t.taps <= 2),
  `${taps.length} controls`,
);

console.log('\nTap-count table (state | surface | taps | control)');
for (const t of taps)
  console.log(`${t.state.padEnd(5)} | ${t.surface.padEnd(14)} | ${t.taps} | ${t.tag} ${t.label}`);
writeFileSync(`${out}/mobile-middle-taps.json`, JSON.stringify(taps, null, 2));

await browser.close();
const failed = results.filter((r) => !r.ok);
if (jsonPath)
  writeFileSync(
    jsonPath,
    JSON.stringify({ results, taps, jumpOrders, reached: Object.fromEntries(reached) }, null, 2),
  );
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
for (const f of failed) console.log(`FAILED ${f.width} ${f.name}`);
process.exit(failed.length ? 1 : 0);
