// @vitest-environment jsdom
// Find-it for Catalog → Brands from the decor list (ADR-210, G-044), in jsdom (ADR-108), from the bare app by role and
// visible text at 1280 and 390 px: with a decor list on the device, a chip per manufacturer with its count; "Egger"
// lists its decors (code, name, thickness, type) and the saved pieces with an Egger board. Without a list, the empty
// text; a failed read of the list, the alert. Nothing is fetched (ADR-002).
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Decor } from '../../src/core/materials';
import { renderApp, WIDTHS } from './setup';

// The device storage fails to read the decor list while `failDecors` is set.
const store = vi.hoisted(() => ({ failDecors: false }));
vi.mock('../../src/persist/db', async (orig) => {
  const real = await orig<typeof import('../../src/persist/db')>();
  return {
    ...real,
    listDecors: (...a: Parameters<typeof real.listDecors>) =>
      store.failDecors ? Promise.reject(new Error('blocked')) : real.listDecors(...a),
  };
});

type User = Awaited<ReturnType<typeof renderApp>>['user'];

const decor = (maker: Decor['maker'], makerText: string, code: string, name: string): Decor => ({
  id: `${maker}:${code}:18`,
  maker,
  makerText,
  kind: 'pal',
  code,
  name,
  thickness: 18,
  color: '#d8d2c4',
  list: 'my-decors.csv',
});

/**
 * The device's storage as each test needs it (the IndexedDB library keeps its storage across the app's fresh module
 * loads, so it is emptied here): the decor list given, and, with a list, one saved piece with an Egger board.
 */
async function seed(withList: boolean) {
  const db = await import('../../src/persist/db');
  const { templates } = await import('../../src/core/design');
  await db.clearDecors();
  await db.db.designs.clear();
  if (!withList) return;
  await db.replaceDecors([
    decor('egger', 'Egger', 'W1000', 'Premium White'),
    decor('egger', 'EGGER', 'H1145', 'Natural Bardolino Oak'),
    decor('kronospan', 'Kronospan', 'K001', 'Kronospan Grey'),
    decor('other', 'Acme Boards', 'X1', 'Acme Sand'),
  ]);
  const d = templates.find((x) => x.id === 'base-door')!.create();
  await db.saveDesign({
    ...d,
    id: 'egger-hall-cabinet',
    name: 'Egger hall cabinet',
    materials: d.materials.map((m, i) => (i === 0 ? { ...m, maker: 'egger' as const } : m)),
  });
}

async function brands(user: User) {
  await user.click(screen.getByRole('link', { name: /Catalog/ }));
  await user.click(await screen.findByRole('tab', { name: 'Brands' }));
}

describe.each(WIDTHS)(
  'Catalog → Brands from the decor list at %ipx (find-it, ADR-210)',
  (width) => {
    it('a chip per manufacturer; Egger lists its decors and the saved pieces with an Egger board', async () => {
      store.failDecors = false;
      const { user } = await renderApp(width);
      await seed(true);
      await brands(user);
      const chips = await screen.findByRole('group', { name: 'Brands from your decor list' });
      const names = within(chips)
        .getAllByRole('button')
        .map((b) => b.textContent);
      expect(names).toEqual(['Acme Boards (1)', 'Egger (2)', 'Kronospan (1)']);
      const egger = within(chips).getByRole('button', { name: 'Egger (2)' });
      expect(egger.getAttribute('aria-pressed')).toBe('false');
      await user.click(egger);
      expect(egger.getAttribute('aria-pressed')).toBe('true');
      const section = screen.getByRole('region', { name: 'Egger' });
      expect(within(section).getByRole('heading', { name: 'Egger decors' })).toBeTruthy();
      expect(within(section).getByText('W1000 Premium White')).toBeTruthy();
      expect(within(section).getByText('H1145 Natural Bardolino Oak')).toBeTruthy();
      expect(within(section).queryByText(/Kronospan Grey/)).toBeNull();
      expect(within(section).getAllByText(/^18 mm · /).length).toBe(2);
      expect(
        within(section).getByRole('heading', { name: 'Saved pieces with a Egger board' }),
      ).toBeTruthy();
      expect(within(section).getByRole('button', { name: /Egger hall cabinet/ })).toBeTruthy();

      // An `other` maker by its written name, with no saved piece of it.
      await user.click(within(chips).getByRole('button', { name: 'Acme Boards (1)' }));
      const acme = screen.getByRole('region', { name: 'Acme Boards' });
      expect(within(acme).getByText('X1 Acme Sand')).toBeTruthy();
      expect(within(acme).getByText('No saved piece has a board of this maker yet.')).toBeTruthy();
    });

    it('no decor list: the empty text; a failed read: the alert', async () => {
      store.failDecors = false;
      const { user } = await renderApp(width);
      await seed(false);
      await brands(user);
      expect(
        await screen.findByText(
          'No brands yet. Import your decor list under Boards to see its manufacturers here.',
        ),
      ).toBeTruthy();
      expect(screen.queryByRole('group', { name: 'Brands from your decor list' })).toBeNull();

      store.failDecors = true;
      try {
        await user.click(screen.getByRole('tab', { name: 'Templates' }));
        await user.click(screen.getByRole('tab', { name: 'Brands' }));
        expect((await screen.findByRole('alert')).textContent).toBe(
          'The decor list could not be read on this device.',
        );
      } finally {
        store.failDecors = false;
      }
    });
  },
);
