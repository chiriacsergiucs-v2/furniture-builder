// ADR-237: the setup every browser acceptance script (`tools/*/find-it*.mjs`, CLAUDE.md R3) shares — the declared
// `playwright-core` (no browser download), the browser launch, the preview URL and the usual widths.
//   pnpm build && pnpm preview &  node tools/<area>/find-it.mjs [url] [out dir]
// The browser: `CHROMIUM_PATH` when set, else a system Chromium (the first of SYSTEM_CHROMIUM that exists), else the
// browser Playwright installed for itself (PLAYWRIGHT_BROWSERS_PATH), as the scripts did before.
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

export { chromium };

/** The production preview (`pnpm preview`) the scripts open when no URL is given. */
export const PREVIEW_URL = 'http://localhost:4173/furniture-builder/';
/** The two widths most scripts check: desktop and phone (CLAUDE.md R3). */
export const WIDTHS = [1280, 390];
/** Where a system Chromium usually lives on Linux. */
export const SYSTEM_CHROMIUM = [
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
];

/** The Chromium to launch: CHROMIUM_PATH, else a system Chromium, else undefined (Playwright's own install). */
export function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  return SYSTEM_CHROMIUM.find((p) => existsSync(p));
}

/** Launch the browser (extra launch options, such as `args`, are passed on). */
export function launchBrowser(options = {}) {
  return chromium.launch({ executablePath: chromiumPath(), ...options });
}

/** The URL to open: the first argument, else `fallback`. */
export const previewUrl = (fallback = PREVIEW_URL) => process.argv[2] ?? fallback;
/** The screenshot folder: the second argument, else `fallback`. */
export const outDir = (fallback = 'dist-acceptance') => process.argv[3] ?? fallback;
