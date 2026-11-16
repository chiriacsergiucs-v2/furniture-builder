// @vitest-environment jsdom
// Find-it for audit F-04, in jsdom (ADR-108): the reason a primary action is off is visible text, not only a title.
// The 3D viewer is a stub here (no WebGL), so the Move/Adjust reasons are proved on their own component.
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('disabled reasons are visible text at %ipx (F-04)', (width) => {
  it('the wizard says why Create piece is off', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('link', { name: /Catalog/ }));
    await user.click(await screen.findByRole('button', { name: 'New piece' }));
    const wiz = await screen.findByRole('dialog', { name: 'New piece' });
    await user.click(within(wiz).getByRole('radio', { name: /Cabinet \(closed box\)/ }));
    await user.click(within(wiz).getByRole('button', { name: 'Next' }));
    const box = within(wiz).getByRole('textbox', { name: /^Width/ });
    await user.clear(box);
    await user.type(box, 'abc[Tab]');
    const rail = within(wiz).getByRole('list', { name: 'Wizard steps' });
    await user.click(within(rail).getByRole('button', { name: 'Review' }));
    const create = within(wiz).getByRole('button', { name: 'Create piece' }) as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    expect(within(wiz).getByText('Fix the problems listed under Checks first')).toBeTruthy();
  });

  it('the 3D toolbar says why Move and Adjust wall picture are off while Exploded 3D is on', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    const { ExplodedWhy } = await import('../../src/viewer/ExplodedWhy');
    const { useDesign } = await import('../../src/store/designStore');
    useDesign.getState().setExploded(false);
    const { rerender } = render(<ExplodedWhy pieces picture />);
    expect(screen.queryByText(/Turn off Exploded 3D/)).toBeNull();
    useDesign.getState().setExploded(true);
    rerender(<ExplodedWhy pieces picture />);
    expect(screen.getByText('Turn off Exploded 3D to move pieces')).toBeTruthy();
    expect(screen.getByText('Turn off Exploded 3D to adjust a wall picture')).toBeTruthy();
    useDesign.getState().setExploded(false);
  });
});
