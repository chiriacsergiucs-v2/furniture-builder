// @vitest-environment jsdom
// Find-it for ADR-211 (N216), in jsdom (ADR-108): from the bare app, by role and visible text, at phone and desktop
// widths. The sheet's "Resize the sheet" slider steps with arrow keys and a tap (phones only); "Up one level" selects
// the parent space on a phone; Start something new rows each have their own glyph; Gaps and Research show Back to the
// editor only with a design open; the three Select toggles have "About Select"; Lock boards and Lock construction
// sit in More actions and turn off Boards with its hint; History lists "Versions of deleted projects" with Restore as a
// new project and Delete. Drags (the sheet, the front-view box) need layout: `tools/editor-nav/find-it.mjs`.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PHONE_WIDTH, renderApp, WIDTHS } from './setup';

type User = Awaited<ReturnType<typeof renderApp>>['user'];

async function newProject(user: User, name: string) {
  await user.click(await screen.findByRole('button', { name: 'Create a new project' }));
  const create = await screen.findByRole('dialog');
  await user.type(within(create).getByRole('textbox'), name);
  await user.click(within(create).getByRole('button', { name: 'Create project' }));
  const panel = await screen.findByRole('complementary', { name: 'Compose' });
  const peek = panel.querySelector<HTMLButtonElement>('.sheet-peek');
  if (peek?.getAttribute('aria-expanded') === 'false') await user.click(peek);
  return panel;
}
async function addBase(user: User, panel: HTMLElement) {
  const all = within(panel).queryByRole('button', { name: /^All pieces \(\d+\)$/ });
  if (all) await user.click(all);
  await user.click(within(panel).getByRole('button', { name: 'Add a piece' }));
  const dlg = await screen.findByRole('dialog', { name: 'Add a piece' });
  await user.click(within(dlg).getAllByRole('button', { name: /Base cabinet, doors: 1 door/ })[0]);
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add a piece' })).toBeNull());
  const place = screen.queryByRole('button', { name: 'Place to the right' });
  if (place) await user.click(place);
}
async function more(user: User) {
  await user.click(screen.getByLabelText(/^More$/));
}

describe.each(WIDTHS)('editor and navigation follow-ups at %ipx (find-it, ADR-211)', (width) => {
  const phone = width === PHONE_WIDTH;

  it('Start something new: Project, Fill a wall and Fill the room each have their own glyph', async () => {
    const { user } = await renderApp(width);
    await more(user);
    await user.click(await screen.findByRole('button', { name: /New…/ }));
    const dlg = await screen.findByRole('dialog', { name: 'Start something new' });
    const glyph = (name: RegExp) =>
      within(dlg).getByRole('button', { name }).querySelector('.glyph path')?.getAttribute('d');
    const shapes = [/^Project with several pieces/, /^Fill a wall/, /^Fill the room/].map(glyph);
    expect(shapes.every(Boolean)).toBe(true);
    expect(new Set(shapes).size).toBe(3);
  });

  it('Gaps and Research: no Back to the editor with nothing open; Back once a design is open', async () => {
    const { user } = await renderApp(width);
    const visit = async (button: RegExp, page: string) => {
      await more(user);
      await user.click(screen.getByRole('button', { name: button }));
      return screen.findByRole('main', { name: page });
    };
    let gaps = await visit(/^Gaps/, 'Gaps');
    expect(within(gaps).queryByRole('button', { name: 'Back to the editor' })).toBeNull();
    let research = await visit(/^Feature Research/, 'Feature Research & Catalog');
    expect(within(research).queryByRole('button', { name: 'Back to the editor' })).toBeNull();
    // ADR ids stay on the Research page.
    expect(within(research).getAllByText(/ADR-\d{3}/).length).toBeGreaterThan(0);

    // Open a design: both pages now lead back to it.
    await user.click(screen.getByRole('link', { name: 'Furniture Builder, go to Projects' }));
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getAllByRole('button', { name: /Sideboard/ })[0]);
    gaps = await visit(/^Gaps/, 'Gaps');
    await user.click(within(gaps).getByRole('button', { name: 'Back to the editor' }));
    research = await visit(/^Feature Research/, 'Feature Research & Catalog');
    expect(within(research).getByRole('button', { name: 'Back to the editor' })).toBeTruthy();
  });

  it('a space path on a phone has Up one level, which selects the parent space', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getAllByRole('button', { name: /Wardrobe/ })[0]);
    await user.click(await screen.findByRole('radio', { name: 'Compose' }));
    // The whole piece has no path and no Up one level.
    expect(screen.queryByRole('button', { name: 'Up one level' })).toBeNull();
    // Enter on a space runs the same tap as the drawing; each further tap at the same spot selects one space smaller
    // (bigger to smaller, G-388): tap the hanging space until it is selected, noting the selected step each time.
    const current = () =>
      screen
        .queryByRole('navigation', { name: 'Where this space sits' })
        ?.querySelector('[aria-current]')?.textContent ?? null;
    const seen: (string | null)[] = [];
    for (let i = 0; i < 5 && seen.at(-1) !== 'Hanging'; i++) {
      screen.getByRole('button', { name: /^Hanging.* space/ }).focus();
      await user.keyboard('{Enter}');
      seen.push(current());
    }
    expect(seen.at(-1)).toBe('Hanging');
    // A nested space: the step before it is a space too.
    expect(seen.at(-2)).toBeTruthy();
    const up = within(
      screen.getByRole('navigation', { name: 'Where this space sits' }),
    ).queryByRole('button', { name: 'Up one level' });
    if (!phone) {
      expect(up).toBeNull();
      return;
    }
    // Up one level goes back one tap: the space around it (ADR-203's parentOf).
    await user.click(up!);
    expect(current()).toBe(seen.at(-2));
  });

  it('Resize the sheet: a slider on phones only; arrow keys step Collapsed, Half, Full screen; a tap toggles', async () => {
    const { user } = await renderApp(width);
    const panel = await newProject(user, `Sheet ${width}`);
    const slider = within(panel).queryByRole('slider', { name: 'Resize the sheet' });
    if (!phone) {
      expect(slider).toBeNull();
      return;
    }
    const value = () => slider!.getAttribute('aria-valuetext');
    // The peek row was opened above: the sheet is at half.
    expect(value()).toBe('Half');
    expect(document.querySelector('.work')!.className).toContain('sheet-open');
    slider!.focus();
    await user.keyboard('{ArrowUp}');
    expect(value()).toBe('Full screen');
    expect(document.querySelector('.work')!.className).toContain('sheet-full');
    await user.keyboard('{ArrowUp}');
    expect(value()).toBe('Full screen');
    await user.keyboard('{ArrowDown}');
    expect(value()).toBe('Half');
    expect(document.querySelector('.work')!.className).not.toContain('sheet-full');
    await user.keyboard('{ArrowDown}');
    expect(value()).toBe('Collapsed');
    expect(document.querySelector('.work')!.className).not.toContain('sheet-open');
    await user.keyboard('{End}');
    expect(value()).toBe('Full screen');
    await user.keyboard('{Home}');
    expect(value()).toBe('Collapsed');
    // A tap (no move) opens to half, another closes it again.
    await user.click(slider!);
    expect(value()).toBe('Half');
    await user.click(slider!);
    expect(value()).toBe('Collapsed');
  });

  it('About Select beside the Select toggles; the plan adds the drag box', async () => {
    const { user } = await renderApp(width);
    const panel = await newProject(user, `Select ${width}`);
    await addBase(user, panel);
    await user.click(within(panel).getByRole('button', { name: /^All pieces \(\d+\)$/ }));
    const tips = screen.getAllByRole('button', { name: 'About Select' });
    expect(tips.length).toBeGreaterThanOrEqual(2);
    // The Pieces list's Select: taps and Shift, Ctrl or Cmd-click.
    const listTip = within(
      within(panel).getByRole('heading', { name: 'Pieces' }).parentElement!,
    ).getByRole('button', { name: 'About Select' });
    await user.click(listTip);
    let note = screen.getByRole('note');
    expect(note.textContent).toMatch(/With Select on, each tap adds or removes a piece/);
    expect(note.textContent).not.toMatch(/A drag on empty space/);
    await user.keyboard('{Escape}');
    // The plan's Select also names the drag box.
    const plan = screen.getByRole('figure', { name: /Room plan, seen from above/ });
    await user.click(within(plan).getByRole('button', { name: 'About Select' }));
    note = screen.getByRole('note');
    expect(note.textContent).toMatch(/A drag on empty space selects every piece it touches\./);
  });

  it('More actions: Lock boards turns Boards off with its hint; Lock construction; both unlock', async () => {
    const { user } = await renderApp(width);
    const panel = await newProject(user, `Board locks ${width}`);
    await addBase(user, panel);
    const card = await screen.findByRole('region', { name: /^Selected piece: / });
    const menu = async () => {
      await user.click(within(card).getByRole('button', { name: 'More actions' }));
      return screen.findByRole('group', { name: 'More actions' });
    };
    let m = await menu();
    expect(within(m).getByRole('button', { name: 'Lock construction' })).toBeTruthy();
    await user.click(within(m).getByRole('button', { name: 'Lock boards' }));
    m = await menu();
    expect(within(m).getByRole('button', { name: 'Unlock boards' })).toBeTruthy();
    await user.click(within(m).getByRole('button', { name: 'Lock construction' }));
    m = await menu();
    expect(within(m).getByRole('button', { name: 'Unlock construction' })).toBeTruthy();
    await user.keyboard('{Escape}');

    // The piece's Settings: Boards, sheets and saw cut is off with the reason.
    await user.click(within(card).getByRole('button', { name: 'Edit this piece' }));
    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    const settings = await screen.findByRole('dialog', { name: /^Settings/ });
    const boards = within(settings)
      .getByText('Boards, sheets and saw cut', { selector: 'summary' })
      .closest('details')!;
    expect(within(boards).getByRole('note').textContent).toBe('Boards locked — unlock to change');
    expect(boards.querySelector('fieldset')!.disabled).toBe(true);
    await user.click(within(settings).getByRole('button', { name: 'Close' }));
    // The Construction group says so too.
    const build = document.getElementById('g-build');
    if (build) expect(build.textContent).toContain('Construction locked — unlock to change');
  });

  it('History: Versions of deleted projects; Restore as a new project opens a copy; Delete asks and removes one', async () => {
    const { user } = await renderApp(width);
    // A saved project with two kept versions.
    const dbm = await import('../../src/persist/db');
    const { makeVersion } = await import('../../src/core/projectVersion');
    const { newProject: blank } = await import('../../src/core/project');
    // Dexie keeps the first IndexedDB of the file: start from no kept versions.
    await dbm.db.projectVersions.clear();
    const gone = { ...blank(`Old hallway ${width}`), id: `gone-${width}` };
    await dbm.saveProject(gone);
    await dbm.saveProjectVersion(makeVersion(gone, 'manual', new Date('2026-11-01T10:00:00Z')));
    await dbm.saveProjectVersion(makeVersion(gone, 'session', new Date('2026-11-02T10:00:00Z')));

    let panel = await newProject(user, `Kitchen ${width}`);
    await user.click(
      within(panel).getByText(/^History( · \d+ versions?)?$/, { selector: 'summary' }),
    );
    await within(panel).findByRole('button', { name: 'Save a version' });
    expect(within(panel).queryByText(/^Versions of deleted projects/)).toBeNull();
    // The project is deleted keeping its versions (as Projects does, ADR-203) while this one stays open.
    await dbm.deleteProject(gone.id);
    // Read from the device after the deletion: allow for a slow storage read.
    const folded = await within(panel).findByText(
      'Versions of deleted projects (2)',
      { selector: 'summary' },
      { timeout: 5000 },
    );
    await user.click(folded);
    let list = within(panel).getByRole('list', { name: 'Versions of deleted projects (2)' });
    expect(within(list).getAllByText(`Old hallway ${width}`)).toHaveLength(2);

    // Restore as a new project opens the copy; the version stays.
    await user.click(within(list).getAllByRole('button', { name: 'Restore as a new project' })[0]);
    await screen.findByDisplayValue(`Old hallway ${width} (restored)`);
    const rows = await dbm.listProjects();
    const copy = rows.find((r) => r.name === `Old hallway ${width} (restored)`)!;
    expect(copy.id).not.toBe(gone.id);
    expect(await dbm.db.projectVersions.count()).toBe(2);

    // Delete asks first; Cancel keeps it; Delete removes only that one.
    panel = await screen.findByRole('complementary', { name: 'Compose' });
    const peek = panel.querySelector<HTMLButtonElement>('.sheet-peek');
    if (peek?.getAttribute('aria-expanded') === 'false') await user.click(peek);
    const history = within(panel).getByText(/^History( · \d+ versions?)?$/, {
      selector: 'summary',
    });
    if (!(history.closest('details') as HTMLDetailsElement).open) await user.click(history);
    const again = await within(panel).findByText('Versions of deleted projects (2)', {
      selector: 'summary',
    });
    if (!(again.closest('details') as HTMLDetailsElement).open) await user.click(again);
    list = within(panel).getByRole('list', { name: 'Versions of deleted projects (2)' });
    const del = within(list).getAllByRole('button', { name: /^Delete the version of / });
    await user.click(del[0]);
    let ask = await screen.findByRole('dialog', { name: 'Confirm' });
    expect(within(ask).getByText(/It cannot be undone\./)).toBeTruthy();
    await user.click(within(ask).getByRole('button', { name: 'Cancel' }));
    expect(await dbm.db.projectVersions.count()).toBe(2);
    await user.click(del[0]);
    ask = await screen.findByRole('dialog', { name: 'Confirm' });
    await user.click(within(ask).getByRole('button', { name: 'Delete' }));
    await within(panel).findByRole('list', { name: 'Versions of deleted projects (1)' });
    expect(await dbm.db.projectVersions.count()).toBe(1);
  });
});
