// @vitest-environment jsdom
// Find-it for ADR-183 (N186), in jsdom (ADR-108): from the bare app, More → Information and guides → Moving shows
// "arrow keys" in the detail of Drag a piece on the plan, at phone and desktop widths.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('feature-tree details at %i px (find-it, ADR-183)', (width) => {
  it('bare app → More → Information and guides → Moving → Drag a piece on the plan → arrow keys', async () => {
    const { user } = await renderApp(width);
    await user.click(screen.getByLabelText(/^More$/));
    await user.click(screen.getByRole('button', { name: /^Information and guides/ }));

    const page = await screen.findByRole('main', { name: 'Information and guides' });
    const features = within(page).getByRole('region', { name: 'Features' });
    const moving = within(features).getByText('Moving', { selector: 'summary', exact: false });
    const group = moving.closest('details')!;
    if (!group.open) await user.click(moving);
    expect(group.open).toBe(true);

    const line = within(group).getByText('Drag a piece on the plan').closest('li')!;
    expect(line.textContent).toMatch(/arrow keys move a focused piece 10 mm, 100 mm with Shift/);
  });
});
