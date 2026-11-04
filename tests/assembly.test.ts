// ADR-174: assembly steps per piece — every panel in exactly one step, the order rules, joint counts summing to
// ADR-074's, hardware matching the schedule, the guidance line in every print language.
import { describe, expect, it } from 'vitest';
import { ASSEMBLY_GUIDANCE, assemblySteps, STEP_ORDER } from '../src/core/assembly';
import { buildModel } from '../src/core/build';
import { templates } from '../src/core/design';
import { fastenerCounts } from '../src/core/fasteners';
import { PRINT_EN, PRINT_RU } from '../src/core/i18n/print-text';
import { makeItem, newProject, buildProjectModel } from '../src/core/project';

const GUIDANCE_RO =
  'Îndrumare: ordinea rezultă din pozițiile pieselor; îmbinările, elementele de fixare și găurirea sunt alegerea dumneavoastră.';

describe('assemblySteps (ADR-174)', () => {
  it('for every catalog template, every panel is in exactly one step and the steps follow STEP_ORDER', () => {
    for (const tpl of templates) {
      const model = buildModel(tpl.create());
      const steps = assemblySteps(model);
      const ids = steps.flatMap((s) => s.parts.flatMap((p) => p.panelIds));
      expect(new Set(ids).size, tpl.id).toBe(ids.length);
      expect(ids.length, tpl.id).toBe(model.panels.length);
      const order = steps.map((s) => STEP_ORDER.indexOf(s.id));
      expect(
        [...order].sort((a, b) => a - b),
        tpl.id,
      ).toEqual(order);
      expect(
        steps.map((s) => s.n),
        tpl.id,
      ).toEqual(steps.map((_, i) => i + 1));
      // The hardware of the schedule, all of it, by quantity.
      const scheduled = model.hardware.reduce((n, h) => n + h.quantity, 0);
      const listed = steps.flatMap((s) => s.hardware).reduce((n, h) => n + h.quantity, 0);
      expect(listed, tpl.id).toBe(scheduled);
      // Joints per step sum to ADR-074's carcass joints.
      const joints = fastenerCounts(model).find((c) => c.joint === 'carcass-joint')!.count;
      expect(
        steps.reduce((n, s) => n + s.joints, 0),
        tpl.id,
      ).toBe(joints);
    }
  });
  it('a base cabinet: bottom before sides before top before back before fronts; the drawer chest puts boxes before fronts', () => {
    const base = assemblySteps(buildModel(templates.find((x) => x.id === 'base-door')!.create()));
    const at = (id: string) => base.findIndex((s) => s.id === id);
    expect(at('bottom')).toBeLessThan(at('sides'));
    expect(at('sides')).toBeLessThan(at('top'));
    expect(at('top')).toBeLessThan(at('back'));
    expect(at('back')).toBeLessThan(at('fronts'));
    expect(base.find((s) => s.id === 'sides')!.parts.reduce((n, p) => n + p.quantity, 0)).toBe(2);
    expect(base.find((s) => s.id === 'sides')!.joints).toBeGreaterThan(0);
    expect(base.find((s) => s.id === 'fronts')!.hardware.some((h) => h.kind === 'hinge')).toBe(
      true,
    );
    const chest = assemblySteps(buildModel(templates.find((x) => x.id === 'chest')!.create()));
    const c = (id: string) => chest.findIndex((s) => s.id === id);
    expect(c('drawers')).toBeGreaterThan(-1);
    expect(c('drawers')).toBeLessThan(c('fronts'));
    expect(
      chest.find((s) => s.id === 'drawers')!.hardware.some((h) => h.kind === 'drawer-runner-pair'),
    ).toBe(true);
    // Adjustable shelves (with pins) come after the carcass.
    const shelves = assemblySteps(buildModel(templates.find((x) => x.id === 'bookcase')!.create()));
    const s = (id: string) => shelves.findIndex((x) => x.id === id);
    if (s('adjustable') >= 0) expect(s('adjustable')).toBeGreaterThan(s('back'));
  });
  it('a panel set and frame furniture get one "loose parts" step with no order claimed', () => {
    const panels = templates.find((x) => x.id === 'panels');
    if (panels) {
      const steps = assemblySteps(buildModel(panels.create()));
      expect(steps.filter((s) => s.parts.length).map((s) => s.id)).toEqual(['loose']);
    }
  });
  it('a project piece: steps from its own model; the guidance line exists in ro, ru and en', () => {
    let p = newProject('A');
    p = { ...p, items: [makeItem(p, templates.find((x) => x.id === 'base-door')!.create())] };
    const pm = buildProjectModel(p);
    const steps = assemblySteps(pm.pieces[0].model);
    expect(steps.length).toBeGreaterThan(3);
    expect(ASSEMBLY_GUIDANCE).toMatch(/^Guidance:/);
    expect(PRINT_RU[GUIDANCE_RO]).toMatch(/^Рекомендация/);
    expect(PRINT_EN[GUIDANCE_RO]).toMatch(/^Guidance:/);
  });
});
