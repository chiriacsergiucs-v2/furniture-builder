// @vitest-environment jsdom
// Find-it for the project panel's order and the selected piece's sections (ADR-117, reordered by ADR-160), in jsdom
// (ADR-108): Add a piece in the Pieces header; one selected piece replaces the list with All pieces and previous /
// next; no How many, typed rotation or quarter-turn buttons; the toolbar and More actions; Position open, More
// closed, no Finish group (ADR-163); Move to lists only working actions; a group holding an error opens itself (ADR-008).
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

const GROUPS = ['More: clearance, merge'] as const;

describe.each(WIDTHS)('selected piece card at %ipx (find-it, ADR-117, ADR-160)', (width) => {
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

    // 1. Add a piece sits in the Pieces header; one piece selected replaces the list with All pieces and
    //    previous / next (ADR-160).
    const heading = within(panel).getByRole('heading', { name: 'Pieces' });
    expect(heading.parentElement!.textContent).toContain('Add a piece');
    const nav = within(panel).getByRole('navigation', { name: 'Pieces' });
    await user.click(within(nav).getByRole('button', { name: 'All pieces (2)' }));
    const list = within(panel).getByRole('list', { name: 'Pieces' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    await user.click(within(list).getAllByRole('button')[1]);
    expect(within(panel).queryByRole('list', { name: 'Pieces' })).toBeNull();
    const card = within(panel).getByRole('region', { name: /^Selected piece: / });
    expect(heading.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(panel).getByText('2 / 2')).toBeTruthy();

    // 2. Gone: How many, Rotation (°), the 0°/90°/180°/270° buttons. The toolbar turns; More actions holds the rest.
    expect(within(card).queryByText('How many')).toBeNull();
    expect(within(card).queryByLabelText('Rotation (°)')).toBeNull();
    expect(within(card).queryByRole('radio', { name: '90°' })).toBeNull();
    const tools = within(card).getByRole('group', { name: 'Arrange this piece' });
    for (const n of [
      'Duplicate',
      'Add a linked copy',
      'Turn 90° anticlockwise about its centre',
      'Turn 90° clockwise about its centre',
      'Mirror',
    ])
      expect(within(tools).getByRole('button', { name: n })).toBeTruthy();
    await user.click(within(card).getByRole('button', { name: 'More actions' }));
    const menu = within(card).getByRole('group', { name: 'More actions' });
    for (const n of ['Replace…', 'Save to catalog', 'Lock size', 'Remove from project'])
      expect(within(menu).getByRole('button', { name: n })).toBeTruthy();
    await user.click(within(card).getByRole('button', { name: 'More actions' }));
    expect(within(card).queryByRole('group', { name: 'More actions' })).toBeNull();

    // 3. Width and Depth are open; Position opens with the piece; More is closed and opens on a tap; no Finish group.
    const folded = (el: Element) => el.closest('details:not([open])') !== null;
    for (const f of ['Width', 'Depth'])
      expect(folded(within(card).getByLabelText(f, { exact: true }))).toBe(false);
    const summary = (t: string) => within(card).getByText(t, { selector: 'summary' });
    const details = (t: string) => summary(t).closest('details')!;
    expect(details('Position').open).toBe(true);
    expect(within(card).queryByText('Finish', { selector: 'summary' })).toBeNull();
    const fields: Record<(typeof GROUPS)[number], () => HTMLElement> = {
      'More: clearance, merge': () =>
        within(details('More: clearance, merge')).getByRole('button', { name: /^Merge with / }),
    };
    for (const t of GROUPS) {
      expect(details(t).open).toBe(false);
      expect(folded(fields[t]())).toBe(true);
      await user.click(summary(t));
      expect(details(t).open).toBe(true);
      expect(folded(fields[t]())).toBe(false);
    }
    // Move to: only the working actions are buttons; the rest fold under "N more are off" with reasons.
    const moveTo = within(details('Position')).getByRole('group', { name: 'Move to' });
    expect(
      within(moveTo)
        .queryAllByRole('button')
        .some((b) => b.getAttribute('aria-disabled')),
    ).toBe(false);
    expect(within(moveTo).getByText(/^\d+ more (is|are) off$/)).toBeTruthy();

    // 4. An error opens its group: move the second piece onto the first, close Position, step to the first.
    const fromLeft = within(details('Position')).getByLabelText('From left', {
      exact: true,
    }) as HTMLInputElement;
    await user.clear(fromLeft);
    await user.type(fromLeft, '0{Enter}');
    const overlap = await within(details('Position')).findByRole('alert');
    expect(overlap.textContent).toMatch(/overlap by \d+ mm in the room/);
    await user.click(summary('Position'));
    expect(details('Position').open).toBe(false);
    await user.click(within(panel).getByRole('button', { name: 'Previous piece' }));
    expect(within(panel).getByText('1 / 2')).toBeTruthy();
    await waitFor(() => expect(details('Position').open).toBe(true));
    expect(within(details('Position')).getByRole('alert').textContent).toMatch(/overlap/);
  });
});
