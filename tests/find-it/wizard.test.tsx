// @vitest-environment jsdom
// Find-it for the New-piece wizard (ADR-044–046, ADR-191), in jsdom (ADR-108): from the bare app, Catalog → New
// piece → a type → a size → Review → Create piece, plus the critique fixes: the untouched Type step hints, a size
// typo is one problem, a type change drops the old type's answers, Review lists the answers with Edit, the footer
// reads "Use defaults", and closing with changed answers asks first: a new piece keeps its answers as the session's
// draft (Continue where you left off / Start over, ADR-211), a reopened piece asks "Discard the answers?".
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ru_shell } from '../../src/core/i18n/ru/shell';
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

    // 1: a backdrop click keeps the wizard open; × with changed answers asks first. A new piece's answers stay as the
    // session's draft (ADR-211, G-356): the ask says so and closes with Close.
    await user.click(await screen.findByRole('link', { name: /Catalog/ }));
    await user.click(await screen.findByRole('button', { name: 'New piece' }));
    const again = await screen.findByRole('dialog', { name: 'New piece' });
    // A finished piece leaves no draft behind.
    expect(within(again).queryByRole('button', { name: 'Continue where you left off' })).toBeNull();
    await user.click(within(again).getByRole('radio', { name: /Open shelving/ }));
    await user.click(again);
    expect(screen.getByRole('dialog', { name: 'New piece' })).toBeTruthy();
    await user.click(within(again).getByRole('button', { name: 'Close' }));
    let ask = await screen.findByRole('dialog', { name: 'Confirm' });
    expect(
      within(ask).getByText(
        'Close the wizard? Your answers stay as a draft until you close the app.',
      ),
    ).toBeTruthy();
    expect(within(ask).queryByText('Discard the answers?')).toBeNull();
    await user.click(within(ask).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('dialog', { name: 'New piece' })).toBeTruthy();
    await user.click(within(again).getByRole('button', { name: 'Close' }));
    ask = await screen.findByRole('dialog', { name: 'Confirm' });
    await user.click(within(ask).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New piece' })).toBeNull());
  });
});

describe.each(WIDTHS)('New-piece wizard draft at %ipx (find-it, ADR-211)', (width) => {
  it('a closed new piece reopens with Continue where you left off on its step; Start over; a reopened piece asks Discard', async () => {
    const { user } = await renderApp(width);
    const offer = (wiz: HTMLElement) =>
      within(wiz).queryByRole('button', { name: 'Continue where you left off' });
    const open = async () => {
      await user.click(await screen.findByRole('button', { name: 'New piece' }));
      return screen.findByRole('dialog', { name: 'New piece' });
    };
    const closeKeepingDraft = async (wiz: HTMLElement) => {
      await user.click(within(wiz).getByRole('button', { name: 'Close' }));
      const ask = await screen.findByRole('dialog', { name: 'Confirm' });
      expect(
        within(ask).getByText(
          'Close the wizard? Your answers stay as a draft until you close the app.',
        ),
      ).toBeTruthy();
      await user.click(within(ask).getByRole('button', { name: 'Close' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New piece' })).toBeNull());
    };
    const shelving = (wiz: HTMLElement) =>
      within(wiz)
        .getByRole('radio', { name: /Open shelving/ })
        .getAttribute('aria-checked');

    await user.click(await screen.findByRole('link', { name: /Catalog/ }));
    let wiz = await open();
    expect(offer(wiz)).toBeNull();
    await user.click(within(wiz).getByRole('radio', { name: /Open shelving/ }));
    await user.click(within(wiz).getByRole('button', { name: 'Next' }));
    const stepName = within(wiz).getByRole('heading', { level: 3 }).textContent;
    expect(stepName).not.toBe('Type');
    await closeKeepingDraft(wiz);

    // Reopened, the Type step offers the draft; Continue where you left off returns to its step with its answers.
    wiz = await open();
    expect(within(wiz).getByRole('button', { name: 'Start over' })).toBeTruthy();
    await user.click(offer(wiz)!);
    expect(within(wiz).getByRole('heading', { level: 3 }).textContent).toBe(stepName);
    expect(offer(wiz)).toBeNull();
    const rail = within(wiz).getByRole('list', { name: 'Wizard steps' });
    await user.click(within(rail).getByRole('button', { name: 'Type' }));
    expect(shelving(wiz)).toBe('true');

    // Creating the piece clears the draft.
    for (let i = 0; i < 20 && !within(wiz).queryByRole('button', { name: 'Create piece' }); i++)
      await user.click(within(wiz).getByRole('button', { name: 'Next' }));
    await user.click(within(wiz).getByRole('button', { name: 'Create piece' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New piece' })).toBeNull());
    await user.click(await screen.findByRole('link', { name: /Catalog/ }));
    wiz = await open();
    expect(offer(wiz)).toBeNull();

    // Start over clears a draft: a fresh Type step, and no offer the next time.
    await user.click(within(wiz).getByRole('radio', { name: /Open shelving/ }));
    await closeKeepingDraft(wiz);
    wiz = await open();
    await user.click(within(wiz).getByRole('button', { name: 'Start over' }));
    expect(offer(wiz)).toBeNull();
    expect(shelving(wiz)).toBe('false');
    await user.click(within(wiz).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New piece' })).toBeNull());
    wiz = await open();
    expect(offer(wiz)).toBeNull();
    await user.click(within(wiz).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New piece' })).toBeNull());

    // A reopened piece keeps its own answers: closing it with changes still asks "Discard the answers?" (ADR-191).
    await user.click(await screen.findByRole('button', { name: 'Back to the editor' }));
    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    const settings = await screen.findByRole('dialog', { name: /^Settings/ });
    await user.click(within(settings).getByRole('button', { name: 'Open in wizard' }));
    const reopened = await screen.findByRole('dialog', { name: /^Wizard: / });
    expect(offer(reopened)).toBeNull();
    const rail2 = within(reopened).getByRole('list', { name: 'Wizard steps' });
    await user.click(within(rail2).getByRole('button', { name: 'Type' }));
    await user.click(within(reopened).getByRole('radio', { name: /Cabinet \(closed box\)/ }));
    await user.click(within(reopened).getByRole('button', { name: 'Close' }));
    const ask = await screen.findByRole('dialog', { name: 'Confirm' });
    expect(within(ask).getByText('Discard the answers?')).toBeTruthy();
    await user.click(within(ask).getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /^Wizard: / })).toBeNull());
  });
});

describe.each(WIDTHS)('New-piece wizard findings at %ipx (find-it, ADR-194)', (width) => {
  it('defaults button, arrow keys, named cards with warnings, field errors, focus, counters, Continue by hand', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('link', { name: /Catalog/ }));
    await user.click(await screen.findByRole('button', { name: 'New piece' }));
    const wiz = await screen.findByRole('dialog', { name: 'New piece' });

    // 7: one tab stop in the type radios; arrow keys move between types without choosing one.
    const types = within(wiz).getByRole('radiogroup', { name: 'Construction type' });
    const radios = within(types).getAllByRole('radio');
    expect(radios.map((r) => r.tabIndex)).toEqual(radios.map((_, k) => (k === 0 ? 0 : -1)));
    radios[0].focus();
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(radios[1]);
    expect(radios[1].tabIndex).toBe(0);
    expect(radios[1].getAttribute('aria-checked')).toBe('false');
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(radios[0]);
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(radios[radios.length - 1]);

    // 4: the defaults button shows while no type is chosen, and hides once one is.
    expect(within(wiz).getByRole('button', { name: 'Use Cabinet (closed box)' })).toBeTruthy();
    await user.click(within(types).getByRole('radio', { name: /Cabinet \(closed box\)/ }));
    expect(within(wiz).queryByRole('button', { name: /^Use Cabinet/ })).toBeNull();
    expect(within(wiz).getByRole('button', { name: 'Next' })).toBeTruthy();

    // 5: every card button is named after its card; a card with warnings lists their messages.
    const cards = within(wiz).getByRole('region', { name: 'Suggested combinations' });
    const uses = within(cards).getAllByRole('button', { name: /^Use this: / });
    expect(uses.length).toBe(6);
    expect(within(cards).queryByRole('button', { name: 'Use this' })).toBeNull();
    expect(
      within(cards).getByRole('button', {
        name: 'Use this: no dividers · 2 shelves · pair of doors · on a plinth',
      }),
    ).toBeTruthy();
    const warned = within(cards)
      .getAllByText('Door 798 mm wide; over ~600 mm (typical) consider two doors.')
      .map((n) => n.closest('li.wz-card'));
    expect(warned.length).toBeGreaterThan(0);
    expect(within(warned[0] as HTMLElement).getByText('1 warning')).toBeTruthy();
    // 8: the second button reads "Continue by hand".
    expect(within(cards).getByRole('button', { name: 'Continue by hand' })).toBeTruthy();
    expect(within(cards).queryByRole('button', { name: 'Start blank' })).toBeNull();

    // 1 and 7: a card, then Type → Wardrobe: the Size step follows the wardrobe; the step change moves the focus.
    await user.click(uses[0]);
    expect(document.activeElement?.tagName).toBe('H3');
    const rail = within(wiz).getByRole('list', { name: 'Wizard steps' });
    await user.click(within(rail).getByRole('button', { name: 'Type' }));
    await user.click(within(wiz).getByRole('radio', { name: /^Wardrobe/ }));
    await user.click(within(wiz).getByRole('button', { name: 'Next' }));
    expect(document.activeElement).toBe(within(wiz).getByRole('heading', { name: 'Size' }));
    expect((within(wiz).getByRole('textbox', { name: 'Name' }) as HTMLInputElement).value).toBe(
      'Wardrobe',
    );
    const box = (name: RegExp) => within(wiz).getByRole('textbox', { name }) as HTMLInputElement;
    expect([box(/^Width/).value, box(/^Height/).value, box(/^Depth/).value]).toEqual([
      '1200',
      '2100',
      '600',
    ]);

    // 6: Width "abc" marks the Width box invalid, the error under it, once.
    await user.clear(box(/^Width/));
    await user.type(box(/^Width/), 'abc[Tab]');
    const widthBox = box(/^Width/);
    expect(widthBox.getAttribute('aria-invalid')).toBe('true');
    const message = 'Width must be a whole number from 400 to 3000 mm.';
    expect(within(wiz).getAllByText(message)).toHaveLength(1);
    const err = document.getElementById(widthBox.getAttribute('aria-describedby') ?? '');
    expect(err?.textContent).toBe(message);
    expect(widthBox.closest('.field')?.contains(err)).toBe(true);
    await user.clear(widthBox);
    await user.type(widthBox, '1000[Tab]');
    expect(box(/^Width/).getAttribute('aria-invalid')).toBeNull();

    // 8: on Dividers, "Continue by hand" moves on and keeps the answers.
    await user.click(within(wiz).getByRole('button', { name: 'Next' }));
    expect(document.activeElement).toBe(within(wiz).getByRole('heading', { name: 'Dividers' }));
    await user.click(within(wiz).getByRole('button', { name: 'Continue by hand' }));
    expect(document.activeElement).toBe(within(wiz).getByRole('heading', { name: 'Contents' }));

    // 7: the counters name their compartment.
    expect(
      within(wiz).getByRole('button', { name: 'Fewer shelves in compartment 2' }),
    ).toBeTruthy();
    expect(within(wiz).getByRole('button', { name: 'More shelves in compartment 2' })).toBeTruthy();
    expect(within(wiz).queryByRole('button', { name: 'Fewer shelves' })).toBeNull();
    await user.click(within(rail).getByRole('button', { name: 'Size' }));
    expect(box(/^Width/).value).toBe('1000');

    // 8 (Russian): the renamed button's entry.
    expect(ru_shell['Continue by hand']).toBe('Продолжить вручную');
  });
});
