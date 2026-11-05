// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from './find-it/setup';

afterEach(() => vi.restoreAllMocks());
async function setup() {
  const app = await renderApp(1280);
  cleanup();
  const { useDesign } = await import('../src/store/designStore');
  const { newProject, makeItem } = await import('../src/core/project');
  const { templates } = await import('../src/core/design');
  const p = newProject('Audit');
  const project = {
    ...p,
    room: {
      height: 2500,
      outline: [
        [0, 0],
        [4000, 0],
        [4000, 3000],
        [0, 3000],
      ] as [number, number][],
      features: [],
    },
    items: [makeItem(p, templates.find((t) => t.id === 'sideboard')!.create())],
  };
  act(() => useDesign.getState().openProject(project));
  const persistence = await import('../src/persist/db');
  return { ...app, useDesign, project, persistence };
}

async function history() {
  const ctx = await setup();
  const { makeVersion } = await import('../src/core/projectVersion');
  const version = makeVersion(ctx.project, 'manual');
  const read = vi.spyOn(ctx.persistence, 'listProjectVersions').mockResolvedValue([version]);
  const { ProjectHistory } = await import('../src/ui/History');
  const view = render(<ProjectHistory />);
  await ctx.user.click(view.container.querySelector('summary')!);
  await screen.findByRole('list', { name: 'Kept versions' });
  return { ...ctx, version, read };
}

describe('project version failures (ADR-200)', () => {
  it('a failed read shows an error, not a false empty list, and Retry recovers', async () => {
    const ctx = await setup();
    const read = vi
      .spyOn(ctx.persistence, 'listProjectVersions')
      .mockRejectedValue(new Error('blocked'));
    const { ProjectHistory } = await import('../src/ui/History');
    const view = render(<ProjectHistory />);
    await ctx.user.click(view.container.querySelector('summary')!);
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      expect.stringContaining('Versions could not be read'),
    );
    expect(screen.queryByText('No versions kept yet.')).toBeNull();
    read.mockResolvedValue([]);
    await ctx.user.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByText('No versions kept yet.');
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('Save failure retains versions and exposes retry, with no false success', async () => {
    const ctx = await history();
    const versions = await import('../src/store/versions');
    const save = vi
      .spyOn(versions, 'saveVersionNow')
      .mockRejectedValueOnce(new Error('quota'))
      .mockResolvedValue(ctx.version);
    await ctx.user.click(screen.getByRole('button', { name: 'Save a version' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'The version could not be saved on this device.',
    );
    expect(screen.queryByText('Version saved.')).toBeNull();
    expect(screen.getByRole('list', { name: 'Kept versions' })).toBeTruthy();
    await ctx.user.click(screen.getByRole('button', { name: 'Save a version' }));
    await screen.findByText('Version saved.');
    expect(save).toHaveBeenCalledTimes(2);
  });
  it('Restore/Delete failures keep the project and version intact', async () => {
    const ctx = await history();
    const versions = await import('../src/store/versions');
    const confirm = await import('../src/ui/Confirm');
    vi.spyOn(confirm, 'askConfirm').mockResolvedValue(true);
    vi.spyOn(versions, 'restoreVersion').mockRejectedValue(new Error('quota'));
    const before = ctx.useDesign.getState().project;
    await ctx.user.click(screen.getByRole('button', { name: 'Restore' }));
    await screen.findByText('The version could not be restored.');
    expect(ctx.useDesign.getState().project).toBe(before);
    vi.spyOn(ctx.persistence, 'deleteProjectVersion').mockRejectedValue(new Error('quota'));
    await ctx.user.click(screen.getByRole('button', { name: /Delete the version of/ }));
    await screen.findByText('The version could not be deleted from this device.');
    expect(screen.getByRole('list', { name: 'Kept versions' })).toBeTruthy();
  });
  it('a pending write cannot be submitted twice', async () => {
    const ctx = await history();
    const versions = await import('../src/store/versions');
    let done!: (value: typeof ctx.version) => void;
    const save = vi.spyOn(versions, 'saveVersionNow').mockImplementation(
      () =>
        new Promise((resolve) => {
          done = resolve;
        }),
    );
    const button = screen.getByRole('button', { name: 'Save a version' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(save).toHaveBeenCalledOnce();
    expect((button as HTMLButtonElement).disabled).toBe(true);
    await act(async () => done(ctx.version));
    await screen.findByText('Version saved.');
  });
  it.each(['edit', 'switch'] as const)(
    'a restore cannot overwrite a project changed during its backup write: %s',
    async (kind) => {
      const ctx = await setup();
      const { makeVersion } = await import('../src/core/projectVersion');
      const v = makeVersion(ctx.project, 'manual');
      let done!: () => void;
      vi.spyOn(ctx.persistence, 'saveProjectVersion').mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            done = resolve;
          }),
      );
      const { restoreVersion } = await import('../src/store/versions');
      const restoring = restoreVersion(v);
      act(() => {
        if (kind === 'edit')
          ctx.useDesign.getState().setRoom({ ...ctx.project.room, height: 2800 });
        else ctx.useDesign.getState().openProject({ ...ctx.project, id: 'other-project' });
      });
      const changed = ctx.useDesign.getState().project;
      done();
      expect(await restoring).toBe(false);
      expect(ctx.useDesign.getState().project).toBe(changed);
    },
  );
});

describe('project templates (ADR-200)', () => {
  it('Cancel/Escape never writes; failed Save retains name/room choice and retries with the same id', async () => {
    const ctx = await setup();
    const save = vi
      .spyOn(ctx.persistence, 'saveProjectTemplate')
      .mockRejectedValueOnce(new Error('quota'))
      .mockResolvedValue(undefined);
    const { SaveProjectTemplate } = await import('../src/ui/ProjectTemplates');
    render(<SaveProjectTemplate />);
    const open = () =>
      ctx.user.click(screen.getByRole('button', { name: 'Save as project template' }));
    await open();
    let d = screen.getByRole('dialog');
    await ctx.user.click(within(d).getByRole('button', { name: 'Cancel' }));
    expect(save).not.toHaveBeenCalled();
    await open();
    d = screen.getByRole('dialog');
    fireEvent(d, new Event('cancel', { cancelable: true }));
    expect(save).not.toHaveBeenCalled();
    await open();
    d = screen.getByRole('dialog');
    const name = within(d).getByRole('textbox', { name: 'Name of the project template' });
    await ctx.user.clear(name);
    await ctx.user.type(name, 'Keep this name');
    await ctx.user.click(within(d).getByRole('checkbox', { name: 'Include the room' }));
    await ctx.user.click(within(d).getByRole('button', { name: 'Save template' }));
    await within(d).findByRole('alert');
    expect((name as HTMLInputElement).value).toBe('Keep this name');
    expect((within(d).getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
    await ctx.user.click(within(d).getByRole('button', { name: 'Save template' }));
    await screen.findByText(/Saved as project template “Keep this name”/);
    expect(save.mock.calls[0][0].id).toBe(save.mock.calls[1][0].id);
    expect(save.mock.calls[1][0].room).toBeUndefined();
  });
  it('Create/Rename failures keep input; Create opens only after saving, reusing the same new id on retry', async () => {
    const ctx = await setup();
    const { templateFromProject } = await import('../src/core/projectTemplate');
    const template = templateFromProject(ctx.project, 'Template');
    vi.spyOn(ctx.persistence, 'listProjectTemplates').mockResolvedValue([template]);
    const write = vi
      .spyOn(ctx.persistence, 'saveProjectTemplate')
      .mockRejectedValueOnce(new Error('quota'))
      .mockResolvedValue(undefined);
    const { ProjectTemplateList } = await import('../src/ui/ProjectTemplates');
    const opened = vi.fn();
    render(<ProjectTemplateList manage onOpened={opened} />);
    await ctx.user.click(await screen.findByRole('button', { name: 'Rename' }));
    let d = screen.getByRole('dialog');
    let name = within(d).getByRole('textbox', { name: 'New name' });
    await ctx.user.clear(name);
    await ctx.user.type(name, 'Renamed');
    await ctx.user.click(within(d).getByRole('button', { name: 'Rename' }));
    await within(d).findByRole('alert');
    expect((name as HTMLInputElement).value).toBe('Renamed');
    await ctx.user.click(within(d).getByRole('button', { name: 'Rename' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(write).toHaveBeenCalledTimes(2);
    const create = vi
      .spyOn(ctx.persistence, 'saveProject')
      .mockRejectedValueOnce(new Error('quota'))
      .mockResolvedValue(undefined);
    await ctx.user.click(screen.getByRole('button', { name: /^Template/ }));
    d = screen.getByRole('dialog');
    name = within(d).getByRole('textbox', { name: 'Name of the new project' });
    await ctx.user.clear(name);
    await ctx.user.type(name, 'Created');
    await ctx.user.click(within(d).getByRole('button', { name: 'Create project' }));
    await within(d).findByRole('alert');
    expect(opened).not.toHaveBeenCalled();
    expect(ctx.useDesign.getState().project?.id).toBe(ctx.project.id);
    await ctx.user.click(within(d).getByRole('button', { name: 'Create project' }));
    await waitFor(() => expect(opened).toHaveBeenCalledOnce());
    expect(create.mock.calls[0][0].id).toBe(create.mock.calls[1][0].id);
    expect(create.mock.calls[1][0].id).not.toBe(ctx.project.id);
  });
  it('Export/Delete errors retain the row and expose Retry', async () => {
    const ctx = await setup();
    const { templateFromProject } = await import('../src/core/projectTemplate');
    const template = templateFromProject(ctx.project, 'Template');
    const read = vi.spyOn(ctx.persistence, 'listProjectTemplates').mockResolvedValue([template]);
    const file = await import('../src/persist/projectTemplateFile');
    const exportFile = vi
      .spyOn(file, 'projectTemplateFile')
      .mockRejectedValue(new Error('missing picture'));
    const { ProjectTemplateList } = await import('../src/ui/ProjectTemplates');
    render(<ProjectTemplateList manage onOpened={() => {}} />);
    await ctx.user.click(await screen.findByRole('button', { name: 'Export' }));
    await screen.findByText('The project template could not be exported.');
    expect(screen.getByRole('button', { name: /^Template/ })).toBeTruthy();
    await ctx.user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(exportFile).toHaveBeenCalledTimes(2));
    const confirm = await import('../src/ui/Confirm');
    vi.spyOn(confirm, 'askConfirm').mockResolvedValue(true);
    const del = vi
      .spyOn(ctx.persistence, 'deleteProjectTemplate')
      .mockRejectedValueOnce(new Error('quota'))
      .mockResolvedValue(undefined);
    await ctx.user.click(screen.getByRole('button', { name: 'Delete' }));
    await screen.findByText('The project template could not be deleted from this device.');
    expect(screen.getByRole('button', { name: /^Template/ })).toBeTruthy();
    read.mockResolvedValue([]);
    await ctx.user.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByText(/No project templates yet/);
    expect(del).toHaveBeenCalledTimes(2);
  });
});

it('wall finishes merge into the latest room and reject changed targets (ADR-200)', async () => {
  const ctx = await setup();
  const { applyWallFinish } = await import('../src/ui/wallFinishTarget');
  const { setWallFinish } = await import('../src/core/room');
  const source = ctx.useDesign.getState().project!.room!;
  act(() =>
    ctx.useDesign.getState().setRoom({
      ...source,
      height: 2800,
      features: [
        {
          id: 'door',
          kind: 'door',
          wall: 1,
          from: 100,
          width: 800,
          sill: 0,
          height: 2000,
          depth: 0,
          label: 'Door',
        },
      ],
    }),
  );
  expect(applyWallFinish(ctx.project.id, source, 0, { colour: '#123456' })).toBe(true);
  expect(ctx.useDesign.getState().project!.room).toMatchObject({
    height: 2800,
    features: [{ id: 'door' }],
  });
  const before = ctx.useDesign.getState().project;
  expect(applyWallFinish(ctx.project.id, source, 0, { colour: '#abcdef' })).toBe(false);
  expect(ctx.useDesign.getState().project).toBe(before);
  expect(applyWallFinish('other-project', source, 1, { colour: '#abcdef' })).toBe(false);
  act(() =>
    ctx.useDesign.getState().setRoom({
      ...source,
      outline: [
        [0, 0],
        [4500, 0],
        [4500, 3000],
        [0, 3000],
      ],
    }),
  );
  expect(applyWallFinish(ctx.project.id, source, 0, { colour: '#abcdef' })).toBe(false);
  act(() => ctx.useDesign.getState().setRoom(setWallFinish(source, 2, { colour: '#eeeeee' })));
  expect(applyWallFinish(ctx.project.id, source, 0, { colour: '#abcdef' })).toBe(true);
  expect(ctx.useDesign.getState().project!.room!.walls).toHaveLength(2);
});

it('a completed image import preserves newer room edits; changing the background cancels the pending import (ADR-200)', async () => {
  const ctx = await setup();
  const images = await import('../src/persist/images');
  type Result = Awaited<ReturnType<typeof images.importImage>>;
  let done!: (r: Result) => void;
  vi.spyOn(images, 'importImage').mockImplementation(
    () =>
      new Promise((resolve) => {
        done = resolve;
      }),
  );
  const { WallBackground } = await import('../src/ui/WallBackground');
  const source = ctx.useDesign.getState().project!.room!;
  const view = render(<WallBackground projectId={ctx.project.id} room={source} wall={0} />);
  await ctx.user.selectOptions(
    screen.getByRole('combobox', { name: 'Wall 1 background' }),
    'picture',
  );
  await ctx.user.upload(
    screen.getByLabelText('Add a picture for Wall 1'),
    new File(['png'], 'picture.png', { type: 'image/png' }),
  );
  act(() => ctx.useDesign.getState().setRoom({ ...source, height: 2800 }));
  view.rerender(
    <WallBackground
      projectId={ctx.project.id}
      room={ctx.useDesign.getState().project!.room!}
      wall={0}
    />,
  );
  await act(async () =>
    done({
      ok: true,
      color: '#ffffff',
      image: { id: 'pic', name: 'picture', tileLength: 100, tileWidth: 100 },
    }),
  );
  expect(ctx.useDesign.getState().project!.room).toMatchObject({
    height: 2800,
    walls: [{ image: { id: 'pic' } }],
  });
  const room = ctx.useDesign.getState().project!.room!;
  view.rerender(<WallBackground projectId={ctx.project.id} room={room} wall={0} />);
  await ctx.user.upload(
    screen.getByLabelText('Replace picture for Wall 1'),
    new File(['png'], 'next.png', { type: 'image/png' }),
  );
  await ctx.user.selectOptions(screen.getByRole('combobox', { name: 'Wall 1 background' }), 'none');
  await act(async () =>
    done({
      ok: true,
      color: '#123456',
      image: { id: 'stale', name: 'next', tileLength: 100, tileWidth: 100 },
    }),
  );
  expect(ctx.useDesign.getState().project!.room!.walls).toBeUndefined();
});
