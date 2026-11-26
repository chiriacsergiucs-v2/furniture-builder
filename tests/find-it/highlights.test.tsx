// @vitest-environment jsdom
// Find-it for Highlights and kits (ADR-298), in jsdom (ADR-108): from the bare app, Catalog › Highlights lists the room
// divider and the staggered shelving with 3 kit versions each and a stand-out per function group; Add kit opens a
// kit whose Settings show the banner and only the size; Unlock all edits asks, unlocks, and Undo locks it again; Edit
// template has a Highlight switch per variant.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { openCatalog, renderApp, WIDTHS } from './setup';

async function toHighlights(user: Parameters<typeof openCatalog>[0]) {
  await openCatalog(user);
  await user.click(screen.getByRole('tab', { name: 'Highlights' }));
}

describe.each(WIDTHS)('Highlights and kits at %ipx (find-it, ADR-298)', (width) => {
  it('Catalog › Highlights lists the custom families, 3 kits each, and a stand-out per group', async () => {
    const { user } = await renderApp(width);
    await toHighlights(user);
    for (const name of ['Room divider', 'Staggered shelving']) {
      const fam = await screen.findByRole('article', { name });
      expect(within(fam).getAllByRole('button', { name: /^Add kit / })).toHaveLength(3);
    }
    for (const group of [
      'Kitchen cabinets',
      'Storage and display',
      'Tables and surfaces',
      'Seating',
      'Sleeping and lying',
    ])
      expect(screen.getByRole('region', { name: group })).toBeTruthy();
    expect(screen.getAllByText('Highlight').length).toBeGreaterThanOrEqual(11);
  });

  it('Add kit → Settings shows the banner and only the size; Unlock all edits, then Undo', async () => {
    const { user } = await renderApp(width);
    await toHighlights(user);
    const fam = await screen.findByRole('article', { name: 'Room divider' });
    await user.click(within(fam).getByRole('button', { name: /^Add kit Tall / }));
    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    expect(
      (
        await screen.findAllByText(
          'Size and boards can be changed. Unlock all edits to change the rest.',
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole('radiogroup', { name: 'Back' })).toBeNull();
    expect(screen.getAllByRole('textbox', { name: /^Width/ }).length).toBeGreaterThan(0);
    await user.click(screen.getAllByRole('button', { name: 'Unlock all edits' })[0]);
    await user.click(await screen.findByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(screen.getByRole('radiogroup', { name: 'Back' })).toBeTruthy());
    expect(screen.queryAllByRole('button', { name: 'Unlock all edits' })).toEqual([]);
    await user.click(screen.getAllByRole('button', { name: 'Undo' })[0]);
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Unlock all edits' }).length).toBeGreaterThan(0),
    );
  });

  it('Edit template has a Highlight switch per variant', async () => {
    const { user } = await renderApp(width);
    await toHighlights(user);
    const fam = await screen.findByRole('article', { name: 'Staggered shelving' });
    await user.click(within(fam).getByRole('button', { name: 'Edit template' }));
    const one = await screen.findByRole('checkbox', { name: 'Highlight variant 1' });
    expect((one as HTMLInputElement).checked).toBe(true);
    await user.click(one);
    expect((one as HTMLInputElement).checked).toBe(false);
  });
});
