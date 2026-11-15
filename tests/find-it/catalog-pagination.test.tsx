// @vitest-environment jsdom
// Find-it for the paginated catalog (N303) in jsdom (ADR-108): from the bare app, Catalog lists at most 12 families per
// group with "Showing 12 of N families" and a "Show … more" button; the button adds the next page and the count line
// follows; a new search starts the groups again at their first page. Desktop and phone widths.
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderApp, WIDTHS } from './setup';

afterEach(async () => {
  vi.restoreAllMocks();
  const { db } = await import('../../src/persist/db');
  await db.templates.clear();
});

type User = Awaited<ReturnType<typeof renderApp>>['user'];

async function openCatalog(user: User) {
  await user.click((await screen.findAllByRole('link', { name: /^(Catalog|Каталог)/ }))[0]);
  return screen.findByRole('heading', { level: 1, name: /^(Catalog|Каталог)$/ });
}

describe.each(WIDTHS)('catalog pagination at %ipx (find-it, N303)', (width) => {
  it('a long group lists 12 families, then "Show … more" adds the next page', async () => {
    const { user } = await renderApp(width);
    await openCatalog(user);

    const status = screen.getAllByText(/^Showing 12 of \d+ families$/)[0];
    const total = Number(/of (\d+) families/.exec(status.textContent!)![1]);
    expect(total).toBeGreaterThan(12);
    const section = status.closest('section')!;
    expect(within(section).getAllByRole('article')).toHaveLength(12);

    const left = total - 12;
    const label = new RegExp(`^Show ${Math.min(12, left)} more famil(y|ies)$`);
    await user.click(within(section).getByRole('button', { name: label }));
    const shownNow = Math.min(24, total);
    expect(within(section).getAllByRole('article')).toHaveLength(shownNow);
    expect(within(section).getByText(`Showing ${shownNow} of ${total} families`)).toBeTruthy();
  });

  it('a group with 12 families or fewer shows no count line and no button', async () => {
    const { user } = await renderApp(width);
    await openCatalog(user);
    const index = within(screen.getByRole('navigation', { name: 'Jump to a group' }));
    const small = index
      .getAllByRole('link')
      .map((a) => a.textContent!.trim())
      .map((x) => /^(.*) (\d+)$/.exec(x)!)
      .find(([, , n]) => Number(n) <= 12);
    if (!small) return; // every group is long in this catalog: nothing to check
    const section = screen.getByRole('region', { name: small[1] });
    expect(within(section).queryByText(/^Showing \d+ of \d+ families$/)).toBeNull();
    expect(within(section).queryByRole('button', { name: /^Show \d+ more/ })).toBeNull();
  });

  it('a search starts every group at its first page again', async () => {
    const { user } = await renderApp(width);
    await openCatalog(user);
    const status = screen.getAllByText(/^Showing 12 of \d+ families$/)[0];
    const section = status.closest('section')!;
    const name = section.getAttribute('aria-label')!;
    await user.click(within(section).getByRole('button', { name: /^Show \d+ more/ }));
    expect(within(section).getAllByRole('article').length).toBeGreaterThan(12);
    const box = screen.getByRole('searchbox', { name: 'Search the catalog' });
    await user.type(box, 'a');
    await user.clear(box);
    // The same group, with the search cleared again, is back at its first page.
    expect(within(screen.getByRole('region', { name })).getAllByRole('article')).toHaveLength(12);
  });
  it('"Show “…”" after Save to catalog opens the group down to the new family', async () => {
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
});
