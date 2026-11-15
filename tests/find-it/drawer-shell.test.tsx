// @vitest-environment jsdom
// Find-it for ADR-267 (N281), in jsdom (ADR-108): from the bare app, by role and visible text, at phone and desktop
// widths. Sibling spaces of one kind get different names in the path, the title and the phone peek row; a selection
// change is announced once; a group the user opened stays open when the selection changes. The sticky head and the
// tint animation need layout and CSS: `tools/drawer-shell/find-it.mjs`.
import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('keep the drawer still at %ipx (find-it, ADR-267)', (width) => {
  async function sideboard() {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getAllByRole('button', { name: /Sideboard/ })[0]);
    await user.click(await screen.findByRole('radio', { name: 'Compose' }));
    const { useDesign } = await import('../../src/store/designStore');
    // Left to right: shelves behind a door, the drawer bank, shelves behind a door.
    const bays = () =>
      useDesign
        .getState()
        .model.spaces.filter((s) => s.leaf && s.view !== 'side')
        .sort((a, b) => a.box.x - b.box.x)
        .map((s) => s.nodeId);
    const pick = (i: number) => act(() => useDesign.getState().select(bays()[i]));
    return { user, pick };
  }

  it('two shelf bays read Left and Right in the path, the title and the peek row', async () => {
    const { pick } = await sideboard();
    pick(0);
    const crumbs = await screen.findByRole('navigation', { name: 'Where this space sits' });
    expect(within(crumbs).getByText('Left: Shelves')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Left: Shelves' })).toBeTruthy();
    expect(screen.getByText('Selected: Left: Shelves')).toBeTruthy();
    pick(2);
    expect(within(crumbs).getByText('Right: Shelves')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Right: Shelves' })).toBeTruthy();
    pick(1);
    expect(screen.getByRole('heading', { name: 'Middle: Drawers' })).toBeTruthy();
  });

  it('a selection change is announced once, after a short pause', async () => {
    const { pick } = await sideboard();
    pick(0);
    pick(1);
    pick(2);
    expect(await screen.findByText('Selection changed to Right: Shelves')).toBeTruthy();
    expect(screen.queryByText('Selection changed to Left: Shelves')).toBeNull();
    expect(screen.queryByText('Selection changed to Middle: Drawers')).toBeNull();
  });

  it('a group the user opened stays open when another space is selected', async () => {
    const { user, pick } = await sideboard();
    pick(0);
    const layouts = (await screen.findByText('Layouts')).closest('details')!;
    expect(layouts.open).toBe(false);
    await user.click(within(layouts).getByText('Layouts'));
    layouts.dispatchEvent(new Event('toggle')); // jsdom does not fire the event itself
    const { useUi } = await import('../../src/store/uiStore');
    expect(useUi.getState().groupOpen['Layouts']).toBe(true);
    pick(1);
    pick(2);
    expect((await screen.findByText('Layouts')).closest('details')!.open).toBe(true);
  });
});
