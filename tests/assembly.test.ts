// ADR-174: assembly steps per piece — every panel in exactly one step, the order rules, joint counts summing to
// ADR-074's, hardware matching the schedule, the guidance line in every print language.
// ADR-185: print language for part and hardware names, fasteners per step summing to ADR-074's totals, hardware
// halves at the side step, a final fit step. ADR-186: identical drawer boxes once, an instruction per step in en, ro
// and ru with the square check at the back, a preparation step from what the model holds.
// ADR-178: the project-level order — corner cabinets, base pieces wall by wall from the corner, wall pieces, run
// parts; deterministic; plan x without a room; none for a design alone; the printed section in ro, ru and en.
import { afterEach, describe, expect, it } from 'vitest';
import {
  ASSEMBLY_GUIDANCE,
  assemblySteps,
  boxTitle,
  fastenerLines,
  hardwareLine,
  partName,
  prepLines,
  PROJECT_STAGE_ORDER,
  projectAssemblyOrder,
  projectOrderPrint,
  STEP_ORDER,
  stepInstruction,
  stepPanelIds,
  stepTitle,
  type AssemblyStep,
} from '../src/core/assembly';
import { buildModel } from '../src/core/build';
import { templates } from '../src/core/design';
import { fastenerCounts, JOINTS, type FastenerChoice } from '../src/core/fasteners';
import { setPrintLang } from '../src/core/i18n/print';
import { PRINT_EN, PRINT_RU } from '../src/core/i18n/print-text';
import {
  makeItem,
  newProject,
  buildProjectModel,
  suggestRunParts,
  type Project,
} from '../src/core/project';
import { shapeOutline, type Room } from '../src/core/room';
import { suggestRoomMixes } from '../src/core/roomfill';

const GUIDANCE_RO =
  'Îndrumare: ordinea rezultă din pozițiile pieselor; îmbinările, elementele de fixare și găurirea sunt alegerea dumneavoastră.';

describe('assemblySteps (ADR-174)', () => {
  it('for every catalog template, every panel is in exactly one step and the steps follow STEP_ORDER', () => {
    for (const tpl of templates) {
      const model = buildModel(tpl.create());
      const steps = assemblySteps(model);
      const ids = steps.flatMap(stepPanelIds);
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
      // The hardware of the schedule, all of it, by quantity (Fit hardware to the sides repeats runner pairs' and
      // hinges' other halves, ADR-185).
      const scheduled = model.hardware.reduce((n, h) => n + h.quantity, 0);
      const listed = steps
        .filter((s) => s.id !== 'fit-hardware')
        .flatMap((s) => s.hardware)
        .reduce((n, h) => n + h.quantity, 0);
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
    expect(at('fronts')).toBeLessThan(at('fit'));
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

const tpl = (id: string) => buildModel(templates.find((x) => x.id === id)!.create());
const step = (steps: AssemblyStep[], id: string) => steps.find((s) => s.id === id)!;
const CONFIRMAT: FastenerChoice = { joint: 'carcass-joint', name: 'Confirmat 7 × 50', per: 2 };

describe('assembly steps: fasteners, hardware halves, print language (ADR-185)', () => {
  afterEach(() => setPrintLang('ro'));

  it('for every template, per-step fasteners add up to ADR-074’s totals for each joint type', () => {
    for (const t of templates) {
      const model = buildModel(t.create());
      const steps = assemblySteps(model);
      for (const j of JOINTS) {
        const total = fastenerCounts(model).find((c) => c.joint === j.id)!.count;
        const perStep = steps
          .flatMap((s) => s.fasteners)
          .filter((f) => f.joint === j.id)
          .reduce((n, f) => n + f.count, 0);
        expect(perStep, `${t.id} ${j.id}`).toBe(total);
      }
    }
  });

  it('Sides to the bottom of a base cabinet: "4 × {name}" with a fastener per 2, else "choose your fastener"', () => {
    const sides = step(assemblySteps(tpl('base-door')), 'sides');
    expect(sides.joints).toBe(2);
    expect(fastenerLines(sides, [CONFIRMAT], 'app')[0]).toMatch(/^4 × Confirmat 7 × 50/);
    const none = fastenerLines(sides, [], 'app');
    expect(none).toHaveLength(1);
    expect(none[0]).toMatch(/choose your fastener/);
    // Back, plinth and hanging steps carry their own fixings.
    const base = assemblySteps(tpl('base-door'));
    expect(step(base, 'back').fasteners).toEqual([{ joint: 'back-fixing', count: 1 }]);
    expect(step(base, 'plinth').fasteners).toEqual([{ joint: 'foot', count: 1 }]);
    const wall = assemblySteps(tpl('wall-cabinet'));
    expect(step(wall, 'hang').fasteners).toEqual([{ joint: 'hanging-point', count: 2 }]);
    // The print says it in the print language.
    setPrintLang('ro');
    expect(fastenerLines(sides, [], 'print')[0]).toMatch(
      /^2 îmbinări — alegeți elementul de fixare/,
    );
    expect(fastenerLines(sides, [CONFIRMAT], 'print')[0]).toMatch(
      /^4 × Confirmat 7 × 50 \(2 îmbinări × 2\)/,
    );
  });

  it('a base cabinet: Fit hardware to the sides (hinge plates) before the carcass, Fit drawers and doors last', () => {
    const steps = assemblySteps(tpl('base-door'));
    const carcass = steps.filter((s) => s.id !== 'prepare');
    expect(carcass[0].id).toBe('fit-hardware');
    expect(carcass[0].title).toBe('Fit hardware to the sides');
    expect(carcass[0].hardware.map((h) => [h.kind, h.half])).toEqual([['hinge', 'plate']]);
    expect(hardwareLine(carcass[0].hardware[0], 'app')).toMatch(/— mounting plates$/);
    expect(step(steps, 'fronts').hardware.find((h) => h.kind === 'hinge')!.half).toBe('door');
    const last = steps[steps.length - 1];
    expect(last.id).toBe('fit');
    expect(last.title).toBe('Fit drawers and doors, adjust the fronts');
    expect(last.again.map((p) => p.label)).toEqual(['Door']);
  });

  it('a chest: the runner pairs in the side step (carcass halves) and in Drawer boxes (drawer halves)', () => {
    const steps = assemblySteps(tpl('chest'));
    const side = step(steps, 'fit-hardware').hardware;
    const box = step(steps, 'drawers').hardware;
    expect(side).toEqual([
      expect.objectContaining({ kind: 'drawer-runner-pair', quantity: 4, half: 'carcass' }),
    ]);
    expect(box).toEqual([
      expect.objectContaining({ kind: 'drawer-runner-pair', quantity: 4, half: 'drawer' }),
    ]);
    expect(steps.findIndex((s) => s.id === 'fit-hardware')).toBeLessThan(
      steps.findIndex((s) => s.id === 'sides'),
    );
    expect(steps[steps.length - 1].id).toBe('fit');
  });

  it('the Romanian, Russian and English prints name parts and hardware in that language', () => {
    const steps = assemblySteps(tpl('chest'));
    const sides = step(steps, 'sides');
    const runner = step(steps, 'drawers').hardware[0];
    const words = (s: AssemblyStep) => [
      ...s.parts.map((p) => partName(p.label, 'print')),
      ...s.boxes.flatMap((b) => b.parts.map((p) => partName(p.label, 'print'))),
    ];
    setPrintLang('ro');
    expect(words(sides)).toEqual(['Lateral stânga', 'Lateral dreapta']);
    expect(words(step(steps, 'drawers'))).toContain('Lateral sertar');
    expect(hardwareLine(runner, 'print')).toBe(
      '4 × Pereche glisiere cu bile, montaj lateral — jumătățile de sertar',
    );
    expect(stepTitle(sides, 'print')).toBe('Laturile pe fund');
    setPrintLang('ru');
    expect(words(sides)).toEqual(['Боковина левая', 'Боковина правая']);
    expect(words(step(steps, 'drawers'))).toContain('Боковина ящика');
    expect(hardwareLine(runner, 'print')).toBe(
      '4 × Пара шариковых направляющих, боковой монтаж — ящичные половинки',
    );
    setPrintLang('en');
    expect(words(sides)).toEqual(['Left side', 'Right side']);
    expect(hardwareLine(runner, 'print')).toBe(
      '4 × Ball-bearing runner pair, side mount — drawer halves',
    );
    expect(stepTitle(sides, 'print')).toBe('Sides to the bottom');
  });
});

describe('assembly steps: grouped drawers, instructions, preparation (ADR-186)', () => {
  afterEach(() => setPrintLang('ro'));

  it('a chest of 4 equal drawers shows "Drawer box × 4" with one box’s parts; unequal drawers stay apart', () => {
    const model = tpl('chest');
    const drawers = step(assemblySteps(model), 'drawers');
    expect(drawers.parts).toEqual([]);
    expect(drawers.boxes).toHaveLength(1);
    const [box] = drawers.boxes;
    expect(box.times).toBe(4);
    expect(boxTitle(box, 'app')).toBe('Drawer box × 4');
    // One box: bottom, two sides (one row, × 2), back, inner front — 5 parts.
    expect(box.parts.map((p) => [p.label, p.quantity])).toEqual([
      ['Drawer bottom', 1],
      ['Drawer side', 2],
      ['Drawer back', 1],
      ['Drawer inner front', 1],
    ]);
    expect(box.parts.reduce((n, p) => n + p.quantity, 0)).toBe(5);
    // Every box's panels stay in the step (Show step lights all of them).
    expect(box.parts.flatMap((p) => p.panelIds)).toHaveLength(20);
    // A lower fourth drawer box is its own entry.
    const unequal = {
      ...model,
      panels: model.panels.map((p) =>
        /^Drawer 4 (side|back|inner front)$/.test(p.label)
          ? { ...p, box: { ...p.box, h: 120 } }
          : p,
      ),
    };
    const boxes = step(assemblySteps(unequal), 'drawers').boxes;
    expect(boxes.map((b) => b.times).sort()).toEqual([1, 3]);
    setPrintLang('ro');
    expect(boxTitle(box, 'print')).toBe('Corp de sertar × 4');
  });

  it('every step of every template has an instruction in en, ro and ru; the Back step’s has the square check', () => {
    for (const t of templates) {
      const steps = assemblySteps(buildModel(t.create()));
      for (const s of steps) {
        expect(stepInstruction(s, 'app'), `${t.id} ${s.id}`).toMatch(/^\S.*\.$/);
        for (const l of ['ro', 'ru', 'en'] as const) {
          setPrintLang(l);
          expect(stepInstruction(s, 'print'), `${t.id} ${s.id} ${l}`).toMatch(/^\S.*\.$/);
        }
      }
    }
    const base = assemblySteps(tpl('base-door'));
    expect(stepInstruction(step(base, 'sides'), 'app')).toBe(
      'Fix the left side and right side to the bottom (2 joints).',
    );
    const back = step(base, 'back');
    expect(stepInstruction(back, 'app')).toContain(
      'Check the carcass is square (equal diagonals) before fixing the back.',
    );
    setPrintLang('ro');
    expect(stepInstruction(back, 'print')).toContain(
      'Verificați că corpul este în echer (diagonale egale) înainte de a fixa spatele.',
    );
    setPrintLang('ru');
    expect(stepInstruction(back, 'print')).toContain('диагонали равны');
    setPrintLang('en');
    expect(stepInstruction(back, 'print')).toContain(
      'Check the carcass is square (equal diagonals) before fixing the back.',
    );
  });

  it('a base cabinet starts with Prepare the parts: banded edges and its hinge cups; a plain panel set has none', () => {
    const model = tpl('base-door');
    const steps = assemblySteps(model);
    expect(steps[0].id).toBe('prepare');
    expect(steps[0].title).toBe('Prepare the parts');
    const band = steps[0].prep.filter((x) => x.kind === 'band');
    expect(band.reduce((n, x) => n + (x.kind === 'band' ? x.part.quantity : 0), 0)).toBe(
      model.panels.filter((p) => p.banded.some((f) => f[1] !== p.thicknessAxis)).length,
    );
    const door = band.find((x) => x.kind === 'band' && x.part.label === 'Door');
    expect(door).toMatchObject({ long: 2, short: 2 });
    const cups = steps[0].prep.find((x) => x.kind === 'cups');
    expect(cups).toMatchObject({ count: 2 });
    const lines = prepLines(steps[0], 'app');
    expect(lines).toContain('1 × Door 618 × 598 × 18 mm — band 2 long edges and 2 short edges');
    expect(lines.some((l) => /^Hinge cups to drill: 2 — Hinge, 35 mm cup/.test(l))).toBe(true);
    // No drilling depth or position is added (ADR-010).
    expect(lines.join(' ')).not.toMatch(/depth|from the edge|mm deep/);
    setPrintLang('ro');
    expect(prepLines(steps[0], 'print')).toContain(
      '1 × Ușă 618 × 598 × 18 mm — cant pe 2 laturi lungi și 2 laturi scurte',
    );
    const panels = templates.find((x) => x.id === 'panels')!;
    const plain = buildModel(panels.create());
    expect(plain.panels.every((p) => !p.banded.length)).toBe(true);
    expect(assemblySteps(plain).some((s) => s.id === 'prepare')).toBe(false);
  });
});

/** An L room; walls 0 (back, x 0 → 3600) and 1 (right, z 0 → 1500) meet at the inside corner (3600, 0). */
const lRoom = (): Room => ({
  height: 2500,
  outline: shapeOutline('l-shape', {
    width: 3600,
    depth: 3000,
    cutWidth: 1500,
    cutDepth: 1500,
    offset: 0,
  }),
  features: [],
});

function lProject(): Project {
  const fill = suggestRoomMixes({
    room: lRoom(),
    depth: 560,
    minWidth: 400,
    maxWidth: 1200,
    walls: [0, 1],
  });
  expect(fill.mixes.length).toBeGreaterThan(0);
  const p = fill.mixes[0].project;
  return { ...p, runParts: suggestRunParts(p) };
}

/** A project without a room: A, B (linked to a fourth, also B), C on the floor out of order; a wall cabinet. */
function plainProject(): Project {
  let p = newProject('Plain');
  const base = templates.find((x) => x.id === 'base-door')!;
  const at = (name: string, x: number, linkId?: string) => {
    const it = makeItem(p, { ...base.create(), name });
    p = {
      ...p,
      items: [...p.items, { ...it, position: { x, y: 0, z: 0 }, ...(linkId ? { linkId } : {}) }],
    };
    return p.items[p.items.length - 1];
  };
  at('C', 2000);
  const a = at('A', 0);
  at('B', 1000, 'link-b');
  at('B', 3000, 'link-b');
  const wall = makeItem(p, {
    ...templates.find((x) => x.id === 'wall-cabinet')!.create(),
    name: 'W',
  });
  p = { ...p, items: [...p.items, wall] };
  const m = a.design.materials[0];
  const part = (id: string, kind: 'plinth' | 'worktop', x: number) => ({
    id,
    kind,
    label: kind === 'plinth' ? 'Plinth' : 'Worktop',
    reason: 'test',
    box:
      kind === 'plinth'
        ? { x, y: 0, z: 500, w: 600, h: 100, d: 18 }
        : { x, y: 900, z: 0, w: 600, h: 38, d: 600 },
    material: { ...m },
    thicknessAxis: kind === 'plinth' ? ('z' as const) : ('y' as const),
    grainAxis: 'x' as const,
    banded: [],
  });
  // Given worktop first, then plinths: the order puts plinths first.
  p = {
    ...p,
    runParts: [part('w1', 'worktop', 0), part('p2', 'plinth', 1000), part('p1', 'plinth', 0)],
    sinks: [{ id: 's1', baseId: a.id, w: 500, d: 400 }],
  };
  return p;
}

describe('projectAssemblyOrder (ADR-178)', () => {
  afterEach(() => setPrintLang('ro'));

  it('an L room: corner first, then each wall’s base pieces from the corner, then wall pieces, then run parts', () => {
    const p = lProject();
    const pm = buildProjectModel(p);
    const stages = projectAssemblyOrder(p, pm);
    const ids = stages.map((s) => s.id);
    expect(ids[0]).toBe('corners');
    expect(ids).toEqual(PROJECT_STAGE_ORDER.filter((s) => ids.includes(s)));
    expect(ids).toContain('base');
    expect(stages.map((s) => s.n)).toEqual(stages.map((_, i) => i + 1));
    const pc = (id: string) => pm.pieces.find((x) => x.item.id === id)!;
    // Corner cabinets: every corner piece, and only those.
    const corners = stages.find((s) => s.id === 'corners')!.entries.flatMap((e) => e.ids);
    expect(corners.length).toBeGreaterThan(0);
    expect(corners.every((id) => pc(id).item.design.product.kind === 'corner')).toBe(true);
    expect(corners).toHaveLength(p.items.filter((i) => i.design.product.kind === 'corner').length);
    // Every piece once across the piece stages.
    const pieceIds = stages
      .filter((s) => s.id !== 'run')
      .flatMap((s) => s.entries.flatMap((e) => e.ids));
    expect(new Set(pieceIds).size).toBe(p.items.length);
    expect(pieceIds).toHaveLength(p.items.length);
    // Base pieces: on the floor, wall 0 then wall 1, each from the corner at (3600, 0).
    const base = stages.find((s) => s.id === 'base')!.entries;
    expect(base.every((e) => e.ids.every((id) => pc(id).bounds.y === 0))).toBe(true);
    const walls = base.map((e) => e.wall);
    expect(walls.every((w) => w === 0 || w === 1)).toBe(true);
    expect([...walls].sort()).toEqual(walls);
    const w0 = base.filter((e) => e.wall === 0).map((e) => pc(e.ids[0]).bounds);
    const w1 = base.filter((e) => e.wall === 1).map((e) => pc(e.ids[0]).bounds);
    expect(w0.length).toBeGreaterThan(0);
    expect(w1.length).toBeGreaterThan(0);
    for (let k = 1; k < w0.length; k++)
      expect(w0[k].x + w0[k].w).toBeLessThan(w0[k - 1].x + w0[k - 1].w);
    for (let k = 1; k < w1.length; k++) expect(w1[k].z).toBeGreaterThan(w1[k - 1].z);
    // Wall pieces: none on the floor, the same wall order.
    const wall = stages.find((s) => s.id === 'wall')?.entries ?? [];
    expect(wall.every((e) => e.ids.every((id) => pc(id).bounds.y > 0))).toBe(true);
    const ww = wall.map((e) => e.wall ?? Infinity);
    expect([...ww].sort((a, b) => a - b)).toEqual(ww);
    // Run parts last, when there are any.
    if (p.runParts?.length) {
      expect(ids[ids.length - 1]).toBe('run');
      expect(stages[stages.length - 1].entries.reduce((n, e) => n + e.times, 0)).toBe(
        p.runParts.length,
      );
    }
  });

  it('same input, same order — also with the items listed the other way round', () => {
    const p = lProject();
    const a = projectAssemblyOrder(p, buildProjectModel(p));
    expect(projectAssemblyOrder(p, buildProjectModel(p))).toEqual(a);
    const q = structuredClone(p);
    expect(projectAssemblyOrder(q, buildProjectModel(q))).toEqual(a);
    const r = { ...p, items: [...p.items].reverse() };
    const flat = (st: typeof a) => st.map((s) => [s.id, s.entries.map((e) => e.ids[0])]);
    expect(flat(projectAssemblyOrder(r, buildProjectModel(r)))).toEqual(flat(a));
  });

  it('a project without a room orders by plan x; linked copies once × N; run parts plinths → worktops → sinks', () => {
    const p = plainProject();
    const stages = projectAssemblyOrder(p, buildProjectModel(p));
    expect(stages.map((s) => s.id)).toEqual(['base', 'wall', 'run']);
    const base = stages[0].entries;
    expect(base.map((e) => e.name)).toEqual(['A', 'B', 'C']);
    expect(base.map((e) => e.times)).toEqual([1, 2, 1]);
    expect(base.every((e) => e.wall === undefined)).toBe(true);
    expect(stages[1].entries.map((e) => e.name)).toEqual(['W']);
    const run = stages[2].entries;
    expect(run.map((e) => [e.kind, e.times])).toEqual([
      ['plinth', 2],
      ['worktop', 1],
      ['sink', 1],
    ]);
    expect(run[2].size).toEqual([500, 400]);
  });

  it('a design alone gives no section', () => {
    expect(projectAssemblyOrder(null, null)).toEqual([]);
    expect(projectAssemblyOrder(undefined, undefined)).toEqual([]);
  });

  it('the printed sheet’s section in ro (default), ru and en', () => {
    const p = plainProject();
    const stages = projectAssemblyOrder(p, buildProjectModel(p));
    setPrintLang('ro');
    let sheet = projectOrderPrint(stages);
    expect(sheet.heading).toBe('Ordinea în proiect');
    expect(sheet.stages.map((s) => s.title)).toEqual([
      'Corpuri de jos',
      'Corpuri suspendate',
      'Piese de rând',
    ]);
    expect(sheet.stages[0].lines).toEqual(['A', 'B × 2', 'C']);
    expect(sheet.stages[2].lines).toEqual(['Plintă × 2', 'Blat', 'Decupaj chiuvetă 500 × 400 mm']);
    setPrintLang('ru');
    sheet = projectOrderPrint(stages);
    expect(sheet.heading).toBe('Порядок в проекте');
    expect(sheet.stages.map((s) => s.title)).toEqual([
      'Нижние изделия',
      'Навесные изделия',
      'Детали ряда',
    ]);
    expect(sheet.stages[2].lines[2]).toBe('Вырез под мойку 500 × 400 мм');
    setPrintLang('en');
    sheet = projectOrderPrint(stages);
    expect(sheet.heading).toBe('Project order');
    expect(sheet.stages.map((s) => s.title)).toEqual(['Base pieces', 'Wall pieces', 'Run parts']);
    expect(sheet.stages[2].lines).toEqual(['Plinth × 2', 'Worktop', 'Sink cut-out 500 × 400 mm']);
    // With a room, each piece line names its wall; the corner stage comes first.
    const l = lProject();
    setPrintLang('ro');
    const ro = projectOrderPrint(projectAssemblyOrder(l, buildProjectModel(l)));
    expect(ro.stages[0].title).toBe('Corpuri de colț');
    expect(ro.stages[1].lines.some((x) => x.endsWith('(peretele 1)'))).toBe(true);
    setPrintLang('en');
    const en = projectOrderPrint(projectAssemblyOrder(l, buildProjectModel(l)));
    expect(en.stages[0].title).toBe('Corner cabinets');
    expect(en.stages[1].lines.some((x) => x.endsWith('(wall 2)'))).toBe(true);
  });
});
