// @vitest-environment jsdom
// Find-it for ADR-203 (keep project pieces safe while editing them), in jsdom (ADR-108), at 390 and 1280 px:
// deleting a project with kept versions asks "Also delete its N kept versions?" (Keep them is the default: Esc and
// Keep delete none; Delete versions removes only the readable ones); Open in wizard → Update piece on a project piece
// changes the project's copy only; an imported template that shadows a family already edited here asks, and Keep mine
// changes nothing; a piece's Doors and handles show "Set by Handles for this run" while a run handle reaches it; Esc in
// the piece editor goes up one level. Saved data is put in storage first (a returning user), then found by role and text.
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

type User = Awaited<ReturnType<typeof renderApp>>['user'];

async function newProjectNamed(user: User, name: string) {
  await user.click(await screen.findByRole('button', { name: 'Create a new project' }));
  const create = await screen.findByRole('dialog');
  const box = within(create).getByRole('textbox');
  await user.clear(box);
  await user.type(box, name);
  await user.click(within(create).getByRole('button', { name: 'Create project' }));
  await screen.findByRole('complementary', { name: 'Compose' });
}

async function toProjects(user: User) {
  await user.click(
    screen
      .queryAllByRole('link', { name: 'Projects' })
      .concat(screen.queryAllByRole('button', { name: 'Projects' }))[0],
  );
  await screen.findByRole('main', { name: 'Projects' });
}

/** The Delete action of a saved project's row: a button on a wide screen, in the row's ⋯ menu on a phone. */
async function deleteRow(user: User, name: string, width: number) {
  const page = screen.getByRole('main', { name: 'Projects' });
  if (width < 520) {
    const menu = await within(page).findByLabelText(`Actions for ${name}`);
    await user.click(menu);
    const details = menu.closest('details')!;
    await user.click(within(details as HTMLElement).getByRole('button', { name: /^Delete/ }));
  } else await user.click(await within(page).findByRole('button', { name: `Delete ${name}` }));
}

const confirmDialog = () => screen.findByRole('dialog', { name: 'Confirm' });

describe.each(WIDTHS)('keep project pieces safe at %ipx (find-it, ADR-203)', (width) => {
  it('Projects › Delete a project with kept versions asks about them; Keep is the default', async () => {
    const { user } = await renderApp(width);
    const db = await import('../../src/persist/db');
    const { newProject } = await import('../../src/core/project');
    const { makeVersion } = await import('../../src/core/projectVersion');
    // Three saved projects with kept versions, and one unreadable version row each (ADR-012: never deleted).
    const saved = ['Esc project', 'Keep project', 'Drop project'].map((n) => newProject(n));
    for (const p of saved) {
      await db.saveProject(p);
      await db.saveProjectVersion(makeVersion(p, 'manual'));
      await db.saveProjectVersion(makeVersion(p, 'session'));
      await db.db.projectVersions.put({ id: `bad-${p.id}`, projectId: p.id } as never);
    }
    const [esc, keep, drop] = saved;
    const rows = async (id: string) =>
      (await db.db.projectVersions.where('projectId').equals(id).toArray()).length;

    await newProjectNamed(user, 'Open now project');
    await toProjects(user);

    // Esc on the second question keeps the versions; the project itself is deleted.
    await deleteRow(user, esc.name, width);
    let ask = await confirmDialog();
    expect(within(ask).getByText(/Delete project “Esc project”\?/)).toBeTruthy();
    await user.click(within(ask).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(within(ask).getByText('Also delete its 2 kept versions?')).toBeTruthy(),
    );
    expect(within(ask).getByRole('button', { name: 'Keep them' })).toBeTruthy();
    expect(within(ask).getByRole('button', { name: 'Delete versions' })).toBeTruthy();
    // Esc on a modal dialog is its cancel event.
    fireEvent(ask, new Event('cancel', { cancelable: true }));
    await waitFor(async () => expect(await db.loadProject(esc.id)).toBeUndefined());
    expect(await rows(esc.id)).toBe(3);
    expect(await db.listProjectVersions(esc.id)).toHaveLength(2);

    // Keep them: the same.
    await deleteRow(user, keep.name, width);
    ask = await confirmDialog();
    await user.click(within(ask).getByRole('button', { name: 'Delete' }));
    await within(ask).findByText('Also delete its 2 kept versions?');
    await user.click(within(ask).getByRole('button', { name: 'Keep them' }));
    await waitFor(async () => expect(await db.loadProject(keep.id)).toBeUndefined());
    expect(await rows(keep.id)).toBe(3);

    // Delete versions: only the rows the list returned go; the unreadable row and other projects' versions stay.
    await deleteRow(user, drop.name, width);
    ask = await confirmDialog();
    await user.click(within(ask).getByRole('button', { name: 'Delete' }));
    await within(ask).findByText('Also delete its 2 kept versions?');
    await user.click(within(ask).getByRole('button', { name: 'Delete versions' }));
    await waitFor(async () => expect(await db.listProjectVersions(drop.id)).toEqual([]));
    expect(await db.loadProject(drop.id)).toBeUndefined();
    expect(await db.db.projectVersions.get(`bad-${drop.id}`)).toBeDefined();
    expect(await rows(esc.id)).toBe(3);
    expect(await rows(keep.id)).toBe(3);
    await waitFor(() =>
      expect(screen.getByRole('main', { name: 'Projects' }).textContent).not.toMatch(
        /Drop project/,
      ),
    );
  });

  it('a project without kept versions is deleted with the one question only', async () => {
    const { user } = await renderApp(width);
    const db = await import('../../src/persist/db');
    const { newProject } = await import('../../src/core/project');
    const p = newProject('Plain project');
    await db.saveProject(p);
    await newProjectNamed(user, 'Open now project');
    await toProjects(user);
    await deleteRow(user, p.name, width);
    const ask = await confirmDialog();
    await user.click(within(ask).getByRole('button', { name: 'Delete' }));
    await waitFor(async () => expect(await db.loadProject(p.id)).toBeUndefined());
    expect(screen.queryByText(/Also delete its/)).toBeNull();
  });

  it('a project piece › Settings › Open in wizard › Update piece changes the project copy only', async () => {
    const { user } = await renderApp(width);
    await newProjectNamed(user, 'Start');
    const { createPiece } = await import('../../src/core/wizard/engine');
    const { makeItem, newProject } = await import('../../src/core/project');
    const { useDesign } = await import('../../src/store/designStore');
    const db = await import('../../src/persist/db');
    const made = createPiece({ type: 'cabinet' });
    if (!made.ok) throw new Error('the wizard should make a cabinet');
    const p0 = newProject('Wizard project');
    const item = makeItem(p0, made.design);
    act(() => {
      useDesign.getState().openProject({ ...p0, items: [item] });
      useDesign.getState().editItem(item.id);
    });
    const libraryBefore = (await db.listDesigns()).length;
    const w0 = (item.design.product.params as { width: number }).width;

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const settings = await screen.findByRole('dialog', { name: /^Settings: / });
    await user.click(within(settings).getByRole('button', { name: 'Open in wizard' }));
    const wiz = await screen.findByRole('dialog', { name: /^Wizard: / });
    expect(within(wiz).getByText(/“Update piece” replaces/)).toBeTruthy();
    const rail = within(wiz).getByRole('list', { name: 'Wizard steps' });
    await user.click(within(rail).getByRole('button', { name: 'Size' }));
    const widthBox = within(wiz).getByRole('textbox', { name: /^Width/ });
    await user.clear(widthBox);
    await user.type(widthBox, String(w0 + 100) + '[Tab]');
    await user.click(within(rail).getByRole('button', { name: 'Review' }));
    await user.click(within(wiz).getByRole('button', { name: 'Update piece' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /^Wizard: / })).toBeNull());

    // The open project piece took it, as one edit; the project's other data and the library are untouched.
    const st = useDesign.getState();
    expect(st.editingItemId).toBe(item.id);
    expect((st.design.product.params as { width: number }).width).toBe(w0 + 100);
    expect(st.design.id).toBe(item.design.id);
    expect(st.past).toHaveLength(1);
    act(() => useDesign.getState().backToProject());
    const after = useDesign.getState().project!.items.find((i) => i.id === item.id)!;
    expect((after.design.product.params as { width: number }).width).toBe(w0 + 100);
    expect(useDesign.getState().projectPastNames.at(-1)).toMatch(/^Edit /);
    expect((await db.listDesigns()).length).toBe(libraryBefore);
  });

  it('a size-locked project piece refuses Update piece with the reason', async () => {
    const { user } = await renderApp(width);
    await newProjectNamed(user, 'Start');
    const { createPiece } = await import('../../src/core/wizard/engine');
    const { makeItem, newProject } = await import('../../src/core/project');
    const { useDesign } = await import('../../src/store/designStore');
    const made = createPiece({ type: 'cabinet' });
    if (!made.ok) throw new Error('the wizard should make a cabinet');
    const p0 = newProject('Locked wizard project');
    const item = { ...makeItem(p0, made.design), sizeLocked: true as const };
    act(() => {
      useDesign.getState().openProject({ ...p0, items: [item] });
      useDesign.getState().editItem(item.id);
    });
    const w0 = (item.design.product.params as { width: number }).width;
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const settings = await screen.findByRole('dialog', { name: /^Settings: / });
    await user.click(within(settings).getByRole('button', { name: 'Open in wizard' }));
    const wiz = await screen.findByRole('dialog', { name: /^Wizard: / });
    const rail = within(wiz).getByRole('list', { name: 'Wizard steps' });
    await user.click(within(rail).getByRole('button', { name: 'Size' }));
    const widthBox = within(wiz).getByRole('textbox', { name: /^Width/ });
    await user.clear(widthBox);
    await user.type(widthBox, String(w0 + 100) + '[Tab]');
    await user.click(within(rail).getByRole('button', { name: 'Review' }));
    await user.click(within(wiz).getByRole('button', { name: 'Update piece' }));
    expect(await within(wiz).findByText(/has its size locked/)).toBeTruthy();
    expect((useDesign.getState().design.product.params as { width: number }).width).toBe(w0);
  });

  it('Catalog › Import templates for a family edited here asks; Keep mine changes nothing', async () => {
    const { user } = await renderApp(width);
    const { findFamily } = await import('../../src/core/catalog');
    const { shadowOf } = await import('../../src/core/catalog/local');
    const { useTemplates } = await import('../../src/store/templatesStore');
    // Families per width: templates saved here can outlive one render in jsdom's IndexedDB.
    const [edited, fresh] = width < 520 ? ['bookcase', 'dresser'] : ['wardrobe', 'chest'];
    const shadowing = (f: string) =>
      useTemplates
        .getState()
        .locals.filter((l) => l.shadows === f)
        .map((l) => l.id);
    const mine = shadowOf(findFamily(edited)!);
    mine.family.name = 'My wardrobe';
    await act(() => useTemplates.getState().save(mine));
    const imported = shadowOf(findFamily(edited)!);
    imported.family.name = 'Their wardrobe';
    const file = (list: unknown[]) =>
      new File([JSON.stringify({ templates: list })], 'templates.json', {
        type: 'application/json',
      });

    await user.click(await screen.findByRole('link', { name: /Catalog/ }));
    const page = await screen.findByRole('main', { name: 'Catalog' });
    const input = within(page).getByLabelText('Import templates');
    await user.upload(input, file([imported]));
    let ask = await confirmDialog();
    expect(
      within(ask).getByText(
        '“Their wardrobe” is already edited on this device. Keep yours or use the imported one?',
      ),
    ).toBeTruthy();
    await user.click(within(ask).getByRole('button', { name: 'Keep mine' }));
    expect((await within(page).findByText(/kept as they were/)).textContent).toBe(
      '0 templates imported, 1 kept as they were.',
    );
    expect(shadowing(edited)).toEqual([mine.id]);
    expect(useTemplates.getState().locals.find((l) => l.id === mine.id)!.family.name).toBe(
      'My wardrobe',
    );

    // Esc keeps mine too.
    await user.upload(input, file([imported]));
    ask = await confirmDialog();
    fireEvent(ask, new Event('cancel', { cancelable: true }));
    await waitFor(() =>
      expect(within(page).getByRole('status').textContent).toMatch(/1 kept as they were/),
    );
    expect(shadowing(edited)).toEqual([mine.id]);

    // Only Use the imported one replaces the edit on this device.
    await user.upload(input, file([imported]));
    ask = await confirmDialog();
    await user.click(within(ask).getByRole('button', { name: 'Use the imported one' }));
    await waitFor(() =>
      expect(within(page).getByRole('status').textContent).toBe('1 template imported.'),
    );
    expect(shadowing(edited)).toEqual([imported.id]);

    // Two in one file for a family not edited here: the second asks about the first.
    const a = shadowOf(findFamily(fresh)!);
    const b = shadowOf(findFamily(fresh)!);
    b.family.name = 'Second chest';
    await user.upload(input, file([a, b]));
    ask = await confirmDialog();
    expect(within(ask).getByText(/“Second chest” is already edited on this device/)).toBeTruthy();
    await user.click(within(ask).getByRole('button', { name: 'Keep mine' }));
    await waitFor(() =>
      expect(within(page).getByRole('status').textContent).toBe(
        '1 template imported, 1 kept as they were.',
      ),
    );
    expect(shadowing(fresh)).toEqual([a.id]);
  });

  it('a piece reached by Handles for this run shows them read-only in its Doors and handles', async () => {
    const { user } = await renderApp(width);
    await newProjectNamed(user, 'Start');
    const { templates } = await import('../../src/core/design');
    const { makeItem, newProject } = await import('../../src/core/project');
    const { useDesign } = await import('../../src/store/designStore');
    let p = newProject('Run handle project');
    for (let i = 0; i < 2; i++)
      p = {
        ...p,
        items: [...p.items, makeItem(p, templates.find((x) => x.id === 'base-door')!.create())],
      };
    const [a, b] = p.items;
    p = {
      ...p,
      runHandles: [
        { id: 'rh', from: [a.id], handle: { kind: 'bar', holeSpacing: 160 }, height: 800 },
      ],
    };
    act(() => {
      useDesign.getState().openProject(p);
      useDesign.getState().editItem(b.id);
    });
    // The space with the door, selected as a tap on it does (jsdom cannot hit-test the drawing, ADR-108).
    const space = useDesign.getState().model.spaces.find((s) => s.view !== 'side' && s.leaf)!;
    act(() => useDesign.getState().select(space.nodeId));
    const compose = screen.queryByRole('radio', { name: 'Compose' });
    if (compose) await user.click(compose);
    const note = (await screen.findByText('Set by Handles for this run')).closest('div')!;
    expect(within(note as HTMLElement).getByText('Bar')).toBeTruthy();
    expect(within(note as HTMLElement).getByText('160 mm')).toBeTruthy();
    // In place of the piece's own handle controls; without the run handle they are back.
    expect(screen.queryByText('Handles on the doors')).toBeNull();
    act(() => useDesign.getState().updateProject((q) => ({ ...q, runHandles: [] })));
    expect(await screen.findByText('Handles on the doors')).toBeTruthy();
    expect(screen.queryByText('Set by Handles for this run')).toBeNull();
    // The piece's own design keeps its own handles.
    expect(JSON.stringify(useDesign.getState().design)).not.toContain('"holeSpacing":160');
  });

  it('Esc in the piece editor goes up one level: a space → the one around it → the whole piece → nothing', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    await user.click(
      within(await screen.findByRole('dialog')).getAllByRole('button', { name: /Sideboard/ })[0],
    );
    const { useDesign } = await import('../../src/store/designStore');
    const { splitSpace } = await import('../../src/core/design');
    const root = useDesign.getState().model.spaces.find((s) => s.view !== 'side' && s.depth === 0)!;
    const bay = useDesign
      .getState()
      .model.spaces.find((s) => s.view !== 'side' && s.depth === 1)!.nodeId;
    act(() => useDesign.getState().updateSpace(bay, (s) => splitSpace(s, 'y', 2)));
    const inner = useDesign
      .getState()
      .model.spaces.find((s) => s.view !== 'side' && s.depth === 2)!.nodeId;
    expect(root.leaf).toBe(false);
    act(() => useDesign.getState().select(inner));
    expect(
      screen.getAllByRole('button', { name: 'Select the divided space around this one' }).length,
    ).toBeGreaterThan(0);
    await user.keyboard('{Escape}');
    expect(useDesign.getState().selectedId).toBe(bay);
    await user.keyboard('{Escape}');
    expect(useDesign.getState().selectedId).toBeNull();
    await user.keyboard('{Escape}');
    expect(useDesign.getState().selectedId).toBeUndefined();
    // Esc with nothing selected stays at nothing.
    await user.keyboard('{Escape}');
    expect(useDesign.getState().selectedId).toBeUndefined();
    // An open dialog takes Esc first: the selection stays (ADR-160).
    act(() => useDesign.getState().select(inner));
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const settings = await screen.findByRole('dialog', { name: /^Settings: / });
    await user.keyboard('{Escape}');
    expect(useDesign.getState().selectedId).toBe(inner);
    void settings;
  });
});
