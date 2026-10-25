import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { cutlist, hardwareSummary } from '../src/core/cutlist';
import { templates } from '../src/core/design';
import { estimate, parsePricesCsv, pricesCsv, type PriceEntry } from '../src/core/prices';
import {
  buildProjectModel,
  makeItem,
  materialKey,
  newProject,
  projectCutlist,
  projectHardware,
  suggestRunParts,
  validateProject,
  type Project,
} from '../src/core/project';
import {
  projectFromTemplate,
  templateFromProject,
  validateProjectTemplate,
} from '../src/core/projectTemplate';
import { shoppingCsvRo, shoppingList } from '../src/core/shopping';
import { shapeOutline } from '../src/core/room';
import type { Design, Space } from '../src/core/types';
import {
  db,
  deleteImages,
  listPrices,
  listProjectTemplates,
  loadImage,
  saveImage,
  saveProjectTemplate,
  savePrices,
} from '../src/persist/db';
import { projectTemplateFile, readProjectTemplateFile } from '../src/persist/projectTemplateFile';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
function kitchen(): Project {
  let p = newProject('Kitchen');
  for (const id of ['base-door', 'base-door', 'chest'])
    p = { ...p, items: [...p.items, makeItem(p, t(id))] };
  p = {
    ...p,
    items: p.items.map((it) => ({
      ...it,
      position: { ...it.position, x: it.position.x + 300, z: 50 },
    })),
  };
  return { ...p, runParts: suggestRunParts(p), runSettings: { scribe: 10, auto: true } };
}

describe('project templates (ADR-060)', () => {
  it('save → use gives the same pieces at the same relative places, new ids, run parts suggested again', () => {
    const p = kitchen();
    const tpl = templateFromProject(p, 'My kitchen');
    expect(validateProjectTemplate(tpl)).toEqual([]);
    expect(tpl.items[0].offset).toEqual({ x: 0, y: 0, z: 0 });
    const q = projectFromTemplate(tpl, 'Copy');
    expect(validateProject(q)).toEqual([]);
    expect(q.items.map((i) => i.design.name)).toEqual(p.items.map((i) => i.design.name));
    expect(q.items.some((i) => p.items.some((j) => j.id === i.id))).toBe(false);
    expect(q.items[1].position.x - q.items[0].position.x).toBe(
      p.items[1].position.x - p.items[0].position.x,
    );
    // Run parts are suggested again for where the pieces now stand (against the corner: no left cover).
    expect(q.runParts).toEqual(suggestRunParts(q));
    expect(q.runParts!.some((r) => r.kind === 'worktop')).toBe(true);
    expect(q.runSettings).toEqual({ scribe: 10, auto: true });
    expect(buildProjectModel(q).diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });
  it('the room is optional; with it, positions stay absolute', () => {
    const p = {
      ...kitchen(),
      room: {
        height: 2500,
        outline: shapeOutline('rectangle', {
          width: 4000,
          depth: 3000,
          cutWidth: 0,
          cutDepth: 0,
          offset: 0,
        }),
        features: [],
      },
    };
    expect(templateFromProject(p, 'a').room).toBeUndefined();
    const withRoom = templateFromProject(p, 'b', { includeRoom: true });
    expect(withRoom.room).toBeDefined();
    expect(projectFromTemplate(withRoom).items[0].position.x).toBe(p.items[0].position.x);
  });
  it('stored in Dexie v7 next to everything else; an unreadable row is skipped and kept', async () => {
    expect(db.verno).toBe(8);
    const tpl = templateFromProject(kitchen(), 'Stored');
    await saveProjectTemplate(tpl);
    await db.projectTemplates.put({
      id: 'bad',
      name: 'bad',
      updatedAt: '2020',
      template: { nope: 1 } as never,
    });
    const list = await listProjectTemplates();
    expect(list.map((x) => x.id)).toContain(tpl.id);
    expect(list.map((x) => x.id)).not.toContain('bad');
    expect(await db.projectTemplates.get('bad')).toBeDefined();
  });
  it('a v6 database upgrades to v7 keeping its tables', async () => {
    const name = 'upgrade-test';
    const old = new Dexie(name);
    old.version(6).stores({
      designs: 'id, updatedAt, name',
      projects: 'id, updatedAt, name',
      templates: 'id, updatedAt',
      researchDocs: 'key, docId',
      researchMarks: 'id, updatedAt',
      images: 'id',
      decors: 'id',
    });
    await old.open();
    await old.table('decors').put({ id: 'x' });
    old.close();
    const { db: _ } = await import('../src/persist/db');
    void _;
    const Fresh = (await import('../src/persist/db')).db.constructor as new (
      n: string,
    ) => typeof db;
    const nw = new Fresh(name);
    await nw.open();
    expect(nw.verno).toBe(8);
    expect(await nw.decors.get('x')).toBeDefined();
    expect(await nw.prices.count()).toBe(0);
    nw.close();
  });
});

describe('project templates: bad input, removed run parts, pictures (review of ADR-060)', () => {
  it('a malformed template is reported, never thrown (quarter turn with a run recipe, every item field)', () => {
    const tpl = templateFromProject(kitchen(), 'Bad');
    expect(tpl.runRecipe).toBeDefined();
    const item = (patch: Record<string, unknown>) => ({
      ...tpl,
      items: tpl.items.map((it, n) => (n === 0 ? { ...it, ...patch } : it)),
    });
    const bad: [unknown, RegExp][] = [
      [item({ rotationY: 45 }), /quarter turn/],
      [item({ quantity: 0 }), /quantity/],
      [item({ quantity: 2.5 }), /quantity/],
      [item({ quantity: 100 }), /quantity/],
      [item({ offset: { x: 1.5, y: 0, z: 0 } }), /offset/],
      [item({ offset: { x: 0, y: -1, z: 0 } }), /offset/],
      [item({ offset: null }), /offset/],
      [item({ placement: { kind: 'above', baseId: 'nope', gap: 0, offsetX: 0 } }), /placement/],
      [item({ placement: { kind: 'wall' } }), /placement/],
      [item({ ref: 7 }), /Invalid template item/],
      [item({ design: null }), /Item/],
      [{ ...tpl, items: [tpl.items[0], tpl.items[0]] }, /duplicate/],
      [{ ...tpl, runRecipe: { settings: { scribe: 300, auto: true } } }, /recipe/],
      [{ ...tpl, runRecipe: { settings: { scribe: 1.5, auto: true } } }, /recipe/],
      [{ ...tpl, runRecipe: { settings: { scribe: 0, auto: 'yes' } } }, /recipe/],
      [{ ...tpl, runRecipe: { settings: { scribe: 0, auto: true }, removed: [1] } }, /recipe/],
      [{ ...tpl, runRecipe: {} }, /recipe/],
    ];
    for (const [t, why] of bad) {
      let errs: string[] = [];
      expect(() => (errs = validateProjectTemplate(t))).not.toThrow();
      expect(errs.join(' ')).toMatch(why);
    }
  });
  it('a stored row that used to make the check throw is skipped and kept; the list still loads', async () => {
    const good = templateFromProject(kitchen(), 'Good');
    await saveProjectTemplate(good);
    const t45 = {
      ...good,
      id: 'turned-45',
      items: good.items.map((it, n) => (n === 0 ? { ...it, rotationY: 45 } : it)),
    };
    await db.projectTemplates.put({
      id: 'turned-45',
      name: 'x',
      updatedAt: '2030',
      template: t45 as never,
    });
    const list = await listProjectTemplates();
    expect(list.map((x) => x.id)).toContain(good.id);
    expect(list.map((x) => x.id)).not.toContain('turned-45');
    expect(await db.projectTemplates.get('turned-45')).toBeDefined();
  });
  it('run parts the user removed stay removed in projects made from the template (ids remapped)', () => {
    const p0 = kitchen();
    const gone = p0.runParts!.filter((r) => r.kind === 'worktop' || r.kind === 'cover');
    expect(gone.some((r) => r.kind === 'worktop')).toBe(true);
    expect(gone.some((r) => r.kind === 'cover')).toBe(true);
    const p: Project = {
      ...p0,
      runParts: p0.runParts!.filter((r) => !gone.includes(r)),
      runPartsRemoved: [...gone.map((r) => r.key!), 'filler|gone-a,gone-b'],
    };
    const tpl = templateFromProject(p, 'Without worktop');
    expect(tpl.runRecipe!.removed).toEqual(gone.map((r) => r.key!));
    expect(validateProjectTemplate(tpl)).toEqual([]);
    const q = projectFromTemplate(tpl);
    expect(validateProject(q)).toEqual([]);
    const ids = new Set(q.items.map((i) => i.id));
    expect(q.runPartsRemoved).toHaveLength(gone.length);
    for (const k of q.runPartsRemoved!) {
      expect(
        k
          .split('|')[1]
          .split(',')
          .every((id) => ids.has(id)),
      ).toBe(true);
    }
    expect(q.runPartsRemoved!.map((k) => k.split('|')[0])).toEqual(
      gone.map((r) => r.key!.split('|')[0]),
    );
    expect(q.runParts!.some((r) => r.kind === 'worktop')).toBe(false);
    expect(q.runParts!.filter((r) => r.kind === 'cover')).toEqual([]);
    // The template is used again for a second project: still removed, with that project's ids.
    const q2 = projectFromTemplate(tpl);
    expect(q2.runParts!.some((r) => r.kind === 'worktop')).toBe(false);
  });
  it('export carries the pictures; import on another device restores them and drops them from the template', async () => {
    const p0 = kitchen();
    await saveImage({
      id: 'img-tpl1',
      name: 'oak.jpg',
      type: 'image/jpeg',
      width: 2,
      height: 1,
      bytes: new Uint8Array([4, 5, 6]).buffer,
      createdAt: '',
    });
    const d = p0.items[0].design;
    const withImage = {
      ...d,
      materials: d.materials.map((m, i) =>
        i === 0
          ? { ...m, image: { id: 'img-tpl1', name: 'oak.jpg', tileLength: 1000, tileWidth: 500 } }
          : m,
      ),
    };
    const p = {
      ...p0,
      items: p0.items.map((it, i) => (i === 0 ? { ...it, design: withImage } : it)),
    };
    const tpl = templateFromProject(p, 'Pictured');
    const file = JSON.parse(JSON.stringify(await projectTemplateFile(tpl)));
    expect(file.pictures).toHaveLength(1);
    await deleteImages(['img-tpl1']); // "another device"
    const r = await readProjectTemplateFile(file);
    if (!r.ok) throw new Error(r.error);
    expect(r.problems).toEqual([]);
    expect('pictures' in r.template).toBe(false);
    expect(r.template.id).not.toBe(tpl.id);
    expect(validateProjectTemplate(r.template)).toEqual([]);
    expect(new Uint8Array((await loadImage('img-tpl1'))!.bytes)).toEqual(new Uint8Array([4, 5, 6]));
    // A template without pictures exports unchanged.
    const plain = templateFromProject(kitchen(), 'Plain');
    expect(await projectTemplateFile(plain)).toEqual(plain);
  });
  it('importing a broken template file names the template problem, not a JSON error', async () => {
    const tpl = templateFromProject(kitchen(), 'Broken');
    const file = {
      ...tpl,
      items: tpl.items.map((it, n) => (n === 0 ? { ...it, rotationY: 45 } : it)),
    };
    const r = await readProjectTemplateFile(JSON.parse(JSON.stringify(file)));
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.error).toMatch(/^That file is not a valid project template: .*quarter turn/);
  });
});

describe('shopping list (ADR-064) and estimate (ADR-062)', () => {
  const sink = (): Design => {
    const d = t('chest');
    const fix = (s: Space): Space =>
      s.kind === 'drawers'
        ? { ...s, fixedTop: true }
        : s.kind === 'split'
          ? { ...s, children: s.children.map(fix) }
          : s;
    return d.product.kind === 'cabinet'
      ? {
          ...d,
          product: {
            ...d.product,
            params: { ...d.product.params, interior: fix(d.product.params.interior) },
          },
        }
      : d;
  };
  /** Three base units whose sides stand on the bottom, so the run gets a worktop and a run plinth. */
  const underRun = (): Project => {
    let p = newProject('Under');
    for (let i = 0; i < 3; i++) {
      const d = t('base-door');
      const under: Design =
        d.product.kind === 'cabinet'
          ? {
              ...d,
              product: { ...d.product, params: { ...d.product.params, bottom: 'under' } },
            }
          : d;
      p = { ...p, items: [...p.items, makeItem(p, under)] };
    }
    p = {
      ...p,
      items: p.items.map((it) => ({ ...it, position: { ...it.position, x: it.position.x + 300 } })),
    };
    return { ...p, runParts: suggestRunParts(p), runSettings: { scribe: 0, auto: true } };
  };
  it('lists boards, banding, hardware, run parts, and what is still to choose; screws are not counted', () => {
    let p = underRun();
    expect(p.runParts!.some((r) => r.kind === 'plinth')).toBe(true);
    p = {
      ...p,
      items: [...p.items, { ...makeItem(p, sink()), position: { x: 5000, y: 0, z: 0 } }],
    };
    const pm = buildProjectModel(p);
    const lines = shoppingList({
      rows: projectCutlist(p),
      materials: pm.materials,
      hardware: projectHardware(p),
      sheets: null,
      runParts: p.runParts,
    });
    const sections = new Set(lines.map((l) => l.section));
    for (const s of ['boards', 'banding', 'hardware', 'run', 'choose'] as const)
      expect(sections.has(s)).toBe(true);
    const run = lines.filter((l) => l.section === 'run').map((l) => l.label);
    expect(run).toContain('Worktop');
    expect(run).toContain('Plinth');
    expect(lines.find((l) => l.section === 'run' && l.label === 'Plinth')!.detail).toMatch(
      /^1800 × 100 × \d+ mm, /,
    );
    expect(lines.find((l) => l.section === 'choose')!.label).toMatch(/fixed \(false\) front/);
    expect(lines.some((l) => l.section === 'hardware' && /runner/i.test(l.label))).toBe(true);
    const tall = buildModel(t('wardrobe'));
    const safety = shoppingList({
      rows: [],
      materials: [],
      hardware: [],
      sheets: null,
      diagnostics: [
        ...tall.diagnostics,
        { severity: 'warning', code: 'anti-tip', message: 'Fix it to the wall.' },
      ],
    });
    expect(safety.some((l) => l.section === 'choose' && l.label === 'Anti-tip fixing')).toBe(true);
    const csv = shoppingCsvRo(lines);
    expect(csv).toContain('Plăci');
    expect(csv).toContain('not counted');
  });
  it('with a sheet count from the layout, a board is bought in sheets (m² kept for per-m² prices)', () => {
    const p = underRun();
    const rows = projectCutlist(p);
    const materials = buildProjectModel(p).materials;
    const board = rows.find((r) => !r.solid)!.materialId;
    const lines = shoppingList({
      rows,
      materials,
      hardware: projectHardware(p),
      sheets: new Map([[board, 3]]),
      runParts: p.runParts,
    });
    const m = materials.find((x) => x.id === board)!;
    const line = lines.find(
      (l) => l.section === 'boards' && l.priceKey === `board:${materialKey(m)}`,
    )!;
    expect(line.unit).toBe('sheet');
    expect(line.quantity).toBe(3);
    expect(line.sheets).toBe(3);
    expect(line.m2).toBeGreaterThan(0);
    const others = lines.filter((l) => l.section === 'boards' && l !== line && l.unit !== 'm');
    expect(others.every((l) => l.unit === 'm2' && l.sheets === null)).toBe(true);
  });
  it('an oven niche is to choose before buying; hardware counts follow the number of copies', () => {
    const d = t('base-door');
    const oven: Design =
      d.product.kind === 'cabinet'
        ? {
            ...d,
            name: 'Oven unit',
            product: {
              ...d.product,
              params: {
                ...d.product.params,
                interior: {
                  id: 'oven',
                  kind: 'empty',
                  appliance: { kind: 'oven', w: 560, h: 590, d: 550 },
                },
              },
            },
          }
        : d;
    let p = newProject('Niche');
    p = {
      ...p,
      items: [
        makeItem(p, oven),
        { ...makeItem(p, t('base-door')), position: { x: 700, y: 0, z: 0 } },
      ],
    };
    const list = (q: Project) =>
      shoppingList({
        rows: projectCutlist(q),
        materials: buildProjectModel(q).materials,
        hardware: projectHardware(q),
        sheets: null,
      });
    expect(list(p).some((l) => l.section === 'choose' && /oven/i.test(l.label))).toBe(true);
    const hinges = (q: Project) =>
      list(q)
        .filter((l) => l.section === 'hardware' && /hinge/i.test(l.label))
        .reduce((n, l) => n + l.quantity, 0);
    const two = { ...p, items: p.items.map((it, i) => (i === 1 ? { ...it, quantity: 2 } : it)) };
    expect(hinges(p)).toBeGreaterThan(0);
    expect(hinges(two)).toBe(2 * hinges(p));
  });
  it('estimate per sheet and per m²; missing prices are listed and nothing is guessed; CSV round trip', () => {
    const d = t('chest'),
      m = buildModel(d);
    const rows = cutlist(m, d.materials);
    const body = d.materials.find((x) => rows.some((r) => r.materialId === x.id))!;
    const sheets = new Map([[body.id, 2]]);
    const lines = shoppingList({
      rows,
      materials: d.materials,
      hardware: hardwareSummary(m),
      sheets,
    });
    const board = lines.find((l) => l.priceKey === `board:${materialKey(body)}`)!;
    expect(board.unit).toBe('sheet');
    const perSheet: PriceEntry = { id: board.priceKey!, unit: 'sheet', amount: 25000 };
    const e1 = estimate(lines, [perSheet]);
    expect(e1.total).toBe(50000);
    expect(e1.missing.length).toBe(lines.filter((l) => l.priceKey).length - 1);
    const perM2: PriceEntry = { ...perSheet, unit: 'm2', amount: 10000 };
    expect(estimate(lines, [perM2]).total).toBe(Math.round(board.m2! * 10000));
    const csv = pricesCsv([perSheet, { id: 'currency', unit: 'piece', amount: 0, text: 'EUR' }]);
    const back = parsePricesCsv(csv);
    expect(back.problems).toEqual([]);
    expect(back.prices).toEqual([
      perSheet,
      { id: 'currency', unit: 'piece', amount: 0, text: 'EUR' },
    ]);
    expect(
      parsePricesCsv('key;unit;price\nboard:x;sheet;abc\nboard:y;bad;1').problems,
    ).toHaveLength(2);
  });
  it('prices are stored on this device; unreadable rows are skipped and kept', async () => {
    await savePrices([{ id: 'hw:Knob', unit: 'piece', amount: 350 }]);
    await db.prices.put({ id: 'broken', unit: 'x', amount: -1 } as never);
    const list = await listPrices();
    expect(list.map((p) => p.id)).toContain('hw:Knob');
    expect(list.map((p) => p.id)).not.toContain('broken');
    expect(await db.prices.get('broken')).toBeDefined();
  });
});
