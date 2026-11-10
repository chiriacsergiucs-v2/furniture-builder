// @vitest-environment jsdom
// Find-it for ADR-250 (UI audit, Moving), in jsdom (ADR-108) at 1280 and 390 px: a grouped piece turns only with its
// group, the gap and height fields accept places the app makes, Move to keeps focus in its group, and a refused typed
// position says why in the card. The 3D multi-selection drag (D03-F5) is checked in the store test below and by the
// browser script (Acceptance: browser).
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { projectWithTwoPieces, renderApp, WIDTHS } from './setup';

async function twoPieces(width: number) {
  const app = await renderApp(width);
  await projectWithTwoPieces(app.user);
  const { useDesign } = await import('../../src/store/designStore');
  const st = () => useDesign.getState();
  await waitFor(() => expect(st().project!.items.length).toBe(2));
  useDesign.setState({ placingItemId: null });
  return { ...app, useDesign, st };
}

describe.each(WIDTHS)('moving at %ipx (find-it, ADR-250)', (width) => {
  it('a grouped piece is not turned alone: refused with the reason, no turn handle', async () => {
    const { st } = await twoPieces(width);
    const [a, b] = st().project!.items;
    st().selectItems([a.id, b.id]);
    st().groupSelection();
    const why = st().setRotation(b.id, 90);
    expect(why).toMatch(/is in a group; turn the group with Turn ↺ or Turn ↻/);
    expect(st().project!.items.map((i) => i.rotationY)).toEqual([0, 0]);
    st().selectItem(b.id);
    const plan = await screen.findByRole('figure', { name: /Room plan, seen from above/ });
    const piece = within(plan).getAllByRole('button', { name: /^Base cabinet/ })[1];
    fireEvent.keyDown(piece, { key: ']' });
    expect(st().project!.items.map((i) => i.rotationY)).toEqual([0, 0]);
  });

  it('the gap field accepts a 5400 mm gap the app made', async () => {
    const { st } = await twoPieces(width);
    const [a, b] = st().project!.items;
    st().updateItem(b.id, { position: { ...b.position, x: a.position.x + 600 + 5400 } });
    st().selectItem(b.id);
    const card = await screen.findByRole('region', { name: /^Selected piece: / });
    const gap = within(card).getByLabelText(/^Gap to .* on the left$/);
    expect(gap.getAttribute('aria-invalid')).toBe('false');
  });

  it('Move to keeps the keyboard focus inside its group', async () => {
    const { user, st } = await twoPieces(width);
    const [a, b] = st().project!.items;
    st().updateItem(b.id, { position: { ...b.position, x: a.position.x + 900 } });
    st().selectItem(b.id);
    const card = await screen.findByRole('region', { name: /^Selected piece: / });
    const moveTo = within(card).getByRole('group', { name: 'Move to' });
    const btn = within(moveTo)
      .getAllByRole('button')
      .find((x) => x.textContent === 'To left piece')!;
    await user.click(btn);
    const group = within(screen.getByRole('region', { name: /^Selected piece: / })).getByRole(
      'group',
      { name: 'Move to' },
    );
    expect(group.contains(document.activeElement)).toBe(true);
  });

  it('a refused From left change says why in the card', async () => {
    const { user, st } = await twoPieces(width);
    const [a, b] = st().project!.items;
    st().selectItems([a.id, b.id]);
    st().groupSelection();
    st().setLocked(a.id, true);
    st().selectItem(b.id);
    const card = await screen.findByRole('region', { name: /^Selected piece: / });
    const x = within(card).getByLabelText('From left') as HTMLInputElement;
    await user.clear(x);
    await user.type(x, String(b.position.x + 100));
    await user.tab();
    expect(
      within(screen.getByRole('region', { name: /^Selected piece: / })).getByText(/is locked/),
    ).toBeTruthy();
  });
});

describe('3D Move mode with several selected (ADR-250, user 2026-11-10)', () => {
  it('moveSelectionBy moves every selected piece by the same amount in one undo step', async () => {
    await renderApp(1280);
    const { makeItem, newProject, resolvePlacements } = await import('../../src/core/project');
    const { templates } = await import('../../src/core/design');
    const { useDesign } = await import('../../src/store/designStore');
    const make = () => templates.find((x) => x.id === 'base-door')!.create();
    let p = newProject('Two');
    p = { ...p, items: [...p.items, makeItem(p, make())] };
    p = { ...p, items: [...p.items, makeItem(p, make())] };
    p = resolvePlacements(p);
    useDesign.getState().openProject(p);
    const ids = useDesign.getState().project!.items.map((i) => i.id);
    useDesign.getState().selectItems(ids);
    const before = useDesign.getState().project!.items.map((i) => i.position.z);
    const steps = useDesign.getState().projectPast.length;
    useDesign.getState().moveSelectionBy(0, 200, 1, { alone: false });
    expect(useDesign.getState().project!.items.map((i) => i.position.z)).toEqual(
      before.map((z) => z + 200),
    );
    expect(useDesign.getState().projectPast.length).toBe(steps + 1);
  });
});
