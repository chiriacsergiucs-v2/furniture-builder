// @vitest-environment jsdom
// Find-it for the paginated catalog (N304) in jsdom (ADR-108), from the bare app at 1280 and 390 px: each Catalog group
// lists its first families with "Showing 4 of N families" and a "Show … more" button that adds the next page; a group
// that fits the first page shows neither; a new search starts the groups again at page one; a saved design lands on
// page one after "Save to catalog"; the Saved list and a brand's decors list page their rows the same way.
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Decor } from '../../src/core/materials';
// ./setup installs the test IndexedDB first; CatalogPage loads the storage library when it is imported.
import { renderApp, WIDTHS } from './setup';
import { GROUP_PAGE, GROUP_STEP } from '../../src/ui/CatalogPage';

// The first page of a flat list (saved designs, a brand's decors); the code keeps it in CatalogPage.tsx.
const LIST_PAGE = 24;

afterEach(async () => {
  vi.restoreAllMocks();
  const db = await import('../../src/persist/db');
  await db.db.templates.clear();
  await db.db.designs.clear();
  await db.clearDecors();
});

type User = Awaited<ReturnType<typeof renderApp>>['user'];

async function openCatalog(user: User) {
  await user.click((await screen.findAllByRole('link', { name: /^(Catalog|Каталог)/ }))[0]);
  return screen.findByRole('heading', { level: 1, name: /^(Catalog|Каталог)$/ });
}
const firstPageNote = new RegExp(`^Showing ${GROUP_PAGE} of \\d+ families$`);

describe.each(WIDTHS)('catalog pagination at %ipx (find-it, N304)', (width) => {
  it('a long group lists its first families, then "Show … more" adds the next page', async () => {
    const { user } = await renderApp(width);
    await openCatalog(user);

    const status = screen.getAllByText(firstPageNote)[0];
    const total = Number(/of (\d+) families/.exec(status.textContent!)![1]);
    expect(total).toBeGreaterThan(GROUP_PAGE);
    const section = status.closest('section')!;
    expect(within(section).getAllByRole('article')).toHaveLength(GROUP_PAGE);

    const next = Math.min(GROUP_STEP, total - GROUP_PAGE);
    await user.click(
      within(section).getByRole('button', { name: new RegExp(`^Show ${next} more famil(y|ies)$`) }),
    );
    const shownNow = GROUP_PAGE + next;
    expect(within(section).getAllByRole('article')).toHaveLength(shownNow);
    expect(within(section).getByText(`Showing ${shownNow} of ${total} families`)).toBeTruthy();
  });

  it('a group that fits the first page shows neither a count line nor a button', async () => {
    const { user } = await renderApp(width);
    await openCatalog(user);
    const groups = screen
      .getAllByRole('region')
      .filter((r) => r.classList.contains('catalog-group'));
    expect(groups.length).toBeGreaterThan(1);
    let fits = 0;
    for (const g of groups) {
      const note = within(g).queryByText(/^Showing \d+ of \d+ families$/);
      if (note) continue; // a long group: covered above
      fits += 1;
      expect(within(g).getAllByRole('article').length).toBeLessThanOrEqual(GROUP_PAGE);
      expect(within(g).queryByRole('button', { name: /^Show \d+ more/ })).toBeNull();
    }
    expect(fits).toBeGreaterThan(0);
  });

  it('a search starts every group at its first page again', async () => {
    const { user } = await renderApp(width);
    await openCatalog(user);
    const section = screen.getAllByText(firstPageNote)[0].closest('section')!;
    const name = section.getAttribute('aria-label')!;
    await user.click(within(section).getByRole('button', { name: /^Show \d+ more/ }));
    expect(within(section).getAllByRole('article').length).toBeGreaterThan(GROUP_PAGE);
    const box = screen.getByRole('searchbox', { name: 'Search the catalog' });
    await user.type(box, 'a');
    await user.clear(box);
    expect(within(screen.getByRole('region', { name })).getAllByRole('article')).toHaveLength(
      GROUP_PAGE,
    );
  });

  it('"Show “…”" after Save to catalog lands on the new family', async () => {
    const { user } = await renderApp(width);
    await user.click(screen.getAllByRole('link', { name: /^Projects/ })[0]);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    await user.click(
      within(await screen.findByRole('dialog')).getAllByRole('button', { name: /Sideboard/ })[0],
    );
    await openCatalog(user);
    if (width < 500) await user.click(screen.getByText('More catalog actions'));
    await user.click(screen.getByRole('button', { name: 'Save this piece as a template' }));
    const dlg = await screen.findByRole('dialog', { name: 'Save to catalog' });
    const name = within(dlg).getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Zeta sideboard');
    await user.selectOptions(within(dlg).getByLabelText('Room'), 'Living room');
    await user.click(within(dlg).getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved to the catalog.');
    await user.click(screen.getByRole('link', { name: 'Show “Zeta sideboard”' }));
    const section = screen.getByRole('region', { name: 'Living room' });
    expect(within(section).getByRole('article', { name: 'Zeta sideboard' })).toBeTruthy();
  });

  it('the Saved list shows its first rows, then "Show … more"', async () => {
    const { user } = await renderApp(width);
    const db = await import('../../src/persist/db');
    const { templates } = await import('../../src/core/design');
    await db.db.designs.clear();
    const base = templates.find((x) => x.id === 'base-door')!.create();
    const total = LIST_PAGE + 6;
    for (let i = 0; i < total; i += 1)
      await db.saveDesign({
        ...base,
        id: `paged-${i}`,
        name: `Paged piece ${String(i).padStart(2, '0')}`,
      });

    await openCatalog(user);
    await user.click(screen.getByRole('tab', { name: /^Saved/ }));
    await screen.findAllByRole('button', { name: /^Paged piece/ });
    const rows = () => screen.getAllByRole('button', { name: /^Paged piece/ });
    expect(rows()).toHaveLength(LIST_PAGE);
    expect(screen.getByText(`Showing ${LIST_PAGE} of ${total}`)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Show 6 more' }));
    expect(rows()).toHaveLength(total);
    expect(screen.queryByRole('button', { name: /^Show \d+ more/ })).toBeNull();
    expect(screen.getByText(`Showing ${total} of ${total}`)).toBeTruthy();
  });

  it('a brand\'s decors list shows its first rows, then "Show … more"', async () => {
    const { user } = await renderApp(width);
    const db = await import('../../src/persist/db');
    await db.clearDecors();
    const total = LIST_PAGE + 5;
    const decors: Decor[] = Array.from({ length: total }, (_, i) => ({
      id: `egger:E${i}:18`,
      maker: 'egger',
      makerText: 'Egger',
      kind: 'pal',
      code: `E${String(i).padStart(3, '0')}`,
      name: `Egger decor ${i}`,
      thickness: 18,
      color: '#d8d2c4',
      list: 'my-decors.csv',
    }));
    await db.replaceDecors(decors);

    await openCatalog(user);
    await user.click(screen.getByRole('tab', { name: /^Brands/ }));
    await user.click(
      await screen.findByRole('button', { name: new RegExp(`^Egger \\(${total}\\)`) }),
    );
    const section = screen.getByRole('region', { name: 'Egger' });
    expect(within(section).getAllByText(/^E\d{3} Egger decor/)).toHaveLength(LIST_PAGE);
    expect(within(section).getByText(`Showing ${LIST_PAGE} of ${total}`)).toBeTruthy();

    await user.click(within(section).getByRole('button', { name: 'Show 5 more' }));
    expect(within(section).getAllByText(/^E\d{3} Egger decor/)).toHaveLength(total);
  });
});
