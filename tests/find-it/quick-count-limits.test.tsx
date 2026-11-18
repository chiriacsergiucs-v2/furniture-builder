// @vitest-environment jsdom
// Find-it for N338 (L-1): the − and + buttons of a size stepper are disabled at the field's limits. From the bare app:
// New single piece › Sideboard › Settings › "Plinth height" (0 to 250 mm), found by role and accessible name.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('stepper limits at %ipx (find-it, N338)', (width) => {
  it('Decrease is disabled at the minimum and Increase at the maximum', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    await user.click(
      within(await screen.findByRole('dialog')).getAllByRole('button', { name: /Sideboard/ })[0],
    );
    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    await screen.findByRole('heading', { name: 'Whole cabinet' });
    const field = screen.getByLabelText('Plinth height') as HTMLInputElement;
    const minus = () => screen.getByRole('button', { name: 'Decrease Plinth height' });
    const plus = () => screen.getByRole('button', { name: 'Increase Plinth height' });
    const setTo = async (v: string) => {
      await user.clear(field);
      await user.type(field, v);
      await user.tab();
      await waitFor(() => expect(field.value).toBe(v));
    };

    await setTo('100');
    expect((minus() as HTMLButtonElement).disabled).toBe(false);
    expect((plus() as HTMLButtonElement).disabled).toBe(false);

    await setTo('0');
    expect((minus() as HTMLButtonElement).disabled).toBe(true);
    expect((plus() as HTMLButtonElement).disabled).toBe(false);

    await setTo('250');
    expect((plus() as HTMLButtonElement).disabled).toBe(true);
    expect((minus() as HTMLButtonElement).disabled).toBe(false);
  });
});
