import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { defaultMaterials, templates } from '../src/core/design';
import { describeChange } from '../src/core/history';
import { insertTemplate } from '../src/core/insertTemplate';
import { addLinkedCopy } from '../src/core/linked';
import {
  makeItem,
  newProject,
  validateProject,
  type Project,
  type ProjectItem,
} from '../src/core/project';
import { templateFromProject } from '../src/core/projectTemplate';
import { makeVersion, restoredProject, validateVersion } from '../src/core/projectVersion';
import {
  applyStyle,
  builtInStyles,
  handleKindOf,
  withHandleKind,
  yourStyles,
} from '../src/core/styles';
import { roleBoard } from '../src/core/finish';
import type { CabinetParams } from '../src/core/types';
import {
  db,
  deleteProjectVersion,
  listProjectVersions,
  saveProject,
  saveProjectVersion,
} from '../src/persist/db';
import { useDesign } from '../src/store/designStore';
import { keepSessionVersion, restoreVersion, saveVersionNow } from '../src/store/versions';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
function run(ids: string[], name = 'Run'): Project {
  let p = newProject(name);
  for (const id of ids) p = { ...p, items: [...p.items, makeItem(p, t(id))] };
  return p;
}
const s = () => useDesign.getState();
const frontName = (it: ProjectItem) =>
  it.design.materials.find((m) => m.id === roleBoard(it.design, 'front'))?.name;

describe('insert a project template into an open project (ADR-123)', () => {
  it('adds the pieces with new ids, kept relative positions and new links', () => {
    let src = run(['base-door', 'base-door']);
    const linked = addLinkedCopy(src, src.items[0].id)!;
    src = linked.project;
    const tpl = templateFromProject(src, 'Kit');
    const target = run(['base-drawers']);
    // The open project has a link of its own, with the same link id as the template's.
    const own = { ...target.items[0], linkId: src.items[0].linkId };
    const res = insertTemplate({ ...target, items: [own] }, tpl, { x: 2000, z: 100 });
    expect(res.ids).toHaveLength(3);
    const added = res.project.items.filter((i) => res.ids.includes(i.id));
    const ids = new Set([...src.items.map((i) => i.id), own.id]);
    expect(added.every((i) => !ids.has(i.id))).toBe(true);
    // Left-back corner at the point; spacing as in the template.
    const xs = added.map((i) => i.position.x);
    expect(Math.min(...xs)).toBe(2000);
    expect(added.every((i) => i.position.z === 100)).toBe(true);
    const srcXs = src.items.map((i) => i.position.x - src.items[0].position.x);
    expect(xs.map((x) => x - 2000)).toEqual(srcXs);
    // The template's linked pair stays linked, with a new link id never shared with the project's own.
    const links = added.filter((i) => i.linkId).map((i) => i.linkId);
    expect(links).toHaveLength(2);
    expect(links[0]).toBe(links[1]);
    expect(links[0]).not.toBe(own.linkId);
    expect(validateProject(res.project)).toEqual([]);
  });

  it('in the store: one undo step for insert and the tap that places it', () => {
    const tpl = templateFromProject(run(['base-door', 'wall-cabinet']), 'Kit');
    s().openProject(run(['base-door']));
    const before = s().project!;
    const ids = s().insertTemplate(tpl);
    expect(ids).toHaveLength(2);
    expect(s().selectedItemIds).toEqual(ids);
    expect(s().placingIds).toEqual(ids);
    s().placeAt(3000, 500);
    const placed = s().project!.items.filter((i) => ids.includes(i.id));
    expect(Math.min(...placed.map((i) => i.position.x))).toBe(3000);
    expect(s().projectPast).toHaveLength(1);
    expect(s().projectPastNames).toEqual(['Insert Kit']);
    s().undoProject();
    expect(s().project!.items.map((i) => i.id)).toEqual(before.items.map((i) => i.id));
  });
});

describe('named undo steps (ADR-123)', () => {
  beforeEach(() => s().openProject(run(['base-door', 'base-door'])));

  it('derives a name from what changed', () => {
    const p = run(['base-door', 'base-drawers']);
    const [a, b] = p.items;
    const moved = { ...p, items: [{ ...a, position: { ...a.position, x: 50 } }, b] };
    expect(describeChange(p, moved)).toBe(`Move ${a.design.name}`);
    const turned = { ...p, items: [{ ...a, rotationY: 90 as const }, b] };
    expect(describeChange(p, turned)).toBe(`Turn ${a.design.name}`);
    expect(describeChange(p, { ...p, items: [a] })).toBe(`Remove ${b.design.name}`);
    expect(describeChange({ ...p, items: [] }, p)).toBe('Add 2 pieces');
    expect(describeChange(p, { ...p, name: 'Kitchen' })).toBe('Rename the project');
  });

  it('every project action records its step; undo and redo carry the names', () => {
    const [a] = s().project!.items;
    s().moveItemBy(a.id, 100, 0);
    s().selectAll();
    s().groupSelection();
    s().turnItem(a.id, 1);
    expect(s().projectPastNames).toEqual([
      `Move ${a.design.name}`,
      'Group 2 pieces',
      `Turn ${a.design.name}`,
    ]);
    expect(s().projectPastNames).toHaveLength(s().projectPast.length);
    s().undoProject();
    expect(s().projectFutureNames).toEqual([`Turn ${a.design.name}`]);
    s().redoProject();
    expect(s().projectPastNames.at(-1)).toBe(`Turn ${a.design.name}`);
    expect(s().projectFutureNames).toEqual([]);
  });

  it('a replace with run parts and a repair undoes as one step', () => {
    s().suggestRunParts();
    const start = s().project!;
    const steps = s().projectPast.length;
    const [a, b] = start.items;
    s().transact(`Replace ${a.design.name}`, () => {
      s().replaceItem(a.id, t('base-drawers'));
      // The repair: move the other piece along.
      s().moveItemBy(b.id, 50, 0);
    });
    expect(s().project!.items[0].design.name).not.toBe(a.design.name);
    expect(s().projectPast).toHaveLength(steps + 1);
    expect(s().projectPastNames.at(-1)).toBe(`Replace ${a.design.name}`);
    s().undoProject();
    expect(s().project).toBe(start);
  });

  it('Edit history jumps back and forward several steps', () => {
    const [a] = s().project!.items;
    const start = s().project!;
    s().moveItemBy(a.id, 100, 0);
    s().moveItemBy(a.id, 100, 0);
    s().moveItemBy(a.id, 100, 0);
    const end = s().project!;
    s().jumpProject(-3);
    expect(s().project).toBe(start);
    expect(s().projectFutureNames).toHaveLength(3);
    s().jumpProject(3);
    expect(s().project).toBe(end);
  });
});

describe('style suggestions (ADR-123)', () => {
  it('built-in styles use only shipped boards and handle kinds', () => {
    const shipped = new Set(defaultMaterials().map((m) => m.name));
    for (const st of builtInStyles()) {
      expect(shipped.has(st.front.name) && shipped.has(st.body.name)).toBe(true);
      expect([null, 'bar', 'knob', 'push']).toContain(st.handle);
    }
  });

  it('applies through finish scope to the scoped pieces only, one undo step', () => {
    const p = run(['base-door', 'base-door', 'base-door']);
    const oak = builtInStyles().find((x) => x.id === 'all-oak')!;
    const r = applyStyle(p, p.items[0].id, oak, 'piece');
    expect(r.applied).toEqual([p.items[0].design.name]);
    expect(frontName(r.project.items[0])).toBe('PAL 18 oak');
    expect(r.project.items[1]).toBe(p.items[1]);
    expect(r.project.items[2]).toBe(p.items[2]);
    expect(handleKindOf(r.project.items[0].design)).toBe('knob');
    s().openProject(p);
    s().applyStyle(p.items[0].id, oak, 'project');
    expect(s().project!.items.every((i) => frontName(i) === 'PAL 18 oak')).toBe(true);
    expect(s().projectPastNames).toEqual(['Apply style All oak']);
    s().undoProject();
    expect(s().project!.items.map(frontName)).toEqual(p.items.map(frontName));
  });

  it('fronts without a handle stay without one', () => {
    const d = t('base-door');
    const p = d.product.params as CabinetParams;
    const bare = { ...d, product: { ...d.product, params: { ...p, interior: { ...p.interior, handle: null } } } } as typeof d;
    expect(withHandleKind(bare, 'knob')).toBe(bare);
  });

  it("the user's own styles come from their projects, most used first", () => {
    const p = run(['base-door', 'base-door']);
    const oakFronts = applyStyle(p, p.items[0].id, builtInStyles()[2], 'project').project;
    const custom = {
      ...oakFronts,
      items: oakFronts.items.map((i) => ({ ...i, design: withHandleKind(i.design, 'bar') })),
    };
    const mine = yourStyles([custom]);
    expect(mine).toHaveLength(1);
    expect(mine[0].uses).toBe(2);
    expect(mine[0].source).toBe('yours');
  });
});

describe('kept project versions (ADR-123, Dexie v10)', () => {
  beforeEach(async () => {
    await db.projectVersions.clear();
  });

  it('a v9 database upgrades to v10 keeping its rows', async () => {
    const name = 'versions-upgrade-test';
    const old = new Dexie(name);
    old.version(9).stores({
      designs: 'id, updatedAt, name',
      projects: 'id, updatedAt, name',
      templates: 'id, updatedAt',
      researchDocs: 'key, docId',
      researchMarks: 'id, updatedAt',
      images: 'id',
      decors: 'id',
      projectTemplates: 'id, updatedAt, name',
      prices: 'id',
      models: 'id, createdAt',
      gapMarks: 'gapId, updatedAt',
    });
    await old.open();
    const p = run(['base-door']);
    await old.table('projects').put({ id: p.id, name: p.name, updatedAt: p.updatedAt, project: p });
    await old.table('designs').put({ id: 'd', name: 'D', updatedAt: '2026', design: t('base-door') });
    await old.table('gapMarks').put({ gapId: 'G-001', decision: null, note: '', updatedAt: '2026' });
    old.close();
    const Fresh = db.constructor as new (n: string) => typeof db;
    const nw = new Fresh(name);
    await nw.open();
    expect(nw.verno).toBe(10);
    expect((await nw.projects.get(p.id))?.project).toEqual(p);
    expect(await nw.designs.get('d')).toBeDefined();
    expect(await nw.gapMarks.get('G-001')).toBeDefined();
    expect(await nw.projectVersions.count()).toBe(0);
    nw.close();
  });

  it('restore keeps the current state as a version first and never rewrites a version', async () => {
    const p = run(['base-door']);
    await saveProject(p);
    s().openProject(p);
    const v1 = await saveVersionNow();
    const kept = structuredClone(v1);
    s().addPiece(t('base-drawers'));
    s().stopPlacing();
    expect(s().project!.items).toHaveLength(2);
    expect(await restoreVersion(v1!)).toBe(true);
    expect(s().project!.items).toHaveLength(1);
    expect(s().project!.id).toBe(p.id);
    const list = await listProjectVersions(p.id);
    expect(list.map((v) => v.kind).sort()).toEqual(['before-restore', 'manual']);
    expect(list.find((v) => v.kind === 'before-restore')!.project.items).toHaveLength(2);
    expect(list.find((v) => v.id === v1!.id)).toEqual(kept);
    // Restore is one undo step.
    s().undoProject();
    expect(s().project!.items).toHaveLength(2);
  });

  it('keeps the project as opened at its first change, once per session', async () => {
    const p = run(['base-door']);
    s().openProject(p);
    expect(await keepSessionVersion()).toBeNull();
    s().moveItemBy(p.items[0].id, 10, 0);
    const v = await keepSessionVersion();
    expect(v?.kind).toBe('session');
    expect(v?.project).toEqual(p);
    s().moveItemBy(p.items[0].id, 10, 0);
    expect(await keepSessionVersion()).toBeNull();
  });

  it('versions are removed only by Delete; unreadable rows are skipped and kept', async () => {
    const p = run(['base-door']);
    const v = makeVersion(p, 'manual');
    await saveProjectVersion(v);
    await db.projectVersions.put({ id: 'bad', projectId: p.id } as never);
    expect((await listProjectVersions(p.id)).map((x) => x.id)).toEqual([v.id]);
    expect(await db.projectVersions.get('bad')).toBeDefined();
    await deleteProjectVersion(v.id);
    expect(await listProjectVersions(p.id)).toEqual([]);
  });

  it('validates versions and restores under the current id', () => {
    const p = run(['base-door']);
    const v = makeVersion(p, 'session');
    expect(validateVersion(v)).toEqual([]);
    expect(validateVersion({ ...v, kind: 'x' })).toContain('Unknown version kind');
    expect(validateVersion({ ...v, projectId: 'other' })).toContain(
      'The version belongs to another project',
    );
    const now = run(['base-drawers']);
    expect(restoredProject(now, { ...v, projectId: now.id }).id).toBe(now.id);
  });
});
