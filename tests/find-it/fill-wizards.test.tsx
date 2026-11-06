// @vitest-environment jsdom
// Find-it for ADR-204 (N209), in jsdom (ADR-108): More → New… → Fill a wall → Refine shows "Tall cabinet height" (2200)
// and "Wall cabinet depth" (320), a wrong value is named under its field and good ones give cards; Fill the room →
// Room has the doors-and-windows list (RoomFeatures) and the new hint, "Add door" adds Door 1, Refine shows both fields,
// and Use this mix opens a project whose room has the door, kept free of pieces.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

type User = Awaited<ReturnType<typeof renderApp>>['user'];

async function startNew(user: User, row: RegExp, title: string) {
  await user.click(screen.getByLabelText('More'));
  await user.click(await screen.findByRole('button', { name: /New…/ }));
  const start = await screen.findByRole('dialog', { name: 'Start something new' });
  await user.click(within(start).getByRole('button', { name: row }));
  return screen.findByRole('dialog', { name: title });
}

async function retype(user: User, dlg: HTMLElement, label: string, value: string) {
  const input = within(dlg).getByLabelText(label);
  await user.clear(input);
  if (value) await user.type(input, value);
  return input as HTMLInputElement;
}

const step = (dlg: HTMLElement, list: string, name: string) =>
  within(within(dlg).getByRole('list', { name: list })).getByRole('button', { name });

describe.each(WIDTHS)('Fill a wall and Fill the room at %ipx (find-it, ADR-204)', (width) => {
  it('Fill a wall → Refine: Tall cabinet height and Wall cabinet depth; a wrong one is named; good ones give cards', async () => {
    const { user } = await renderApp(width);
    const dlg = await startNew(user, /^Fill a wall/, 'Fill a wall');
    await user.click(step(dlg, 'Fill a wall steps', 'Refine'));
    expect(within(dlg).getByRole('heading', { name: 'Refine' })).toBeTruthy();
    const tall = within(dlg).getByLabelText('Tall cabinet height') as HTMLInputElement;
    const depth = within(dlg).getByLabelText('Wall cabinet depth') as HTMLInputElement;
    expect(tall.value).toBe('2200');
    expect(depth.value).toBe('320');

    // A wrong depth is named, no cards.
    await retype(user, dlg, 'Wall cabinet depth', 'abc');
    await user.click(within(dlg).getByRole('button', { name: 'Suggest again' }));
    expect(
      await within(dlg).findByText(/Wall cabinet depth must be a whole number of mm above 0\./),
    ).toBeTruthy();
    expect(within(dlg).queryByRole('button', { name: 'Use this mix' })).toBeNull();

    // Good values: cards again.
    await user.click(step(dlg, 'Fill a wall steps', 'Refine'));
    await retype(user, dlg, 'Wall cabinet depth', '350');
    await retype(user, dlg, 'Tall cabinet height', '2000');
    await user.click(within(dlg).getByRole('button', { name: 'Suggest again' }));
    expect(
      (await within(dlg).findAllByRole('button', { name: 'Use this mix' })).length,
    ).toBeGreaterThan(0);
    expect(dlg.textContent).not.toMatch(/must be a whole number/);
  });

  it('Fill the room → Room: the doors-and-windows list; Add door; Refine fields; the mix keeps the door free', async () => {
    const { user } = await renderApp(width);
    const dlg = await startNew(user, /^Fill the room/, 'Fill the room');
    expect(within(dlg).getByRole('heading', { name: 'Room' })).toBeTruthy();
    expect(
      within(dlg).getByText(
        'A ready shape and its sizes, in mm, with its doors, windows and other features.',
      ),
    ).toBeTruthy();
    expect(dlg.textContent).not.toMatch(/Doors and windows come from a project’s own room/);
    expect(
      within(dlg).getByRole('heading', { name: 'Doors, windows, obstacles, pipes and outlets' }),
    ).toBeTruthy();
    expect(within(dlg).getByText('None yet.')).toBeTruthy();
    for (const name of ['Add window', 'Add obstacle', 'Add pipe', 'Add outlet'])
      expect(within(dlg).getByRole('button', { name })).toBeTruthy();
    await user.click(within(dlg).getByRole('button', { name: 'Add door' }));
    const door = within(dlg).getByRole('group', { name: 'Door 1' });
    expect((within(door).getByLabelText('On') as HTMLSelectElement).value).toBe('3');
    expect(within(door).getByRole('button', { name: 'Remove door' })).toBeTruthy();
    expect(within(dlg).queryByText('None yet.')).toBeNull();
    // Moved 1000 mm along its wall: a door 100 mm from a corner opens into the next wall's run, which the room fill
    // does not keep free (ADR-173 frees a door's range on its own wall only; reported, not decided here).
    const from = within(door).getByLabelText("From the wall's start") as HTMLInputElement;
    expect(from.value).toBe('100');
    await user.clear(from);
    await user.type(from, '1000');
    await user.tab();

    // Refine has both new fields too (RoomInput extends WallInput).
    await user.click(step(dlg, 'Fill the room steps', 'Refine'));
    expect((within(dlg).getByLabelText('Tall cabinet height') as HTMLInputElement).value).toBe(
      '2200',
    );
    expect((within(dlg).getByLabelText('Wall cabinet depth') as HTMLInputElement).value).toBe(
      '320',
    );

    // The door stays on Room; Walls → Show suggestions → Use this mix.
    await user.click(step(dlg, 'Fill the room steps', 'Room'));
    expect(within(dlg).getByRole('group', { name: 'Door 1' })).toBeTruthy();
    await user.click(within(dlg).getByRole('button', { name: 'Next' }));
    await user.click(within(dlg).getByRole('button', { name: 'Show suggestions' }));
    const use = await within(dlg).findAllByRole('button', { name: 'Use this mix' });
    await user.click(use[0]);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Fill the room' })).toBeNull());

    // The opened project's room has the door, and no floor piece stands in its opening.
    const { useDesign } = await import('../../src/store/designStore');
    const { buildProjectModel } = await import('../../src/core/project');
    const { wallBox } = await import('../../src/core/room');
    const p = useDesign.getState().project!;
    const f = p.room!.features;
    expect(f.map((x) => [x.kind, x.label, x.wall, x.from])).toEqual([['door', 'Door 1', 3, 1000]]);
    const opening = wallBox(p.room!, f[0].wall!, f[0].from, f[0].width, 600, 0, f[0].height);
    const pieces = buildProjectModel(p).pieces;
    expect(pieces.length).toBeGreaterThan(0);
    for (const pc of pieces.filter((x) => x.item.placement?.kind !== 'wall')) {
      const b = pc.bounds;
      const apart =
        b.x + b.w <= opening.x ||
        opening.x + opening.w <= b.x ||
        b.z + b.d <= opening.z ||
        opening.z + opening.d <= b.z;
      expect(apart, pc.item.design.name).toBe(true);
    }
  });
});
