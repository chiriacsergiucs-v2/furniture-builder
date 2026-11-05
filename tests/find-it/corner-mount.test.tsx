// @vitest-environment jsdom
// Find-it for hung corner pieces (ADR-177, user 2026-11-05), in jsdom (ADR-108): a corner unit's Settings offer
// "Stands on" as a cabinet's does; hung on wall brackets it drops the plinth height and the hardware list asks the
// user to choose the hanging brackets.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('corner unit Stands on at %ipx (find-it, ADR-177)', (width) => {
  it('New single piece › Blind corner › Settings › Stands on › Wall brackets › no plinth; Hardware lists the choose-brackets line', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getAllByRole('button', { name: /Blind corner/ })[0]);
    // The piece's Settings (ADR-080) hold its size and construction.
    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    await screen.findByRole('heading', { name: 'Corner unit' });

    const stands = screen.getByRole('radiogroup', { name: 'Stands on' });
    expect(
      within(stands).getByRole('radio', { name: 'The floor' }).getAttribute('aria-checked'),
    ).toBe('true');
    expect(screen.getByLabelText('Plinth height')).toBeTruthy();

    await user.click(within(stands).getByRole('radio', { name: 'Wall brackets' }));
    expect(screen.getByLabelText('Underside above the floor')).toBeTruthy();
    expect(
      screen.getByText(/the hardware list asks you to choose the hanging brackets/),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Plinth height')).toBeNull();

    // Results › Hardware: one line to choose the brackets, no bracket or rail of its own.
    await user.click(screen.getByRole('button', { name: 'Done' }));
    const results = screen.getByRole('region', { name: 'Results' });
    await user.click(within(results).getByRole('tab', { name: 'Hardware' }));
    expect(
      (await screen.findAllByText('Wall hanging brackets: choose for this corner unit')).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText('Adjustable hanging bracket')).toBeNull();
  });
});
