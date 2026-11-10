// @vitest-environment jsdom
// Find-it for ADR-255 (UI audit, Boards and edges) at 1280 and 390 px: a refused board change is said as refused, a
// removed part's board names no id, an emptied board name goes back and says so, each board row is its own group,
// a wrong own-band thickness is marked, and the band list can be removed.
import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { projectWithTwoPieces, renderApp, WIDTHS } from './setup';

async function chest(width: number) {
  const app = await renderApp(width);
  await app.user.click(await screen.findByRole('button', { name: 'New single piece' }));
  await app.user.click(
    within(await screen.findByRole('dialog')).getAllByRole('button', {
      name: /Chest of drawers/,
    })[0],
  );
  return app;
}

describe.each(WIDTHS)('boards and edges at %ipx (find-it, ADR-255)', (width) => {
  it("Use its group's board again on a boards-locked piece says Nothing changed", async () => {
    const { user } = await renderApp(width);
    await projectWithTwoPieces(user);
    const { useDesign } = await import('../../src/store/designStore');
    const { buildModel } = await import('../../src/core/build');
    const it0 = useDesign.getState().project!.items[0];
    const panel = buildModel(it0.design).panels[0];
    const oak = { ...it0.design.materials[0], id: 'oak', name: 'PAL 18 oak', color: '#a07850' };
    act(() => useDesign.getState().selectItem(it0.id));
    useDesign.getState().applyMaterial(it0.id, [], oak, 'part', `${it0.id}:${panel.id}`);
    act(() => {
      useDesign.getState().setBoardsLocked(it0.id, true);
      useDesign.getState().selectItem(it0.id);
    });
    await user.click(screen.getByRole('button', { name: 'Material' }));
    const dlg = await screen.findByRole('dialog', { name: 'Material' });
    await user.click(within(dlg).getByRole('radio', { name: 'Part' }));
    await user.selectOptions(within(dlg).getByRole('combobox', { name: 'Part' }), panel.id);
    await user.click(within(dlg).getByRole('button', { name: "Use its group's board again" }));
    expect(within(dlg).getByRole('status').textContent).toMatch(/^Nothing changed:/);
  });

  it('an emptied board name goes back and says why; each board row is a named group', async () => {
    const { user } = await chest(width);
    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    const settings = await screen.findByRole('dialog');
    await user.click(within(settings).getByText('Boards, sheets and saw cut'));
    const rows = within(settings).getAllByRole('group', { name: /^Board / });
    expect(rows.length).toBeGreaterThan(0);
    const name = within(rows[0]).getByRole('textbox', { name: 'Name' }) as HTMLInputElement;
    const stored = name.value;
    await user.clear(name);
    await user.tab();
    expect(name.value).toBe(stored);
    expect(within(rows[0]).getByText(/^A board needs a name; it keeps /)).toBeTruthy();
  });

  it('a wrong own-band thickness is marked with its reason', async () => {
    const { user } = await chest(width);
    await user.click(await screen.findByRole('button', { name: 'Material' }));
    const dlg = await screen.findByRole('dialog', { name: 'Material' });
    await user.selectOptions(within(dlg).getByRole('combobox', { name: 'Edge band' }), 'own');
    const th = within(dlg).getByLabelText('Band thickness (mm)');
    await user.type(th, '0.85');
    expect(th.getAttribute('aria-invalid')).toBe('true');
    expect(within(dlg).getByText('From 0.1 to 10 mm, one decimal.')).toBeTruthy();
  });

  it('the band list can be removed', async () => {
    const { user } = await chest(width);
    const { replaceBands } = await import('../../src/store/libraryStore');
    await replaceBands([
      {
        id: 'b1',
        list: 'Mine',
        kind: 'abs',
        thickness: 8,
        width: 22,
        color: '#ffffff',
        code: 'A1',
      } as never,
    ]);
    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    const settings = await screen.findByRole('dialog');
    await user.click(within(settings).getByText('Boards, sheets and saw cut'));
    await user.click(await within(settings).findByRole('button', { name: 'Remove band list' }));
    const ask = await screen.findByText(/^Remove the band list from this device\?/);
    await user.click(within(ask.closest('dialog')!).getByRole('button', { name: 'Remove list' }));
    expect(await within(settings).findByText(/Band list: none\./)).toBeTruthy();
  });
});
