// @vitest-environment jsdom
// Find-it for ADR-252 (UI audit, Selection and groups) at 1280 and 390 px: a group gets its name in the user's
// language and a Name field, Group says 3D models are not grouped, a double tap groups once, and the selection boxes
// take 3D models.
import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { composePanel, projectWithTwoPieces, renderApp, selectRows, WIDTHS } from './setup';

describe.each(WIDTHS)('selection and groups at %ipx (find-it, ADR-252)', (width) => {
  it('a double tap on Group makes one group, and the group card renames it in one step', async () => {
    const { user } = await renderApp(width);
    await projectWithTwoPieces(user);
    await selectRows(user, [0, 1]);
    const { useDesign } = await import('../../src/store/designStore');
    const card = within(composePanel()).getByRole('region', { name: /^2 pieces selected/ });
    const steps = useDesign.getState().projectPast.length;
    await user.dblClick(within(card).getByRole('button', { name: 'Group' }));
    expect(useDesign.getState().project!.groups ?? []).toHaveLength(1);
    expect(useDesign.getState().projectPast.length).toBe(steps + 1);
    const name = await within(composePanel()).findByRole('textbox', { name: 'Group name' });
    await user.clear(name);
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(within(composePanel()).getByText('Type a name for the group.')).toBeTruthy();
    await user.type(name, 'Sink run');
    await user.tab();
    expect(useDesign.getState().project!.groups![0].name).toBe('Sink run');
    useDesign.getState().undoProject();
    expect(useDesign.getState().project!.groups![0].name).toBe('Group 1');
  });

  it('Group with a piece and a 3D model says the model is not grouped', async () => {
    const { user } = await renderApp(width);
    await projectWithTwoPieces(user);
    const { useDesign } = await import('../../src/store/designStore');
    const { makeModelItem } = await import('../../src/core/model3d');
    const m = makeModelItem(
      'm1',
      { id: 'mdl-1', name: 'Fridge', size: { w: 600, h: 1800, d: 650 } },
      2000,
    );
    act(() => {
      const p = useDesign.getState().project!;
      useDesign.getState().openProject({ ...p, models: [m] });
    });
    act(() => {
      const p = useDesign.getState().project!;
      useDesign.getState().selectItems([p.items[0].id, p.items[1].id, m.id]);
    });
    const card = await screen.findByRole('region', { name: /2 pieces and 1 3D model selected/ });
    await user.click(within(card).getByRole('button', { name: 'Group' }));
    expect(await within(card).findByText('3D models are not grouped.')).toBeTruthy();
  });
});

describe('selection core (ADR-252)', () => {
  it('a new group is named in Russian; the box selection takes 3D models', async () => {
    localStorage.setItem('fb:lang', 'ru');
    await renderApp(1280);
    const { useDesign } = await import('../../src/store/designStore');
    const { newProject } = await import('../../src/core/project');
    const { templates } = await import('../../src/core/design');
    const { itemsInBox } = await import('../../src/core/selection');
    const { makeModelItem } = await import('../../src/core/model3d');
    act(() => {
      useDesign.getState().openProject(newProject('P'));
      for (let i = 0; i < 2; i++) {
        useDesign.getState().addPiece(templates.find((x) => x.id === 'base-door')!.create());
        useDesign.getState().stopPlacing();
      }
    });
    act(() => {
      const p = useDesign.getState().project!;
      useDesign.getState().selectItems(p.items.map((i) => i.id));
      useDesign.getState().groupSelection();
    });
    await waitFor(() => expect(useDesign.getState().project!.groups![0].name).toBe('Группа 1'));
    const m = makeModelItem(
      'm1',
      { id: 'mdl-1', name: 'Fridge', size: { w: 600, h: 1800, d: 650 } },
      2000,
    );
    const p = { ...useDesign.getState().project!, models: [m] };
    const placed = new Map([[m.id, { x: 2000, y: 0, z: 0, w: 600, h: 1800, d: 650 }]]);
    expect(itemsInBox(p, { x: 1900, z: 0 }, { x: 2100, z: 100 }, placed)).toEqual([m.id]);
  });
});
