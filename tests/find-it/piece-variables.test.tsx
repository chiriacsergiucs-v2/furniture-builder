// @vitest-environment jsdom
// Find-it for variables in a piece (ADR-210, G-335), in jsdom (ADR-108), from the bare app by role and visible text at
// 1280 and 390 px: New single piece → Sideboard → Settings → the piece's Variables section → Add variable; the ƒ
// button by Width binds it; the width follows a new value; a bad formula is an alert and an error.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('variables in a piece at %ipx (find-it, ADR-210)', (width) => {
  it('Settings → Variables → Add variable; ƒ by Width binds it; the width follows; a bad formula is an error', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    await user.click(
      within(await screen.findByRole('dialog')).getAllByRole('button', { name: /Sideboard/ })[0],
    );
    await user.click(screen.getByRole('radio', { name: 'Compose' }));
    const { useDesign } = await import('../../src/store/designStore');
    const widthOf = () => {
      const p = useDesign.getState().design.product;
      return p.kind === 'cabinet' ? p.params.width : null;
    };

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const settings = await screen.findByRole('dialog', { name: /^Settings: / });
    const section = within(settings)
      .getByRole('heading', { name: 'Variables' })
      .closest('section')!;
    await user.type(within(section).getByLabelText('New variable'), 'w');
    await user.type(within(section).getByLabelText('Value or formula'), '900');
    await user.click(within(section).getByRole('button', { name: 'Add variable' }));
    expect(within(section).getByLabelText('Value of w')).toBeTruthy();
    expect(within(section).getByText('not used')).toBeTruthy();
    // Formula fields keep the full keyboard here too (ADR-195; cleanup audit 2026-11-09, item 7).
    expect(within(section).getByLabelText('Value of w').getAttribute('inputmode')).toBeNull();
    expect(within(section).getByLabelText('Value or formula').getAttribute('inputmode')).toBeNull();

    await user.click(within(settings).getByRole('button', { name: 'Bind Width to a variable' }));
    const bind = await screen.findByRole('dialog', { name: 'Bind Width' });
    await user.click(within(bind).getByRole('button', { name: /^w = 900/ }));
    await user.click(within(bind).getByRole('button', { name: 'Bind' }));
    await waitFor(() => expect(widthOf()).toBe(900));
    expect(within(settings).getAllByText('w = 900').length).toBeGreaterThan(0);
    expect(within(section).getByText('used by 1 size')).toBeTruthy();

    // A new value: the width follows.
    const value = within(section).getByLabelText('Value of w');
    await user.clear(value);
    await user.type(value, '1000');
    await user.tab();
    await waitFor(() => expect(widthOf()).toBe(1000));

    // A bad formula: an alert in the section, an error in the model (export blocked), the width kept.
    const again = within(section).getByLabelText('Value of w');
    await user.clear(again);
    await user.type(again, '1000 +');
    await user.tab();
    await waitFor(() => expect(within(section).getByRole('alert')).toBeTruthy());
    expect(widthOf()).toBe(1000);
    expect(useDesign.getState().model.diagnostics.some((d) => d.severity === 'error')).toBe(true);
  });
});
