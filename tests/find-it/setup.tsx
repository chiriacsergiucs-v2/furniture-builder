// Find-it acceptance in jsdom (ADR-108): render the bare app at a phone or desktop width and find features by role
// and visible text only. jsdom applies no CSS, so layout is not checked here; an ADR that changes layout or CSS, or
// touches the 3D view or Move mode, uses `- Acceptance: browser` (`tools/<area>/find-it.mjs`) instead.
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { cleanup, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, vi } from 'vitest';

export const PHONE_WIDTH = 390;
export const DESKTOP_WIDTH = 1280;
export const WIDTHS = [DESKTOP_WIDTH, PHONE_WIDTH] as const;

// The 3D viewer needs WebGL; it is lazy (ADR-014) and stands in as an empty box here.
vi.mock('../../src/viewer/Viewer3D', () => ({ default: () => <div data-testid="viewer3d" /> }));

/** `(max-width: Npx)` and `(min-width: Npx)` against `window.innerWidth`; anything else does not match. */
function matches(q: string) {
  const w = window.innerWidth;
  const max = /max-width:\s*(\d+)px/.exec(q);
  const min = /min-width:\s*(\d+)px/.exec(q);
  if (!max && !min) return false;
  return (!max || w <= Number(max[1])) && (!min || w >= Number(min[1]));
}

function stubBrowser(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: width < 500 ? 844 : 900,
  });
  window.matchMedia = (q: string) =>
    ({
      matches: matches(q),
      media: q,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.scrollTo ??= () => {};
  window.scrollTo = () => {};
  // No canvas in jsdom: pictures and thumbnails drawn on a canvas stay blank.
  HTMLCanvasElement.prototype.getContext = (() => null) as never;
  const d = HTMLDialogElement.prototype;
  d.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
  d.show ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
  d.close ??= function (this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

/** The bare app at `width`: fresh modules, storage and URL, so each run starts as a first visit. */
export async function renderApp(width: number) {
  stubBrowser(width);
  globalThis.indexedDB = new IDBFactory();
  window.history.replaceState(null, '', '/');
  vi.resetModules();
  // The languages stored on the device (ADR-153, ADR-157), read before the app's modules, as main.tsx does.
  await import('../../src/langInit');
  const { App } = await import('../../src/ui/App');
  const user = userEvent.setup();
  return { user, ...render(<App />) };
}

/**
 * The project's Pieces list (ADR-160): while one piece is selected it gives way to "All pieces (N)", which is tapped
 * here to bring it back (that clears the selection).
 */
export async function piecesList(
  user: ReturnType<typeof userEvent.setup>,
  panel: HTMLElement,
): Promise<HTMLElement> {
  const all = within(panel).queryByRole('button', { name: /^All pieces \(\d+\)$/ });
  if (all) await user.click(all);
  return within(panel).getByRole('list', { name: 'Pieces' });
}
