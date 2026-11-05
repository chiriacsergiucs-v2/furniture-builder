// @vitest-environment jsdom
// Find-it for the New-piece wizard (ADR-044–046, ADR-191), in jsdom (ADR-108): from the bare app, Catalog → New
// piece → a type → a size → Review → Create piece, plus the critique fixes: the untouched Type step hints, a size
// typo is one problem, a type change drops the old type's answers, Review lists the answers with Edit, the footer
// reads "Use defaults", and closing with changed answers asks first.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('New-piece wizard at %ipx (find-it, ADR-191)', (width) => {
  it('Catalog → New piece → Cabinet → Size → Review → Create piece; the critique fixes', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('link', { name: /Catalog/ }));
    await user.click(await screen.findByRole('button', { name: 'New piece' }));
    const wiz = await screen.findByRole('dialog', { name: 'New piece' });

    // 7: the untouched Type step hints, not an error; 4: the footer names the first type; 13: types are radios.
    expect(within(wiz).getByText('Choose a construction type.').className).toContain('hint');
    expect(within(wiz).getByRole('button', { name: 'Use Cabinet (closed box)' })).toBeTruthy();
    const types = within(wiz).getByRole('radiogroup', { name: 'Construction type' });
    expect(within(types).getAllByRole('radio').length).toBeGreaterThanOrEqual(7);
    await user.click(within(types).getByRole('radio', { name: /Cabinet \(closed box\)/ }));
    expect(
      within(types)
        .getByRole('radio', { name: /Cabinet \(closed box\)/ })
        .getAttribute('aria-checked'),
    ).toBe('true');
    await user.click(within(wiz).getByRole('button', { name: 'Next' }));
    expect(within(wiz).getByRole('button', { name: 'Use defaults' })).toBeTruthy();

    // 3 and 8: a size typo gives exactly one problem, no 0 mm model, and the preview says what to do.
    const widthBox = within(wiz).getByRole('textbox', { name: /^Width/ });
    await user.clear(widthBox);
    await user.type(widthBox, 'abc[Tab]');
    expect(
      within(wiz).getAllByText('Width must be a whole number from 200 to 3000 mm.'),
    ).toHaveLength(1);
    expect(within(wiz).queryByText(/is too small for/)).toBeNull();
    expect(within(wiz).getByText('Fix the marked fields.')).toBeTruthy();
    // 6: Next keeps the answers; a step with an error is not shown as done.
    await user.click(within(wiz).getByRole('button', { name: 'Next' }));
    const rail = within(wiz).getByRole('list', { name: 'Wizard steps' });
    expect(
      within(rail).getByRole('button', { name: 'Size' }).closest('li')?.className,
    ).not.toContain('done');
    await user.click(within(rail).getByRole('button', { name: 'Size' }));
    await user.clear(within(wiz).getByRole('textbox', { name: /^Width/ }));
    await user.type(within(wiz).getByRole('textbox', { name: /^Width/ }), '800[Tab]');
    const heightBox = within(wiz).getByRole('textbox', { name: /^Height/ });
    await user.clear(heightBox);
    await user.type(heightBox, '400[Tab]');

    // 2: Cabinet height 400 → Bed: the headboard height takes the Bed default, no error.
    await user.click(within(rail).getByRole('button', { name: 'Type' }));
    await user.click(within(wiz).getByRole('radio', { name: /^Bed/ }));
    await user.click(within(wiz).getByRole('button', { name: 'Next' }));
    expect(
      (within(wiz).getByRole('textbox', { name: /^Headboard height/ }) as HTMLInputElement).value,
    ).toBe('1000');
    expect(within(wiz).queryByText(/Headboard height must be/)).toBeNull();
    await user.click(within(rail).getByRole('button', { name: 'Type' }));
    await user.click(within(wiz).getByRole('radio', { name: /Cabinet \(closed box\)/ }));

    // 5: Review lists the answers with Edit; Edit opens that step.
    for (let i = 0; i < 20 && !within(wiz).queryByRole('button', { name: 'Create piece' }); i++)
      await user.click(within(wiz).getByRole('button', { name: 'Next' }));
    const answers = within(wiz).getByRole('region', { name: 'Answers' });
    expect(within(answers).getByText(/Cabinet \(closed box\)/)).toBeTruthy();
    expect(within(answers).getByText(/Board: PAL 18 white/)).toBeTruthy();
    expect(within(answers).getByText(/Handles: Bar/)).toBeTruthy();
    expect(within(answers).getByText(/Plinth height: 80 mm/)).toBeTruthy();
    await user.click(within(answers).getByRole('button', { name: 'Edit Doors' }));
    expect(within(wiz).getByRole('heading', { name: 'Doors' })).toBeTruthy();
    await user.click(within(rail).getByRole('button', { name: 'Review' }));
    expect(within(wiz).getByText('No problems found.')).toBeTruthy();
    await user.click(within(wiz).getByRole('button', { name: 'Create piece' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New piece' })).toBeNull());

    // 1: a backdrop click keeps the wizard open; × with changed answers asks first.
    await user.click(await screen.findByRole('link', { name: /Catalog/ }));
    await user.click(await screen.findByRole('button', { name: 'New piece' }));
    const again = await screen.findByRole('dialog', { name: 'New piece' });
    await user.click(within(again).getByRole('radio', { name: /Open shelving/ }));
    await user.click(again);
    expect(screen.getByRole('dialog', { name: 'New piece' })).toBeTruthy();
    await user.click(within(again).getByRole('button', { name: 'Close' }));
    const ask = await screen.findByRole('dialog', { name: 'Confirm' });
    expect(within(ask).getByText('Discard the answers?')).toBeTruthy();
    await user.click(within(ask).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('dialog', { name: 'New piece' })).toBeTruthy();
    await user.click(within(again).getByRole('button', { name: 'Close' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Confirm' })).getByRole('button', {
        name: 'Discard',
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New piece' })).toBeNull());
  });
});
