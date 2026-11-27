// ADR-300 (G-422): merge an assembly step with the next one — one step with both steps' parts, saved with the
// design's step order (schemaVersion 13), undone by Reset the steps; old designs load unchanged.
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  assemblySteps,
  mergeStep,
  moveStep,
  renameStep,
  stepInstruction,
  stepPanelIds,
  stepTitle,
} from '../src/core/assembly';
import { buildModel } from '../src/core/build';
import { SCHEMA_VERSION, templates, upgradeDesign, validateDesign } from '../src/core/design';
import { fastenerCounts } from '../src/core/fasteners';
import { buildProjectModel, newProject, makeItem, validateProject } from '../src/core/project';
import type { Design } from '../src/core/types';
import { useDesign } from '../src/store/designStore';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
const st = () => useDesign.getState();
const partIds = (s: { parts: { panelIds: string[] }[] }) => s.parts.flatMap((p) => p.panelIds);

describe('merge assembly steps (ADR-300)', () => {
  const model = () => buildModel(t('base-door'));

  it('merging two neighbouring steps gives one step with both parts, titles and instructions; numbers follow', () => {
    const m = model();
    const steps = assemblySteps(m);
    const i = steps.findIndex((s) => s.id === 'bottom');
    const [a, b] = [steps[i], steps[i + 1]];
    const edit = mergeStep(steps, a.id)!;
    expect(edit.merged).toEqual([b.id]);
    const merged = assemblySteps(m, edit);
    expect(merged).toHaveLength(steps.length - 1);
    const one = merged[i];
    expect(one.id).toBe(a.id);
    expect(partIds(one)).toEqual([...partIds(a), ...partIds(b)]);
    expect(one.joints).toBe(a.joints + b.joints);
    expect(stepTitle(one, 'app')).toBe(`${a.title} + ${b.title}`);
    expect(stepTitle(one, 'print')).toBe(`${stepTitle(a, 'print')} + ${stepTitle(b, 'print')}`);
    expect(stepInstruction(one, 'app')).toBe(
      `${stepInstruction(a, 'app')} ${stepInstruction(b, 'app')}`,
    );
    expect(merged.map((s) => s.n)).toEqual(merged.map((_, k) => k + 1));
    // Every panel still in exactly one step; the fasteners still add up to ADR-074's totals.
    const all = merged.flatMap(stepPanelIds);
    expect(new Set(all).size).toBe(all.length);
    expect(all.sort()).toEqual(m.panels.map((p) => p.id).sort());
    const totals = new Map<string, number>();
    for (const s of merged)
      for (const f of s.fasteners) totals.set(f.joint, (totals.get(f.joint) ?? 0) + f.count);
    for (const c of fastenerCounts(m)) expect(totals.get(c.joint) ?? 0).toBe(c.count);
  });

  it('the last step cannot merge; merging again joins a third step; move and rename keep the merge', () => {
    const m = model();
    const steps = assemblySteps(m);
    expect(mergeStep(steps, steps.at(-1)!.id)).toBeNull();
    const e1 = mergeStep(steps, steps[0].id)!;
    const s1 = assemblySteps(m, e1);
    const e2 = mergeStep(s1, s1[0].id, e1)!;
    const s2 = assemblySteps(m, e2);
    expect(s2).toHaveLength(steps.length - 2);
    expect(s2[0].from?.map((x) => x.id)).toEqual(steps.slice(0, 3).map((s) => s.id));
    // Moving the merged step down moves the whole of it.
    const down = assemblySteps(m, moveStep(s2, s2[0].id, 1, e2)!);
    expect(down[0].id).toBe(s2[1].id);
    expect(down[1].from?.map((x) => x.id)).toEqual(steps.slice(0, 3).map((s) => s.id));
    // Renaming keeps the merge.
    const named = renameStep(s2, s2[0].id, 'Start', e2);
    expect(named.merged).toEqual(e2.merged);
    expect(stepTitle(assemblySteps(m, named)[0], 'app')).toBe('Start');
  });

  it('a merged step listed first stays on its own; unknown ids are ignored', () => {
    const m = model();
    const steps = assemblySteps(m);
    const first = assemblySteps(m, { order: steps.map((s) => s.id), merged: [steps[0].id] });
    expect(first.map((s) => s.id)).toEqual(steps.map((s) => s.id));
    const unknown = assemblySteps(m, { order: [], merged: ['nope' as never] });
    expect(unknown.map((s) => s.id)).toEqual(steps.map((s) => s.id));
  });

  it('design 13 validates merged steps; design 12 files load unchanged and refuse them', () => {
    expect(SCHEMA_VERSION).toBe(13);
    const base = t('base-door');
    const v12 = {
      ...base,
      schemaVersion: 12,
      assembly: { order: ['bottom', 'prepare'] },
    } as Design;
    expect(validateDesign(v12)).toEqual([]);
    expect(upgradeDesign(v12).assembly).toEqual(v12.assembly);
    expect(assemblySteps(buildModel(v12), v12.assembly).map((s) => s.id)).toEqual(
      assemblySteps(buildModel(base), { order: ['bottom', 'prepare'] }).map((s) => s.id),
    );
    const merged = { ...base, assembly: { order: ['bottom'], merged: ['sides'] } } as Design;
    expect(validateDesign(merged)).toEqual([]);
    expect(validateDesign({ ...merged, schemaVersion: 12 })).toContain(
      'Merged assembly steps need schemaVersion 13',
    );
    expect(validateDesign({ ...base, assembly: { order: [], merged: 'x' } })).toContain(
      'Invalid merged assembly steps',
    );
    expect(validateDesign({ ...base, assembly: { order: [], merged: ['a', 'a'] } })).toContain(
      'Invalid merged assembly steps',
    );
  });

  it('store: saved with the design (version 13) in one undo step; Reset the steps restores the generated steps', () => {
    const p = newProject('Merge');
    const it0 = makeItem(p, t('base-door'));
    st().openProject({ ...p, items: [it0] });
    const a = st().project!.items[0].id;
    const m = buildProjectModel(st().project!).pieces[0].model;
    const steps = assemblySteps(m);
    const edit = mergeStep(steps, steps[1].id)!;
    const n = st().projectPastNames.length;
    st().setAssembly(a, edit, 'Merge with the next step');
    expect(st().projectPastNames).toHaveLength(n + 1);
    const d = st().project!.items[0].design;
    expect(d.assembly).toEqual(edit);
    expect(d.schemaVersion).toBe(13);
    expect(validateProject(st().project!)).toEqual([]);
    expect(assemblySteps(m, d.assembly)).toHaveLength(steps.length - 1);
    st().setAssembly(a, undefined, 'Reset the steps');
    const reset = st().project!.items[0].design;
    expect('assembly' in reset).toBe(false);
    expect(assemblySteps(m, reset.assembly).map((s) => s.id)).toEqual(steps.map((s) => s.id));
  });
});
