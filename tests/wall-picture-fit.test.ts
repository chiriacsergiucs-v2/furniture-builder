import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { newProject, PROJECT_SCHEMA, validateProject, type Project } from '../src/core/project';
import { setWallFinish, shapeOutline, wallFinish, type Pt, type Room } from '../src/core/room';
import { SNAP_RANGE } from '../src/core/snap';
import {
  boxSpan,
  dragPicture,
  pictureRect,
  project,
  rectLabel,
  splitSpan,
  squareToQuad,
  straightenMap,
  wallAxes,
  wallPlanePoint,
  wholeWall,
} from '../src/core/wallPicture';
import { roomDisplayBoxes } from '../src/core/room';
import { db, loadProject, saveProject } from '../src/persist/db';
import { takePictures, withPictures } from '../src/persist/images';
import { pictureHolders } from '../src/core/project';

const sizes = { width: 3000, depth: 2000, cutWidth: 0, cutDepth: 0, offset: 0 };
const room = (): Room => ({
  height: 2500,
  outline: shapeOutline('rectangle', sizes),
  features: [],
  shape: { kind: 'rectangle', sizes },
});
const corners: [Pt, Pt, Pt, Pt] = [
  [1500, 9000],
  [8750, 7833],
  [8250, 1500],
  [2000, 667],
];
const fitted = (): Project => ({
  ...newProject('Fitted'),
  room: setWallFinish(room(), 0, {
    colour: '#4682a0',
    image: {
      id: 'img-w',
      name: 'wall.png',
      fit: { x: -200, y: 100, w: 3400, h: 2300 },
      straighten: corners,
    },
  }),
});
const close = (a: number[] | null, b: number[]) => {
  expect(a).not.toBeNull();
  a!.forEach((v, k) => expect(v).toBeCloseTo(b[k], 9));
};

describe('fitted and straightened wall pictures (ADR-146)', () => {
  it('validate, need version 15, and older versions still load; old repeating pictures fill their wall', () => {
    const p = fitted();
    expect(PROJECT_SCHEMA).toBe(17);
    expect(validateProject(JSON.parse(JSON.stringify(p)))).toEqual([]);
    expect(validateProject({ ...p, schemaVersion: 14 })).toContain(
      'Fitted wall pictures need project schemaVersion 15',
    );
    // An ADR-145 project: a repeating picture with a tile size, version 14.
    const old = setWallFinish(room(), 0, {
      colour: '#4682a0',
      image: { id: 'img-w', name: 'tiles.png', tileWidth: 300, tileHeight: 300 },
    });
    expect(validateProject({ ...p, schemaVersion: 14, room: old })).toEqual([]);
    expect(pictureRect(old, 0, wallFinish(old, 0)!.image!)).toEqual({
      x: 0,
      y: 0,
      w: 3000,
      h: 2500,
    });
    const bad = (image: unknown) =>
      validateProject({
        ...p,
        room: { ...p.room!, walls: [{ wall: 0, colour: '#ffffff', image }] } as never,
      });
    const img = wallFinish(p.room!, 0)!.image!;
    expect(bad({ ...img, fit: { x: 0, y: 0, w: 0, h: 10 } })).toContain('Invalid wall background');
    expect(bad({ ...img, fit: { x: 0.5, y: 0, w: 10, h: 10 } })).toContain(
      'Invalid wall background',
    );
    expect(bad({ ...img, straighten: [corners[0], corners[2], corners[1], corners[3]] })).toContain(
      'Invalid wall background',
    );
    expect(
      bad({
        ...img,
        straighten: [
          [0, 0],
          [5000, 0],
          [10000, 0],
          [0, 10000],
        ],
      }),
    ).toContain('Invalid wall background');
    expect(
      bad({
        ...img,
        straighten: [
          [0, 0],
          [0, 10001],
          [1, 1],
          [2, 2],
        ],
      }),
    ).toContain('Invalid wall background');
  });

  it('round-trips through save, export and import', async () => {
    await db.images.clear();
    const p = fitted();
    await saveProject(p);
    expect((await loadProject(p.id))!.room!.walls).toEqual(p.room!.walls);
    const file = JSON.parse(JSON.stringify(await withPictures(p, pictureHolders(p))));
    const { data } = await takePictures(file);
    expect(validateProject(data)).toEqual([]);
    expect((data as Project).room!.walls).toEqual(p.room!.walls);
  });

  it('the straightening maps the four corners exactly onto the picture corners', () => {
    const m = straightenMap(corners)!;
    close(project(m, 0, 0), [0.2, 0.0667]); // top-left
    close(project(m, 1, 0), [0.825, 0.15]); // top-right
    close(project(m, 1, 1), [0.875, 0.7833]); // bottom-right
    close(project(m, 0, 1), [0.15, 0.9]); // bottom-left
    // A parallelogram is affine; the centre maps to the centre.
    const sq = squareToQuad([
      [0, 0],
      [2, 0],
      [3, 1],
      [1, 1],
    ])!;
    close(project(sq, 0.5, 0.5), [1.5, 0.5]);
    expect(
      squareToQuad([
        [0, 0],
        [1, 0],
        [2, 0],
        [3, 0],
      ]),
    ).toBeNull();
  });

  it('dragging moves and stretches in whole mm, snapping edges to the wall ends, floor and ceiling', () => {
    const wall = { len: 3000, height: 2500 };
    const r = { x: 0, y: 0, w: 3000, h: 2500 };
    expect(dragPicture(r, 'move', -400.4, 120.6, wall, true)).toEqual({
      x: -400,
      y: 121,
      w: 3000,
      h: 2500,
    });
    expect(dragPicture(r, 'move', 40, -30, wall, true)).toEqual(r);
    expect(dragPicture(r, 'move', 40, -30, wall, false)).toEqual({
      x: 40,
      y: -30,
      w: 3000,
      h: 2500,
    });
    const small = { x: 500, y: 500, w: 1000, h: 1000 };
    expect(dragPicture(small, 'e', 1450, 0, wall, true)).toEqual({ ...small, w: 2500 });
    expect(dragPicture(small, 'e', 1440, 0, wall, true).w).toBe(2500);
    expect(dragPicture(small, 'e', 1440, 0, wall, false).w).toBe(2440);
    expect(dragPicture(small, 'sw', -480, -470, wall, true)).toEqual({
      x: 0,
      y: 0,
      w: 1500,
      h: 1500,
    });
    expect(dragPicture(small, 'n', 0, 1000 + SNAP_RANGE, wall, true).h).toBe(2000);
    expect(dragPicture(small, 'ne', 520, 300, wall, false)).toEqual({
      x: 500,
      y: 500,
      w: 1520,
      h: 1300,
    });
    // Free stretch: an edge dragged past the opposite one stops 1 mm short.
    expect(dragPicture(small, 'w', 5000, 0, wall, false)).toEqual({
      x: 1499,
      y: 500,
      w: 1,
      h: 1000,
    });
    expect(rectLabel(wholeWall(room(), 0))).toBe('From left 0 · From floor 0 · W 3000 × H 2500 mm');
  });

  it('wall coordinates: left end seen from inside, the plane under a ray, and spans around the picture', () => {
    const r = room();
    expect(wallAxes(r, 0)).toEqual({ left: [0, 0], right: [1, 0], inward: [0, 1] });
    // Wall 2 (x = 3000, z 0 → 2000) seen from inside: its left end is the back corner.
    expect(wallAxes(r, 1).left).toEqual([3000, 0]);
    const hit = wallPlanePoint({ origin: [1000, 1200, 4000], dir: [0, 0, -1] }, r, 0)!;
    expect(hit).toEqual({ u: 1000, y: 1200 });
    expect(wallPlanePoint({ origin: [1000, 1200, 4000], dir: [1, 0, 0] }, r, 0)).toBeNull();
    const boxes = roomDisplayBoxes(r);
    const span = boxSpan(r, 0, boxes.walls[boxes.wallOf.indexOf(0)]);
    expect(span).toEqual({ u0: 0, u1: 3000, y0: 0, y1: 2500 });
    const parts = splitSpan(span, { x: 1000, y: 500, w: 1000, h: 1000 });
    expect(parts[0]).toEqual({
      u0: 1000,
      u1: 2000,
      y0: 500,
      y1: 1500,
      picture: { s0: 0, s1: 1, t0: 0, t1: 1 },
    });
    const area = parts.reduce((a, q) => a + (q.u1 - q.u0) * (q.y1 - q.y0), 0);
    expect(area).toBe(3000 * 2500);
    expect(splitSpan(span, { x: -200, y: 0, w: 3400, h: 2500 })[0].picture!.s0).toBeCloseTo(
      200 / 3400,
    );
  });
});
