// @vitest-environment jsdom
// Find-it for ADR-193 (N198), in jsdom (ADR-108): More → New… ("Start something new") → its rows; Fill a wall with a
// wrong width (named under the field, Enter keeps the user on Wall, the header never echoes it) and Wall → Refine →
// Back (cards for the typed width); Fill the room with a wrong room size (named on Next, no "NaN mm"), Room →
// Refine → Back (cards), U → Rectangle → Show suggestions (cards), Rectangle → L (6 ticked walls), the cabinet
// depths on the Walls step for a typed room and for a project's room, Use this mix; a failed save of "Project with
// several pieces" is said in the dialog and opens nothing.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderApp, WIDTHS } from './setup';

// The device storage refuses a save while `failSave` is set (a full or blocked browser storage).
const store = vi.hoisted(() => ({ failSave: false }));
vi.mock('../../src/persist/db', async (orig) => {
  const real = await orig<typeof import('../../src/persist/db')>();
  return {
    ...real,
    saveProject: (...a: Parameters<typeof real.saveProject>) =>
      store.failSave ? Promise.reject(new Error('QuotaExceededError')) : real.saveProject(...a),
  };
});

type User = Awaited<ReturnType<typeof renderApp>>['user'];

async function startNew(user: User) {
  await user.click(screen.getByLabelText('More'));
  await user.click(await screen.findByRole('button', { name: /New…/ }));
  return screen.findByRole('dialog', { name: 'Start something new' });
}

/** The dialog's field with this label, typed over. */
async function retype(user: User, dlg: HTMLElement, label: string, value: string) {
  const input = within(dlg).getByLabelText(label);
  await user.clear(input);
  if (value) await user.type(input, value);
  return input as HTMLInputElement;
}

const step = (dlg: HTMLElement, list: string, name: string) =>
  within(within(dlg).getByRole('list', { name: list })).getByRole('button', { name });

describe.each(WIDTHS)('start something new at %ipx (find-it, ADR-193)', (width) => {
  it('New… rows; Fill a wall: a wrong width is named under the field; Refine → Back shows cards', async () => {
    const { user } = await renderApp(width);
    const start = await startNew(user);
    for (const name of [/^Project with several pieces/, /^Fill a wall/, /^Fill the room/])
      expect(within(start).getByRole('button', { name })).toBeTruthy();
    await user.click(within(start).getByRole('button', { name: /^Fill a wall/ }));
    const dlg = await screen.findByRole('dialog', { name: 'Fill a wall' });

    // Width "abc" + Enter: stays on Wall, the alert under the field, the field marked.
    const w = await retype(user, dlg, 'Width', 'abc{Enter}');
    expect(within(dlg).getByRole('heading', { name: 'Wall' })).toBeTruthy();
    const alert = within(dlg).getByRole('alert');
    expect(alert.textContent).toMatch(/Width must be a whole number of mm above 0\./);
    expect(w.getAttribute('aria-invalid')).toBe('true');
    expect(w.getAttribute('aria-describedby')).toBe(alert.id);
    expect(within(dlg).queryByText(/abc mm wall/i)).toBeNull();
    expect(within(dlg).queryByRole('button', { name: 'Use this mix' })).toBeNull();

    // A good width, then Wall → Refine → Back: cards for the typed width, never a blank step.
    await retype(user, dlg, 'Width', '2400');
    await user.click(step(dlg, 'Fill a wall steps', 'Refine'));
    expect(within(dlg).getByRole('heading', { name: 'Refine' })).toBeTruthy();
    await user.click(within(dlg).getByRole('button', { name: 'Back' }));
    expect(
      await within(dlg).findByText('2400 mm wall · best 4, each checked for problems'),
    ).toBeTruthy();
    expect(within(dlg).getAllByRole('button', { name: 'Use this mix' }).length).toBeGreaterThan(0);
    expect(within(dlg).queryByRole('alert')).toBeNull();
  });

  it('Fill the room: wrong sizes named on Next, Refine → Back, shape changes, cabinet depths, Use this mix', async () => {
    const { user } = await renderApp(width);
    await user.click(within(await startNew(user)).getByRole('button', { name: /^Fill the room/ }));
    const dlg = await screen.findByRole('dialog', { name: 'Fill the room' });
    expect(within(dlg).queryByText(/ADR-059/)).toBeNull();

    // A wrong room width keeps the user on Room with an alert naming the field; never "NaN mm".
    for (const bad of ['abc', '0', '-100']) {
      const input = await retype(user, dlg, 'Width', bad);
      await user.click(within(dlg).getByRole('button', { name: 'Next' }));
      expect(within(dlg).getByRole('heading', { name: 'Room' })).toBeTruthy();
      expect(within(dlg).getByRole('alert').textContent).toMatch(
        /^Width must be a whole number of mm above 0\.$/,
      );
      expect(input.getAttribute('aria-invalid')).toBe('true');
      // Jumping to another step is checked the same way.
      await user.click(step(dlg, 'Fill the room steps', 'Walls'));
      expect(within(dlg).getByRole('heading', { name: 'Room' })).toBeTruthy();
      expect(dlg.textContent).not.toMatch(/NaN/);
    }
    await retype(user, dlg, 'Width', '3600');

    // Room → Refine → Back: cards for the typed room.
    await user.click(step(dlg, 'Fill the room steps', 'Refine'));
    expect(within(dlg).getByRole('heading', { name: 'Refine' })).toBeTruthy();
    expect(within(dlg).queryByLabelText('Tall cabinet depth')).toBeNull();
    await user.click(within(dlg).getByRole('button', { name: 'Back' }));
    expect(
      (await within(dlg).findAllByRole('button', { name: 'Use this mix' })).length,
    ).toBeGreaterThan(0);
    expect(within(dlg).getByText('4 walls · best 4, each checked for problems')).toBeTruthy();
    expect(within(dlg).getAllByText(/^Wall 1: .*; Wall 2: /).length).toBeGreaterThan(0);

    // U (8 walls), one wall unticked → Rectangle → Show suggestions gives cards.
    await user.click(step(dlg, 'Fill the room steps', 'Room'));
    await user.click(within(dlg).getByRole('radio', { name: 'U' }));
    await retype(user, dlg, 'Cut offset', '600');
    await user.click(within(dlg).getByRole('button', { name: 'Next' }));
    let walls = within(dlg).getByRole('group', { name: 'Walls to fill' });
    expect(within(walls).getAllByRole('checkbox')).toHaveLength(8);
    await user.click(within(walls).getByRole('checkbox', { name: /^Wall 8,/ }));
    // The cabinet depths come before the cards, on the Walls step.
    expect(within(dlg).getByRole('heading', { name: 'Cabinets' })).toBeTruthy();
    expect(within(dlg).getByLabelText('Depth')).toBeTruthy();
    expect(within(dlg).getByLabelText('Tall cabinet depth')).toBeTruthy();
    await user.click(within(dlg).getByRole('button', { name: 'Back' }));
    await user.click(within(dlg).getByRole('radio', { name: 'Rectangle' }));
    await user.click(within(dlg).getByRole('button', { name: 'Next' }));
    walls = within(dlg).getByRole('group', { name: 'Walls to fill' });
    expect(within(walls).getAllByRole('checkbox')).toHaveLength(4);
    await user.click(within(dlg).getByRole('button', { name: 'Show suggestions' }));
    expect(
      (await within(dlg).findAllByRole('button', { name: 'Use this mix' })).length,
    ).toBeGreaterThan(0);
    expect(within(dlg).queryByText(/A ticked wall is not a wall of this room/)).toBeNull();

    // Rectangle (one wall unticked) → L: the six walls of the L are all ticked.
    await user.click(step(dlg, 'Fill the room steps', 'Walls'));
    walls = within(dlg).getByRole('group', { name: 'Walls to fill' });
    await user.click(within(walls).getByRole('checkbox', { name: /^Wall 2,/ }));
    await user.click(within(dlg).getByRole('button', { name: 'Back' }));
    await user.click(within(dlg).getByRole('radio', { name: 'L' }));
    await user.click(within(dlg).getByRole('button', { name: 'Next' }));
    walls = within(dlg).getByRole('group', { name: 'Walls to fill' });
    const boxes = within(walls).getAllByRole('checkbox') as HTMLInputElement[];
    expect(boxes).toHaveLength(6);
    expect(boxes.every((b) => b.checked)).toBe(true);

    // Back to the rectangle, then Use this mix opens the project; its own room's Walls step asks the cabinet
    // depths too. (The default L room gives no mix at all, before and after ADR-193: G id in N198.)
    await user.click(within(dlg).getByRole('button', { name: 'Back' }));
    await user.click(within(dlg).getByRole('radio', { name: 'Rectangle' }));
    await user.click(within(dlg).getByRole('button', { name: 'Next' }));
    await user.click(within(dlg).getByRole('button', { name: 'Show suggestions' }));
    const use = await within(dlg).findAllByRole('button', { name: 'Use this mix' });
    await user.click(use[0]);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Fill the room' })).toBeNull());
    await user.click(screen.getByLabelText('More'));
    await user.click(await screen.findByRole('button', { name: /^Fill the room…/ }));
    const again = await screen.findByRole('dialog', { name: 'Fill the room' });
    expect(within(again).getByText(/This project’s room/)).toBeTruthy();
    expect(within(again).getByRole('heading', { name: 'Cabinets' })).toBeTruthy();
    expect(within(again).getByLabelText('Depth')).toBeTruthy();
    expect(within(again).getByLabelText('Tall cabinet depth')).toBeTruthy();
  });

  it('a failed save of "Project with several pieces" is said in the dialog and opens nothing', async () => {
    const { user } = await renderApp(width);
    const start = await startNew(user);
    store.failSave = true;
    try {
      await user.click(within(start).getByRole('button', { name: /^Project with several pieces/ }));
      expect((await within(start).findByRole('alert')).textContent).toMatch(
        /The project could not be saved in this browser’s storage\./,
      );
      expect(screen.getByRole('dialog', { name: 'Start something new' })).toBe(start);
      expect(screen.queryByRole('list', { name: 'Pieces' })).toBeNull();
    } finally {
      store.failSave = false;
    }
    // Opened again, the dialog starts without the old alert.
    await user.click(within(start).getByRole('button', { name: 'Close' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Start something new' })).toBeNull(),
    );
    const again = await startNew(user);
    expect(within(again).queryByRole('alert')).toBeNull();
    // A double tap makes one project: the second tap waits for the first save.
    const before = (await import('../../src/persist/db')).listProjects;
    const count = async () => (await before()).length;
    const n = await count();
    const row = within(again).getByRole('button', { name: /^Project with several pieces/ });
    await user.dblClick(row);
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Start something new' })).toBeNull(),
    );
    expect(await count()).toBe(n + 1);
  });
});
