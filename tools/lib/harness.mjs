// ADR-237: the setup every browser acceptance script (`tools/*/find-it*.mjs`, CLAUDE.md R3) shares — the declared
// `playwright-core` (no browser download), the browser launch, the preview URL and the usual widths.
//   pnpm build && pnpm preview &  node tools/<area>/find-it.mjs [url] [out dir]
// The browser: `CHROMIUM_PATH` when set, else a system Chromium (the first of SYSTEM_CHROMIUM that exists), else the
// browser Playwright installed for itself (PLAYWRIGHT_BROWSERS_PATH), as the scripts did before.
import { existsSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

export { chromium };

/** The production preview (`pnpm preview`) the scripts open when no URL is given. */
export const PREVIEW_URL = 'http://localhost:4173/furniture-builder/';
/** The two widths most scripts check: desktop and phone (CLAUDE.md R3). */
export const WIDTHS = [1280, 390];
// Colour schemes the capture scripts run (`tools/capture/flows*.mjs`). Light only for now (user 2026-11-17: theme runs
// are not the priority); `CAPTURE_DARK=1` adds the dark run back.
export const SCHEMES = process.env.CAPTURE_DARK === '1' ? ['light', 'dark'] : ['light'];
/** Where a system Chromium usually lives on Linux. */
export const SYSTEM_CHROMIUM = [
  '/opt/pw-browsers/chromium',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
  '/usr/bin/google-chrome',
];

/** The Chromium to launch: CHROMIUM_PATH, else a system Chromium, else undefined (Playwright's own install). */
export function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  return SYSTEM_CHROMIUM.find((p) => existsSync(p));
}

/**
 * Before the page's own scripts: the sheet editor on phones unless this context already chose. The canvas editor is the
 * phone default since ADR-290; most scripts were written for the sheet, and 70 of 94 timed out behind the canvas in the
 * `pnpm regress` run of the catch-up on 2026-11-26. A script that tests the canvas sets `fb:canvasEditor` itself (its own
 * init script runs after this one) or switches it in More, and a reload keeps that choice.
 */
function sheetEditorUnlessChosen() {
  try {
    if (localStorage.getItem('fb:canvasEditor') === null)
      localStorage.setItem('fb:canvasEditor', 'off');
  } catch {
    /* storage blocked: the app falls back to its default */
  }
}

/**
 * Launch the browser (extra launch options, such as `args`, are passed on). Every new context and page starts with the
 * sheet editor (`sheetEditorUnlessChosen`). A script that tests the app's real phone default passes `{ appDefault: true }`;
 * `CANVAS_DEFAULT=1` does the same for every script.
 */
export async function launchBrowser({ appDefault = false, ...options } = {}) {
  const browser = await chromium.launch({ executablePath: chromiumPath(), ...options });
  if (appDefault || process.env.CANVAS_DEFAULT === '1') return browser;
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (...args) => {
    const ctx = await newContext(...args);
    await ctx.addInitScript(sheetEditorUnlessChosen);
    return ctx;
  };
  browser.newPage = async (...args) => {
    const ctx = await browser.newContext(...args);
    const page = await ctx.newPage();
    page.on('close', () => ctx.close().catch(() => {}));
    return page;
  };
  return browser;
}

/** The URL to open: the first argument, else `fallback`. */
export const previewUrl = (fallback = PREVIEW_URL) => process.argv[2] ?? fallback;
/** The screenshot folder: the second argument, else `fallback`. */
export const outDir = (fallback = 'dist-acceptance') => process.argv[3] ?? fallback;

/**
 * The `check` every find-it script declares: records `{ width, name, ok }` in `results` and prints the PASS/FAIL line.
 * Pass the script's own `results` array; the script keeps its closing summary.
 */
export function makeChecker(results) {
  const check = (width, name, ok, detail = '') => {
    results.push({ width, name, ok });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${width}px ${name}${detail ? ` — ${detail}` : ''}`);
  };
  return { check };
}

/**
 * `PROJECT_SCHEMA` read from the source text of `src/core/project.ts` (the `.mjs` scripts do not import the
 * TypeScript app), for scripts that seed saved projects.
 */
export function projectSchema() {
  return Number(/PROJECT_SCHEMA = (\d+)/.exec(readFileSync('src/core/project.ts', 'utf8'))[1]);
}
