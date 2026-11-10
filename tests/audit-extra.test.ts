// The UI audit ADRs' Done-when items that a core or store test proves: ADR-249 (stepDrops), ADR-251 (left/right/centre
// along a side wall), ADR-252 (front-view box takes 3D models), ADR-253 (Kept: in Russian), ADR-258 (mayRepair),
// ADR-259 (model arrow keys use the drag's path), ADR-265 (board names in Russian messages).
import 'fake-indexeddb/auto';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { loadDictionary, setLang, t, tr } from '../src/core/i18n';
import { makeSpace, splitSpace, templates } from '../src/core/design';
import { stepDrops } from '../src/core/counts';
import {
  makeItem,
  newProject,
  placedBounds,
  resolvePlacements,
  type Project,
} from '../src/core/project';
import { alignItems } from '../src/core/align';
import { itemsInFrontBox } from '../src/core/selection';
import { makeModelItem } from '../src/core/model3d';
import { mayRepair } from '../src/core/repairs';
import { useDesign } from '../src/store/designStore';
import { buildModel } from '../src/core/build';
import { resizeProduct } from '../src/core/pieceSize';
import type { Space } from '../src/core/types';

beforeAll(() => loadDictionary('ru'));
afterEach(() => setLang('en'));
const tp = (id: string) => templates.find((x) => x.id === id)!.create();

describe('ADR-249 stepDrops', () => {
  it('asks only when the removed part holds something', () => {
    const empty = splitSpace(makeSpace('empty'), 'x', 3) as Extract<Space, { kind: 'split' }>;
    expect(stepDrops(empty, 'vdiv', -1)).toBeNull();
    const filled = {
      ...empty,
      children: [...empty.children.slice(0, -1), { ...makeSpace('drawers'), id: 'd' }],
    } as Space;
    expect(stepDrops(filled, 'vdiv', -1)).toBe('last');
    expect(stepDrops(filled, 'vdiv', 1)).toBeNull();
  });
});

describe('ADR-251 Left, Right and Centre along a side wall', () => {
  it('move the pieces along z only', () => {
    let p = newProject('Side');
    for (let i = 0; i < 2; i++) p = { ...p, items: [...p.items, makeItem(p, tp('base-door'))] };
    p = resolvePlacements({
      ...p,
      items: p.items.map((it, i) => ({
        ...it,
        rotationY: 90 as const,
        position: { ...it.position, x: 0, z: i === 0 ? 0 : 1000 },
      })),
    });
    for (const how of ['left', 'right', 'centre'] as const) {
      const r = alignItems(
        p,
        p.items.map((i) => i.id),
        how,
      );
      const b = resolvePlacements(r.project).items.map(placedBounds);
      const b0 = resolvePlacements(p).items.map(placedBounds);
      expect(b.map((x) => x.x)).toEqual(b0.map((x) => x.x));
      expect(b[1].z).toBe(b[0].z);
    }
  });
});

describe('ADR-252 front-view box', () => {
  it('takes a 3D model whose front extent it touches', () => {
    const m = makeModelItem(
      'm1',
      { id: 'mdl', name: 'Fridge', size: { w: 600, h: 1800, d: 650 } },
      2000,
    );
    const p: Project = { ...newProject('P'), models: [m] };
    const placed = new Map([[m.id, { x: 2000, y: 0, z: 0, w: 600, h: 1800, d: 650 }]]);
    expect(itemsInFrontBox(p, { x: 1900, y: 100 }, { x: 2100, y: 200 }, placed)).toEqual([m.id]);
  });
});

describe('ADR-253 Kept: in Russian', () => {
  it('is a translated text', () => {
    setLang('ru');
    expect(t('Kept: {list}.', { list: 'A' })).toBe('Сохранено: A.');
  });
});

describe('ADR-258 repair wording', () => {
  it('a connection-broken problem has no repair family; an overlap has one', () => {
    expect(
      mayRepair({ severity: 'error', code: 'connection-broken', message: '', itemIds: ['a'] }),
    ).toBe(false);
    expect(
      mayRepair({ severity: 'error', code: 'pieces-overlap', message: '', itemIds: ['a', 'b'] }),
    ).toBe(true);
  });
});

describe('ADR-259 model arrow keys', () => {
  it('dropModel moves a model by 10 mm in one undo step', () => {
    const m = makeModelItem(
      'm1',
      { id: 'mdl', name: 'Fridge', size: { w: 600, h: 1800, d: 650 } },
      2000,
    );
    useDesign.getState().openProject({ ...newProject('P'), models: [m] });
    const steps = useDesign.getState().projectPast.length;
    const x0 = useDesign.getState().project!.models![0].position.x;
    useDesign.getState().dropModel(m.id, 10, 0, false);
    expect(useDesign.getState().project!.models![0].position.x).toBe(x0 + 10);
    expect(useDesign.getState().projectPast.length).toBe(steps + 1);
  });
});

describe('ADR-265 board names in messages', () => {
  it('the shelf-span warning names a built-in board in Russian', () => {
    let found = false;
    for (const tpl of templates) {
      const base = tpl.create();
      const w = (base.product.params as unknown as { width?: number }).width;
      for (const by of [0, 300, 600]) {
        const d =
          w === undefined || by === 0
            ? base
            : { ...base, product: resizeProduct(base.product, 'width', w + by) };
        const en = buildModel(d).diagnostics.find((x) => x.code === 'shelf-span');
        if (!en) continue;
        setLang('ru');
        const ru = buildModel(d).diagnostics.find((x) => x.code === 'shelf-span')!;
        const board = d.materials.find((m) => en.message.includes(m.name))!;
        expect(ru.message).toContain(tr(board.name));
        expect(tr(board.name)).not.toBe(board.name);
        setLang('en');
        found = true;
        break;
      }
      if (found) break;
    }
    expect(found).toBe(true);
  });
});
