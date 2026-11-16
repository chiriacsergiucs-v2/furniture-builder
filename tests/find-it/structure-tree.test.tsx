// @vitest-environment jsdom
// Find-it for ADR-268 (N286), in jsdom (ADR-108): from the bare app, by role and visible text, at phone and desktop
// widths. The Structure group is open at 1280 px and closed at 390 px; a space selected elsewhere marks its row and
// opens its ancestors; a row click selects that space and the drawer title and path follow; the whole-piece row
// selects the piece. A tap on the drawing is stood in by the store's `select`, as in the ADR-267 find-it test; the
// real tap needs layout, `tools/drawer-shell/find-it.mjs` covers the sticky head.
import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('structure tree at %ipx (find-it, ADR-268)', (width) => {
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

  /** The Structure group; on a phone it starts closed, so open it the way a user does. */
  async function structure(user: Awaited<ReturnType<typeof renderApp>>['user']) {
    const group = (await screen.findByText('Structure')).closest('details')!;
    if (width < 500) {
      expect(group.open).toBe(false);
      await user.click(within(group).getByText('Structure'));
      group.dispatchEvent(new Event('toggle')); // jsdom does not fire the event itself
    } else {
      expect(group.open).toBe(true);
    }
    // Query the screen, not `within(group)`: the group's element is replaced when the selection changes.
    return screen;
  }

  it('is open at 1280 px and closed at 390 px on a bare start', async () => {
    const { user } = await sideboard();
    const tree = await structure(user);
    expect(tree.getByRole('tree', { name: 'Whole piece tree' })).toBeTruthy();
    expect(tree.getByRole('treeitem', { name: /^Whole/ })).toBeTruthy();
  });

  it('a space selected elsewhere marks its row selected and opens its ancestors', async () => {
    const { user, pick } = await sideboard();
    const tree = await structure(user);
    pick(0);
    const row = await tree.findByRole('treeitem', { name: /^Left: Shelves/ });
    expect(row.getAttribute('aria-selected')).toBe('true');
    expect(Number(row.getAttribute('aria-level'))).toBeGreaterThan(2);
  });

  it('a row click selects that space; the title and path follow; the whole-piece row selects the piece', async () => {
    const { user, pick } = await sideboard();
    const tree = await structure(user);
    pick(0); // opens the tree down to the bays
    await user.click(await tree.findByRole('treeitem', { name: /^Right: Shelves/ }));
    expect(await screen.findByRole('heading', { name: 'Right: Shelves' })).toBeTruthy();
    const crumbs = screen.getByRole('navigation', { name: 'Where this space sits' });
    expect(within(crumbs).getByText('Right: Shelves')).toBeTruthy();
    expect(
      tree.getByRole('treeitem', { name: /^Right: Shelves/ }).getAttribute('aria-selected'),
    ).toBe('true');

    await user.click(tree.getAllByRole('treeitem')[0]);
    expect(tree.getAllByRole('treeitem')[0].getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByRole('heading', { name: 'Right: Shelves' })).toBeNull();
  });
});
