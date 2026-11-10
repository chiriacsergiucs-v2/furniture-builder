// @vitest-environment jsdom
// Find-it for ADR-241, in jsdom (ADR-108): from the bare app, by role and visible text, at 1280 and 390 px.
// - Edit this piece edits the piece inside the project: the project stays open with its pieces and the piece's
//   "Inside this piece" section; the piece editor screen is under More actions › Open in the piece editor.
// - On a phone the Cut list place (bottom nav) opens the results; on a desktop there is no such place.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  composePanel,
  openMenu,
  openSheet,
  PHONE_WIDTH,
  projectWithTwoPieces,
  renderApp,
  selectRows,
  WIDTHS,
} from './setup';

const places = () => within(screen.getByRole('navigation', { name: 'Places' }));

describe.each(WIDTHS)('phone editor structure at %ipx (find-it, ADR-241)', (width) => {
  it('Edit this piece stays in the project; Open in the piece editor leaves it; Cut list on a phone', async () => {
    const { user } = await renderApp(width);
    await projectWithTwoPieces(user);
    await openSheet(user);
    await selectRows(user, [0], false);
    const card = await screen.findByRole('region', { name: /^Selected piece: / });

    // Edit this piece: still the project (its name field, its pieces), with the piece's inside in place.
    await user.click(within(card).getByRole('button', { name: 'Edit this piece' }));
    expect(await screen.findByRole('region', { name: 'Inside this piece' })).toBeTruthy();
    expect(screen.getByLabelText('Name of this project')).toBeTruthy();
    expect(within(composePanel()).getByRole('button', { name: /^All pieces \(2\)$/ })).toBeTruthy();

    // Cut list: a phone place only, opening the results on Parts or Checks.
    if (width === PHONE_WIDTH) {
      await user.click(places().getByRole('link', { name: /Cut list/ }));
      await waitFor(() =>
        expect(
          screen.getAllByRole('tab').some((tab) => tab.getAttribute('aria-selected') === 'true'),
        ).toBe(true),
      );
      expect(
        places()
          .getByRole('link', { name: /Cut list/ })
          .getAttribute('aria-current'),
      ).toBe('page');
      // Editor brings the drawing back.
      await user.click(places().getByRole('link', { name: 'Editor' }));
      expect(places().getByRole('link', { name: 'Editor' }).getAttribute('aria-current')).toBe(
        'page',
      );
    } else {
      expect(places().queryByRole('link', { name: /Cut list/ })).toBeNull();
    }

    // The piece editor screen is one step away under More actions.
    await openSheet(user);
    const again = await screen.findByRole('region', { name: /^Selected piece: / });
    const menu = await openMenu(user, again);
    await user.click(within(menu).getByRole('button', { name: 'Open in the piece editor' }));
    expect(await screen.findByLabelText('Name of this piece')).toBeTruthy();
  });

  it('Settings and Material open inside the Compose sheet on a phone, over the page on a desktop (ADR-247)', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    await user.click(
      within(await screen.findByRole('dialog')).getAllByRole('button', { name: /Sideboard/ })[0],
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    for (const [button, title] of [
      ['Settings', /^Settings: /],
      ['Material', /^Material$/],
    ] as const) {
      await user.click(screen.getByRole('button', { name: button }));
      const dlg = await screen.findByRole('dialog', { name: title });
      expect(composePanel().contains(dlg)).toBe(width === PHONE_WIDTH);
      await user.click(within(dlg).getByRole('button', { name: 'Close' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: title })).toBeNull());
    }
  });
});
