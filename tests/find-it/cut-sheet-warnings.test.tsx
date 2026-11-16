// @vitest-environment jsdom
// Find-it for ADR-265 (D18-F6, G-515) in jsdom (ADR-108), from the bare app at 1280 and 390 px: a wide sideboard has a
// shelf-span warning; Parts → Print draws the cut sheet's "check" list in the print language chosen under More › Print
// language (Romanian by default, then Russian and English), not in the app language.
import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hiddenLabelled, PHONE_WIDTH, printedSheet, renderApp, WIDTHS } from './setup';

beforeEach(() => {
  window.print = vi.fn();
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { load: () => Promise.resolve([]), ready: Promise.resolve() },
  });
});
// The app's modules are loaded again for each render (renderApp), so the print language is set on that copy.
afterEach(async () => (await import('../../src/core/i18n/print')).setPrintLang('ro'));

describe.each(WIDTHS)('cut-sheet warnings at %ipx (find-it, ADR-265)', (width) => {
  it('Parts → Print lists the shelf-span warning in Romanian, Russian and English by the print language', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    await user.click(
      within(await screen.findByRole('dialog')).getAllByRole('button', { name: /Sideboard/ })[0],
    );
    const { useDesign } = await import('../../src/store/designStore');
    const { setPrintLang } = await import('../../src/core/i18n/print');
    act(() => useDesign.getState().resizePiece('width', 2600));
    if (width === PHONE_WIDTH) {
      const build = screen.queryByRole('radio', { name: /Build & Preview/ });
      if (build) await user.click(build);
    }
    await user.click(screen.getByRole('tab', { name: /^Parts/ }));
    expect(useDesign.getState().model.diagnostics.some((d) => d.code === 'shelf-span')).toBe(true);
    const list = () => {
      const [root] = hiddenLabelled(document.body, 'region', 'Printed sheet');
      const ul = root
        ? within(root)
            .queryAllByRole('list', { hidden: true })
            .find((l) => l.classList.contains('pr-warn'))
        : undefined;
      return ul?.textContent ?? '';
    };
    for (const lang of ['ro', 'ru', 'en'] as const) {
      act(() => setPrintLang(lang));
      await user.click(within(screen.getByRole('tabpanel')).getByRole('button', { name: 'Print' }));
      await printedSheet();
      await waitFor(() => expect(list().length).toBeGreaterThan(0));
      await waitFor(() => expect(window.print).toHaveBeenCalled());
      const text = list();
      if (lang === 'ro') expect(text).toMatch(/Deschiderea raftului de \d+ mm/);
      if (lang === 'ru') expect(text).toMatch(/[А-Яа-я]/);
      if (lang === 'en') expect(text).toMatch(/Shelf span \d+ mm is long/);
      // The browser ends a print with afterprint; the next one draws the sheet again.
      act(() => window.dispatchEvent(new Event('afterprint')));
      await waitFor(() => expect(list()).toBe(''));
    }
  });
});
