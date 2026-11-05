// ADR-171: lock a piece's turn and each of its sizes one by one; locks outrank variables, Replace, linked copies,
// group size and project settings.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { mirrorItem, setItemRotation, tryTurn } from '../src/core/arrange';
import { templates } from '../src/core/design';
import { describeChange } from '../src/core/history';
import {
  makeItem,
  moveBy,
  newProject,
  PROJECT_SCHEMA,
  rotationOf,
  setTurnLocked,
  turnBlocked,
  validateProject,
  type Project,
} from '../src/core/project';
import { mirrorItems, turnSelection } from '../src/core/selection';
import { isAxisLocked, lockedAxes, setAxisLocked, sizeLockBlocked } from '../src/core/sizeLock';
import { addVariable, applyBindings, setBinding, variableDiagnostics } from '../src/core/variables';
import type { CabinetParams } from '../src/core/types';
import { useDesign } from '../src/store/designStore';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
function row(...ids: string[]): Project {
  let p = newProject('Locks');
  for (const id of ids) p = { ...p, items: [...p.items, makeItem(p, t(id))] };
  return p;
}
const cab = (p: Project, id: string) =>
  p.items.find((i) => i.id === id)!.design.product.params as CabinetParams;
const st = () => useDesign.getState();

describe('turn lock (ADR-171)', () => {
  it('refuses Turn, the typed angle, Mirror and a group turn with the reason; the piece still moves', () => {
    const p0 = row('base-door', 'base-door');
    const [a, b] = p0.items.map((i) => i.id);
    const p = setTurnLocked(p0, a, true);
    expect(p.items[0].turnLocked).toBe(true);
    expect(setTurnLocked(p, a, true)).toBe(p);
    expect(turnBlocked(p, [a])).toMatch(/turn locked/);
    expect(turnBlocked(p, [b])).toBeNull();
    expect(tryTurn(p, a, 1).reason).toMatch(/turn locked/);
    expect(setItemRotation(p, a, 37).reason).toMatch(/turn locked/);
    expect(mirrorItem(p, a).reason).toMatch(/Turn locked/);
    expect(turnSelection(p, [a, b], 1).reason).toMatch(/turn locked/);
    expect(mirrorItems(p, [a, b]).refused).toMatch(/turn locked/);
    expect(tryTurn(p, b, 1).reason).toBeUndefined();
    const moved = moveBy(p, a, 100, 0, 1);
    expect(moved.reason).toBeUndefined();
    expect(moved.project.items[0].position.x).toBe(p.items[0].position.x + 100);
    expect(setTurnLocked(p, a, false).items[0].turnLocked).toBeUndefined();
  });
});

describe('per-size locks (ADR-171)', () => {
  it('setAxisLocked keeps a sorted list; sizeLocked means all three', () => {
    const p0 = row('base-door');
    const id = p0.items[0].id;
    let p = setAxisLocked(p0, id, 'depth', true);
    p = setAxisLocked(p, id, 'width', true);
    expect(p.items[0].sizeLocks).toEqual(['width', 'depth']);
    expect(lockedAxes(p.items[0])).toEqual(['width', 'depth']);
    expect(isAxisLocked(p.items[0], 'height')).toBe(false);
    expect(setAxisLocked(p, id, 'width', true)).toBe(p);
    p = setAxisLocked(setAxisLocked(p, id, 'width', false), id, 'depth', false);
    expect(p.items[0].sizeLocks).toBeUndefined();
    expect(lockedAxes({ sizeLocked: true })).toEqual(['width', 'height', 'depth']);
  });
  it('sizeLockBlocked refuses a change on a locked axis only and names the axes', () => {
    const p0 = row('base-door');
    const id = p0.items[0].id;
    const p = setAxisLocked(p0, id, 'width', true);
    const with_ = (patch: Partial<CabinetParams>): Project => ({
      ...p,
      items: p.items.map((i) =>
        i.design.product.kind === 'cabinet'
          ? {
              ...i,
              design: {
                ...i.design,
                product: { ...i.design.product, params: { ...i.design.product.params, ...patch } },
              },
            }
          : i,
      ),
    });
    expect(sizeLockBlocked(p, with_({ height: 900 }))).toBeNull();
    expect(sizeLockBlocked(p, with_({ depth: 500 }))).toBeNull();
    expect(sizeLockBlocked(p, with_({ width: 700 }))).toMatch(/has its width locked/);
    const two = setAxisLocked(p, id, 'depth', true);
    expect(
      sizeLockBlocked(two, {
        ...with_({ depth: 500 }),
        items: with_({ depth: 500 }).items.map((i) => ({
          ...i,
          sizeLocks: ['width', 'depth'] as const,
        })),
      }),
    ).toMatch(/width and depth locked/);
  });
  it('a binding on a locked axis is held and warned; other axes follow', () => {
    let p = row('base-door');
    const id = p.items[0].id;
    const h0 = cab(p, id).height;
    p = addVariable(p, 'h', '900').project;
    p = setBinding(p, id, 'height', 'h');
    p = setBinding(p, id, 'width', 'h');
    p = setAxisLocked(p, id, 'height', true);
    const next = applyBindings(p);
    expect(cab(next, id).height).toBe(h0);
    expect(cab(next, id).width).toBe(900);
    const held = variableDiagnostics(next).filter((d) => d.code === 'binding-held');
    expect(held).toHaveLength(1);
    expect(held[0].severity).toBe('warning');
    expect(held[0].message).toMatch(/Height keeps its value/);
  });
});

describe('validation and schema (ADR-171, ADR-011)', () => {
  it('schemaVersion 19 validates the fields; older projects load unchanged; bad values are refused', () => {
    expect(PROJECT_SCHEMA).toBe(20);
    const p0 = row('base-door');
    const id = p0.items[0].id;
    const old = { ...p0, schemaVersion: 18 as const };
    expect(validateProject(old)).toEqual([]);
    expect(validateProject(setTurnLocked(old, id, true))).toContain(
      'Turn and size locks need project schemaVersion 19',
    );
    expect(validateProject(setAxisLocked(old, id, 'width', true))).toContain(
      'Turn and size locks need project schemaVersion 19',
    );
    expect(validateProject(setAxisLocked(setTurnLocked(p0, id, true), id, 'width', true))).toEqual(
      [],
    );
    const bad = (patch: object) =>
      validateProject({ ...p0, items: p0.items.map((i) => ({ ...i, ...patch })) } as Project);
    expect(bad({ turnLocked: false })).toContain('Invalid item turn lock');
    expect(bad({ sizeLocks: [] })).toContain('Invalid item size locks');
    expect(bad({ sizeLocks: ['width', 'width'] })).toContain('Invalid item size locks');
    expect(bad({ sizeLocks: ['length'] })).toContain('Invalid item size locks');
  });
});

describe('store (ADR-171)', () => {
  beforeEach(() => st().openProject(row('base-door', 'base-door')));
  it('a width-locked piece refuses a width change from the card, Replace, a linked copy, group size and project settings; height changes', () => {
    const [a, b] = st().project!.items.map((i) => i.id);
    st().setAxisLocked(a, 'width', true);
    expect(st().projectPastNames.at(-1)).toMatch(/^Lock size/);
    const before = st().project!;
    st().resizeItem(a, 'width', 700);
    expect(st().project).toBe(before);
    expect(st().notice).toMatch(/width locked/);
    st().resizeItem(a, 'height', 900);
    expect(cab(st().project!, a).height).toBe(900);
    const afterHeight = st().project!;
    expect(st().replaceItem(a, t('wardrobe'))).toBeNull();
    expect(st().project).toBe(afterHeight);
    // Project settings that keep the width apply; group size on width skips the locked piece.
    expect(st().setProjectSetting('plinthHeight', 150)).toHaveLength(2);
    expect(cab(st().project!, a).plinthHeight).toBe(150);
    st().selectItems([a, b]);
    st().groupSelection();
    const gid = st().project!.groups![0].id;
    const w0 = cab(st().project!, a).width;
    st().resizeGroup(gid, 'width', 1500, 'proportional');
    expect(cab(st().project!, a).width).toBe(w0);
    expect(cab(st().project!, b).width).toBe(1500 - w0);
    // A linked copy's width change would reach the locked one: refused as a whole.
    st().selectItems([a]);
    st().setAxisLocked(a, 'width', false);
    st().addLinkedCopy(a);
    const copy = st().selectedItemId!;
    st().setAxisLocked(a, 'width', true);
    const linked = st().project!;
    st().resizeItem(copy, 'width', 700);
    expect(st().project).toBe(linked);
    expect(st().notice).toMatch(/width locked/);
  });
  it('Lock turn refuses Turn, R, the handle angle and the group turn; undo names; sizeLocked still locks all three', () => {
    const [a, b] = st().project!.items.map((i) => i.id);
    st().setTurnLocked(a, true);
    expect(st().projectPastNames.at(-1)).toMatch(/^Lock turn/);
    expect(describeChange(st().projectPast.at(-1)!, st().project!)).toMatch(/^Lock turn/);
    expect(st().turnItem(a, 1)).toMatch(/turn locked/);
    expect(st().setRotation(a, 37)).toMatch(/turn locked/);
    expect(rotationOf(st().project!.items[0])).toBe(0);
    st().selectItems([a, b]);
    expect(st().turnSelectionBy(1)).toMatch(/turn locked/);
    expect(st().mirrorItem(a)).toMatch(/turn locked/i);
    st().setTurnLocked(a, false);
    expect(st().projectPastNames.at(-1)).toMatch(/^Unlock turn/);
    expect(st().turnItem(a, 1)).toBeNull();
    st().setSizeLocked(b, true);
    expect(st().projectPastNames.at(-1)).toMatch(/^Lock size/);
    const p = st().project!;
    st().resizeItem(b, 'height', 900);
    expect(st().project).toBe(p);
    expect(st().notice).toMatch(/size locked/);
  });
});
