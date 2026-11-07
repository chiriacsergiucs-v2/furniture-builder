// @vitest-environment jsdom
// Find-it for the unit price on each Shopping list row (ADR-181, N184), in jsdom (ADR-108): a board priced per m²
// shows "45,00 lei / m²" under its line total, a row without a price shows "—", and the printed list has the
// Unit price column; every header follows More › Print language (Romanian by default: "Preț unitar"; user 2026-11-05:
// "All headers via print language").
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setPrintLang } from '../../src/core/i18n/print';
import { addPiece, openSheet, renderApp, WIDTHS } from './setup';

afterEach(() => {
  vi.restoreAllMocks();
  setPrintLang('ro');
});

/** The printed list's headers, per print language: the column headers, then the Boards and Hardware titles. */
const HEADERS = {
  ro: ['Cantitate', 'Articol', 'Detalii', 'Preț', 'Preț unitar', 'Plăci', 'Feronerie'],
  ru: ['Количество', 'Позиция', 'Подробности', 'Цена', 'Цена за единицу', 'Листы', 'Фурнитура'],
  en: ['Quantity', 'Item', 'Details', 'Price', 'Unit price', 'Boards', 'Hardware'],
} as const;
const TITLE = { ro: 'Listă de cumpărături — ', ru: 'Список покупок — ', en: 'Shopping list — ' };

function expectHeaders(html: string, lang: keyof typeof HEADERS) {
  const [qty, item, details, price, unit, boards, hardware] = HEADERS[lang];
  expect(html).toContain(
    `<tr><th>${qty}</th><th>${item}</th><th>${details}</th><th>${price}</th><th>${unit}</th></tr>`,
  );
  expect(html).toContain(`<h2>${boards}</h2>`);
  expect(html).toContain(`<h2>${hardware}</h2>`);
  expect(html).toContain(`<h1>${TITLE[lang]}`);
}

describe.each(WIDTHS)('unit price on Shopping list rows at %ipx (find-it, ADR-181)', (width) => {
  it('a board priced per m² shows its unit price under the total; an unpriced row shows "—"; the print has the column and its headers follow the print language', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'Create a new project' }));
    const create = await screen.findByRole('dialog');
    await user.type(within(create).getByRole('textbox'), `Unit price ${width}`);
    await user.click(within(create).getByRole('button', { name: 'Create project' }));
    const panel = await screen.findByRole('complementary', { name: 'Compose' });
    await openSheet(user, panel);
    await addPiece(user);

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
    expectHeaders(html, 'ro');

    // More › Print language: every header of the printed list follows it.
    for (const [lang, name, per] of [
      ['ru', 'Русский', '45,00 lei / м²'],
      ['en', 'English', '45,00 lei / m²'],
    ] as const) {
      await user.click(screen.getByLabelText(/^More$/));
      const group = screen.getByRole('group', { name: /Print language/ });
      await user.click(within(group).getByRole('button', { name }));
      await user.keyboard('{Escape}');
      html = '';
      await user.click(within(list).getByRole('button', { name: 'Print shopping list' }));
      expectHeaders(html, lang);
      expect(html).toContain(per);
    }
  });
});
