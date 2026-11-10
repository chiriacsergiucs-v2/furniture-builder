// @vitest-environment jsdom
// Find-it for ADR-249 (UI audit, Composition), in jsdom (ADR-108) at 1280 and 390 px: Fewer dividers and Apply a
// layout ask before they drop contents, the niche toggle fills in no appliance size, and Esc inside a drilled project
// piece goes up one level.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { projectWithTwoPieces, renderApp, WIDTHS } from './setup';
import type { Space } from '../../src/core/types';

const kinds = (s: Space): string[] =>
  s.kind === 'split'
    ? s.children.flatMap(kinds)
    : [s.kind + ('count' in s ? String((s as { count?: number }).count ?? '') : '')];

async function sideboard(width: number) {
  const app = await renderApp(width);
  await app.user.click(await screen.findByRole('button', { name: 'New single piece' }));
  await app.user.click(
    within(await screen.findByRole('dialog')).getAllByRole('button', { name: /Sideboard/ })[0],
  );
  await app.user.click(screen.getByRole('radio', { name: 'Compose' }));
  const { useDesign } = await import('../../src/store/designStore');
  const interior = () =>
    (useDesign.getState().design.product as { params: { interior: Space } }).params.interior;
  return { ...app, useDesign, interior };
}

describe.each(WIDTHS)('composition at %ipx (find-it, ADR-249)', (width) => {
  it('Fewer vertical dividers asks before dropping a part with drawers; Cancel keeps it', async () => {
    const { user, useDesign, interior } = await sideboard(width);
    await user.click(screen.getByRole('button', { name: /Edit the interior/ }));
    await user.click(screen.getByRole('button', { name: 'Right' }));
    await user.click(screen.getByRole('radio', { name: 'Drawers' }));
    const c = screen.queryByRole('dialog');
    if (c) await user.click(within(c).getByRole('button', { name: 'Change' }));
    const withDrawers = kinds(interior());
    useDesign.getState().select(null);
    const card = (await screen.findAllByRole('group', { name: 'Quick counts' }))[0];
    await user.click(within(card).getByRole('button', { name: 'Fewer vertical dividers' }));
    const ask = await screen.findByText('Remove the last parts and what is in them?');
    await user.click(within(ask.closest('dialog')!).getByRole('button', { name: 'Cancel' }));
    expect(kinds(interior())).toEqual(withDrawers);
  });

  it('the niche toggle starts at the measured opening, kind Other, with no oven size', async () => {
    const { user, useDesign } = await sideboard(width);
    await user.click(screen.getByRole('button', { name: /Edit the interior/ }));
    await user.click(screen.getByRole('button', { name: 'Left' }));
    await user.click(screen.getByRole('radio', { name: 'Empty' }));
    const c = screen.queryByRole('dialog');
    if (c) await user.click(within(c).getByRole('button', { name: 'Change' }));
    const sp = useDesign
      .getState()
      .model.spaces.find((o) => o.nodeId === useDesign.getState().selectedId)!;
    await user.click(screen.getByRole('checkbox', { name: 'Niche for a built-in appliance' }));
    expect((screen.getByRole('combobox', { name: 'Appliance' }) as HTMLSelectElement).value).toBe(
      'other',
    );
    expect((screen.getByLabelText('Niche height') as HTMLInputElement).value).toBe(
      String(sp.box.h),
    );
  });

  it('Apply a layout asks before replacing what is in the space', async () => {
    const { user, interior } = await sideboard(width);
    await user.click(screen.getByRole('button', { name: /Edit the interior/ }));
    await user.click(screen.getByRole('button', { name: 'Middle' }));
    const before = kinds(interior());
    await user.click(screen.getByText('Layouts'));
    const sel = screen.getByRole('combobox', {
      name: 'Apply a layout from the catalog',
    }) as HTMLSelectElement;
    await user.selectOptions(sel, sel.options[1].value);
    const ask = await screen.findByText(/^Replace what is in this space with /);
    await user.click(within(ask.closest('dialog')!).getByRole('button', { name: 'Cancel' }));
    expect(kinds(interior())).toEqual(before);
  });

  it('Esc inside a drilled project piece goes up one level, then leaves the piece', async () => {
    const { user } = await renderApp(width);
    await projectWithTwoPieces(user);
    const { useDesign } = await import('../../src/store/designStore');
    const id = useDesign.getState().project!.items[0].id;
    const { editInPlace } = await import('../../src/ui/Project');
    editInPlace(id);
    await waitFor(() => expect(useDesign.getState().drillItemId).toBe(id));
    const root = (useDesign.getState().design.product as { params: { interior: Space } }).params
      .interior;
    useDesign.getState().select(root.id);
    (document.activeElement as HTMLElement | null)?.blur();
    await user.keyboard('{Escape}');
    expect(useDesign.getState().drillItemId).toBe(id);
    expect(useDesign.getState().selectedId).not.toBe(root.id);
  });
});
