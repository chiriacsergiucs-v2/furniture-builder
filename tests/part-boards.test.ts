import { describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { templates, validateDesign } from '../src/core/design';
import type { Design } from '../src/core/types';

const chest = () => templates.find((t) => t.id === 'chest')!.create();

describe('a board per part (partMaterials, schemaVersion 4)', () => {
  it('gives only that part its own board', () => {
    const d = chest();
    const left = buildModel(d).panels.find((p) => p.label === 'Left side')!;
    const right = buildModel(d).panels.find((p) => p.label === 'Right side')!;
    const next: Design = { ...d, partMaterials: { [left.id]: 'pal18oak' } };
    expect(validateDesign(next)).toEqual([]);
    const m = buildModel(next);
    expect(m.panels.find((p) => p.id === left.id)!.materialId).toBe('pal18oak');
    expect(m.panels.find((p) => p.id === right.id)!.materialId).toBe(right.materialId);
    expect(m.diagnostics.some((x) => x.severity === 'error')).toBe(false);
  });

  it('flags a board of another thickness as an error', () => {
    const d = chest();
    const left = buildModel(d).panels.find((p) => p.label === 'Left side')!;
    const m = buildModel({ ...d, partMaterials: { [left.id]: 'pal16' } });
    expect(m.diagnostics.some((x) => x.code === 'thickness' && x.panelIds?.includes(left.id))).toBe(
      true,
    );
  });

  it('warns about a part that no longer exists, never drops it', () => {
    const d: Design = { ...chest(), partMaterials: { 'gone/side': 'pal18oak' } };
    expect(validateDesign(d)).toEqual([]);
    const m = buildModel(d);
    expect(m.diagnostics.find((x) => x.code === 'part-board-lost')?.severity).toBe('warning');
    expect(d.partMaterials).toEqual({ 'gone/side': 'pal18oak' });
  });

  it('rejects an unknown board and part boards in an older file', () => {
    const d = chest();
    expect(validateDesign({ ...d, partMaterials: { x: 'nope' } }).join()).toMatch(/unknown/);
    expect(
      validateDesign({ ...d, schemaVersion: 3, partMaterials: { x: 'pal18' } }).join(),
    ).toMatch(/schemaVersion 4/);
  });
});
