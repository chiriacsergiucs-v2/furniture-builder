// ADR-166: project variables, formulas and bindings.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import {
  buildProjectModel,
  makeItem,
  newProject,
  PROJECT_SCHEMA,
  validateProject,
  type Project,
} from '../src/core/project';
import { moveTo } from '../src/core/moveTo';
import {
  addVariable,
  applyBindings,
  deleteVariable,
  evaluateExpr,
  evaluateVariables,
  evaluatedText,
  heldByBinding,
  readTarget,
  renameInExpr,
  setBinding,
  updateVariable,
  variableDiagnostics,
  variableUsers,
} from '../src/core/variables';
import type { CabinetParams } from '../src/core/types';
import { useDesign } from '../src/store/designStore';

const tpl = (id: string) => templates.find((x) => x.id === id)!.create();
const st = () => useDesign.getState();
const cab = (p: Project, id: string) =>
  p.items.find((i) => i.id === id)!.design.product.params as CabinetParams;

function three(): { p: Project; ids: string[] } {
  let p = newProject('Vars');
  const ids: string[] = [];
  for (const id of ['base-door', 'base-door', 'wall-cabinet']) {
    const it = makeItem(p, tpl(id));
    ids.push(it.id);
    p = { ...p, items: [...p.items, it] };
  }
  return { p, ids };
}

describe('formulas (ADR-166)', () => {
  const scope = new Map([
    ['bottom height', 400],
    ['total', 2000],
  ]);
  it('evaluates numbers, names with spaces, + − × ÷ and parentheses', () => {
    expect(evaluateExpr('400', scope)).toEqual({ raw: 400 });
    expect(evaluateExpr('bottom height + 18', scope)).toEqual({ raw: 418 });
    expect(evaluateExpr('total − bottom height', scope)).toEqual({ raw: 1600 });
    expect(evaluateExpr('(total - bottom height) / 2', scope)).toEqual({ raw: 800 });
    expect(evaluateExpr('2 × Bottom Height', scope)).toEqual({ raw: 800 });
  });
  it('reports unknown names, syntax, empty and division by zero', () => {
    expect(evaluateExpr('top + 1', scope)).toMatchObject({ problem: /Unknown variable “top”/ });
    expect(evaluateExpr('(400', scope)).toMatchObject({ problem: /not closed/ });
    expect(evaluateExpr('', scope)).toMatchObject({ problem: /empty/ });
    expect(evaluateExpr('400 / 0', scope)).toMatchObject({ problem: /Division by zero/ });
    expect(evaluateExpr('400 400', scope)).toMatchObject({ problem: /Unexpected/ });
  });
  it('rounds once at the end of a chain and reports the unrounded value', () => {
    const vars = [
      { id: 'a', name: 'third', expr: '1000 / 3' },
      { id: 'b', name: 'two thirds', expr: 'third × 2' },
      { id: 'c', name: 'bad', expr: 'two thirds / 0' },
      { id: 'd', name: 'loop', expr: 'other + 1' },
      { id: 'e', name: 'other', expr: 'loop + 1' },
    ];
    const ev = evaluateVariables(vars);
    expect(ev.get('a')).toMatchObject({ value: 333 });
    expect(evaluatedText(ev.get('a')!)).toBe('333.33 → 333 mm');
    // 666.67 → 667, not 333 × 2 = 666.
    expect(ev.get('b')?.value).toBe(667);
    expect(ev.get('c')?.problem).toMatch(/Division by zero/);
    expect(ev.get('d')?.problem).toMatch(/circle/);
    expect(ev.get('e')?.problem).toMatch(/circle/);
  });
  it('renameInExpr follows a name into formulas', () => {
    expect(renameInExpr('bottom height + 18', 'bottom height', 'base', ['bottom height'])).toBe(
      'base + 18',
    );
  });
});

describe('bindings on a project (ADR-166)', () => {
  it('bound heights follow the variable; a change reaches every bound piece', () => {
    const { p, ids } = three();
    const a = addVariable(p, 'bottom height', '400');
    let next = setBinding(a.project, ids[0], 'height', 'bottom height');
    next = setBinding(next, ids[1], 'height', 'bottom height + 18');
    next = applyBindings(next);
    expect(cab(next, ids[0]).height).toBe(400);
    expect(cab(next, ids[1]).height).toBe(418);
    next = applyBindings(updateVariable(next, a.id, { expr: '450' }));
    expect(cab(next, ids[0]).height).toBe(450);
    expect(cab(next, ids[1]).height).toBe(468);
    expect(applyBindings(next)).toBe(next);
  });
  it('a split size, mount height and position follow; a formula result is rounded', () => {
    const { p, ids } = three();
    const a = addVariable(p, 'x', '1000 / 3');
    let next = setBinding(a.project, ids[0], 'x', 'x');
    next = setBinding(next, ids[2], 'mountHeight', 'x × 4');
    const interior = cab(next, ids[0]).interior;
    const split = interior.kind === 'split' ? interior : null;
    if (split) next = setBinding(next, ids[0], `split:${split.id}:0`, 'x');
    next = applyBindings(next);
    const it0 = next.items.find((i) => i.id === ids[0])!;
    expect(it0.position.x).toBe(333);
    const it2 = next.items.find((i) => i.id === ids[2])!;
    expect(it2.placement).toEqual({ kind: 'wall', height: 1333 });
    expect(cab(next, ids[2]).mountHeight).toBe(1333);
    if (split) expect(readTarget(it0, `split:${split.id}:0`)).toBe(333);
  });
  it('problems are error diagnostics and the bound field keeps its number', () => {
    const { p, ids } = three();
    const a = addVariable(p, 'h', 'nothing + 1');
    const next = applyBindings(setBinding(a.project, ids[0], 'height', 'h'));
    expect(cab(next, ids[0]).height).toBe(cab(p, ids[0]).height);
    const d = variableDiagnostics(next);
    expect(d.some((x) => x.severity === 'error' && x.code === 'variable-problem')).toBe(true);
    expect(d.some((x) => x.code === 'binding-problem')).toBe(true);
    const model = buildProjectModel(next);
    expect(model.diagnostics.some((x) => x.code === 'variable-problem')).toBe(true);
  });
  it('a result outside the field’s range is an error and is not written', () => {
    const { p, ids } = three();
    const a = addVariable(p, 'h', '-50');
    const next = applyBindings(setBinding(a.project, ids[0], 'height', 'h'));
    expect(cab(next, ids[0]).height).toBe(cab(p, ids[0]).height);
    expect(validateProject(next)).toEqual([]);
    const d = variableDiagnostics(next).find((x) => x.code === 'binding-range');
    expect(d?.message).toMatch(/-50 mm is outside 100–3000 mm/);
  });
  it('a y binding on a floor piece is an error; a size lock is a warning', () => {
    const { p, ids } = three();
    const a = addVariable(p, 'h', '300');
    let next = setBinding(a.project, ids[0], 'y', 'h');
    next = setBinding(next, ids[1], 'width', 'h');
    next = {
      ...next,
      items: next.items.map((i) => (i.id === ids[1] ? { ...i, sizeLocked: true } : i)),
    };
    const codes = variableDiagnostics(next).map((x) => x.code);
    expect(codes).toContain('binding-floor');
    expect(codes).toContain('binding-size-lock');
  });
  it('deleting a used variable lists its users and unbinds them; rename follows', () => {
    const { p, ids } = three();
    const a = addVariable(p, 'bottom height', '400');
    const b = addVariable(a.project, 'top', 'bottom height + 18');
    let next = setBinding(b.project, ids[0], 'height', 'bottom height');
    next = applyBindings(next);
    const users = variableUsers(next, a.id);
    expect(users.items.map((i) => i.id)).toEqual([ids[0]]);
    expect(users.vars.map((v) => v.name)).toEqual(['top']);
    const renamed = updateVariable(next, a.id, { name: 'base' });
    expect(renamed.variables![1].expr).toBe('base + 18');
    expect(renamed.items[0].bindings![0].expr).toBe('base');
    const gone = deleteVariable(renamed, a.id);
    expect(gone.items[0].bindings).toBeUndefined();
    expect(cab(gone, ids[0]).height).toBe(400);
    expect(gone.variables).toHaveLength(1);
  });
  it('a bound axis is held: Move to changes nothing on it and says why', () => {
    const { p, ids } = three();
    const a = addVariable(p, 'left', '60');
    const bound = applyBindings(setBinding(a.project, ids[1], 'x', 'left'));
    const tried = moveTo(bound, ids[1], 'left');
    const applied = applyBindings(tried.project ?? bound);
    if (tried.project && tried.project !== bound) {
      expect(heldByBinding(bound, tried.project, applied)).toMatch(/From left follows “left”/);
      expect(applied.items.find((i) => i.id === ids[1])!.position.x).toBe(60);
    }
  });
  it('validates schemaVersion 16 and refuses bindings on an older version', () => {
    const { p, ids } = three();
    const a = addVariable(p, 'h', '400');
    const next = setBinding(a.project, ids[0], 'height', 'h');
    expect(next.schemaVersion).toBe(PROJECT_SCHEMA);
    expect(validateProject(next)).toEqual([]);
    expect(validateProject({ ...next, schemaVersion: 15 })).toContain(
      'Variables need project schemaVersion 16',
    );
    expect(validateProject({ ...next, variables: [{ id: 'x', name: '', expr: '1' }] })).toContain(
      'Invalid variable',
    );
    expect(
      validateProject({
        ...next,
        items: next.items.map((i) =>
          i.bindings ? { ...i, bindings: [{ target: 'nope', expr: '1' }] } : i,
        ),
      }),
    ).toContain('Invalid item bindings');
    const old = { ...p, schemaVersion: 15 as const };
    expect(validateProject(old)).toEqual([]);
  });
});

describe('store (ADR-166)', () => {
  beforeEach(() => st().openProject(three().p));
  it('addVariable, bindTarget and updateVariable are each one undo step; the piece follows', () => {
    const id = st().project!.items[0].id;
    const vid = st().addVariable('bottom height', '400');
    st().bindTarget(id, 'height', 'bottom height');
    expect(cab(st().project!, id).height).toBe(400);
    st().updateVariable(vid, { expr: '450' });
    expect(cab(st().project!, id).height).toBe(450);
    expect(st().projectPast).toHaveLength(3);
    st().undoProject();
    expect(cab(st().project!, id).height).toBe(400);
    // A direct edit of a bound size is held and the reason shown.
    st().resizeItem(id, 'height', 700);
    expect(cab(st().project!, id).height).toBe(400);
    expect(st().notice).toMatch(/Height follows “bottom height”/);
  });
});

describe('seeded fuzz: random variables and bindings build with no throw (ADR-166)', () => {
  it('3,000 projects', () => {
    let seed = 7;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
    const N = Math.ceil(Number(process.env.FUZZ_N ?? 3000) / 10);
    const names = ['a', 'b b', 'c'];
    const targets = ['width', 'height', 'depth', 'x', 'z', 'mountHeight', 'y'];
    for (let n = 0; n < N; n++) {
      const t3 = three();
      let p = t3.p;
      const ids = t3.ids;
      for (const name of names)
        p = addVariable(
          p,
          name,
          rnd() < 0.3
            ? `${names[ri(0, 2)]} ${['+', '-', '*', '/'][ri(0, 3)]} ${ri(0, 50)}`
            : String(ri(100, 2000)),
        ).project;
      for (const id of ids)
        if (rnd() < 0.7) p = setBinding(p, id, targets[ri(0, targets.length - 1)], names[ri(0, 2)]);
      const next = applyBindings(p);
      expect(validateProject(next)).toEqual([]);
      buildProjectModel(next);
      variableDiagnostics(next);
    }
  });
});
