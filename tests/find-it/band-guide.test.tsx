// @vitest-environment jsdom
// Find-it for ADR-301 (G-460, N428), in jsdom (ADR-108), at phone and desktop widths, from the bare app:
// a single piece → Settings → Boards, sheets and saw cut → a board's Edge band → once a band type is chosen,
// "Tolerances and edgebander (guidance)" shows Thickness tolerance ± (mm), Width tolerance ± (mm), Overhang to trim
// per side (mm) and Edgebander settings, all empty; typed values are kept after the dialog is closed and reopened, and
// an out-of-range tolerance is marked.
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import Dexie from 'dexie';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

beforeEach(() => {
  Dexie.dependencies.indexedDB = new IDBFactory();
  Dexie.dependencies.IDBKeyRange = IDBKeyRange;
});

const GUIDE = [
  ['Thickness tolerance ± (mm)', '0.1'],
  ['Width tolerance ± (mm)', '0.5'],
  ['Overhang to trim per side (mm)', '2'],
  ['Edgebander settings', '210 °C, 12 m/min'],
] as const;

describe.each(WIDTHS)('ADR-301 at %i px (find-it)', (width) => {
  it('bare app → single piece → Settings → Edge band → Tolerances and edgebander (guidance): empty, then kept', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    const start = await screen.findByRole('dialog');
    await user.click(within(start).getAllByRole('button', { name: /Chest of drawers/ })[0]);
    const openBoards = async () => {
      await user.click(await screen.findByRole('button', { name: 'Settings' }));
      const settings = await screen.findByRole('dialog');
      await user.click(within(settings).getByText('Boards, sheets and saw cut'));
      const row = within(settings)
        .getAllByRole('group', { name: /^Board / })
        .find((li) => within(li).queryByRole('group', { name: /^Edge band for / }))!;
      return within(row).getByRole('group', { name: /^Edge band for / });
    };
    let band = await openBoards();
    // Not shown until the band has a type; then every field is empty (nothing filled in, ADR-010).
    expect(
      within(band).queryByRole('group', { name: 'Tolerances and edgebander (guidance)' }),
    ).toBeNull();
    await user.selectOptions(within(band).getAllByLabelText('Band type')[0], 'abs');
    const guide = await within(band).findByRole('group', {
      name: 'Tolerances and edgebander (guidance)',
    });
    expect(within(guide).getByText(/The app fills nothing in and checks nothing/)).toBeTruthy();
    const input = (name: string) => within(band).getByLabelText(name) as HTMLInputElement;
    for (const [name] of GUIDE) expect(input(name).value).toBe('');

    // Name the band, then type the guidance.
    await user.type(input('Band width (mm)'), '22');
    await user.type(input('Band thickness (mm)'), '0.8');
    fireEvent.blur(input('Band thickness (mm)'));
    for (const [name, v] of GUIDE) {
      await user.type(input(name), v);
      fireEvent.blur(input(name));
    }
    await waitFor(() => expect(within(band).getByText(/^ABS 0\.8 × 22 mm$/)).toBeTruthy());

    // An out-of-range tolerance is marked, not clamped (ADR-008).
    await user.clear(input('Width tolerance ± (mm)'));
    await user.type(input('Width tolerance ± (mm)'), '12');
    expect(input('Width tolerance ± (mm)').getAttribute('aria-invalid')).toBe('true');
    expect(within(band).getAllByText('From 0.1 to 10 mm, one decimal.').length).toBeGreaterThan(0);
    await user.clear(input('Width tolerance ± (mm)'));
    await user.type(input('Width tolerance ± (mm)'), '0.5');
    fireEvent.blur(input('Width tolerance ± (mm)'));

    // Closed and reopened: the values are the design's.
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    band = await openBoards();
    for (const [name, v] of GUIDE)
      expect((within(band).getByLabelText(name) as HTMLInputElement).value).toBe(v);
  });
});
