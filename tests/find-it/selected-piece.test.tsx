// @vitest-environment jsdom
// Find-it for the project panel's order and the selected piece's folded sections (ADR-116, N115), in jsdom (ADR-108):
// the pieces list comes before "Selected piece"; Position, Clearance, Finish and Merge are closed groups; Width and
// Depth stay open; a group holding an error opens itself (ADR-008).
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

const GROUPS = ['Position', 'Clearance', 'Finish', 'Merge'] as const;

describe.each(WIDTHS)('selected piece card at %ipx (find-it, ADR-116)', (width) => {
  it('bare app → new project → two pieces → list first, folded groups, an error opens Position', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'Create a new project' }));
    const create = await screen.findByRole('dialog');
    await user.type(within(create).getByRole('textbox'), 'Card test');
    await user.click(within(create).getByRole('button', { name: 'Create project' }));

    const panel = await screen.findByRole('complementary', { name: 'Compose' });
    // Phones: the panel is a bottom sheet opened from its peek row.
    const peek = panel.querySelector<HTMLButtonElement>('.sheet-peek');
    if (peek?.getAttribute('aria-expanded') === 'false') await user.click(peek);
    const addPiece = async (name: RegExp) => {
      await user.click(within(panel).getByRole('button', { name: 'Add a piece' }));
      const dlg = await screen.findByRole('dialog');
      await user.type(within(dlg).getByRole('searchbox', { name: 'Search the items' }), 'Base');
      await user.click(within(dlg).getAllByRole('button', { name })[0]);
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    };
    await addPiece(/Base cabinet, doors: 1 door \+ shelf/);
    await addPiece(/Base cabinet, doors: Drawer over door/);

    const list = within(panel).getByRole('list', { name: 'Pieces' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    await user.click(within(list).getAllByRole('button')[1]);

    // 1. The pieces list heading comes before "Selected piece".
    const heading = within(panel).getByRole('heading', { name: 'Pieces' });
    const card = within(panel).getByRole('region', { name: /^Selected piece: / });
    expect(heading.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      list.compareDocumentPosition(within(card).getByText('Selected piece')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // 2. Width and Depth are open; the four groups are closed and open on a tap to show their fields.
    const folded = (el: Element) => el.closest('details:not([open])') !== null;
    for (const f of ['Width', 'Depth'])
      expect(folded(within(card).getByLabelText(f, { exact: true }))).toBe(false);
    const summary = (t: string) => within(card).getByText(t, { selector: 'summary' });
    const details = (t: string) => summary(t).closest('details')!;
    for (const t of GROUPS) expect(details(t).open).toBe(false);

    const fields: Record<(typeof GROUPS)[number], () => HTMLElement> = {
      Position: () => within(details('Position')).getByLabelText('From left', { exact: true }),
      Clearance: () =>
        within(details('Clearance')).getByRole('radiogroup', { name: 'Service zone' }),
      Finish: () => within(details('Finish')).getByRole('button', { name: 'Apply finish' }),
      Merge: () => within(details('Merge')).getByRole('button', { name: /^Merge with / }),
    };
    for (const t of GROUPS) {
      expect(folded(fields[t]())).toBe(true);
      await user.click(summary(t));
      expect(details(t).open).toBe(true);
      expect(folded(fields[t]())).toBe(false);
      // No second heading inside: the summary is the group's title.
      expect(within(details(t)).queryAllByRole('heading')).toHaveLength(0);
    }

    // 3. An error opens its group: move the second piece onto the first, close Position, select the first.
    const fromLeft = fields.Position() as HTMLInputElement;
    await user.clear(fromLeft);
    await user.type(fromLeft, '0{Enter}');
    const overlap = await within(details('Position')).findByRole('alert');
    expect(overlap.textContent).toMatch(/overlap by \d+ mm in the room/);
    await user.click(summary('Position'));
    expect(details('Position').open).toBe(false);
    await user.click(within(list).getAllByRole('button')[0]);
    await waitFor(() => expect(details('Position').open).toBe(true));
    expect(within(details('Position')).getByRole('alert').textContent).toMatch(/overlap/);
  });
});
