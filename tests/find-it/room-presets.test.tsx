// @vitest-environment jsdom
// Find-it for ADR-210 (N215), in jsdom (ADR-108), from the bare app by role and visible text at 1280 and 390 px:
// More → New… → Room preset → "Home office: desk and bookcase" opens a project with both pieces; in that project,
// Shopping → Add seller product says it goes on the project's list and the picked product shows on it; More → New… →
// Fill the room → Refine shows "Budget ceiling", "Style" and "Add an island", and an island with no walkway is an
// error (never prefilled).
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { piecesList, renderApp, WIDTHS } from './setup';

afterEach(() => vi.unstubAllGlobals());

type User = Awaited<ReturnType<typeof renderApp>>['user'];

async function startNew(user: User) {
  await user.click(screen.getByLabelText('More'));
  await user.click(await screen.findByRole('button', { name: /New…/ }));
  return screen.findByRole('dialog', { name: 'Start something new' });
}

describe.each(WIDTHS)('room presets and room-mix filters at %ipx (find-it, ADR-210)', (width) => {
  it('New… → Room preset → Home office opens a project with the desk and the bookcase; Add seller product', async () => {
    // No request leaves the test (ADR-002): a seller picture download fails.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    );
    const { user } = await renderApp(width);
    const start = await startNew(user);
    const row = within(start).getByRole('button', { name: /^Room preset/ });
    expect(row.getAttribute('aria-expanded')).toBe('false');
    await user.click(row);
    const list = within(start).getByRole('list', { name: 'Room presets' });
    for (const name of [
      /^Bedroom: bed, two nightstands and a wardrobe/,
      /^Home office: desk and bookcase/,
      /^Kitchen and desk/,
    ])
      expect(within(list).getByRole('button', { name })).toBeTruthy();
    expect(
      within(list).getByRole('button', { name: /^Home office: desk and bookcase/ }).textContent,
    ).toMatch(/2 pieces, with the room/);
    await user.click(within(list).getByRole('button', { name: /^Home office: desk and bookcase/ }));

    // The project opens with both pieces.
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Start something new' })).toBeNull(),
    );
    const panel = await screen.findByRole('complementary', { name: 'Compose' });
    const peek = panel.querySelector<HTMLButtonElement>('.sheet-peek');
    if (peek?.getAttribute('aria-expanded') === 'false') await user.click(peek);
    const pieces = await piecesList(user, panel);
    const items = within(pieces).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(pieces.textContent).toMatch(/Desk/i);
    expect(pieces.textContent).toMatch(/Bookcase/i);
    expect(screen.getAllByText('Home office: desk and bookcase').length).toBeGreaterThan(0);

    // Shopping → Add seller product: enabled, with the project hint; the product lands on the project's list.
    const build = screen.queryByRole('radio', { name: /Build & Preview/ });
    if (build) await user.click(build);
    await user.click(screen.getByRole('tab', { name: /Shopping/ }));
    const add = await screen.findByRole('button', { name: 'Add seller product' });
    expect(add).toHaveProperty('disabled', false);
    await user.click(add);
    const picker = await screen.findByRole('dialog', { name: 'Add seller product' });
    expect(
      within(picker).getByText('Any product of a seller, added to this project’s shopping list.'),
    ).toBeTruthy();
    await user.type(within(picker).getByRole('searchbox'), '230M2500.21');
    await user.click(
      (await within(picker).findAllByRole('button', { name: 'Use this' }, { timeout: 15000 }))[0],
    );
    expect(
      await screen.findByRole('spinbutton', { name: /^Quantity of Glisiera BLUM/ }),
    ).toBeTruthy();
  });

  it('Fill the room → Refine shows Budget ceiling, Style and Add an island; an empty walkway is an error', async () => {
    const { user } = await renderApp(width);
    await user.click(within(await startNew(user)).getByRole('button', { name: /^Fill the room/ }));
    const dlg = await screen.findByRole('dialog', { name: 'Fill the room' });
    // A room with space for an island and its walkway on both sides.
    for (const label of ['Width', 'Depth']) {
      const input = within(dlg).getByLabelText(label);
      await user.clear(input);
      await user.type(input, '6000');
    }
    await user.click(
      within(within(dlg).getByRole('list', { name: 'Fill the room steps' })).getByRole('button', {
        name: 'Refine',
      }),
    );
    expect(within(dlg).getByRole('heading', { name: 'Refine' })).toBeTruthy();
    const ceiling = within(dlg).getByLabelText(/^Budget ceiling/) as HTMLInputElement;
    expect(ceiling.value).toBe('');
    const style = within(dlg).getByLabelText('Style') as HTMLSelectElement;
    expect(style.value).toBe('');
    expect(within(style).getByRole('option', { name: 'Any' })).toBeTruthy();
    expect(within(style).getByRole('option', { name: 'All oak' })).toBeTruthy();

    // Add an island: the walkway field appears empty (no prefill); suggesting without it names the error.
    expect(within(dlg).queryByLabelText(/^Walkway width/)).toBeNull();
    await user.click(within(dlg).getByRole('checkbox', { name: 'Add an island' }));
    const walkway = within(dlg).getByLabelText(/^Walkway width/) as HTMLInputElement;
    expect(walkway.value).toBe('');
    await user.click(within(dlg).getByRole('button', { name: 'Suggest again' }));
    expect(
      (await within(dlg).findAllByText('Type the walkway width to place an island.')).length,
    ).toBeGreaterThan(0);
    expect(within(dlg).queryByRole('button', { name: 'Use this mix' })).toBeNull();

    // A walkway the room has room for: cards with the island's summary line.
    await user.clear(walkway);
    await user.type(walkway, '1000');
    await user.click(within(dlg).getByRole('button', { name: 'Suggest again' }));
    const cards = await within(dlg).findAllByRole(
      'button',
      { name: 'Use this mix' },
      {
        timeout: 15000,
      },
    );
    expect(cards.length).toBeGreaterThan(0);
    expect(within(dlg).getAllByText(/^Island: /).length).toBeGreaterThan(0);
  });
});
