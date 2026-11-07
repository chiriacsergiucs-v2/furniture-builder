// @vitest-environment jsdom
// Catch-up find-it for N170 (ADR-066 light acceptance, run in jsdom per ADR-108): from the bare app,
// More → Information and guides → Output › Results lists "Results tabs under the views", and the Gaps page lists no
// Done gap (Done gaps live in docs/adr/GAPS-archive.md), at phone and desktop widths. Uses the real ledger.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('feature tree and gaps sync at %i px (find-it, N170)', (width) => {
  it('bare app → Information and guides → Output › Results → "Results tabs under the views"', async () => {
    const { user } = await renderApp(width);
    await user.click(screen.getByLabelText(/^More$/));
    await user.click(screen.getByRole('button', { name: /^Information and guides/ }));

    const page = await screen.findByRole('main', { name: 'Information and guides' });
    const features = within(page).getByRole('region', { name: 'Features' });
    const output = within(features).getByText('Output', { selector: 'summary', exact: false });
    const group = output.closest('details')!;
    if (!group.open) await user.click(output);
    expect(group.open).toBe(true);
    const results = within(group).getByText('Results', { selector: 'summary', exact: false });
    const sub = results.closest('details')!;
    if (!sub.open) await user.click(results);
    expect(within(sub).getByText('Results tabs under the views')).toBeTruthy();
  });

  it('bare app → More → Gaps → the Done filter counts no gap', async () => {
    const { user } = await renderApp(width);
    await user.click(screen.getByLabelText(/^More$/));
    await user.click(screen.getByRole('button', { name: /^Gaps/ }));
    const page = await screen.findByRole('main', { name: 'Gaps' });
    const status = within(page).getByRole('group', { name: 'Status' });
    expect(within(status).getByRole('button', { name: 'Done (0)' })).toBeTruthy();
    expect(within(status).getByRole('button', { name: /^Open \([1-9]\d*\)$/ })).toBeTruthy();
  });
});
