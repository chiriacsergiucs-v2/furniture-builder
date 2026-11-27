import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { encodeRow } from '../src/core/backup';
import { bytesToBase64, MAX_FILE_PICTURES, sniffPictureType } from '../src/core/surface';
import { db, loadImage, saveImage } from '../src/persist/db';
import { restoreFiles } from '../src/persist/backup';
import { takePictures, type PictureEncoder } from '../src/persist/images';

// G-542, G-565: pictures carried in an imported file or a backup go through the same decode and re-encode as a picked
// picture; their bytes must match their declared type, and a file carries at most MAX_FILE_PICTURES of them.

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 1, 2, 3];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0];
const WEBP = [0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0];
const b64 = (bytes: number[]) => bytesToBase64(new Uint8Array(bytes).buffer);
const pic = (id: string, type = 'image/jpeg', bytes = JPEG) => ({
  id,
  name: `${id}.jpg`,
  type,
  width: 4,
  height: 2,
  data: b64(bytes),
});

/** Stands in for the browser's decode and re-encode: records what it got, returns new JPEG bytes. */
const encoder = () => {
  const seen: string[] = [];
  const encode: PictureEncoder = async (bytes, type, name) => {
    seen.push(`${name}:${type}:${bytes.byteLength}`);
    return {
      ok: true,
      bytes: new Uint8Array([0xff, 0xd8, 0xff, 9]).buffer,
      type: 'image/jpeg',
      width: 3,
      height: 1,
      color: '#000000',
    };
  };
  return { seen, encode };
};
const refuse: PictureEncoder = async (_b, _t, name) => ({
  ok: false,
  problem: `${name} is broken`,
});

beforeEach(async () => {
  await db.images.clear();
});

describe('picture bytes (G-565)', () => {
  it('tells PNG, JPEG and WebP apart by their first bytes', () => {
    expect(sniffPictureType(new Uint8Array(JPEG).buffer)).toBe('image/jpeg');
    expect(sniffPictureType(new Uint8Array(PNG).buffer)).toBe('image/png');
    expect(sniffPictureType(new Uint8Array(WEBP).buffer)).toBe('image/webp');
    expect(sniffPictureType(new Uint8Array([0x3c, 0x73, 0x76, 0x67]).buffer)).toBeUndefined();
    expect(sniffPictureType(new ArrayBuffer(0))).toBeUndefined();
  });
});

describe('pictures in an imported file (G-542, G-565)', () => {
  it('each picture is re-encoded before it is stored, under its own id', async () => {
    const { seen, encode } = encoder();
    const { data, problems } = await takePictures(
      { a: 1, pictures: [pic('img-a'), pic('img-b', 'image/png', PNG)] },
      db,
      encode,
    );
    expect(problems).toEqual([]);
    expect(data).toEqual({ a: 1 });
    expect(seen).toEqual(['img-a.jpg:image/jpeg:7', 'img-b.jpg:image/png:9']);
    const a = await loadImage('img-a');
    expect([...new Uint8Array(a!.bytes)]).toEqual([0xff, 0xd8, 0xff, 9]);
    expect([a!.type, a!.width, a!.height]).toEqual(['image/jpeg', 3, 1]);
  });

  it('a picture whose bytes do not match its type is refused and reported', async () => {
    const { seen, encode } = encoder();
    const { problems } = await takePictures(
      { pictures: [pic('img-svg', 'image/png', [0x3c, 0x73, 0x76, 0x67])] },
      db,
      encode,
    );
    expect(problems).toEqual(['A picture was skipped: picture bytes do not match its type.']);
    expect(seen).toEqual([]);
    expect(await loadImage('img-svg')).toBeUndefined();
  });

  it('a picture the browser cannot decode is refused and reported', async () => {
    const { problems } = await takePictures({ pictures: [pic('img-x')] }, db, refuse);
    expect(problems).toEqual(['img-x.jpg is broken']);
    expect(await loadImage('img-x')).toBeUndefined();
  });

  it('a picture already on this device is kept as it is', async () => {
    const mine = {
      id: 'img-mine',
      name: 'mine',
      type: 'image/jpeg',
      width: 1,
      height: 1,
      bytes: new Uint8Array(JPEG).buffer,
      createdAt: '2026-11-01',
    };
    await saveImage(mine);
    const { seen, encode } = encoder();
    const { problems } = await takePictures({ pictures: [pic('img-mine')] }, db, encode);
    expect(problems).toEqual([]);
    expect(seen).toEqual([]);
    expect(await loadImage('img-mine')).toEqual(mine);
  });

  it(`reads at most ${MAX_FILE_PICTURES} pictures and reports the rest`, async () => {
    const { seen, encode } = encoder();
    const many = Array.from({ length: MAX_FILE_PICTURES + 2 }, (_, i) => pic(`img-${i}`));
    const { problems } = await takePictures({ pictures: many }, db, encode);
    expect(seen).toHaveLength(MAX_FILE_PICTURES);
    expect(problems).toEqual([
      `The file holds ${MAX_FILE_PICTURES + 2} pictures; 2 over the limit of ${MAX_FILE_PICTURES} were skipped.`,
    ]);
    expect(await loadImage(`img-${MAX_FILE_PICTURES}`)).toBeUndefined();
    expect(await db.images.count()).toBe(MAX_FILE_PICTURES);
  });
});

describe('pictures in a backup (G-542)', () => {
  const row = (id: string, bytes = JPEG) => ({
    path: `images/${id}.json`,
    text: encodeRow({
      id,
      name: `${id}.jpg`,
      type: 'image/jpeg',
      width: 4,
      height: 2,
      bytes: new Uint8Array(bytes).buffer,
      createdAt: '2026-11-27',
    }),
  });

  it('a restored picture is re-encoded before it is stored', async () => {
    const { seen, encode } = encoder();
    const plan = await restoreFiles([row('img-r')], encode);
    expect(plan.skipped).toEqual([]);
    expect(seen).toEqual(['img-r.jpg:image/jpeg:7']);
    const r = await loadImage('img-r');
    expect([...new Uint8Array(r!.bytes)]).toEqual([0xff, 0xd8, 0xff, 9]);
    expect([r!.width, r!.height, r!.createdAt]).toEqual([3, 1, '2026-11-27']);
  });

  it('a picture that cannot be decoded is listed and nothing else is lost', async () => {
    const plan = await restoreFiles(
      [row('img-bad'), { path: 'prices/p1.json', text: '{"id":"p1","unit":"piece","amount":1}' }],
      refuse,
    );
    expect(plan.skipped).toEqual([
      { path: 'images/img-bad.json', reason: 'img-bad.jpg is broken' },
    ]);
    expect(plan.actions.map((a) => a.table)).toEqual(['prices']);
    expect(await loadImage('img-bad')).toBeUndefined();
    expect(await db.prices.get('p1')).toBeTruthy();
  });
});
