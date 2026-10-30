// ADR-162: the script that downloads Regency board pictures for the app to ship.
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pictureExt as appExt } from '../src/core/sellers';
import {
  download,
  markHosted,
  pictureExt,
  picturePlan,
  run,
} from '../tools/sellers/regency-pictures';

const catalog = () => ({
  imageBase: 'https://shop.example/media/cache/',
  products: [
    { id: '1', k: 'board', i: 'a/one.jpg' },
    { id: '2', k: 'worktop', i: 'b/two.PNG' },
    { id: '3', k: 'edge-band', i: 'c/three.jpg' },
    { id: '4', k: 'board' },
    { id: '5', k: 'board', i: 'https://evil.example/x.jpg' },
    { id: '../6', k: 'board', i: 'd/six.jpg' },
    { id: '7', k: 'hinge', i: 'e/seven.jpg', h: 1 as const },
  ],
});
const okFetch = (seen: string[]) => async (url: string) => {
  seen.push(url);
  return {
    ok: true,
    headers: { get: () => 'image/jpeg' },
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  };
};

describe('Regency board pictures (ADR-162)', () => {
  it('plans boards and worktops on the seller picture base only, and skips files already there', () => {
    const plan = picturePlan(catalog(), new Set(['2.png']));
    expect(plan).toEqual([
      { id: '1', url: 'https://shop.example/media/cache/a/one.jpg', file: '1.jpg' },
    ]);
    expect(picturePlan({ ...catalog(), imageBase: 'http://shop.example/' }, new Set())).toEqual([]);
  });
  it('names files the same way as the app', () => {
    for (const p of ['a.jpg', 'b.JPEG', 'c.png', 'd.webp', 'e.gif', 'f'])
      expect(pictureExt(p)).toBe(appExt(p));
  });
  it('marks h only on boards and worktops whose file exists', () => {
    const c = markHosted(catalog(), new Set(['1.jpg', '3.jpg', '7.jpg']), 'sellers/regency/');
    expect(c.hostedBase).toBe('sellers/regency/');
    expect(c.products.filter((p) => 'h' in p).map((p) => p.id)).toEqual(['1']);
  });
  it('saves only picture answers and counts the rest as failed', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pics-'));
    let n = 0;
    const r = await download(
      [
        { url: 'https://shop.example/a.jpg', file: 'a.jpg' },
        { url: 'https://shop.example/b.jpg', file: 'b.jpg' },
      ],
      dir,
      async () => ({
        ok: true,
        headers: { get: () => (n++ === 0 ? 'image/jpeg' : 'text/html') },
        arrayBuffer: async () => new Uint8Array([1]).buffer,
      }),
      1,
    );
    expect(r.saved).toBe(1);
    expect(r.failed).toEqual(['https://shop.example/b.jpg']);
    expect(readdirSync(dir)).toEqual(['a.jpg']);
  });
  it('runs end to end: downloads, then marks the catalog; a second run fetches nothing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pics-'));
    const path = join(dir, 'catalog.json');
    writeFileSync(path, JSON.stringify(catalog()));
    const seen: string[] = [];
    await run(path, join(dir, 'out'), okFetch(seen));
    expect(seen.sort()).toEqual([
      'https://shop.example/media/cache/a/one.jpg',
      'https://shop.example/media/cache/b/two.PNG',
    ]);
    const c = JSON.parse(readFileSync(path, 'utf8'));
    expect(c.products.filter((p: { h?: number }) => p.h).map((p: { id: string }) => p.id)).toEqual([
      '1',
      '2',
    ]);
    seen.length = 0;
    await run(path, join(dir, 'out'), okFetch(seen));
    expect(seen).toEqual([]);
  });
});
