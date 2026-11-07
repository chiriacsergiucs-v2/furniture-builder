// @vitest-environment jsdom
// Find-it for the match-the-neighbour repairs (ADR-204, G-104), in jsdom (ADR-108): from the bare app, two base units
// side by side; the second is made 500 mm deep. Checks → the depth warning → "Show on the plan and see repairs" → the
// problem banner offers "Make … 560 mm deep like …" and "Make … 500 mm deep like …" → Apply → "Applied: Make …" and
// the warning is gone from Checks.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { addPiece, openSheet, piecesList, renderApp, WIDTHS } from './setup';

const depthWarning = () =>
  screen.queryByRole('button', { name: /stand side by side with different depths/ });

describe.each(WIDTHS)('match-the-neighbour repairs at %ipx (find-it, ADR-204)', (width) => {
  it('Checks → a depth warning → Show on the plan and see repairs → "Make … mm deep like …" → Apply clears it', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'Create a new project' }));
    const create = await screen.findByRole('dialog');
    await user.type(within(create).getByRole('textbox'), `Depth match ${width}`);
    await user.click(within(create).getByRole('button', { name: 'Create project' }));
    const panel = await screen.findByRole('complementary', { name: 'Compose' });
    await openSheet(user, panel);
    await addPiece(user);
    await addPiece(user);

    // The second one 500 mm deep.
    const list = await piecesList(user, panel);
    await user.click(within(list).getAllByRole('button')[1]);
    const card = await screen.findByRole('region', { name: /^Selected piece: / });
    const depth = within(card).getByLabelText('Depth') as HTMLInputElement;
    const was = depth.value;
    expect(was).not.toBe('500');
    await user.clear(depth);
    await user.type(depth, '500');
    await user.tab();

    // Checks → the depth warning names the repairs → the problem banner.
    await user.click(screen.getByRole('tab', { name: /^Checks/ }));
    const warning = await screen.findByRole('button', {
      name: /stand side by side with different depths/,
    });
    expect(within(warning).getByText('Show on the plan and see repairs')).toBeTruthy();
    await user.click(warning);
    const banner = await screen.findByRole('region', { name: 'Problem and repairs' });
    const radios = within(banner).getAllByRole('radio') as HTMLInputElement[];
    const labels = radios.map((r) => r.closest('label')!.textContent ?? '');
    expect(
      labels.some((l) =>
        /^Make Base cabinet.* \(piece 2\) \d+ mm deep like Base cabinet.* \(piece 1\)/.test(l),
      ),
    ).toBe(true);
    expect(
      labels.some((l) =>
        /^Make Base cabinet.* \(piece 1\) 500 mm deep like Base cabinet.* \(piece 2\)/.test(l),
      ),
    ).toBe(true);
    const back = radios.find((r) =>
      /^Make Base cabinet.* \(piece 2\) \d+ mm deep like/.test(
        r.closest('label')!.textContent ?? '',
      ),
    )!;
    expect(back.disabled).toBe(false);
    await user.click(back);
    expect(back.checked).toBe(true);
    await user.click(within(banner).getByRole('button', { name: 'Apply' }));
    expect(
      await screen.findByText(/^Applied: Make Base cabinet.* \(piece 2\) \d+ mm deep like/),
    ).toBeTruthy();
    // Checks, still open: the warning is gone and nothing else is left.
    expect(screen.getByRole('tab', { name: /^Checks/ }).getAttribute('aria-selected')).toBe('true');
    await waitFor(() => expect(depthWarning()).toBeNull());
    expect(await screen.findByText(/^No problems found\./)).toBeTruthy();
  });
});
