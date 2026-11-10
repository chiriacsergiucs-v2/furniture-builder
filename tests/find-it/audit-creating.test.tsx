// @vitest-environment jsdom
// Find-it for ADR-248 (UI audit, Creating), in jsdom (ADR-108) at 1280 and 390 px: one tap makes one saved thing, a
// failed save is said where the user tapped, Add this mix is checked against the open project, invalid answers mark
// their field, Fill the room… sits outside Files, and the wizard's draft offer says what it is.
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
const db = () => import('../../src/persist/db');
const projectCount = async () => (await (await db()).listProjects()).length;
const designCount = async () => (await (await db()).listDesigns()).length;
const SAVE_FAILED = /The project could not be saved in this browser’s storage\./;

describe.each(WIDTHS)('creating at %ipx (find-it, ADR-248)', (width) => {
  it('a double tap on a room preset makes one project; a failed save says so and opens nothing', async () => {
    const { user } = await renderApp(width);
    const start = await startNew(user);
    await user.click(within(start).getByRole('button', { name: /^Room preset/ }));
    const list = within(start).getByRole('list', { name: 'Room presets' });
    store.failSave = true;
    try {
      await user.click(within(list).getByRole('button', { name: /^Home office/ }));
      expect((await within(start).findByRole('alert')).textContent).toMatch(SAVE_FAILED);
      expect(screen.getByRole('dialog', { name: 'Start something new' })).toBe(start);
    } finally {
      store.failSave = false;
    }
    // Closed and opened again: the old alert is gone.
    await user.click(within(start).getByRole('button', { name: 'Close' }));
    const again = await startNew(user);
    expect(within(again).queryByRole('alert')).toBeNull();
    await user.click(within(again).getByRole('button', { name: /^Room preset/ }));
    const n = await projectCount();
    await user.dblClick(
      within(within(again).getByRole('list', { name: 'Room presets' })).getByRole('button', {
        name: /^Home office/,
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Start something new' })).toBeNull(),
    );
    await waitFor(async () => expect(await projectCount()).toBe(n + 1));
  });

  it('Projects page Create project with a failing save opens nothing and says why', async () => {
    const { user } = await renderApp(width);
    store.failSave = true;
    try {
      await user.click(await screen.findByRole('button', { name: 'Create a new project' }));
      const create = await screen.findByRole('dialog');
      await user.click(within(create).getByRole('button', { name: 'Create project' }));
      expect((await screen.findByText(SAVE_FAILED)).textContent).toMatch(SAVE_FAILED);
      expect(screen.queryByRole('complementary', { name: 'Compose' })).toBeNull();
    } finally {
      store.failSave = false;
    }
  });

  it('a double tap on Create piece saves one piece', async () => {
    const { user } = await renderApp(width);
    const n = await designCount();
    await user.click(await screen.findByRole('link', { name: /Catalog/ }));
    await user.click(await screen.findByRole('button', { name: 'New piece' }));
    const wiz = await screen.findByRole('dialog', { name: 'New piece' });
    await user.click(
      within(within(wiz).getByRole('radiogroup', { name: 'Construction type' })).getByRole(
        'radio',
        { name: /Cabinet \(closed box\)/ },
      ),
    );
    for (let i = 0; i < 20 && !within(wiz).queryByRole('button', { name: 'Create piece' }); i++)
      await user.click(within(wiz).getByRole('button', { name: 'Next' }));
    await user.dblClick(within(wiz).getByRole('button', { name: 'Create piece' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New piece' })).toBeNull());
    expect(await designCount()).toBe(n + 1);
  });

  it('Fill a wall marks a wrong tall height and wall depth at their fields', async () => {
    const { user } = await renderApp(width);
    await user.click(within(await startNew(user)).getByRole('button', { name: /^Fill a wall/ }));
    const dlg = await screen.findByRole('dialog', { name: 'Fill a wall' });
    await user.click(within(dlg).getByRole('button', { name: 'Show suggestions' }));
    await user.click(within(dlg).getAllByRole('button', { name: 'Refine' }).at(-1)!);
    for (const label of ['Tall cabinet height', 'Wall cabinet depth']) {
      const f = within(dlg).getByLabelText(label);
      await user.clear(f);
      await user.type(f, '-5');
    }
    await user.click(within(dlg).getByRole('button', { name: 'Suggest again' }));
    for (const label of ['Tall cabinet height', 'Wall cabinet depth'])
      expect(within(dlg).getByLabelText(label).getAttribute('aria-invalid')).toBe('true');
  });

  it('Fill the room… is outside the Files group; Add this mix offers nothing over a filled room', async () => {
    const { user } = await renderApp(width);
    await user.click(within(await startNew(user)).getByRole('button', { name: /^Fill the room/ }));
    const dlg = await screen.findByRole('dialog', { name: 'Fill the room' });
    await user.click(within(dlg).getByRole('button', { name: 'Next' }));
    await user.click(within(dlg).getByRole('button', { name: 'Show suggestions' }));
    await user.click((await within(dlg).findAllByRole('button', { name: 'Use this mix' }))[0]);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Fill the room' })).toBeNull());
    await user.click(screen.getByLabelText('More'));
    const files = await screen.findByRole('group', { name: 'Files' });
    expect(within(files).queryByRole('button', { name: /^Fill the room…/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: /^Fill the room…/ }));
    const again = await screen.findByRole('dialog', { name: 'Fill the room' });
    await user.click(within(again).getByRole('button', { name: 'Show suggestions' }));
    expect(
      await within(again).findByText(/No mix fits beside the pieces already in this project/),
    ).toBeTruthy();
    expect(within(again).queryAllByRole('button', { name: 'Add this mix' })).toHaveLength(0);
  });

  it('the wizard draft offer says a draft is there', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('link', { name: /Catalog/ }));
    await user.click(await screen.findByRole('button', { name: 'New piece' }));
    const wiz = await screen.findByRole('dialog', { name: 'New piece' });
    await user.click(within(wiz).getByRole('radio', { name: /Cabinet \(closed box\)/ }));
    await user.click(within(wiz).getByRole('button', { name: 'Close' }));
    await user.click(await screen.findByRole('button', { name: 'Close' }));
    await user.click(await screen.findByRole('button', { name: 'New piece' }));
    const back = await screen.findByRole('dialog', { name: 'New piece' });
    expect(
      within(back).getByText('You have a draft of a new piece from earlier in this session.'),
    ).toBeTruthy();
  });
});
