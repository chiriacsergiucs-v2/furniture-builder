// @vitest-environment jsdom
// Find-it for ADR-123 (N124), in jsdom (ADR-108): from the bare app, a project shows the named undo step on Undo,
// Edit history, Save a version and Restore under History, Suggest a style in the Material dialog (ADR-163), and a
// saved project template
// under "Project templates" in Add a piece, placed by a tap.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { piecesList, renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('history, templates and styles at %ipx (find-it, ADR-123)', (width) => {
  it('bare app → project → Undo Move, Edit history, versions, a style, a project template', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'Create a new project' }));
    const create = await screen.findByRole('dialog');
    // Named per width: saved templates can outlive one render in jsdom's IndexedDB.
    await user.type(within(create).getByRole('textbox'), `History test ${width}`);
    await user.click(within(create).getByRole('button', { name: 'Create project' }));

    const panel = await screen.findByRole('complementary', { name: 'Compose' });
    const peek = panel.querySelector<HTMLButtonElement>('.sheet-peek');
    if (peek?.getAttribute('aria-expanded') === 'false') await user.click(peek);
    await user.click(within(panel).getByRole('button', { name: 'Add a piece' }));
    let dlg = await screen.findByRole('dialog');
    await user.type(within(dlg).getByRole('searchbox', { name: 'Search the items' }), 'Base');
    await user.click(
      within(dlg).getAllByRole('button', { name: /Base cabinet, doors: 1 door/ })[0],
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const placeRight = screen.queryByRole('button', { name: 'Place to the right' });
    if (placeRight) await user.click(placeRight);

    // Move the piece: Undo names the step.
    await user.click(within(await piecesList(user, panel)).getAllByRole('button')[0]);
    const card = within(panel).getByRole('region', { name: /^Selected piece: / });
    // Position opens with the piece (ADR-160).
    const fromLeft = within(card).getByLabelText('From left', { exact: true });
    await user.clear(fromLeft);
    await user.type(fromLeft, '300{Enter}');
    const undo = screen.getByRole('button', { name: 'Undo' });
    await waitFor(() => expect(undo.getAttribute('title')).toMatch(/^Undo Move /));

    // A style through the Material dialog (ADR-163).
    await user.click(screen.getByRole('button', { name: 'Material' }));
    dlg = await screen.findByRole('dialog', { name: 'Material' });
    await user.click(within(dlg).getByRole('button', { name: 'Suggest a style' }));
    const styles = within(dlg).getByRole('region', { name: 'Suggested styles' });
    await user.click(within(styles).getByRole('button', { name: 'Apply All oak' }));
    expect(within(styles).getByRole('status').textContent).toMatch(/All oak applied to 1 piece/);
    await waitFor(() => expect(undo.getAttribute('title')).toMatch(/^Undo Apply style All oak/));
    await user.click(within(dlg).getByRole('button', { name: 'Close' }));

    // History: Edit history lists the steps; Save a version, then Restore it.
    // The title counts the kept versions (ADR-160): "History" or "History · N versions".
    await user.click(
      within(panel).getByText(/^History( · \d+ versions?)?$/, { selector: 'summary' }),
    );
    await user.click(within(panel).getByRole('button', { name: 'Edit history' }));
    dlg = await screen.findByRole('dialog', { name: 'Edit history' });
    expect(within(dlg).getByRole('button', { name: /^Move / })).toBeTruthy();
    expect(within(dlg).getByRole('button', { name: /Apply style All oak/ })).toBeTruthy();
    await user.click(within(dlg).getByRole('button', { name: 'Close' }));
    await user.click(within(panel).getByRole('button', { name: 'Save a version' }));
    const restore = await within(panel).findByRole('button', { name: 'Restore' });
    await user.click(restore);
    const ask = await screen.findByRole('dialog', { name: 'Confirm' });
    await user.click(within(ask).getByRole('button', { name: 'Restore' }));
    await waitFor(() =>
      expect(within(panel).getAllByRole('button', { name: 'Restore' }).length).toBe(2),
    );

    // Save the project as a template, then insert it from Add a piece.
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const settings = await screen.findByRole('dialog');
    await user.click(within(settings).getByRole('button', { name: 'Save as project template' }));
    const name = await screen.findByRole('dialog', { name: 'Confirm' });
    await user.click(within(name).getByRole('button', { name: 'Save template' }));
    await within(settings).findByText(/Saved as project template/);
    await user.click(within(settings).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await user.click(within(panel).getByRole('button', { name: 'Add a piece' }));
    dlg = await screen.findByRole('dialog');
    expect(await within(dlg).findByRole('heading', { name: 'Project templates' })).toBeTruthy();
    const templates = within(dlg).getByRole('list', { name: 'Project templates' });
    await user.click(
      within(templates).getByRole('button', { name: new RegExp(`History test ${width}`) }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText(/Tap the plan to place/)).toBeTruthy();
    expect((await piecesList(user, panel)).children).toHaveLength(2);
  });
});
