// @vitest-environment jsdom
// Find-it for UI audit F-08 (Replace dialog), in jsdom (ADR-108) at 1280 and 390 px: the Replace dialog stays open
// while the "was edited after it was added" confirm is asked, and Cancel returns to it.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  composePanel,
  openSheet,
  projectWithTwoPieces,
  renderApp,
  selectRows,
  WIDTHS,
} from './setup';

describe.each(WIDTHS)('Replace confirm at %ipx (find-it, F-08)', (width) => {
  it('Cancel on the edited-piece confirm returns to the Replace dialog', async () => {
    const { user } = await renderApp(width);
    await projectWithTwoPieces(user);
    const { useDesign } = await import('../../src/store/designStore');
    // Mark the first piece as edited after it was added (the stamps differ).
    const first = useDesign.getState().project!.items[0];
    useDesign.getState().updateItem(first.id, {
      design: { ...first.design, updatedAt: first.design.createdAt + 1000 },
    });
    await openSheet(user);
    await selectRows(user, [0], false);
    const card = within(composePanel()).getByRole('region', { name: /^Selected piece: / });
    await user.click(within(card).getByRole('button', { name: 'More actions' }));
    await user.click(within(card).getByRole('button', { name: 'Replace…' }));
    const dlg = await screen.findByRole('dialog', { name: /^Replace / });
    const list = within(dlg).getByRole('list', { name: 'Alternatives' });
    await user.click(within(list).getAllByRole('button')[0]);
    const ask = await screen.findByText(/was edited after it was added/);
    await user.click(within(ask.closest('dialog')!).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByText(/was edited after it was added/)).toBeNull());
    expect(screen.getByRole('dialog', { name: /^Replace / })).toBeTruthy();
  });
});
