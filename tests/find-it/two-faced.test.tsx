// @vitest-environment jsdom
// Find-it for Open both sides (ADR-292), in jsdom (ADR-108): from the bare app, a bookcase's Settings › Back has the
// option "Open both sides", and the Parts tab shows sides banded on both long edges and the Hardware tab names the free-standing fixing instead of the wall fixing.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('Open both sides at %ipx (find-it, ADR-292)', (width) => {
  it('bare app → New single piece → Bookcase › Settings › Back › Open both sides → Parts, Hardware', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getAllByRole('button', { name: /Bookcase/ })[0]);
    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    // Before: no part is banded on both long edges.
    const before = screen.getByRole('region', { name: 'Results' });
    await user.click(within(before).getByRole('tab', { name: /^Parts/ }));
    expect(within(before).queryAllByText('L2 W0')).toEqual([]);
    const back = await screen.findByRole('radiogroup', { name: 'Back' });
    const both = within(back).getByRole('radio', { name: 'Open both sides' });
    await user.click(both);
    expect(both.getAttribute('aria-checked')).toBe('true');
    const results = screen.getByRole('region', { name: 'Results' });
    // Parts (still open; a second tap would fold it on a phone): the sides are banded on both long edges.
    const parts = within(results).getByRole('tab', { name: /^Parts/ });
    if (parts.getAttribute('aria-selected') !== 'true') await user.click(parts);
    expect(within(results).getAllByText('L2 W0').length).toBeGreaterThan(0);
    await user.click(within(results).getByRole('tab', { name: /^Hardware/ }));
    expect(
      within(results).getAllByText(/Free-standing fixing: floor or ceiling/).length,
    ).toBeGreaterThan(0);
    expect(within(results).queryByText(/Anti-tip wall fixing/)).toBeNull();
  });
});
