// Find-it acceptance in jsdom (ADR-108): render the bare app at a phone or desktop width and find features by role
// and visible text only. jsdom applies no CSS, so layout is not checked here; an ADR that changes layout or CSS, or
// touches the 3D view or Move mode, uses `- Acceptance: browser` (`tools/<area>/find-it.mjs`) instead.
//
// Review rules (ADR-224):
// - Every test runs at both widths, 390 and 1280 px (`describe.each(WIDTHS)`, CLAUDE.md R3, ADR-108).
// - Find by role, accessible name and visible text (`getByRole`, `within`, `getByText`), never by class name:
//   `querySelector` and `querySelectorAll` are refused by ESLint under `tests/find-it/`. When a thing has no role or
//   name, give the component an accessible name (through `t()`, with its Russian entry) instead.
// - Shared steps (`addPiece`, `projectWithTwoPieces`, `selectRows`, `openMore`, `openMenu`, `openSheet`) live here;
//   import them instead of copying them into a test file.
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { cleanup, configure, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, vi } from 'vitest';

// Pages and dialogs load on first use (React.lazy, ADR-222): in a test the first visit compiles the page's modules and
// renders it after the click returns, so the find-by waits allow 10 s instead of 1 s.
configure({ asyncUtilTimeout: 10000 });

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

type User = ReturnType<typeof userEvent.setup>;

/** The editor's Compose panel (the bottom sheet on a phone). */
export const composePanel = () => screen.getByRole('complementary', { name: 'Compose' });

/**
 * Phones: opens the Compose bottom sheet from its peek row, the panel's first button that expands (the peek reads
 * the project or the selection, so it has no fixed name). Already open, or on a desktop: nothing to do.
 */
export async function openSheet(user: User, panel: HTMLElement = composePanel()) {
  // `hidden` only skips the visibility check per button (slow in jsdom); the peek row is never hidden.
  const peek = within(panel)
    .getAllByRole('button', { hidden: true })
    .find((b) => b.hasAttribute('aria-expanded'));
  if (peek?.getAttribute('aria-expanded') === 'false') await user.click(peek);
}

/**
 * Compose › Add a piece: picks the first item named `name` (typing `search` first when given) and places it to the
 * right when asked. Brings the Pieces list back first, since a selected piece hides it (ADR-160).
 */
export async function addPiece(
  user: User,
  name: RegExp = /Base cabinet, doors: 1 door/,
  search?: string,
) {
  const side = composePanel();
  const all = within(side).queryByRole('button', { name: /^All pieces \(\d+\)$/ });
  if (all) await user.click(all);
  await user.click(within(side).getByRole('button', { name: 'Add a piece' }));
  const list = await screen.findByRole('dialog', { name: 'Add a piece' });
  if (search !== undefined)
    await user.type(within(list).getByRole('searchbox', { name: 'Search the items' }), search);
  await user.click(within(list).getAllByRole('button', { name })[0]);
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add a piece' })).toBeNull());
  const place = screen.queryByRole('button', { name: 'Place to the right' });
  if (place) await user.click(place);
}

/** Bare app → ⋯ › New… › Project with several pieces → Compose, with two base cabinets. */
export async function projectWithTwoPieces(user: User) {
  await user.click(screen.getByLabelText('More'));
  await user.click(await screen.findByRole('button', { name: /New…/ }));
  const dlg = await screen.findByRole('dialog', { name: 'Start something new' });
  await user.click(within(dlg).getByRole('button', { name: /Project with several pieces/ }));
  await user.click(await screen.findByRole('radio', { name: 'Compose' }));
  for (let i = 0; i < 2; i++) {
    await user.click(await screen.findByRole('button', { name: 'Add a piece' }));
    const list = await screen.findByRole('dialog', { name: 'Add a piece' });
    await user.click(within(list).getAllByRole('button', { name: /Base cabinet, doors/ })[0]);
  }
}

/**
 * Selects the rows `which` of the Pieces list. `multi` (the default): the Select switch on and exactly those rows
 * pressed; otherwise the switch off and a tap on the first of them.
 */
export async function selectRows(user: User, which: number[], multi = true) {
  const side = composePanel();
  const all = within(side).queryByRole('button', { name: /^All pieces \(\d+\)$/ });
  if (all) await user.click(all);
  const sw = within(side).getByRole('checkbox', { name: 'Select' }) as HTMLInputElement;
  if (sw.checked !== multi) await user.click(sw);
  const rows = within(within(side).getByRole('list', { name: 'Pieces' })).getAllByRole('button');
  if (!multi) return user.click(rows[which[0]]);
  for (let i = 0; i < rows.length; i++)
    if ((rows[i].getAttribute('aria-pressed') === 'true') !== which.includes(i))
      await user.click(rows[i]);
}

/** Opens the app's More menu (⋯), or the control labelled `name`. */
export async function openMore(user: User, name: RegExp | string = /^More$/) {
  await user.click(screen.getByLabelText(name));
}

/** Opens a card's More actions menu and returns it. */
export async function openMenu(user: User, card: HTMLElement) {
  await user.click(within(card).getByRole('button', { name: 'More actions' }));
  return screen.findByRole('group', { name: 'More actions' });
}

/** The printed sheet, once a print has drawn it: hidden from screen readers, so found with `hidden`. */
export const printedSheet = () =>
  waitFor(() => {
    const [sheet] = hiddenLabelled(document.body, 'region', 'Printed sheet');
    expect(sheet).toBeTruthy();
    return sheet;
  });

/**
 * The parts hidden from screen readers (`aria-hidden`: the printed sheet, the plan's drawn layers) with `role` and the
 * label `label`. Testing Library gives a hidden element no accessible name, so its label attribute is read instead.
 */
export function hiddenLabelled(container: HTMLElement, role: string, label: string | RegExp) {
  return within(container)
    .queryAllByRole(role, { hidden: true })
    .filter((e) => {
      const l = e.getAttribute('aria-label') ?? '';
      return typeof label === 'string' ? l === label : label.test(l);
    });
}

/** The numbered steps of an Assembly section: the items of its first list, not the items nested in them. */
export function stepItems(section: HTMLElement) {
  const list = within(section).getAllByRole('list')[0];
  return within(list)
    .getAllByRole('listitem')
    .filter((li) => li.parentElement === list);
}
