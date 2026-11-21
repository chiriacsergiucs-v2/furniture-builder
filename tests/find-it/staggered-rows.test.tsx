// @vitest-environment jsdom
// Find-it for staggered rows (ADR-282), in jsdom (ADR-108): from the bare app, a bookcase's stacked space gets
// staggered rows from three widths and a Randomize button.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { composePanel, openSheet, renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('staggered rows at %ipx (find-it, ADR-282)', (width) => {
  it('bare app → New single piece → Bookcase → Compose → Stacked → Stagger the rows → Randomize', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getAllByRole('button', { name: /Bookcase/ })[0]);
    await user.click(await screen.findByRole('radio', { name: 'Compose' }));
    await openSheet(user);
    const side = composePanel();
    await user.click(await within(side).findByRole('button', { name: /Edit the interior/ }));
    await user.click(await within(side).findByRole('button', { name: 'Stacked' }));
    await user.click(await within(side).findByRole('button', { name: 'Stagger the rows' }));
    for (const n of [1, 2, 3])
      expect(within(side).getByLabelText(new RegExp(`^Span width ${n}`))).toBeTruthy();
    expect(within(side).getByRole('checkbox', { name: 'Row 1: set by hand' })).toBeTruthy();
    await user.click(within(side).getByRole('button', { name: 'Randomize' }));
    // The rows are written as side-by-side parts: their dividers are in the drawing.
    expect(within(side).getByRole('button', { name: 'Stop staggering' })).toBeTruthy();
    expect(
      (await screen.findAllByRole('button', { name: /Divided space|empty space/i })).length,
    ).toBeGreaterThan(1);
  });
});
