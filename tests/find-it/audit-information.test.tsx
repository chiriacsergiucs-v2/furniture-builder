// @vitest-environment jsdom
// Find-it for ADR-266 (UI audit, Information) at 1280 and 390 px: with nothing open, Information offers no "Back to
// the editor".
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('information pages at %ipx (find-it, ADR-266)', (width) => {
  it('Information hides Back to the editor with nothing open', async () => {
    const { user } = await renderApp(width);
    await user.click(screen.getByLabelText(/^More$/));
    await user.click(screen.getByRole('button', { name: /^Information and guides/ }));
    const page = await screen.findByRole('main', { name: 'Information and guides' });
    expect(within(page).queryByRole('button', { name: 'Back to the editor' })).toBeNull();
  });
});
