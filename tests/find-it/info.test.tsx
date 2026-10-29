// @vitest-environment jsdom
// Find-it for ADR-158 (N160), in jsdom (ADR-108): from the bare app, More → Information and guides shows the
// Features tree with its domains, Moving and Aligning and arranging among them, at phone and desktop widths.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('information and guides at %i px (find-it, ADR-158)', (width) => {
  it('bare app → More → Information and guides → Features → Moving, Aligning and arranging', async () => {
    const { user } = await renderApp(width);
    await user.click(screen.getByLabelText(/^More$/));
    await user.click(screen.getByRole('button', { name: /^Information and guides/ }));

    const page = await screen.findByRole('main', { name: 'Information and guides' });
    expect(
      within(page).getByRole('heading', { level: 1, name: 'Information and guides' }),
    ).toBeTruthy();
    const features = within(page).getByRole('region', { name: 'Features' });
    expect(within(features).getByRole('heading', { level: 2, name: 'Features' })).toBeTruthy();
    expect(
      within(page).getByText(
        /What this version of the app can do: \d+ features, grouped by domain\./,
      ),
    ).toBeTruthy();

    for (const domain of [
      'Creating',
      'Composition',
      'Moving',
      'Aligning and arranging',
      'Language',
    ]) {
      const summary = within(features).getByText(domain, { selector: 'summary', exact: false });
      expect(summary).toBeTruthy();
    }

    // A domain opens on a tap, also on a phone where it starts closed, and lists its features with their ADRs.
    const moving = within(features).getByText('Moving', { selector: 'summary', exact: false });
    const group = moving.closest('details')!;
    if (!group.open) await user.click(moving);
    expect(group.open).toBe(true);
    expect(within(group).getByText('Drag a piece on the plan')).toBeTruthy();
    expect(within(group).getByText('ADR-065')).toBeTruthy();

    await user.click(within(page).getByRole('button', { name: 'Back to the editor' }));
    expect(screen.queryByRole('main', { name: 'Information and guides' })).toBeNull();
  });
});
