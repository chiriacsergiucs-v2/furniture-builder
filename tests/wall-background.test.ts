import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  newProject,
  pictureHolders,
  PROJECT_SCHEMA,
  validateProject,
  type Project,
} from '../src/core/project';
import {
  keepWallFinishes,
  roomFrontView,
  setWallFinish,
  shapeOutline,
  wallFinish,
  type Room,
} from '../src/core/room';
import { imageIdsOf } from '../src/core/surface';
import {
  db,
  deleteImages,
  loadImage,
  loadProject,
  saveImage,
  saveProject,
  unusedImageIds,
} from '../src/persist/db';
import { takePictures, withPictures } from '../src/persist/images';
import { useDesign } from '../src/store/designStore';

const sizes = { width: 3000, depth: 2000, cutWidth: 0, cutDepth: 0, offset: 0 };
const room = (): Room => ({
  height: 2500,
  outline: shapeOutline('rectangle', sizes),
  features: [],
  shape: { kind: 'rectangle', sizes },
});
const tiles = { id: 'img-wall1', name: 'tiles.png', tileWidth: 300, tileHeight: 300 };
const withWalls = (): Project => {
  let r = setWallFinish(room(), 0, { colour: '#4682a0', image: tiles });
  r = setWallFinish(r, 1, { colour: '#e8b04a' });
  return { ...newProject('Walls'), room: r };
};

describe('wall backgrounds (ADR-145)', () => {
  it('set per wall, back to plain with undefined; validated without throwing', () => {
    const p = withWalls();
    expect(p.schemaVersion).toBe(PROJECT_SCHEMA);
    expect(PROJECT_SCHEMA).toBe(14);
    expect(wallFinish(p.room!, 0)?.image?.tileWidth).toBe(300);
    expect(wallFinish(p.room!, 1)?.colour).toBe('#e8b04a');
    expect(wallFinish(p.room!, 2)).toBeUndefined();
    expect(validateProject(JSON.parse(JSON.stringify(p)))).toEqual([]);
    const plain = setWallFinish(setWallFinish(p.room!, 0, undefined), 1, undefined);
    expect(plain.walls).toBeUndefined();
    const bad = (walls: unknown) => validateProject({ ...p, room: { ...p.room!, walls } as never });
    expect(bad([{ wall: 9, colour: '#ffffff' }])).toContain('Invalid wall background');
    expect(bad([{ wall: 0, colour: 'red' }])).toContain('Invalid wall background');
    expect(bad([{ wall: 0, colour: '#ffffff', image: { ...tiles, tileWidth: 0 } }])).toContain(
      'Invalid wall background',
    );
    expect(
      bad([
        { wall: 0, colour: '#ffffff' },
        { wall: 0, colour: '#000000' },
      ]),
    ).toContain('Invalid wall background');
    expect(bad('x')).toContain('Invalid wall backgrounds');
  });

  it('versions 1–13 still load; wall backgrounds need version 14', () => {
    const p = withWalls();
    const { walls: _w, ...plainRoom } = p.room!;
    void _w;
    for (const v of [1, 9, 13])
      expect(validateProject({ ...p, schemaVersion: v, room: plainRoom })).toEqual([]);
    expect(validateProject({ ...p, schemaVersion: 13 })).toContain(
      'Wall backgrounds need project schemaVersion 14',
    );
  });

  it('redrawing the room drops the backgrounds of walls it no longer has', () => {
    const p = withWalls();
    const r = setWallFinish(p.room!, 3, { colour: '#7a9a6b' });
    expect(keepWallFinishes(r.walls, shapeOutline('rectangle', sizes)).walls).toHaveLength(3);
    const three: [number, number][] = [
      [0, 0],
      [3000, 0],
      [0, 2000],
    ];
    expect(keepWallFinishes(r.walls, three).walls!.map((f) => f.wall)).toEqual([0, 1]);
    useDesign.setState({ project: { ...p, room: r }, drawingRoom: three });
    expect(useDesign.getState().finishDrawRoom()).toBe(true);
    expect(useDesign.getState().project!.room!.walls!.map((f) => f.wall)).toEqual([0, 1]);
  });

  it('the front view lists the back wall for its background', () => {
    const fv = roomFrontView(withWalls().room!)!;
    expect(fv.walls).toEqual([{ wall: 0, x: 0, w: 3000 }]);
  });

  it('saves and loads; an exported project carries wall pictures; cleanup keeps them', async () => {
    await db.images.clear();
    await saveImage({
      id: tiles.id,
      name: tiles.name,
      type: 'image/jpeg',
      width: 2,
      height: 2,
      bytes: new Uint8Array([4, 5, 6]).buffer,
      createdAt: '',
    });
    const p = withWalls();
    await saveProject(p);
    expect((await loadProject(p.id))!.room!.walls).toEqual(p.room!.walls);
    expect([...imageIdsOf(pictureHolders(p))]).toEqual([tiles.id]);
    expect(await unusedImageIds()).toEqual([]);
    const file = JSON.parse(JSON.stringify(await withPictures(p, pictureHolders(p))));
    expect(file.pictures.map((x: { id: string }) => x.id)).toEqual([tiles.id]);
    await deleteImages([tiles.id]); // "another device"
    const { data, problems } = await takePictures(file);
    expect(problems).toEqual([]);
    expect(validateProject(data)).toEqual([]);
    expect(new Uint8Array((await loadImage(tiles.id))!.bytes)).toEqual(new Uint8Array([4, 5, 6]));
  });
});
