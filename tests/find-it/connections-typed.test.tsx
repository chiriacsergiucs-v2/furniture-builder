// @vitest-environment jsdom
// Find-it for typed connections, shared sides with a blind corner, editable assembly steps, Link identical pieces
// and the lounger's backrest end (ADR-207, N212), in jsdom (ADR-108). The drags, the 3D lighting and the layout are
// the browser script (tools/connections-typed/find-it.mjs).
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  addPiece,
  PHONE_WIDTH,
  printedSheet,
  renderApp,
  selectRows,
  stepItems,
  WIDTHS,
} from './setup';

type User = Awaited<ReturnType<typeof renderApp>>['user'];

const side = () => screen.getByRole('complementary', { name: 'Compose' });

async function newProject(user: User) {
  await user.click(screen.getByLabelText('More'));
  await user.click(await screen.findByRole('button', { name: /New…/ }));
  const start = await screen.findByRole('dialog', { name: 'Start something new' });
  await user.click(within(start).getByRole('button', { name: /Project with several pieces/ }));
  await user.click(await screen.findByRole('radio', { name: 'Compose' }));
}
/** Select one piece (the Select switch off). */
async function selectOne(user: User, i: number) {
  const all = within(side()).queryByRole('button', { name: /^All pieces \(\d+\)$/ });
  if (all) await user.click(all);
  const sw = within(side()).getByRole('checkbox', { name: 'Select' }) as HTMLInputElement;
  if (sw.checked) await user.click(sw);
  const back = within(side()).queryByRole('button', { name: /^All pieces \(\d+\)$/ });
  if (back) await user.click(back);
  const rows = within(within(side()).getByRole('list', { name: 'Pieces' })).getAllByRole('button');
  await user.click(rows[i]);
  return screen.findByRole('region', { name: /^Selected piece: / });
}
async function setField(user: User, field: HTMLElement, v: number) {
  await user.clear(field);
  await user.type(field, String(v));
  await user.tab();
}

describe.each(WIDTHS)('typed connections at %ipx (find-it, ADR-207)', (width) => {
  it('Add the room → Against the wall on the card; a wall unit over a base → Connected → stacked on the card', async () => {
    const { user } = await renderApp(width);
    await newProject(user);
    await user.click(within(side()).getByRole('button', { name: 'Add the room' }));
    await addPiece(user, /Base cabinet, doors: 1 door/);
    await addPiece(user, /Wall cabinet/);

    // The base unit stands against the back wall: Against the wall is enabled; on, the card names the wall.
    let card = await selectOne(user, 0);
    const wall = within(card).getByRole('checkbox', {
      name: 'Against the wall',
    }) as HTMLInputElement;
    expect(wall.disabled).toBe(false);
    if (!wall.checked) await user.click(wall);
    await waitFor(() => expect(wall.checked).toBe(true));
    expect(within(card).getByText(/^Connected to against wall \d+$/)).toBeTruthy();

    // The wall unit moved over the base (From left 0): select both → Connected → stacked.
    card = await selectOne(user, 1);
    await setField(user, within(card).getByLabelText('From left'), 0);
    await selectRows(user, [0, 1]);
    const pair = within(side()).getByRole('region', { name: /^2 pieces selected/ });
    const connected = within(pair).getByRole('checkbox', { name: 'Connected' }) as HTMLInputElement;
    expect(connected.disabled).toBe(false);
    await user.click(connected);
    await waitFor(() => expect(connected.checked).toBe(true));
    card = await selectOne(user, 1);
    expect(within(card).getByText(/^Connected to Base cabinet.* \(stacked\)$/)).toBeTruthy();

    // Off the wall: the toggle turns off and the card no longer names a wall.
    card = await selectOne(user, 0);
    const again = within(card).getByRole('checkbox', {
      name: 'Against the wall',
    }) as HTMLInputElement;
    await user.click(again);
    await waitFor(() => expect(again.checked).toBe(false));
    expect(within(card).queryByText(/against wall \d+/)).toBeNull();
    expect(within(card).getByText(/\(stacked\)$/)).toBeTruthy();
  });

  it('a blind corner and a base cabinet → Shared sides on; two identical base units → Link 2 identical pieces', async () => {
    const { user } = await renderApp(width);
    await newProject(user);
    await addPiece(user, /Blind corner/);
    await addPiece(user, /Base cabinet, doors: 1 door/);
    await selectRows(user, [0, 1]);
    const card = within(side()).getByRole('region', { name: /^2 pieces selected/ });
    const shared = within(
      within(card).getByRole('group', { name: 'Common top, bottom and sides' }),
    ).getByRole('checkbox', { name: 'Shared sides' }) as HTMLInputElement;
    expect(shared.disabled).toBe(false);
    await user.click(shared);
    await waitFor(() => expect(shared.checked).toBe(true));

    // A second base cabinet, identical to the first: the card offers to link them.
    await addPiece(user, /Base cabinet, doors: 1 door/);
    const one = await selectOne(user, 1);
    const link = within(one).getByRole('button', { name: 'Link 2 identical pieces' });
    await user.click(link);
    await waitFor(() => expect(within(side()).getByText(/^Linked: 2 copies$/)).toBeTruthy());
    expect(
      within(side()).queryByRole('button', { name: /^Link \d+ identical pieces$/ }),
    ).toBeNull();
  });

  it('Assembly → Show step on Fit hardware lights its panels; Move step up, Rename step, the print, Reset the steps', async () => {
    const { user } = await renderApp(width);
    await newProject(user);
    await addPiece(user, /Base cabinet, doors: 1 door/);
    if (width === PHONE_WIDTH) {
      const build = screen.queryByRole('radio', { name: /Build & Preview/ });
      if (build) await user.click(build);
    }
    await user.click(screen.getByRole('tab', { name: /^Assembly/ }));
    const panel = screen.getByRole('tabpanel');
    const piece = (await within(panel).findAllByRole('region', { name: /^Assembly: / }))[0];
    const steps = () => stepItems(piece);
    const titles = () => steps().map((li) => within(li).getAllByRole('strong')[0].textContent);
    const fit = steps().find((li) => within(li).queryByText('Fit hardware to the sides'))!;
    // Show step lights the hinge's side (the store's lit panels; the 3D view itself is the browser script).
    await user.click(within(fit).getByRole('button', { name: 'Show step' }));
    expect(
      within(fit).getByRole('button', { name: 'Show step' }).getAttribute('aria-pressed'),
    ).toBe('true');
    const { useDesign } = await import('../../src/store/designStore');
    const lit = useDesign.getState().litPanelIds ?? [];
    const leftSide = useDesign
      .getState()
      .projectModel!.model.panels.find((p) => p.label === 'Left side')!;
    expect(lit).toContain(leftSide.id);
    expect(screen.getByRole('button', { name: 'Show every part again' })).toBeTruthy();

    // Move the third step up: it is second now, and Reset the steps appears.
    const before = titles();
    expect(within(piece).queryByRole('button', { name: 'Reset the steps' })).toBeNull();
    await user.click(within(steps()[2]).getByRole('button', { name: 'Move step up' }));
    await waitFor(() => expect(titles()[1]).toBe(before[2]));
    expect(titles()[2]).toBe(before[1]);
    // The step shown stays the one shown (Fit hardware), wherever it moved.
    const shownNow = steps().find((li) => within(li).queryByText('Fit hardware to the sides'))!;
    expect(
      within(shownNow).getByRole('button', { name: 'Show step' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      steps().filter(
        (li) =>
          within(li).queryByRole('button', { name: 'Show step' })?.getAttribute('aria-pressed') ===
          'true',
      ),
    ).toHaveLength(1);
    // Rename it.
    await user.click(within(steps()[1]).getByRole('button', { name: 'Rename step' }));
    const ask = await screen.findByRole('dialog');
    const input = within(ask).getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'My own step');
    await user.click(within(ask).getByRole('button', { name: /^(OK|Save|Rename)/ }));
    await waitFor(() => expect(titles()[1]).toBe('My own step'));

    // The print uses the same order and the user's name as typed.
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { load: () => Promise.resolve([]), ready: Promise.resolve() },
    });
    window.print = vi.fn();
    await user.click(within(panel).getByRole('button', { name: 'Print assembly steps' }));
    const root = await printedSheet();
    const printed = within(root)
      .getAllByRole('table', { hidden: true })
      .flatMap((table) => within(table).queryAllByRole('strong', { hidden: true }))
      .map((s) => s.textContent);
    expect(printed[1]).toBe('2. My own step');
    window.dispatchEvent(new Event('afterprint'));

    // Reset the steps (confirmed): the generated order and titles are back.
    await user.click(within(piece).getByRole('button', { name: 'Reset the steps' }));
    const confirm = await screen.findByRole('dialog');
    await user.click(within(confirm).getByRole('button', { name: 'Reset the steps' }));
    await waitFor(() => expect(titles()).toEqual(before));
    expect(within(piece).queryByRole('button', { name: 'Reset the steps' })).toBeNull();
  });

  it('New single piece → Lounger → Settings → Backrest end → Right', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    const dialog = await screen.findByRole('dialog');
    const search = within(dialog).queryByRole('searchbox');
    if (search) await user.type(search, 'lounger');
    await user.click(
      within(dialog).getAllByRole('button', {
        name: /Lounger with backrest|Adjustable backrest/,
      })[0],
    );
    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    const end = await screen.findByRole('radiogroup', { name: 'Backrest end' });
    expect(within(end).getByRole('radio', { name: 'Left' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    await user.click(within(end).getByRole('radio', { name: 'Right' }));
    await waitFor(() =>
      expect(within(end).getByRole('radio', { name: 'Right' }).getAttribute('aria-checked')).toBe(
        'true',
      ),
    );
  });
});
