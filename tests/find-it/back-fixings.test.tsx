// @vitest-environment jsdom
// Find-it for G-439 (N424) in jsdom (ADR-108): from the bare app, by role and visible text, at desktop and phone
// widths — Settings › Fasteners › Back fixing shows "In from each edge (mm)" and "Largest spacing (mm)"; with both
// typed, Parts shows the back's drilling positions, labelled "Guidance: drilling positions from your values".
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('G-439 back fixing drilling positions at %ipx (find-it)', (width) => {
  it('Fasteners › Back fixing: edge and spacing typed → Parts shows the back drilling positions', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    await user.click(
      within(await screen.findByRole('dialog')).getAllByRole('button', { name: /Sideboard/ })[0],
    );
    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    const settings = await screen.findByRole('dialog');
    await user.click(within(settings).getByText('Fasteners', { selector: 'summary' }));
    const name = await within(settings).findByLabelText('Back fixing: your fastener');
    await user.clear(name);
    await user.type(name, 'Nails');
    await user.tab();
    expect(
      within(settings).getByText(
        'Guidance: with your fastener named and both distances typed, Parts shows drilling positions round each back from your values. No diameter, depth or screw is given.',
      ),
    ).toBeTruthy();
    // The other width's run may have saved values on this device: start from empty fields.
    const edge = within(settings).getByLabelText('In from each edge (mm)');
    await user.clear(edge);
    await user.type(edge, '20');
    await user.tab();
    const spacing = within(settings).getByLabelText('Largest spacing (mm)') as HTMLInputElement;
    await user.clear(spacing);
    await user.type(spacing, '0');
    await user.tab();
    expect(spacing.getAttribute('aria-invalid')).toBe('true');
    expect(
      within(settings).getByText('Whole number from 1 to 5000. Not saved until it is.'),
    ).toBeTruthy();
    await user.clear(spacing);
    await user.type(spacing, '150');
    await user.tab();
    expect(spacing.getAttribute('aria-invalid')).toBe('false');
    await user.click(within(settings).getByRole('button', { name: 'Done' }));

    await user.click(screen.getByRole('radio', { name: /Cut List/ }));
    const partsTab = screen.queryByRole('tab', { name: /^Parts/ });
    if (partsTab && partsTab.getAttribute('aria-selected') !== 'true') await user.click(partsTab);
    await waitFor(() =>
      expect(
        screen.getAllByText('Guidance: drilling positions from your values').length,
      ).toBeGreaterThan(0),
    );
    const backRow = screen
      .getAllByRole('row')
      .find((r) => /Back/.test(r.textContent ?? '') && /fixing holes at/.test(r.textContent ?? ''));
    expect(backRow?.textContent).toMatch(
      /fixing holes at 20\/20, .* mm, guidance from your values/,
    );
  });
});
