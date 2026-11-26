// @vitest-environment jsdom
// Find-it for the Appearance dialog (N378) at 1280 and 390 px: More › Appearance opens a dialog whose − / + steps one
// variable and whose ±5% buttons scale a group or all variables; each change shows at once as a CSS variable on <html>
// and as the value beside the slider.
import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { openMore, renderApp, WIDTHS } from './setup';

const rootVar = (name: string) => document.documentElement.style.getPropertyValue(name);

describe.each(WIDTHS)('Appearance dialog at %ipx (find-it, N378)', (width) => {
  beforeEach(() => {
    localStorage.removeItem('fb:theme-vars');
    document.documentElement.removeAttribute('style');
  });

  async function openAppearance(user: Awaited<ReturnType<typeof renderApp>>['user']) {
    await openMore(user);
    await user.click(screen.getByRole('button', { name: /^Appearance/ }));
    return screen.findByRole('dialog', { name: 'Appearance' });
  }

  it('More › Appearance opens the dialog with the all-variables, group and per-variable controls', async () => {
    const { user } = await renderApp(width);
    const dlg = await openAppearance(user);
    expect(within(dlg).getByRole('button', { name: 'All variables +5%' })).toBeTruthy();
    expect(within(dlg).getByRole('button', { name: 'Gaps and paddings −5%' })).toBeTruthy();
    expect(within(dlg).getByRole('button', { name: 'Increase Space 4' })).toBeTruthy();
    expect((within(dlg).getByLabelText('Space 4') as HTMLInputElement).value).toBe('16');
    expect(within(dlg).getByRole('button', { name: 'Reset all' })).toHaveProperty('disabled', true);
    expect(rootVar('--s-4')).toBe('');
  });

  it('+ on Space 4 sets --s-4 to 17px and shows 17px; − brings it back to the default', async () => {
    const { user } = await renderApp(width);
    const dlg = await openAppearance(user);
    await user.click(within(dlg).getByRole('button', { name: 'Increase Space 4' }));
    expect(rootVar('--s-4')).toBe('17px');
    expect(within(dlg).getByText('17px')).toBeTruthy();
    expect((within(dlg).getByLabelText('Space 4') as HTMLInputElement).value).toBe('17');
    expect(rootVar('--s-5')).toBe('');
    await user.click(within(dlg).getByRole('button', { name: 'Decrease Space 4' }));
    expect(rootVar('--s-4')).toBe('');
    expect(within(dlg).queryByText('17px')).toBeNull();
  });

  it('+ on Line height steps by 0.05 and shows 1.5', async () => {
    const { user } = await renderApp(width);
    const dlg = await openAppearance(user);
    await user.click(within(dlg).getByRole('button', { name: 'Increase Line height' }));
    expect(rootVar('--lh')).toBe('1.5');
    expect(within(dlg).getByText('1.5')).toBeTruthy();
  });

  it('Gaps and paddings +5% rounds each gap to a whole px and leaves the other groups alone', async () => {
    const { user } = await renderApp(width);
    const dlg = await openAppearance(user);
    await user.click(within(dlg).getByRole('button', { name: 'Gaps and paddings +5%' }));
    expect(rootVar('--s-4')).toBe('17px');
    expect(rootVar('--s-6')).toBe('25px');
    expect(rootVar('--s-8')).toBe('34px');
    expect(within(dlg).getByText('25px')).toBeTruthy();
    expect(within(dlg).getByText('34px')).toBeTruthy();
    expect(rootVar('--r')).toBe('');
    expect(rootVar('--side')).toBe('');
    expect(rootVar('--fs-md')).toBe('');
    await user.click(within(dlg).getByRole('button', { name: 'Gaps and paddings −5%' }));
    expect(rootVar('--s-6')).toBe('');
    expect(rootVar('--s-8')).toBe('');
  });

  it('a group ±5% that leaves variables at the end of their range says how many (G-598)', async () => {
    const { user } = await renderApp(width);
    const dlg = await openAppearance(user);
    const group = within(dlg).getAllByRole('group', { name: 'Gaps and paddings' })[0];
    const limit = /^\d+ at (its|their) limit$/;
    expect(within(group).queryByText(limit)).toBeNull();
    for (let i = 0; i < 30; i++)
      await user.click(within(dlg).getByRole('button', { name: 'Gaps and paddings +5%' }));
    expect(within(group).getByText(limit)).toBeTruthy();
    await user.click(within(dlg).getByRole('button', { name: 'Gaps and paddings −5%' }));
    expect(within(group).queryByText(limit)).toBeNull();
  });

  it('All variables +5% changes a variable in every group and Reset all puts them back', async () => {
    const { user } = await renderApp(width);
    const dlg = await openAppearance(user);
    await user.click(within(dlg).getByRole('button', { name: 'All variables +5%' }));
    expect(rootVar('--fs-md')).toBe('1rem');
    expect(rootVar('--s-4')).toBe('17px');
    expect(rootVar('--r-lg')).toBe('11px');
    expect(rootVar('--side')).toBe('378px');
    expect(within(dlg).getByText('378px')).toBeTruthy();
    await user.click(within(dlg).getByRole('button', { name: 'Reset all' }));
    for (const n of ['--fs-md', '--s-4', '--r-lg', '--side']) expect(rootVar(n)).toBe('');
    expect(within(dlg).getByText('360px')).toBeTruthy();
  });
});
