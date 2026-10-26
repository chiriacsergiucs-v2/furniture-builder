import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import {
  checkGltf,
  countTriangles,
  makeModelItem,
  modelBox,
  scaleToWidth,
  type ModelItem,
} from '../src/core/model3d';
import {
  buildProjectModel,
  makeItem,
  newProject,
  PROJECT_SCHEMA,
  worktopMaterial,
  projectCutlist,
  projectHardware,
  projectNestingJobs,
  validateProject,
  type Project,
} from '../src/core/project';
import { shoppingList } from '../src/core/shopping';
import { shapeOutline } from '../src/core/room';
import { db, deleteModelIfUnused, loadModel, saveModel, saveProject } from '../src/persist/db';
import { takeModels, withModels } from '../src/persist/models';

const t = (id: string) => templates.find((x) => x.id === id)!.create();

/** A minimal valid GLB: one cube mesh (8 corners, 12 triangles) of `m` metres, built in memory (no binary fixtures). */
function cubeGlb(m = 0.6, extra: Record<string, unknown> = {}): Uint8Array {
  const pos = new Float32Array([
    0,
    0,
    0,
    m,
    0,
    0,
    m,
    m,
    0,
    0,
    m,
    0,
    0,
    0,
    m,
    m,
    0,
    m,
    m,
    m,
    m,
    0,
    m,
    m,
  ]);
  const idx = new Uint16Array([
    0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5,
    6, 1, 6, 2,
  ]);
  const bin = new Uint8Array(pos.byteLength + idx.byteLength);
  bin.set(new Uint8Array(pos.buffer), 0);
  bin.set(new Uint8Array(idx.buffer), pos.byteLength);
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    buffers: [{ byteLength: bin.byteLength }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: pos.byteLength },
      { buffer: 0, byteOffset: pos.byteLength, byteLength: idx.byteLength },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 8,
        type: 'VEC3',
        min: [0, 0, 0],
        max: [m, m, m],
      },
      { bufferView: 1, componentType: 5123, count: 36, type: 'SCALAR' },
    ],
    ...extra,
  };
  let text = new TextEncoder().encode(JSON.stringify(json));
  const pad = (4 - (text.length % 4)) % 4;
  text = new Uint8Array([...text, ...new Array(pad).fill(0x20)]);
  const total = 12 + 8 + text.length + 8 + bin.length;
  const out = new Uint8Array(total);
  const v = new DataView(out.buffer);
  v.setUint32(0, 0x46546c67, true);
  v.setUint32(4, 2, true);
  v.setUint32(8, total, true);
  v.setUint32(12, text.length, true);
  v.setUint32(16, 0x4e4f534a, true);
  out.set(text, 20);
  v.setUint32(20 + text.length, bin.length, true);
  v.setUint32(24 + text.length, 0x004e4942, true);
  out.set(bin, 28 + text.length);
  return out;
}
const gltfText = (json: unknown) => new TextEncoder().encode(JSON.stringify(json));
const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');

const fridge = (over: Partial<ModelItem> = {}): ModelItem => ({
  ...makeModelItem('m1', { id: 'mdl-1', name: 'Fridge', size: { w: 600, h: 1800, d: 650 } }, 0),
  ...over,
});
const withModel = (p: Project, ...models: ModelItem[]): Project => ({
  ...p,
  schemaVersion: PROJECT_SCHEMA,
  models,
});

describe('3D model file check (ADR-076)', () => {
  it('accepts a GLB and counts its triangles', () => {
    const r = checkGltf('Fridge.glb', cubeGlb());
    expect(r).toEqual({ ok: true, format: 'glb', triangles: 12, name: 'Fridge' });
  });
  it('accepts a .gltf whose buffers are embedded data URIs', () => {
    const json = {
      asset: { version: '2.0' },
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
      accessors: [{ count: 3 }],
      buffers: [{ uri: 'data:application/octet-stream;base64,AAAA', byteLength: 3 }],
    };
    expect(checkGltf('chair.gltf', gltfText(json))).toMatchObject({ ok: true, triangles: 1 });
  });
  it('refuses files with external URIs, in buffers or images', () => {
    const base = { asset: { version: '2.0' }, meshes: [{ primitives: [] }] };
    for (const json of [
      { ...base, buffers: [{ uri: 'chair.bin', byteLength: 10 }] },
      { ...base, buffers: [{ uri: 'https://example.com/x.bin', byteLength: 10 }] },
      { ...base, images: [{ uri: 'wood.png' }] },
    ]) {
      const r = checkGltf('chair.gltf', gltfText(json));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.problem).toMatch(/uses files outside it/);
    }
    const glb = checkGltf('x.glb', cubeGlb(0.6, { images: [{ uri: '../secret.png' }] }));
    expect(glb.ok).toBe(false);
  });
  it('refuses files over the size or triangle limits, with the numbers', () => {
    const f = cubeGlb();
    const big = checkGltf('big.glb', f, { bytes: f.byteLength - 1, triangles: 1000 });
    expect(big).toMatchObject({ ok: false });
    if (!big.ok) expect(big.problem).toMatch(/the limit is/);
    const many = checkGltf('dense.glb', f, { bytes: 1e9, triangles: 11 });
    expect(many).toEqual({
      ok: false,
      problem: 'dense.glb has 12 triangles; the limit is 11.',
    });
    // The default: 30 MB.
    const huge = new Uint8Array(30 * 1024 * 1024 + 1);
    expect(checkGltf('huge.glb', huge)).toMatchObject({ ok: false });
  });
  it('refuses non-glTF, empty, broken and decoder-needing files without throwing', () => {
    expect(checkGltf('a.glb', new Uint8Array())).toMatchObject({ ok: false });
    expect(checkGltf('a.obj', new TextEncoder().encode('v 0 0 0'))).toMatchObject({ ok: false });
    expect(checkGltf('a.gltf', new TextEncoder().encode('{nope'))).toMatchObject({ ok: false });
    expect(checkGltf('a.gltf', gltfText({ asset: { version: '1.0' } }))).toMatchObject({
      ok: false,
    });
    const cut = cubeGlb().slice(0, 40);
    expect(checkGltf('a.glb', cut)).toMatchObject({ ok: false });
    const draco = checkGltf(
      'a.glb',
      cubeGlb(0.6, { extensionsRequired: ['KHR_draco_mesh_compression'] }),
    );
    expect(draco).toMatchObject({ ok: false });
    // A declared accessor far larger than the file (a sparse accessor would allocate it all) is refused.
    const sparse = checkGltf(
      'a.glb',
      cubeGlb(0.6, {
        accessors: [
          { componentType: 5126, count: 8, type: 'VEC3' },
          { componentType: 5123, count: 36, type: 'SCALAR' },
          { componentType: 5126, count: 1e9, type: 'VEC3', sparse: { count: 0 } },
        ],
      }),
    );
    expect(sparse).toMatchObject({ ok: false });
    for (let i = 0; i < 200; i++) {
      const junk = cubeGlb().map((b) => (Math.random() < 0.05 ? (Math.random() * 256) | 0 : b));
      expect(() => checkGltf('junk.glb', junk)).not.toThrow();
    }
  });
  it('counts strips and instanced meshes', () => {
    expect(
      countTriangles({
        meshes: [{ primitives: [{ attributes: { POSITION: 0 }, mode: 5 }] }],
        accessors: [{ count: 10 }],
        nodes: [{ mesh: 0 }, { mesh: 0 }],
      }),
    ).toBe(16);
  });
});

describe('model items in a project (ADR-076)', () => {
  it('turns the box by front fix and turn, and keeps proportions when resized', () => {
    expect(modelBox(fridge())).toEqual({ x: 0, y: 0, z: 0, w: 600, h: 1800, d: 650 });
    expect(modelBox(fridge({ rotationY: 90 }))).toMatchObject({ w: 650, d: 600 });
    expect(modelBox(fridge({ rotationY: 90, front: 'left' }))).toMatchObject({ w: 600, d: 650 });
    expect(scaleToWidth({ w: 600, h: 1800, d: 650 }, 300)).toEqual({ w: 300, h: 900, d: 325 });
  });
  it('validates; projects of the previous schemaVersion still load', () => {
    const v1: Project = {
      ...newProject(),
      schemaVersion: 1,
      items: [makeItem(newProject(), t('chest'))],
    };
    expect(validateProject(v1)).toEqual([]);
    // Later versions (ADR-095 and on) keep 3D models; 5 is the version that brought them.
    expect(newProject().schemaVersion).toBe(PROJECT_SCHEMA);
    expect(PROJECT_SCHEMA).toBeGreaterThanOrEqual(5);
    const p = withModel(v1, fridge({ position: { x: 2000, y: 0, z: 0 } }));
    expect(validateProject(p)).toEqual([]);
    for (const older of [1, 2, 3, 4])
      expect(validateProject({ ...p, schemaVersion: older })).toContain(
        '3D models need project schemaVersion 5',
      );
    expect(validateProject({ ...p, schemaVersion: PROJECT_SCHEMA + 1 })).toContain(
      'Unsupported project schemaVersion',
    );
    for (const bad of [
      { size: { w: 0, h: 1, d: 1 } },
      { size: { w: 1.5, h: 1, d: 1 } },
      { position: { x: 0, y: -1, z: 0 } },
      { rotationY: 45 },
      { front: 'up' },
      { modelId: '' },
      { id: v1.items[0].id },
    ])
      expect(validateProject(withModel(v1, fridge(bad as Partial<ModelItem>)))).toContain(
        'Invalid 3D model item',
      );
    expect(validateProject({ ...p, models: 'x' })).toContain('Invalid 3D models');
  });
  it('never reach the cut list, hardware, nesting or shopping list', () => {
    const base = { ...newProject(), items: [makeItem(newProject(), t('chest'))] };
    const p = withModel(base, fridge({ position: { x: 3000, y: 0, z: 0 } }));
    expect(projectCutlist(p)).toEqual(projectCutlist(base));
    expect(projectHardware(p)).toEqual(projectHardware(base));
    expect(JSON.stringify(projectNestingJobs(p))).toBe(JSON.stringify(projectNestingJobs(base)));
    const pm = buildProjectModel(p),
      pb = buildProjectModel(base);
    expect(pm.model.panels).toEqual(pb.model.panels);
    expect(pm.materials).toEqual(pb.materials);
    const shop = (x: Project) =>
      shoppingList({
        rows: projectCutlist(x),
        materials: buildProjectModel(x).materials,
        hardware: projectHardware(x),
        sheets: null,
      });
    expect(shop(p)).toEqual(shop(base));
    expect(JSON.stringify(shop(p))).not.toContain('Fridge');
    expect(pm.models).toEqual([{ item: p.models![0], box: modelBox(p.models![0]) }]);
    // The drawing is framed around the model; the parts' overall size (printed) is not.
    expect(pm.extent.x + pm.extent.w).toBe(3600);
    expect(pm.model.bounds).toEqual(pb.model.bounds);
  });
  it('their boxes are checked: overlap with pieces and models, room walls, openings', () => {
    const chest = makeItem(newProject(), t('chest'));
    const base = { ...newProject(), items: [chest] };
    const codes = (p: Project) => buildProjectModel(p).diagnostics.map((d) => d.code);
    // Touching is fine; overlapping a piece or another model is an error.
    const w = buildProjectModel(base).pieces[0].bounds.w;
    expect(codes(withModel(base, fridge({ position: { x: w, y: 0, z: 0 } })))).not.toContain(
      'model-overlap',
    );
    const over = buildProjectModel(withModel(base, fridge({ position: { x: 100, y: 0, z: 0 } })));
    expect(over.diagnostics.find((d) => d.code === 'model-overlap')).toMatchObject({
      severity: 'error',
      nodeId: 'm1',
    });
    expect(
      codes(
        withModel(
          { ...base, items: [] },
          fridge(),
          fridge({ id: 'm2', position: { x: 300, y: 0, z: 0 } }),
        ),
      ),
    ).toContain('model-overlap');
    // A run part (here a worktop) over a model.
    const worktop = {
      id: 'w',
      kind: 'worktop' as const,
      label: 'Worktop',
      reason: '',
      box: { x: 0, y: 850, z: 0, w: 1000, h: 38, d: 600 },
      material: worktopMaterial(),
      thicknessAxis: 'y' as const,
      grainAxis: 'x' as const,
      banded: [],
    };
    const under = buildProjectModel(
      withModel({ ...base, items: [], runParts: [worktop] }, fridge()),
    ).diagnostics;
    expect(under.find((d) => d.code === 'model-overlap')?.message).toContain('Worktop');
    // The room: a model through a wall or taller than the room.
    const room = {
      height: 1500,
      outline: shapeOutline('rectangle', {
        width: 3000,
        depth: 2000,
        cutWidth: 0,
        cutDepth: 0,
        offset: 0,
      }),
      features: [],
    };
    const inRoom = withModel(
      { ...base, items: [], room },
      fridge({ position: { x: 2800, y: 0, z: 0 } }),
    );
    expect(codes(inRoom)).toContain('outside-room');
    // An opening that swings into a model is reported.
    const door = makeItem(newProject(), t('base-door'));
    const blocked = withModel(
      { ...base, items: [door] },
      fridge({ position: { x: 0, y: 0, z: 600 } }),
    );
    expect(buildProjectModel(blocked).diagnostics.some((d) => d.message.includes('Fridge'))).toBe(
      true,
    );
  });
});

describe('3D model storage (ADR-076)', () => {
  const row = (id: string) => ({
    id,
    name: 'Fridge',
    format: 'glb' as const,
    bytes: cubeGlb().slice().buffer,
    size: { w: 600, h: 600, d: 600 },
    triangles: 12,
    createdAt: new Date().toISOString(),
  });
  it('a model a project still uses cannot be deleted; an unused one can', async () => {
    await saveModel(row('mdl-used'));
    await saveModel(row('mdl-free'));
    await saveModel(row('mdl-open'));
    const p = withModel(newProject('Kitchen'), fridge({ modelId: 'mdl-used' }));
    await saveProject(p);
    expect(await deleteModelIfUnused('mdl-used')).toEqual({ deleted: false, usedBy: ['Kitchen'] });
    expect(await loadModel('mdl-used')).toBeDefined();
    // A saved project the app cannot read still keeps its models.
    await db.projects.put({
      id: 'broken',
      name: 'Broken',
      updatedAt: 'x',
      project: { nope: 'mdl-free' } as never,
    });
    expect((await deleteModelIfUnused('mdl-free')).deleted).toBe(false);
    await db.projects.delete('broken');
    expect((await deleteModelIfUnused('mdl-free')).deleted).toBe(true);
    expect(await loadModel('mdl-free')).toBeUndefined();
    // The open project (not saved yet) protects its models too.
    expect((await deleteModelIfUnused('mdl-open', ['mdl-open'])).deleted).toBe(false);
  });
  it('export embeds the models; import stores them under new ids and re-points the items', async () => {
    const sink = { ...row('mdl-x'), name: 'Sink', bytes: cubeGlb(0.5).slice().buffer };
    await saveModel(sink);
    const p = withModel(newProject('Export'), fridge({ modelId: 'mdl-x' }));
    const file = JSON.parse(JSON.stringify(await withModels(p)));
    expect(file.models3d).toHaveLength(1);
    expect(validateProject(file)).toEqual([]);
    // On this device the same file is already stored: it is reused, not stored twice.
    expect(((await takeModels(file)).data as Project).models![0].modelId).toBe('mdl-x');
    // On another device (the model is not there): stored under a new id, the item points at it.
    await db.models.delete('mdl-x');
    const { data, problems } = await takeModels(file);
    expect(problems).toEqual([]);
    const back = data as Project & { models3d?: unknown };
    expect(back.models3d).toBeUndefined();
    const newId = back.models![0].modelId;
    expect(newId).not.toBe('mdl-x');
    const stored = await loadModel(newId);
    expect(new Uint8Array(stored!.bytes)).toEqual(cubeGlb(0.5));
    expect(stored!.name).toBe('Sink');
    expect(validateProject(back)).toEqual([]);
    expect(((await takeModels(file)).data as Project).models![0].modelId).toBe(newId);
  });
  it('a bad embedded model is skipped and reported; the project still opens', async () => {
    const p = withModel(newProject('Bad'), fridge({ modelId: 'mdl-gone' }));
    const outside = gltfText({
      asset: { version: '2.0' },
      meshes: [{ primitives: [] }],
      buffers: [{ uri: 'https://example.com/a.bin' }],
    });
    const file = {
      ...p,
      models3d: [
        {
          id: 'mdl-gone',
          name: 'Evil',
          format: 'gltf',
          size: { w: 1, h: 1, d: 1 },
          data: b64(outside),
        },
        { id: 'x', name: 'Junk', format: 'glb', size: { w: 1, h: 1, d: 1 }, data: '***' },
        { nope: true },
      ],
    };
    const { data, problems } = await takeModels(file);
    expect(problems).toHaveLength(3);
    expect(problems[0]).toMatch(/outside it/);
    expect((data as Project).models![0].modelId).toBe('mdl-gone');
    expect(validateProject(data)).toEqual([]);
  });
  it('a version-7 database upgrades to version 8 with every row kept', async () => {
    const name = 'upgrade-v7-v8';
    const old = new Dexie(name);
    old.version(7).stores({
      designs: 'id, updatedAt, name',
      projects: 'id, updatedAt, name',
      templates: 'id, updatedAt',
      researchDocs: 'key, docId',
      researchMarks: 'id, updatedAt',
      images: 'id',
      decors: 'id',
      projectTemplates: 'id, updatedAt, name',
      prices: 'id',
    });
    await old.open();
    await old.table('projects').put({ id: 'p1', name: 'Old', updatedAt: 'x', project: { a: 1 } });
    await old.table('prices').put({ id: 'pr' });
    old.close();
    const Fresh = db.constructor as new (n: string) => typeof db;
    const nw = new Fresh(name);
    await nw.open();
    expect(nw.verno).toBe(9);
    expect(await nw.projects.get('p1')).toMatchObject({ project: { a: 1 } });
    expect(await nw.prices.get('pr')).toBeDefined();
    expect(await nw.models.count()).toBe(0);
    nw.close();
  });
});
