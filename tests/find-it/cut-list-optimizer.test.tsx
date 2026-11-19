// @vitest-environment jsdom
// Find-it for the standalone cut list optimizer at 1280 and 390 px: ⋯ › Cut list optimizer, type one part, see the
// sheet count and the drawn sheet; the list is kept after the page is opened again.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { openMore, renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('cut list optimizer at %ipx (find-it)', (width) => {
  it('lays out typed parts on sheets and keeps the list', async () => {
    localStorage.removeItem('fb.optimizer.v1');
    const { user } = await renderApp(width);
    await openMore(user);
    await user.click(screen.getByRole('button', { name: /^Cut list optimizer/ }));
    const page = await screen.findByRole('main', { name: 'Cut list optimizer' });
    expect(within(page).getByLabelText('Sheet length (mm)')).toHaveProperty('value', '2800');
    const part = within(page).getByRole('listitem', { name: 'Part 1' });
    await user.type(within(part).getByLabelText('Length (mm)'), '2000');
    await user.type(within(part).getByLabelText('Width (mm)'), '1500');
    await user.clear(within(part).getByLabelText('Qty'));
    await user.type(within(part).getByLabelText('Qty'), '2');
    expect(await within(page).findByText('2 sheets')).toBeTruthy();
    expect(within(page).getByRole('img', { name: 'Sheet 2: 1 parts' })).toBeTruthy();

    await user.clear(within(part).getByLabelText('Width (mm)'));
    await user.type(within(part).getByLabelText('Width (mm)'), '1.5');
    expect(within(page).getByText('Enter whole millimetres.')).toBeTruthy();

    expect(JSON.parse(localStorage.getItem('fb.optimizer.v1') ?? '{}').parts[0].length).toBe(
      '2000',
    );
  });
});
