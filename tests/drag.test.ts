import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import { dragPosition, liftOff, newProject, type ProjectItem } from '../src/core/project';
import { useDesign } from '../src/store/designStore';
import {
  arrowMove,
  DRAG_THRESHOLD_PX,
  movePointer,
  pressPiece,
  releasePointer,
} from '../src/ui/planDrag';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
const st = () => useDesign.getState();
const wallTemplate = () => t('wall-cabinet');

describe('dragPosition (ADR-065)', () => {
  const item = { position: { x: 1243, y: 0, z: 7 } } as ProjectItem;
  it('moves by whole 10 mm steps and keeps the piece’s own millimetres', () => {
    expect(dragPosition(item, 104, -3)).toEqual({ x: 1343, y: 0, z: 7 });
    expect(dragPosition(item, 106, 15)).toEqual({ x: 1353, y: 0, z: 27 });
    expect(dragPosition(item, -4.9, 4.9)).toEqual({ x: 1243, y: 0, z: 7 });
  });
  it('does not clamp: positions outside the room or below zero are kept', () => {
    expect(dragPosition(item, -5000, -900)).toEqual({ x: -3757, y: 0, z: -893 });
    expect(dragPosition(item, 50_000, 0).x).toBe(51_243);
  });
  it('takes another step and never yields NaN', () => {
    expect(dragPosition(item, 149, 0, 100).x).toBe(1343);
    expect(dragPosition(item, Number.NaN, Infinity)).toEqual(item.position);
  });
});

describe('the drag gesture (ADR-065)', () => {
  const p = (sx: number, sy: number, x = sx * 10, z = sy * 10, pointerId = 1) => ({
    pointerId,
    sx,
    sy,
    room: { x, z },
  });
  it(`a press that moves ${DRAG_THRESHOLD_PX} px or less is a tap`, () => {
    let g = pressPiece(null, 'a', p(100, 100));
    g = movePointer(g, p(103, 102));
    expect(g!.dragging).toBe(false);
    expect(releasePointer(g, 1)).toEqual({ kind: 'tap', id: 'a' });
  });
  it('past the threshold it is a drop with the move in plan mm', () => {
    let g = pressPiece(null, 'a', p(100, 100));
    g = movePointer(g, p(110, 100));
    g = movePointer(g, p(102, 101)); // back near the start: still a drag
    expect(releasePointer(g, 1)).toEqual({ kind: 'drop', id: 'a', dx: 20, dz: 10 });
  });
  it('other pointers are ignored while moving; a second press cancels', () => {
    let g = pressPiece(null, 'a', p(100, 100));
    g = movePointer(g, p(200, 200, 2000, 2000, 2));
    expect(g!.dragging).toBe(false);
    expect(releasePointer(g, 2)).toBeNull();
    expect(pressPiece(g, 'b', p(50, 50, 500, 500, 2))).toBeNull();
    expect(pressPiece(null, 'a', { pointerId: 1, sx: 0, sy: 0, room: null })).toBeNull();
  });
  it('arrow keys move 10 mm, Shift 100 mm; up is toward the back wall', () => {
    expect(arrowMove('ArrowRight', false)).toEqual({ dx: 10, dz: 0 });
    expect(arrowMove('ArrowLeft', true)).toEqual({ dx: -100, dz: 0 });
    expect(arrowMove('ArrowUp', false)).toEqual({ dx: 0, dz: -10 });
    expect(arrowMove('ArrowDown', true)).toEqual({ dx: 0, dz: 100 });
    expect(arrowMove('Enter', false)).toBeNull();
  });
});

describe('moving a piece in the store (ADR-065)', () => {
  beforeEach(() => {
    st().openProject(newProject('Drag'));
    st().addPiece(t('base-door'));
    st().stopPlacing();
  });
  it('one drop is one undo step; undo puts it back', () => {
    const before = st().project!;
    const pos = before.items[0].position;
    const past = st().projectPast.length;
    // A drag is many pointer moves but only the release reaches the store.
    let g = pressPiece(null, before.items[0].id, {
      pointerId: 1,
      sx: 0,
      sy: 0,
      room: { x: 0, z: 0 },
    });
    for (let i = 1; i <= 50; i++)
      g = movePointer(g, { pointerId: 1, sx: i, sy: 0, room: { x: i * 25, z: i } });
    const end = releasePointer(g, 1);
    expect(end?.kind).toBe('drop');
    if (end?.kind === 'drop') st().moveItemBy(end.id, end.dx, end.dz);
    expect(st().projectPast.length).toBe(past + 1);
    expect(st().project!.items[0].position).toEqual({ ...pos, x: pos.x + 1250, z: pos.z + 50 });
    st().undoProject();
    expect(st().project).toBe(before);
  });
  it('a cancelled drag, a tap or a move under one step makes no undo step', () => {
    const before = st().project!;
    const past = st().projectPast.length;
    // Esc / a second finger drop the gesture: nothing is released, nothing reaches the store.
    const tap = releasePointer(
      pressPiece(null, before.items[0].id, { pointerId: 1, sx: 0, sy: 0, room: { x: 0, z: 0 } }),
      1,
    );
    expect(tap?.kind).toBe('tap');
    st().moveItemBy(before.items[0].id, 4, -4);
    expect(st().projectPast.length).toBe(past);
    expect(st().project).toBe(before);
  });
  it('arrow keys are one undo step each', () => {
    const id = st().project!.items[0].id;
    const x0 = st().project!.items[0].position.x;
    const past = st().projectPast.length;
    const right = arrowMove('ArrowRight', false)!;
    const bigRight = arrowMove('ArrowRight', true)!;
    st().moveItemBy(id, right.dx, right.dz);
    st().moveItemBy(id, bigRight.dx, bigRight.dz);
    expect(st().project!.items[0].position.x).toBe(x0 + 110);
    expect(st().projectPast.length).toBe(past + 2);
    st().undoProject();
    expect(st().project!.items[0].position.x).toBe(x0 + 10);
  });
  it('a dropped piece is not clamped: it may leave the room', () => {
    const id = st().project!.items[0].id;
    const { x, z } = st().project!.items[0].position;
    st().moveItemBy(id, -3000, -500);
    expect(st().project!.items[0].position).toMatchObject({ x: x - 3000, z: z - 500 });
  });
  it('a floor piece on another piece is lifted off to the floor; pieces on a dragged base follow it', () => {
    st().addPiece(t('base-door'));
    st().stopPlacing();
    const [base, top] = st().project!.items;
    st().updateItem(top.id, { placement: { kind: 'above', baseId: base.id, gap: 0, offsetX: 0 } });
    const onBase = st().project!.items[1];
    expect(onBase.position.y).toBeGreaterThan(0);
    // Dragging the base: the piece on it follows.
    st().moveItemBy(base.id, 500, 0);
    expect(st().project!.items[1].position.x).toBe(st().project!.items[0].position.x);
    expect(st().project!.items[1].placement?.kind).toBe('above');
    // Dragging the piece on it: it leaves the base and stands on the floor.
    st().moveItemBy(top.id, 1000, 0);
    const moved = st().project!.items[1];
    expect(moved.placement).toEqual({ kind: 'floor' });
    expect(moved.position.y).toBe(0);
    expect(moved.position.x).toBe(st().project!.items[0].position.x + 1000);
  });
  it('a wall-hung piece above another is lifted off to the wall at its current height', () => {
    st().addPiece(wallTemplate());
    st().stopPlacing();
    const [base, wall] = st().project!.items;
    st().updateItem(wall.id, {
      placement: { kind: 'above', baseId: base.id, gap: 600, offsetX: 0 },
    });
    const y = st().project!.items[1].position.y;
    expect(y).toBeGreaterThan(600);
    st().moveItemBy(wall.id, 0, 100);
    const moved = st().project!.items[1];
    expect(moved.placement).toEqual({ kind: 'wall', height: y });
    expect(moved.position.y).toBe(y);
  });
  it('liftOff leaves floor, wall and free placements alone', () => {
    const it0 = st().project!.items[0];
    expect(liftOff({ ...it0, placement: { kind: 'floor' } })).toEqual({ kind: 'floor' });
    expect(liftOff({ ...it0, placement: { kind: 'wall', height: 1400 } })).toEqual({
      kind: 'wall',
      height: 1400,
    });
    expect(liftOff({ ...it0, placement: undefined })).toBeUndefined();
  });
});
