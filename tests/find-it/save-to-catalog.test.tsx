// @vitest-environment jsdom
// Find-it for saving a project piece to the catalog and the wizard inside a project (ADR-107, N105), in jsdom
// (ADR-108): from the bare app, by role and visible text, at desktop and phone widths.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

type User = Awaited<ReturnType<typeof renderApp>>['user'];

/** Bare app → ⋯ › New… › Project with several pieces → Compose. */
async function openProject(user: User) {
  await user.click(screen.getByLabelText('More'));
  await user.click(await screen.findByRole('button', { name: /New…/ }));
  const dlg = await screen.findByRole('dialog', { name: 'Start something new' });
  await user.click(within(dlg).getByRole('button', { name: /Project with several pieces/ }));
  await user.click(await screen.findByRole('radio', { name: 'Compose' }));
}

describe.each(WIDTHS)('save a project piece to the catalog at %ipx (find-it, ADR-107)', (width) => {
  it('project › a piece › Save to catalog › name, room › Save › Catalog › Templates lists it', async () => {
    const { user } = await renderApp(width);
    await openProject(user);
    await user.click(await screen.findByRole('button', { name: 'Add from Catalog' }));
    const cat = await screen.findByRole('main', { name: 'Catalog' });
    await user.type(within(cat).getByRole('searchbox', { name: 'Search the catalog' }), 'Base');
    const block = within(cat)
      .getAllByText(/Base cabinet/)[0]
      .closest('section')!;
    await user.click(within(block as HTMLElement).getAllByRole('button', { name: 'Add' })[0]);

    await user.click(await screen.findByRole('button', { name: 'Save to catalog' }));
    const dlg = await screen.findByRole('dialog', { name: 'Save to catalog' });
    const name = within(dlg).getByLabelText('Name');
    await user.clear(name);
    expect(within(dlg).getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true);
    await user.type(name, 'Hall cabinet');
    await user.selectOptions(within(dlg).getByLabelText('Room'), 'Hallway');
    await user.click(within(dlg).getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/Saved to the catalog/)).toBeTruthy();
    expect(screen.getByText(/revision 1/).textContent).toContain('Hall cabinet');
    await user.click(screen.getByRole('link', { name: 'Open in Catalog' }));
    await user.click(await screen.findByRole('tab', { name: 'Templates' }));
    expect((await screen.findAllByText('Hall cabinet')).length).toBeGreaterThan(0);
  });

  it('project › Add from Catalog › New piece › Add to project adds one piece', async () => {
    const { user } = await renderApp(width);
    await openProject(user);
    const side = screen.getByRole('complementary', { name: 'Compose' });
    expect(within(side).getByText(/No pieces yet/)).toBeTruthy();
    await user.click(await screen.findByRole('button', { name: 'Add from Catalog' }));
    const cat = await screen.findByRole('main', { name: 'Catalog' });
    await user.click(within(cat).getByRole('button', { name: 'New piece' }));
    const wiz = await screen.findByRole('dialog', { name: 'New piece' });
    // Skip on the type step takes the first type; Next keeps each step's defaults up to the review.
    await user.click(within(wiz).getByRole('button', { name: 'Skip' }));
    for (let i = 0; i < 20 && !within(wiz).queryByRole('button', { name: 'Add to project' }); i++)
      await user.click(within(wiz).getByRole('button', { name: 'Next' }));
    await user.click(within(wiz).getByRole('button', { name: 'Add to project' }));

    // The project stays open, now with one piece, selected; the piece is also saved on this device.
    const card = await within(side).findByRole('region', { name: /^Selected piece: / });
    const name = card.getAttribute('aria-label')!.replace('Selected piece: ', '');
    expect(within(side).getByRole('heading', { name: 'Project' })).toBeTruthy();
    expect(within(side).queryByText(/No pieces yet/)).toBeNull();
    expect(
      within(side).getAllByRole('button', { pressed: true, name: new RegExp(name) }).length,
    ).toBe(1);
    const { listDesigns } = await import('../../src/persist/db');
    expect((await listDesigns()).map((r) => r.name)).toContain(name);
  });
});
