import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { templates, validateDesign } from '../src/core/design';
import { decorPatch, materialLabel, parseDecorList } from '../src/core/materials';
import { base64ToBytes, bytesToBase64, pictureFileProblems } from '../src/core/surface';
import type { Design, Material } from '../src/core/types';
import {
  db,
  deleteImages,
  listDecors,
  loadImage,
  replaceDecors,
  saveDesign,
  saveImage,
  unusedImageIds,
} from '../src/persist/db';
import { takePictures, withPictures } from '../src/persist/images';

const patch = (d: Design, id: string, p: Partial<Material>): Design => ({
  ...d,
  materials: d.materials.map((m) => (m.id === id ? { ...m, ...p } : m)),
});
const desk = () => templates.find((t) => t.id === 'desk-pedestal')!.create();

describe('labels (ADR-049)', () => {
  it('are optional, validated, and shown after the name', () => {
    const d = templates[0].create();
    expect(validateDesign(patch(d, 'pal18', { maker: 'egger', kind: 'pal' }))).toEqual([]);
    expect(validateDesign(patch(d, 'pal18', { maker: 'ikea' as never })).join()).toMatch(
      /unknown manufacturer/,
    );
    expect(validateDesign(patch(d, 'pal18', { kind: 'glass' as never })).join()).toMatch(
      /unknown type/,
    );
    expect(validateDesign(patch(d, 'pal18', { decor: { code: '', list: 'x' } })).join()).toMatch(
      /invalid decor link/,
    );
    expect(materialLabel({ name: 'PAL 18 white' })).toBe('PAL 18 white');
    expect(materialLabel({ name: 'H1145', maker: 'egger', kind: 'worktop' })).toBe(
      'H1145 · Egger, Kitchen worktop',
    );
  });
  it('labels never change the parts', () => {
    const d = templates[0].create();
    expect(buildModel(patch(d, 'pal18', { maker: 'kronospan', kind: 'mdf' })).panels).toEqual(
      buildModel(d).panels,
    );
  });
  it('a worktop board on a worktop part is fine; on other parts it is a guidance warning, never an error', () => {
    const top = buildModel(patch(desk(), 'pal18oak', { kind: 'worktop' })).diagnostics.filter(
      (x) => x.code === 'worktop-board',
    );
    expect(top).toEqual([]);
    const body = buildModel(patch(desk(), 'pal18', { kind: 'worktop' })).diagnostics.filter(
      (x) => x.code === 'worktop-board',
    );
    expect(body).toHaveLength(1);
    expect(body[0].severity).toBe('warning');
    expect(body[0].message).toMatch(/labelled kitchen worktop.*\(guidance\)/);
  });
});

describe("the user's decor list", () => {
  it('reads comma or semicolon CSV with English or Romanian headers, quotes and a BOM', () => {
    const en = parseDecorList(
      '﻿manufacturer,type,code,name,thickness,color\nEgger,PAL,H1145 ST10,"Natural Bardolino Oak, grey",18,#B59A7A\nKronospan,Kitchen worktop,K001,Craft Oak,38,#a07850\n',
      'mine.csv',
    );
    expect(en.problems).toEqual([]);
    expect(en.decors.map((d) => [d.maker, d.kind, d.code, d.name, d.thickness, d.color])).toEqual([
      ['egger', 'pal', 'H1145 ST10', 'Natural Bardolino Oak, grey', 18, '#b59a7a'],
      ['kronospan', 'worktop', 'K001', 'Craft Oak', 38, '#a07850'],
    ]);
    const ro = parseDecorList(
      'Producător;Tip;Cod;Denumire;Grosime;Culoare\nKastamonu;MDF;D123;Alb mat;18;#f0f0f0\nAltul SRL;blat;X1;Piatră;28;#888888',
      'ro.csv',
    );
    expect(ro.problems).toEqual([]);
    expect(ro.decors.map((d) => [d.maker, d.makerText, d.kind])).toEqual([
      ['kastamonu', 'Kastamonu', 'mdf'],
      ['other', 'Altul SRL', 'worktop'],
    ]);
  });
  it('skips and lists bad rows; refuses a file without the columns; never throws', () => {
    const r = parseDecorList(
      'manufacturer,type,code,name,thickness,color\nEgger,PAL,A,a,18.5,#ffffff\nEgger,PAL,B,b,18,white\n,PAL,C,c,18,#ffffff\nEgger,PAL,D,d,18,#ffffff\nEgger,PAL,D,d again,18,#ffffff',
      'x.csv',
    );
    expect(r.decors.map((d) => d.code)).toEqual(['D']);
    expect(r.problems).toEqual([
      'Row 2: thickness "18.5" is not whole mm from 1 to 200.',
      'Row 3: color "white" is not #rrggbb.',
      'Row 4: no manufacturer.',
      'Row 6: Egger D 18 mm is listed twice; the first is kept.',
    ]);
    expect(parseDecorList('code,name\nA,b', 'x').problems[0]).toMatch(
      /missing: manufacturer, type, thickness, color/,
    );
    expect(parseDecorList('', 'x').problems).toEqual(['The file is empty.']);
    expect(() => parseDecorList('"unterminated,,,\n;;;', 'x')).not.toThrow();
  });
  it('choosing a decor sets only what the list says, traced to the list', () => {
    const [d] = parseDecorList(
      'manufacturer,type,code,name,thickness,color\nFundermax,PAL,0074,Grey,19,#808080',
      'fm.csv',
    ).decors;
    expect(decorPatch(d)).toEqual({
      name: 'Fundermax 0074 Grey',
      thickness: 19,
      color: '#808080',
      maker: 'fundermax',
      kind: 'pal',
      decor: { code: '0074', list: 'fm.csv' },
    });
    const design = patch(templates[0].create(), 'mdf18', decorPatch(d));
    expect(validateDesign(design)).toEqual([]);
  });
  it('a new list replaces the stored one', async () => {
    await replaceDecors(
      parseDecorList(
        'manufacturer,type,code,name,thickness,color\nEgger,PAL,A,a,18,#ffffff\nEgger,PAL,B,b,18,#ffffff',
        'one.csv',
      ).decors,
    );
    await replaceDecors(
      parseDecorList(
        'manufacturer,type,code,name,thickness,color\nEgger,MDF,C,c,18,#ffffff',
        'two.csv',
      ).decors,
    );
    expect((await listDecors()).map((d) => `${d.list}:${d.code}`)).toEqual(['two.csv:C']);
  });
});

describe('pictures inside exported files (ADR-048)', () => {
  const pic = (id: string) => ({
    id,
    name: `${id}.jpg`,
    type: 'image/jpeg',
    width: 2,
    height: 1,
    bytes: new Uint8Array([9, 8, 7]).buffer,
    createdAt: '',
  });
  it('base64 round trip', () => {
    const bytes = new Uint8Array(70000).map((_, i) => i % 251).buffer;
    expect(new Uint8Array(base64ToBytes(bytesToBase64(bytes)))).toEqual(new Uint8Array(bytes));
  });
  it('export carries every picture the design uses; import on another device restores them', async () => {
    await saveImage(pic('img-exp1'));
    const d = patch(templates[0].create(), 'pal18', {
      image: { id: 'img-exp1', name: 'a.jpg', tileLength: 1000, tileWidth: 500 },
    });
    const file = JSON.parse(JSON.stringify(await withPictures(d, [d])));
    expect(file.pictures).toHaveLength(1);
    expect(validateDesign(file)).toEqual([]);
    await deleteImages(['img-exp1']); // "another device"
    const { data, problems } = await takePictures(file);
    expect(problems).toEqual([]);
    expect(data).toEqual(JSON.parse(JSON.stringify(d)));
    expect(new Uint8Array((await loadImage('img-exp1'))!.bytes)).toEqual(new Uint8Array([9, 8, 7]));
  });
  it('a design without pictures exports unchanged; a bad picture is skipped and reported', async () => {
    const d = templates[0].create();
    expect(await withPictures(d, [d])).toEqual(d);
    expect(
      pictureFileProblems({
        id: 'x',
        name: 'x',
        type: 'image/gif',
        width: 1,
        height: 1,
        data: 'AAAA',
      }).join(),
    ).toMatch(/PNG, JPEG or WebP/);
    const { data, problems } = await takePictures({
      ...d,
      pictures: [
        { id: 'img-bad', name: 'b', type: 'image/jpeg', width: 1, height: 1, data: '%%%' },
      ],
    });
    expect(problems[0]).toMatch(/A picture was skipped: picture data must be base64/);
    expect(data).toEqual(d);
    expect(await loadImage('img-bad')).toBeUndefined();
  });
});

describe('cleaning up pictures', () => {
  it('lists only pictures no stored row or open piece refers to, including rows the app cannot read', async () => {
    await db.images.clear();
    for (const id of ['img-used', 'img-broken-row', 'img-open', 'img-orphan'])
      await saveImage({
        id,
        name: id,
        type: 'image/jpeg',
        width: 1,
        height: 1,
        bytes: new Uint8Array([1]).buffer,
        createdAt: '',
      });
    const d = patch(templates[0].create(), 'pal18', {
      image: { id: 'img-used', name: 'u', tileLength: 1000, tileWidth: 1000 },
    });
    await saveDesign(d);
    await db.projects.put({
      id: 'broken',
      name: 'B',
      updatedAt: '',
      project: { unreadable: { image: { id: 'img-broken-row' } } } as never,
    });
    expect((await unusedImageIds(['img-open'])).sort()).toEqual(['img-orphan']);
  });
});
