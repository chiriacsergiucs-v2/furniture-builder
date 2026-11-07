// @vitest-environment jsdom
// Find-it for the running cost estimate (ADR-172, N175), in jsdom (ADR-108): a new project says "No prices yet";
// a price typed on the Shopping list turns the chip into "Estimate: N lei · M missing" with the list's own number;
// tapping the chip opens the Shopping list.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { addPiece, openSheet, renderApp, WIDTHS } from './setup';

const chip = () => screen.getByRole('button', { name: /^(Estimate: |No prices yet)/ });
const amountOf = (text: string) =>
  /Estimate: ([\d\s\u00a0.,]+) lei/.exec(text)?.[1]?.replace(/\s/g, '');

describe.each(WIDTHS)('running estimate at %ipx (find-it, ADR-172)', (width) => {
  it('new project → "No prices yet"; a price on the Shopping list → the chip shows the list\'s estimate; tap opens it', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'Create a new project' }));
    const create = await screen.findByRole('dialog');
    await user.type(within(create).getByRole('textbox'), `Estimate ${width}`);
    await user.click(within(create).getByRole('button', { name: 'Create project' }));
    const panel = await screen.findByRole('complementary', { name: 'Compose' });
    await openSheet(user, panel);
    await addPiece(user);
    await waitFor(() => expect(chip().getAttribute('aria-label')).toMatch(/^No prices yet/));

    // A price for the first line of the Shopping list.
    const build = screen.queryByRole('radio', { name: /Build & Preview/ });
    if (build) await user.click(build);
    await user.click(screen.getByRole('tab', { name: /Shopping/ }));
    const list = await screen.findByRole('tabpanel');
    await user.click(within(list).getByRole('button', { name: 'Prices' }));
    const price = (await within(list).findAllByLabelText(/^Price of /))[0] as HTMLInputElement;
    await user.clear(price);
    await user.type(price, '250');
    await user.tab();
    const listText = await within(list).findByText(/^Estimate: /);
    await waitFor(() => expect(amountOf(listText.textContent ?? '')).not.toBe('0,00'));
    const listAmount = amountOf(listText.textContent ?? '');
    expect(listAmount).toBeTruthy();
    await waitFor(() =>
      expect(chip().getAttribute('aria-label')).toMatch(/^Estimate: .* · \d+ missing/),
    );
    expect(amountOf(chip().getAttribute('aria-label') ?? '')).toBe(listAmount);

    // Back in Compose, the chip opens the Shopping list.
    const compose = screen.queryByRole('radio', { name: 'Compose' });
    if (compose) await user.click(compose);
    await user.click(chip());
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /Shopping/ }).getAttribute('aria-selected')).toBe(
        'true',
      ),
    );
  });
});
