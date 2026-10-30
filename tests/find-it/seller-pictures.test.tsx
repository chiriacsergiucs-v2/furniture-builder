// @vitest-environment jsdom
// Find-it for shipped seller board pictures (N164, ADR-162), in jsdom (ADR-108): a board the app ships a picture for
// shows it in the list with no seller request, and picking it takes the app's copy as the board's picture and colour.
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderApp, WIDTHS } from './setup';

// A small catalog: one board with a shipped picture (h), one without.
vi.mock('../../src/core/sellers/regency.json?raw', () => ({
  default: JSON.stringify({
    id: 'regency',
    name: 'Regency Company',
    origin: 'https://regencycompany.ro',
    imageBase: 'https://regencycompany.ro/media/',
    hostedBase: 'sellers/regency/',
    currency: 'RON',
    priceNote: 'VAT included',
    extracted: '2026-10-29',
    products: [
      {
        id: '101',
        n: 'Pal hosted blue, 2800 x 2070 x 18 mm',
        k: 'board',
        c: 'Pal',
        p: 40000,
        u: 'piece',
        s: 'in',
        t: 18,
        l: 2800,
        w: 2070,
        x: '',
        i: 'a/b/blue.jpg',
        h: 1,
      },
      {
        id: '102',
        n: 'Pal remote red, 2800 x 2070 x 18 mm',
        k: 'board',
        c: 'Pal',
        p: 40000,
        u: 'piece',
        s: 'in',
        t: 18,
        l: 2800,
        w: 2070,
        x: '',
        i: 'a/b/red.jpg',
      },
    ],
  }),
}));
// jsdom cannot decode pictures: the import stands in, returning the picture's average colour.
vi.mock('../../src/persist/images', async (orig) => ({
  ...(await orig<typeof import('../../src/persist/images')>()),
  importImage: vi.fn(async (f: File) => ({
    ok: true,
    color: '#2255aa',
    image: { id: 'img-test', name: f.name, tileLength: 1000, tileWidth: 1000 },
  })),
}));

afterEach(() => vi.unstubAllGlobals());

describe.each(WIDTHS)('shipped seller board pictures at %ipx (find-it, ADR-162)', (width) => {
  it('bare app → Chest of drawers → Product from a seller → the app’s own picture becomes the board’s look', async () => {
    const fetchFn = vi.fn(async (url: string) =>
      url.startsWith('/furniture-builder/sellers/regency/')
        ? {
            ok: true,
            blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }),
          }
        : Promise.reject(new Error('no seller request in this test')),
    );
    vi.stubGlobal('fetch', fetchFn);
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

    await user.click(within(white).getByRole('button', { name: 'Product from a seller' }));
    const picker = await screen.findByRole('dialog', {
      name: 'Product from a seller for PAL 18 white',
    });
    // Pictures switched off: the shipped picture still shows; the other board shows none.
    await user.click(
      within(picker).getByRole('checkbox', { name: 'Show seller pictures (online)' }),
    );
    const items = await within(picker).findAllByRole('listitem', {}, { timeout: 15000 });
    const hosted = items.find((li) => li.textContent?.includes('hosted blue'))!;
    const remote = items.find((li) => li.textContent?.includes('remote red'))!;
    expect(hosted.querySelector('img')?.getAttribute('src')).toBe(
      '/furniture-builder/sellers/regency/101.jpg',
    );
    expect(remote.querySelector('img')).toBeNull();

    await user.click(within(hosted).getByRole('button', { name: 'Use this' }));
    expect(await within(white).findByText(/Seller product: Pal hosted blue/)).toBeTruthy();
    // The app's copy was fetched, never the seller's site; its colour is now the board's colour.
    await vi.waitFor(() =>
      expect(fetchFn).toHaveBeenCalledWith(
        '/furniture-builder/sellers/regency/101.jpg',
        expect.anything(),
      ),
    );
    expect(fetchFn.mock.calls.every(([u]) => !String(u).includes('regencycompany.ro'))).toBe(true);
    await vi.waitFor(() =>
      expect((within(white).getByLabelText(/colour$/) as HTMLInputElement).value).toBe('#2255aa'),
    );
  });
});
