// @vitest-environment jsdom
// Find-it for merging assembly steps (ADR-300, G-422), in jsdom (ADR-108): More → New… → Project with several pieces
// → a base cabinet → Assembly → "Merge with the next step" on Bottom → one step "Bottom + Sides to the bottom" with
// both steps' parts; Reset the steps (confirmed) brings the generated steps back.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { addPiece, PHONE_WIDTH, renderApp, stepItems, WIDTHS } from './setup';

describe.each(WIDTHS)('merge assembly steps at %ipx (find-it, ADR-300)', (width) => {
  it('Assembly → Merge with the next step → one step with both parts; Reset the steps restores', async () => {
    const { user } = await renderApp(width);
    await user.click(screen.getByLabelText('More'));
    await user.click(await screen.findByRole('button', { name: /New…/ }));
    const start = await screen.findByRole('dialog', { name: 'Start something new' });
    await user.click(within(start).getByRole('button', { name: /Project with several pieces/ }));
    await user.click(await screen.findByRole('radio', { name: 'Compose' }));
    await addPiece(user, /Base cabinet, doors: 1 door/);
    if (width === PHONE_WIDTH) {
      const build = screen.queryByRole('radio', { name: /Cut List/ });
      if (build) await user.click(build);
    }
    await user.click(screen.getByRole('tab', { name: /^Assembly/ }));
    const panel = screen.getByRole('tabpanel');
    const piece = (await within(panel).findAllByRole('region', { name: /^Assembly: / }))[0];
    const steps = () => stepItems(piece);
    const titles = () => steps().map((li) => within(li).getAllByRole('strong')[0].textContent);
    const before = titles();
    const i = before.indexOf('Bottom');
    expect(before[i + 1]).toBe('Sides to the bottom');
    // The last step has nothing to merge with.
    expect(
      (
        within(steps().at(-1)!).getByRole('button', {
          name: 'Merge with the next step',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    await user.click(within(steps()[i]).getByRole('button', { name: 'Merge with the next step' }));
    await waitFor(() => expect(titles()).toHaveLength(before.length - 1));
    const merged = steps()[i];
    expect(titles()[i]).toBe('Bottom + Sides to the bottom');
    expect(within(merged).getByText('Bottom', { exact: false, selector: 'li' })).toBeTruthy();
    expect(within(merged).getByText(/Left side/)).toBeTruthy();
    expect(within(merged).getByText(/Fix the left side and right side to the bottom/)).toBeTruthy();

    await user.click(within(piece).getByRole('button', { name: 'Reset the steps' }));
    const confirm = await screen.findByRole('dialog');
    await user.click(within(confirm).getByRole('button', { name: 'Reset the steps' }));
    await waitFor(() => expect(titles()).toEqual(before));
  });
});
