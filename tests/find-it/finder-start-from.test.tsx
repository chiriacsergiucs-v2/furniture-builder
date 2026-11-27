// @vitest-environment jsdom
// Find-it for G-584 (N416) in jsdom (ADR-108), at 1280 and 390 px, with More › Catalog finder on (the default; the
// setup turns it off for the grouped tests): More → New… → Start from and Compose › Add a piece show every ready item
// in the finder's grid with its Room and Type filters, and a tile still opens or adds the piece; in Material, the seller
// bands are not in the Edge band select, "Band from a seller" opens the product picker and its pick becomes the band.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { openMore, openSheet, renderApp, startNew, WIDTHS } from './setup';

type User = Awaited<ReturnType<typeof renderApp>>['user'];

async function finderOn(user: User) {
  await openMore(user);
  await user.click(await screen.findByRole('button', { name: /^Catalog finder \(preview\)/ }));
}

describe.each(WIDTHS)(
  'Start from and Materials in the finder at %ipx (find-it, G-584)',
  (width) => {
    it('More → New… → Start from: the finder grid with Room and Type filters; a tile opens the piece', async () => {
      const { user } = await renderApp(width);
      await finderOn(user);
      const start = await startNew(user);
      expect(within(start).getByRole('heading', { name: /^Start from/ })).toBeTruthy();
      // No grouping switch: the finder's filters instead.
      expect(within(start).queryByRole('radiogroup', { name: 'Group by' })).toBeNull();
      const filters = within(start).getByRole('group', { name: 'Filters' });
      const room = within(filters).getByRole('combobox', { name: 'Room' }) as HTMLSelectElement;
      const type = within(filters).getByRole('combobox', { name: 'Type' }) as HTMLSelectElement;
      const grid = within(start).getByRole('list', { name: 'Start from' });
      const all = within(grid).getAllByRole('listitem').length;
      expect(all).toBeGreaterThan(10);

      // A type filter narrows the grid; "All types" brings every item back.
      await user.selectOptions(type, type.options[1].value);
      const typed = within(grid).getAllByRole('listitem').length;
      expect(typed).toBeGreaterThan(0);
      expect(typed).toBeLessThan(all);
      await user.selectOptions(type, '');
      expect(within(grid).getAllByRole('listitem')).toHaveLength(all);
      expect(room.options.length).toBeGreaterThan(2);

      await user.type(within(start).getByRole('searchbox', { name: 'Search the items' }), 'Base');
      await user.click(
        within(start).getAllByRole('button', { name: /^Base cabinet, doors: 1 door/ })[0],
      );
      await waitFor(() =>
        expect(screen.queryByRole('dialog', { name: 'Start something new' })).toBeNull(),
      );
      const { useDesign } = await import('../../src/store/designStore');
      expect(useDesign.getState().design.catalog?.origin?.catalogId).toBeTruthy();
    });

    it('Compose › Add a piece: the finder grid; a tile adds the piece to the project', async () => {
      const { user } = await renderApp(width);
      await finderOn(user);
      await user.click(await screen.findByRole('button', { name: 'Create a new project' }));
      const create = await screen.findByRole('dialog');
      await user.click(within(create).getByRole('button', { name: 'Create project' }));
      const panel = await screen.findByRole('complementary', { name: 'Compose' });
      await openSheet(user, panel);
      await user.click(within(panel).getByRole('button', { name: 'Add a piece' }));
      const dlg = await screen.findByRole('dialog', { name: 'Add a piece' });
      expect(within(dlg).getByRole('group', { name: 'Filters' })).toBeTruthy();
      expect(within(dlg).getByRole('button', { name: 'Open the Catalog' })).toBeTruthy();
      const grid = within(dlg).getByRole('list', { name: 'Start from' });
      await user.click(within(grid).getAllByRole('button', { name: /^Base cabinet, doors/ })[0]);
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add a piece' })).toBeNull());
      const { useDesign } = await import('../../src/store/designStore');
      expect(useDesign.getState().project?.items).toHaveLength(1);
    });

    it('Material: Band from a seller opens the product picker; its pick becomes the edge band', async () => {
      const { user } = await renderApp(width);
      await finderOn(user);
      await user.click(await screen.findByRole('button', { name: 'New single piece' }));
      await user.click(
        within(await screen.findByRole('dialog')).getAllByRole('button', {
          name: /Chest of drawers/,
        })[0],
      );
      await user.click(await screen.findByRole('button', { name: 'Material' }));
      const dlg = await screen.findByRole('dialog', { name: 'Material' });
      const band = within(dlg).getByRole('combobox', { name: 'Edge band' }) as HTMLSelectElement;
      expect([...band.options].some((o) => o.text.includes('(seller:'))).toBe(false);
      await user.click(within(dlg).getByRole('button', { name: 'Band from a seller' }));
      const picker = await screen.findByRole('dialog', { name: /^Edge band from a seller for / });
      await user.click(
        (await within(picker).findAllByRole('button', { name: 'Use this' }, { timeout: 15000 }))[0],
      );
      await waitFor(() =>
        expect(screen.queryByRole('dialog', { name: /^Edge band from a seller for / })).toBeNull(),
      );
      expect(band.value).toBe('picked');
      expect(band.selectedOptions[0].text).toMatch(/\(seller: .+\)$/);
      expect(within(dlg).getByRole('button', { name: 'Apply material' })).toBeTruthy();
    });
  },
);
