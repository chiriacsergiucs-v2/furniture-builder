// @vitest-environment jsdom
// Find-it for the grown families (ADR-281, jsdom, ADR-108): the Wardrobe family shows its eleven tiles.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { openCatalog, renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('Wardrobe variants at %ipx (find-it, ADR-281)', (width) => {
  it('the Wardrobe family lists 11 tiles, among them Sliding 3 doors and Open walk-in', async () => {
    const { user } = await renderApp(width);
    await openCatalog(user);
    const fam = (await screen.findAllByRole('article', { name: 'Wardrobe' }))[0];
    expect(within(fam).getAllByRole('button', { name: /^Open / })).toHaveLength(11);
    expect(within(fam).getByRole('button', { name: /^Open Sliding 3 doors/ })).toBeTruthy();
    expect(within(fam).getByRole('button', { name: /^Open Open walk-in/ })).toBeTruthy();
  });

  it('Edit template on the Wardrobe says Variants (1–12; the first is the default)', async () => {
    const { user } = await renderApp(width);
    await openCatalog(user);
    const fam = (await screen.findAllByRole('article', { name: 'Wardrobe' }))[0];
    await user.click(within(fam).getByRole('button', { name: 'Edit template' }));
    const editor = await screen.findByRole('region', { name: /^Edit template / });
    expect(within(editor).getByText('Variants (1–12; the first is the default)')).toBeTruthy();
  });
});
