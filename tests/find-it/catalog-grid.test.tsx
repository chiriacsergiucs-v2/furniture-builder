// @vitest-environment jsdom
// Find-it for the catalog's item tiles in jsdom (ADR-108): from the bare app, by role and visible text, at phone and
// desktop widths. Column counts and picture sizes are layout, which jsdom cannot measure.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { openCatalog, renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('catalog item tiles at %ipx (find-it)', (width) => {
  it('a Wardrobe tile shows picture, name and size, and has no Add button, RO line or chips', async () => {
    const { user } = await renderApp(width);
    await openCatalog(user);
    const fam = (await screen.findAllByRole('article', { name: 'Wardrobe' }))[0];
    const tile = within(fam).getAllByRole('button', { name: /^Open / })[0];
    expect(within(tile).getByRole('img')).toBeTruthy();
    const named = /^Open (.+?) \d+ × \d+ × \d+/.exec(tile.getAttribute('aria-label') ?? '');
    expect(named).toBeTruthy();
    expect(tile.textContent).toContain(named![1]);
    expect(tile.textContent).toMatch(/\d+ × \d+ × \d+/);
    // The tile is the only button of its item: no separate Add / Open button.
    expect(within(fam).queryByRole('button', { name: 'Open' })).toBeNull();
    expect(within(fam).queryByRole('button', { name: 'Add' })).toBeNull();
    for (const gone of [
      /^RO: /,
      /Interior only/,
      /About this family/,
      /^default$/,
      /^Ready$/,
      /parts/,
    ]) {
      expect(within(fam).queryByText(gone), String(gone)).toBeNull();
    }
    expect(within(fam).queryByRole('button', { name: 'More' })).toBeNull();
    expect(within(fam).getByRole('button', { name: 'Edit template' })).toBeTruthy();
  });

  it('tapping a Wardrobe tile opens that variant in the editor', async () => {
    const { user } = await renderApp(width);
    await openCatalog(user);
    const fam = (await screen.findAllByRole('article', { name: 'Wardrobe' }))[0];
    await user.click(within(fam).getAllByRole('button', { name: /^Open / })[0]);
    await waitFor(() =>
      expect(screen.queryAllByRole('article', { name: 'Wardrobe' })).toHaveLength(0),
    );
  });
});
