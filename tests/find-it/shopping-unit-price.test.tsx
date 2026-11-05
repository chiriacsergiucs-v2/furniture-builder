// @vitest-environment jsdom
// Find-it for the unit price on each Shopping list row (ADR-181, N184), in jsdom (ADR-108): a board priced per m²
// shows "45,00 lei / m²" under its line total, a row without a price shows "—", and the printed list has the
// Unit price column (print language Romanian by default: "Preț unitar").
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderApp, WIDTHS } from './setup';

type User = Awaited<ReturnType<typeof renderApp>>['user'];

async function addPiece(user: User, panel: HTMLElement) {
  const all = within(panel).queryByRole('button', { name: /^All pieces \(\d+\)$/ });
  if (all) await user.click(all);
  await user.click(within(panel).getByRole('button', { name: 'Add a piece' }));
  const dlg = await screen.findByRole('dialog', { name: 'Add a piece' });
  await user.click(within(dlg).getAllByRole('button', { name: /Base cabinet, doors: 1 door/ })[0]);
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add a piece' })).toBeNull());
  const place = screen.queryByRole('button', { name: 'Place to the right' });
  if (place) await user.click(place);
}

afterEach(() => vi.restoreAllMocks());

describe.each(WIDTHS)('unit price on Shopping list rows at %ipx (find-it, ADR-181)', (width) => {
  it('a board priced per m² shows its unit price under the total; an unpriced row shows "—"; the print has the column', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'Create a new project' }));
    const create = await screen.findByRole('dialog');
    await user.type(within(create).getByRole('textbox'), `Unit price ${width}`);
    await user.click(within(create).getByRole('button', { name: 'Create project' }));
    const panel = await screen.findByRole('complementary', { name: 'Compose' });
    const peek = panel.querySelector<HTMLButtonElement>('.sheet-peek');
    if (peek?.getAttribute('aria-expanded') === 'false') await user.click(peek);
    await addPiece(user, panel);

    const build = screen.queryByRole('radio', { name: /Build & Preview/ });
    if (build) await user.click(build);
    await user.click(screen.getByRole('tab', { name: /Shopping/ }));
    const list = await screen.findByRole('tabpanel');
    await user.click(within(list).getByRole('button', { name: 'Prices' }));
    const boards = within(list).getByRole('region', { name: 'Boards' });
    await user.selectOptions(within(boards).getAllByLabelText(/^Price unit of /)[0], 'm2');
    const price = within(boards).getAllByLabelText(/^Price of /)[0] as HTMLInputElement;
    await user.clear(price);
    await user.type(price, '45');
    await user.tab();
    await user.click(within(list).getByRole('button', { name: 'Done with prices' }));

    // The board row: its line total (the estimate, the only priced line) and "45,00 lei / m²" under it.
    const unit = await within(boards).findByText('45,00 lei / m²');
    const cell = unit.closest('td')!;
    const estimate = within(list).getByText(/^Estimate: /).textContent ?? '';
    const total = /Estimate: ([^ ]+) lei/.exec(estimate)?.[1];
    expect(total).toBeTruthy();
    expect(cell.textContent).toContain(`${total} lei`);

    // An unpriced hardware row shows "—", not "price missing".
    const hardware = within(list).getByRole('region', { name: 'Hardware' });
    expect(within(hardware).getAllByText('—').length).toBeGreaterThan(0);
    expect(within(list).queryByText('price missing')).toBeNull();

    // The printed list has the Unit price column with the same unit price.
    let html = '';
    const fake = {
      document: { write: (s: string) => (html += s), close: () => {} },
      focus: () => {},
      print: () => {},
    };
    vi.spyOn(window, 'open').mockReturnValue(fake as unknown as Window);
    await user.click(within(list).getByRole('button', { name: 'Print shopping list' }));
    expect(html).toContain('<th>Preț unitar</th>');
    expect(html).toContain('45,00 lei / m²');
  });
});
