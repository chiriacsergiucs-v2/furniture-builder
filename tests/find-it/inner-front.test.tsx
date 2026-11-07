// @vitest-environment jsdom
// Find-it for drawer boxes without an inner front (ADR-192), in jsdom (ADR-108): Settings → Drawers and runners →
// "Box has an inner front" off removes the inner fronts from the parts list.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('inner front at %ipx (find-it, ADR-108)', (width) => {
  it('bare app → Chest of drawers → Settings → Box has an inner front off → no inner fronts', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    const picker = await screen.findByRole('dialog');
    await user.click(within(picker).getAllByRole('button', { name: /Chest of drawers/ })[0]);

    await user.click(screen.getByRole('tab', { name: /^Parts/ }));
    expect(screen.getAllByText(/Drawer inner front/).length).toBeGreaterThan(0);

    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    const settings = await screen.findByRole('dialog');
    expect(within(settings).getByText('Drawers and runners')).toBeTruthy();
    const box = within(settings).getByRole('checkbox', { name: 'Box has an inner front' });
    expect((box as HTMLInputElement).checked).toBe(true);
    await user.click(box);
    expect((box as HTMLInputElement).checked).toBe(false);
    await user.click(within(settings).getByRole('button', { name: 'Done' }));

    // The parts list is still open; the drawer boxes are listed without inner fronts.
    expect(screen.getAllByRole('table').length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/Drawer inner front/)).toHaveLength(0);
    expect(screen.getAllByText(/Drawer side/).length).toBeGreaterThan(0);
  });
});
