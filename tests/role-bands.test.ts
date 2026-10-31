// Edge bands per role and per part, and run parts in the Material dialog (ADR-168).
import { describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { cutlist } from '../src/core/cutlist';
import { templates, validateDesign } from '../src/core/design';
import { applyMaterial, putRoleBoards, putRunBoard } from '../src/core/finish';
import {
  makeItem,
  newProject,
  refreshRunParts,
  requestKey,
  suggestRunParts,
  type Project,
  type RunPart,
} from '../src/core/project';
import type { Design, EdgeBand, Material } from '../src/core/types';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
const ABS2: EdgeBand = { kind: 'abs', thickness: 20, width: 22 };
const PVC1: EdgeBand = { kind: 'pvc', thickness: 10, width: 23, code: 'W1000' };
const NARROW: EdgeBand = { kind: 'abs', thickness: 8, width: 10 };
const oak: Material = { id: 'o', name: 'Oak veneer', thickness: 18, grain: true, color: '#c9a36b' };
const rowBand = (d: Design, label: string) =>
  cutlist(buildModel(d), d.materials).find((r) => r.labels.some((l) => l.startsWith(label)))?.band;

function run(): Project {
  let p = newProject('Bands');
  for (const d of [t('base-door'), t('base-door')])
    p = { ...p, items: [...p.items, makeItem(p, d)] };
  return { ...p, runParts: suggestRunParts(p) };
}

describe('edge band per role and per part (ADR-168)', () => {
  it('part › role › board in the cut list; a narrow band is the band-narrow error; a lost part warns', () => {
    const d = t('chest');
    expect(rowBand(d, 'Drawer front')).toBeUndefined();
    const withRole = putRoleBoards(
      d,
      ['front'],
      d.materials.find((m) => m.id === 'pal18')!,
      ABS2,
    ).design;
    expect(rowBand(withRole, 'Drawer front')).toEqual(ABS2);
    expect(rowBand(withRole, 'Left side')).toBeUndefined();
    const side = buildModel(d).panels.find((p) => p.label === 'Left side')!;
    const withPart: Design = { ...withRole, partBands: { [side.id]: PVC1 } };
    expect(rowBand(withPart, 'Left side')).toEqual(PVC1);
    expect(rowBand(withPart, 'Right side')).toBeUndefined();
    // Carcass band reaches the sides; a side's own role band wins over it.
    const body: Design = { ...d, schemaVersion: 7, roleBands: { body: ABS2, side: PVC1 } };
    expect(rowBand(body, 'Top')).toEqual(ABS2);
    expect(rowBand(body, 'Left side')).toEqual(PVC1);
    expect(validateDesign(withPart)).toEqual([]);
    const narrow: Design = { ...d, schemaVersion: 7, roleBands: { front: NARROW } };
    expect(buildModel(narrow).diagnostics.map((x) => x.code)).toContain('band-narrow');
    const lost: Design = { ...d, schemaVersion: 7, partBands: { 'gone/side': ABS2 } };
    expect(buildModel(lost).diagnostics.map((x) => x.code)).toContain('part-band-lost');
    expect(lost.partBands).toEqual({ 'gone/side': ABS2 });
  });

  it('are validated: unknown roles, bad bands and the fields in a version-6 file', () => {
    const d = t('chest');
    expect(validateDesign({ ...d, schemaVersion: 7, roleBands: { door: ABS2 } })).toContain(
      'Invalid band for door',
    );
    expect(
      validateDesign({
        ...d,
        schemaVersion: 7,
        roleBands: { front: { kind: 'abs', thickness: 0, width: 22 } },
      }),
    ).toContain('Invalid band for front');
    expect(validateDesign({ ...d, schemaVersion: 6, roleBands: { front: ABS2 } })).toContain(
      'Role and part bands need schemaVersion 7',
    );
    expect(validateDesign({ ...d, schemaVersion: 6 })).toEqual([]);
  });
});

describe('run parts in the Material dialog (ADR-168)', () => {
  it('Item reaches the worktop made from it; the board and band stay after a refresh', () => {
    const p = run();
    const wt = p.runParts!.find((r) => r.kind === 'worktop')!;
    expect(wt.from).toContain(p.items[0].id);
    const r = applyMaterial(p, p.items[0].id, ['run-worktop'], oak, 'item', undefined, ABS2);
    expect(r.applied).toContain('Worktop');
    const got = r.project.runParts!.find((x) => x.id === wt.id)!;
    expect([got.material.name, got.material.id, got.material.band]).toEqual([
      'Oak veneer',
      wt.material.id,
      ABS2,
    ]);
    const auto = { ...r.project, runSettings: { scribe: 0, auto: true } };
    const moved = {
      ...auto,
      items: auto.items.map((it) => ({
        ...it,
        position: { ...it.position, x: it.position.x + 10 },
      })),
    };
    expect(refreshRunParts(moved).runParts!.find((x) => x.kind === 'worktop')!.material.name).toBe(
      'Oak veneer',
    );
    // A role the item has no run part for is skipped with the reason.
    expect(applyMaterial(p, p.items[0].id, ['run-trim'], oak, 'item').skipped).toEqual([
      'no trims',
    ]);
  });

  it("a trim's request board changes with it, so a refresh keeps it", () => {
    const p = run();
    const trim: RunPart = {
      ...p.runParts![0],
      id: 'crown-1',
      kind: 'crown',
      key: `crown|${p.items.map((i) => i.id).join(',')}`,
      label: 'Crown',
    };
    const withTrim: Project = {
      ...p,
      runParts: [...p.runParts!, trim],
      runRequests: [
        { kind: 'crown', from: p.items.map((i) => i.id), height: 60, material: trim.material },
      ],
    };
    const got = putRunBoard(withTrim, [trim], oak);
    expect(got.runParts!.find((x) => x.id === 'crown-1')!.material.name).toBe('Oak veneer');
    const req = got.runRequests!.find((r) => requestKey(r) === trim.key)!;
    expect(req.material!.name).toBe('Oak veneer');
  });
});
