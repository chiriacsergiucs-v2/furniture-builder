// @vitest-environment jsdom
// Find-it for ADR-202 in jsdom (ADR-108): the Brands empty text, the By-room hint, the wizard Doors as a segmented
// control with Review's short label, and the arrow keys on Editor mode and a board's Finish. Layout (the Materials row,
// the Doors control wrapping) is checked in the browser by `tools/texts-and-controls/find-it.mjs`.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ru_catalog } from '../../src/core/i18n/ru/catalog';
import { renderApp, WIDTHS } from './setup';

const BRANDS_EMPTY =
  'No brands yet. Import your decor list under Boards to see its manufacturers here.';
const ROOMS_HINT =
  'A family can sit in several rooms, so the room counts add up to more than the total.';

describe.each(WIDTHS)('texts and controls at %ipx (find-it, ADR-202)', (width) => {
  it('Catalog: the By-room hint; Brands says what is true, no feed promise', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('link', { name: /Catalog/ }));
    const group = await screen.findByRole('radiogroup', { name: 'Group by' });
    await user.click(within(group).getAllByRole('radio')[0]);
    expect(await screen.findByText(ROOMS_HINT)).toBeTruthy();
    await user.click(within(group).getAllByRole('radio')[1]);
    expect(screen.queryByText(ROOMS_HINT)).toBeNull();

    const sources = screen.getByRole('tablist', { name: 'Source' });
    await user.click(within(sources).getByRole('tab', { name: 'Brands' }));
    expect(await screen.findByText(BRANDS_EMPTY)).toBeTruthy();
    expect(screen.queryByText(/weekly catalog feed/i)).toBeNull();
  });

  it('in Russian: the By-room hint and the Brands empty text', async () => {
    localStorage.setItem('fb:lang', 'ru');
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('link', { name: /Каталог/ }));
    const group = await screen.findByRole('radiogroup', { name: ru_catalog['Group by'] });
    await user.click(within(group).getAllByRole('radio')[0]);
    expect(await screen.findByText(ru_catalog[ROOMS_HINT])).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: ru_catalog.Brands }));
    expect(await screen.findByText(ru_catalog[BRANDS_EMPTY])).toBeTruthy();
  });

  it('wizard: Doors is a five-option segmented control that wraps; Review reads "Compartment widths"', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('link', { name: /Catalog/ }));
    await user.click(await screen.findByRole('button', { name: 'New piece' }));
    const wiz = await screen.findByRole('dialog', { name: 'New piece' });
    await user.click(within(wiz).getByRole('radio', { name: /Cabinet \(closed box\)/ }));
    const next = () => user.click(within(wiz).getByRole('button', { name: 'Next' }));
    for (let i = 0; i < 10 && !within(wiz).queryByRole('heading', { name: 'Dividers' }); i++)
      await next();
    // One divider, custom widths: the long field label shows on its step.
    await user.click(within(wiz).getByRole('button', { name: /^More/ }));
    const spacing = within(wiz).getByRole('radiogroup', { name: 'Compartment widths' });
    await user.click(within(spacing).getByRole('radio', { name: 'Custom' }));
    expect(within(wiz).getByText('Width of each compartment (0 = share the rest)')).toBeTruthy();

    for (let i = 0; i < 10 && !within(wiz).queryByRole('heading', { name: 'Doors' }); i++)
      await next();
    const doors = within(wiz).getByRole('radiogroup', { name: 'Doors' });
    expect(doors.className).toBe('segmented wrap');
    expect(
      within(doors)
        .getAllByRole('radio')
        .map((r) => r.textContent),
    ).toEqual(['None', 'One door', 'Pair', 'Sliding pair', 'Per compartment']);
    expect(within(wiz).queryByRole('combobox', { name: 'Doors' })).toBeNull();
    await user.click(within(doors).getByRole('radio', { name: 'Pair' }));
    expect(within(doors).getByRole('radio', { name: 'Pair' }).getAttribute('aria-checked')).toBe(
      'true',
    );

    for (let i = 0; i < 20 && !within(wiz).queryByRole('button', { name: 'Create piece' }); i++)
      await next();
    const answers = within(wiz).getByRole('region', { name: 'Answers' });
    expect(within(answers).getByText(/Compartment widths: 0 mm/)).toBeTruthy();
    expect(within(answers).queryByText(/Width of each compartment/)).toBeNull();
    expect(within(answers).getByText(/Doors: Pair/)).toBeTruthy();
  });

  it('arrow keys: Editor mode and a board Finish; Tab reaches only the selected option', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getAllByRole('button', { name: /Sideboard/ })[0]);

    const modes = await screen.findByRole('radiogroup', { name: 'Editor mode' });
    const radios = () => within(modes).getAllByRole('radio');
    const on = () => radios().findIndex((r) => r.getAttribute('aria-checked') === 'true');
    const start = on();
    expect(start).toBeGreaterThanOrEqual(0);
    expect(radios().filter((r) => r.tabIndex === 0)).toEqual([radios()[start]]);
    radios()[start].focus();
    const n = radios().length;
    await user.keyboard('{ArrowRight}');
    expect(on()).toBe((start + 1) % n);
    expect(document.activeElement).toBe(radios()[(start + 1) % n]);
    expect(radios().filter((r) => r.tabIndex === 0)).toEqual([radios()[(start + 1) % n]]);
    await user.keyboard('{End}');
    expect(on()).toBe(n - 1);
    await user.keyboard('{ArrowRight}');
    expect(on()).toBe(0);
    await user.keyboard('{ArrowLeft}');
    expect(on()).toBe(n - 1);
    await user.keyboard('{Home}');
    expect(on()).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const settings = await screen.findByRole('dialog', { name: /^Settings/ });
    const finish = within(settings).getAllByRole('radiogroup', { name: 'Finish' })[0];
    const opts = () => within(finish).getAllByRole('radio');
    const chosen = () => opts().findIndex((r) => r.getAttribute('aria-checked') === 'true');
    const f0 = chosen();
    expect(opts().filter((r) => r.tabIndex === 0)).toEqual([opts()[f0]]);
    opts()[f0].focus();
    await user.keyboard('{ArrowDown}');
    expect(chosen()).toBe((f0 + 1) % opts().length);
    expect(document.activeElement).toBe(opts()[chosen()]);
    await user.keyboard('{ArrowUp}');
    expect(chosen()).toBe(f0);
    await user.keyboard('{End}');
    expect(chosen()).toBe(opts().length - 1);
  });
});
