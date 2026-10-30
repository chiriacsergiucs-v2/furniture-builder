// @vitest-environment jsdom
// Find-it for seller products (N163, ADR-161), in jsdom (ADR-108): a board, its edge band and a hardware line take a
// seller product, and the estimate counts seller prices. No request leaves the test: the seller picture download fails.
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PHONE_WIDTH, renderApp, WIDTHS } from './setup';

afterEach(() => vi.unstubAllGlobals());

describe.each(WIDTHS)('seller products at %ipx (find-it, ADR-161)', (width) => {
  it('bare app → Chest of drawers → board, band and runner from a seller → seller prices', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    );
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    const start = await screen.findByRole('dialog');
    await user.click(within(start).getAllByRole('button', { name: /Chest of drawers/ })[0]);

    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    const settings = await screen.findByRole('dialog');
    await user.click(within(settings).getByText('Boards, sheets and saw cut'));
    const white = within(settings)
      .getAllByRole('listitem')
      .find((li) => within(li).queryByDisplayValue('PAL 18 white'))!;

    // Board: Product from a seller → search → Use this.
    await user.click(within(white).getByRole('button', { name: 'Product from a seller' }));
    let picker = await screen.findByRole('dialog', {
      name: 'Product from a seller for PAL 18 white',
    });
    expect(
      within(picker).getByRole('checkbox', { name: 'Show seller pictures (online)' }),
    ).toBeTruthy();
    await user.type(within(picker).getByRole('searchbox'), 'P18KR.112.PE');
    await user.click(
      (await within(picker).findAllByRole('button', { name: 'Use this' }, { timeout: 15000 }))[0],
    );
    expect(
      await within(white).findByText(/Seller product: Pal melaminat Kronospan gri 112 PE/),
    ).toBeTruthy();
    expect(within(white).getByDisplayValue('Pal melaminat Kronospan gri 112 PE')).toBeTruthy();
    // The picture download failed (no network here): the board keeps its look and says so.
    expect(await within(white).findByText(/the board keeps its look/)).toBeTruthy();

    // Edge band: Band from a seller, the same decor code first.
    await user.click(within(white).getByRole('button', { name: 'Band from a seller' }));
    picker = await screen.findByRole('dialog', {
      name: 'Edge band from a seller for Pal melaminat Kronospan gri 112 PE',
    });
    const first = (await within(picker).findAllByRole('listitem', {}, { timeout: 15000 }))[0];
    expect(first.textContent).toMatch(/112/);
    await user.click(within(first).getByRole('button', { name: 'Use this' }));
    expect(await within(white).findAllByText(/Seller product: Cant/i)).toBeTruthy();
    await user.click(within(settings).getByRole('button', { name: 'Done' }));

    // Shopping list: Product on the runner line, then Add seller product.
    if (width === PHONE_WIDTH)
      await user.click(screen.getByRole('radio', { name: /Build & Preview/ }));
    await user.click(screen.getByRole('tab', { name: /Shopping/ }));
    await user.click(
      await screen.findByRole('button', { name: /^Product for Ball-bearing side runner pair/ }),
    );
    picker = await screen.findByRole('dialog', {
      name: /^Product for Ball-bearing side runner pair/,
    });
    const runner = (await within(picker).findAllByRole('listitem', {}, { timeout: 15000 }))[0];
    expect(runner.textContent).toMatch(/400 mm/);
    await user.click(within(runner).getByRole('button', { name: 'Use this' }));
    expect(
      await screen.findByRole('textbox', { name: /^Seller units per item for Ball-bearing/ }),
    ).toBeTruthy();
    // The runner line is priced by the seller (boards wait for the sheet layout; this band is sold per piece).
    expect(screen.getAllByText('seller price').length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(/at seller prices: Regency Company, 2026-10-29/).length,
    ).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Add seller product' }));
    picker = await screen.findByRole('dialog', { name: 'Add seller product' });
    await user.type(within(picker).getByRole('searchbox'), '230M2500.21');
    await user.click(
      (await within(picker).findAllByRole('button', { name: 'Use this' }, { timeout: 15000 }))[0],
    );
    expect(
      await screen.findByRole('spinbutton', { name: /^Quantity of Glisiera BLUM/ }),
    ).toBeTruthy();
  });
});
