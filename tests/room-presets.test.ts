// ADR-210 (N215): room presets (G-025) and the Fill the room Refine filters — budget ceiling, style and island
// (G-341, G-342) — with the pure `projectEstimate` (ADR-172) they share with the editor.
import { describe, expect, it } from 'vitest';
import { roomPresets } from '../src/core/catalog/roomPresets';
import { buildModel } from '../src/core/build';
import {
  buildProjectModel,
  placedBounds,
  validateProject,
  type Project,
  type ProjectItem,
} from '../src/core/project';
import { projectEstimate } from '../src/core/projectEstimate';
import { projectFromTemplate, validateProjectTemplate } from '../src/core/projectTemplate';
import { shapeOutline, type Room } from '../src/core/room';
import { checkRoom, isRectangle, suggestRoomMixes, type RoomInput } from '../src/core/roomfill';
import { builtInStyles } from '../src/core/styles';
import type { Box } from '../src/core/types';

const rect = (width = 3600, depth = 3000): Room => ({
  height: 2500,
  outline: shapeOutline('rectangle', { width, depth, cutWidth: 0, cutDepth: 0, offset: 0 }),
  features: [],
});
const lRoom = (): Room => ({
  height: 2500,
  outline: shapeOutline('l-shape', {
    width: 4000,
    depth: 3500,
    cutWidth: 1500,
    cutDepth: 1500,
    offset: 0,
  }),
  features: [],
});
const input = (room: Room, over: Partial<RoomInput> = {}): RoomInput => ({
  room,
  depth: 560,
  minWidth: 400,
  maxWidth: 1200,
  walls: [0],
  wallRow: 'never',
  ...over,
});
const boundsOf = (it: ProjectItem): Box => placedBounds(it);
/** Two boxes that overlap or share a face (with some extent in common on the other two axes). */
function touch(a: Box, b: Box): boolean {
  const gap = (p0: number, l0: number, p1: number, l1: number) =>
    Math.max(p0, p1) - Math.min(p0 + l0, p1 + l1);
  return (
    gap(a.x, a.w, b.x, b.w) <= 0 && gap(a.y, a.h, b.y, b.h) <= 0 && gap(a.z, a.d, b.z, b.d) <= 0
  );
}

describe('room presets (ADR-210, G-025)', () => {
  const presets = roomPresets();
  const byName = (name: string) => presets.find((p) => p.name === name)!;

  it('ships the three presets by name, each a valid project template with the 3600 × 3000 room', () => {
    expect(presets.map((p) => p.name)).toEqual([
      'Bedroom: bed, two nightstands and a wardrobe',
      'Home office: desk and bookcase',
      'Kitchen and desk',
    ]);
    for (const pr of presets) {
      expect(validateProjectTemplate(pr.template), pr.name).toEqual([]);
      expect(pr.template.room, pr.name).toBeTruthy();
      expect(isRectangle(pr.template.room!)).toBe(true);
      const xs = pr.template.room!.outline.map((p) => p[0]);
      const zs = pr.template.room!.outline.map((p) => p[1]);
      expect(Math.max(...xs) - Math.min(...xs)).toBe(3600);
      expect(Math.max(...zs) - Math.min(...zs)).toBe(3000);
    }
  });

  it('each preset builds with no error and no compat-family warning', () => {
    for (const pr of presets) {
      const p = projectFromTemplate(pr.template);
      expect(validateProject(p), pr.name).toEqual([]);
      const pm = buildProjectModel(p);
      const errors = pm.diagnostics.filter((d) => d.severity === 'error');
      expect(
        errors.map((d) => d.message),
        pr.name,
      ).toEqual([]);
      expect(
        pm.diagnostics.filter((d) => d.code === 'compat-family').map((d) => d.message),
        pr.name,
      ).toEqual([]);
      // Every piece stands inside the room and no two pieces overlap.
      expect(pm.diagnostics.filter((d) => d.code === 'outside-room')).toEqual([]);
      expect(pm.diagnostics.filter((d) => d.code === 'pieces-overlap')).toEqual([]);
    }
  });

  it('the pieces each preset names, by catalog family', () => {
    const families = (name: string) =>
      byName(name)
        .template.items.map((i) => i.design.catalog?.origin?.catalogId)
        .filter(Boolean)
        .sort();
    expect(families('Bedroom: bed, two nightstands and a wardrobe')).toEqual([
      'bed',
      'nightstand',
      'nightstand',
      'wardrobe',
    ]);
    expect(families('Home office: desk and bookcase')).toEqual(['bookcase', 'desk']);
    const kd = byName('Kitchen and desk').template.items;
    expect(kd.filter((i) => i.design.catalog?.origin?.catalogId === 'desk')).toHaveLength(1);
    expect(kd.length).toBeGreaterThan(2);
  });

  it('Kitchen and desk: the kitchen run and the desk never touch', () => {
    const p = projectFromTemplate(byName('Kitchen and desk').template);
    const isDesk = (it: ProjectItem) => it.design.catalog?.origin?.catalogId === 'desk';
    const desk = p.items.filter(isDesk).map(boundsOf);
    const kitchen = p.items.filter((i) => !isDesk(i)).map(boundsOf);
    expect(desk).toHaveLength(1);
    for (const k of kitchen) {
      expect(touch(desk[0], k)).toBe(false);
    }
  });

  it('is deterministic: the same presets every time', () => {
    const a = roomPresets().map((p) => ({ n: p.name, k: p.template.items.length }));
    const b = roomPresets().map((p) => ({ n: p.name, k: p.template.items.length }));
    expect(a).toEqual(b);
  });
});

describe('Fill the room Refine: budget and style (ADR-210, G-341)', () => {
  // A price per piece for every hardware line and per sheet for every board, so each mix has a total above zero.
  const pricesFor = (p: Project) => {
    const pm = buildProjectModel(p);
    return projectEstimate(p, pm, []).lines.flatMap((l) =>
      l.priceKey
        ? [
            {
              id: l.priceKey,
              unit: l.section === 'boards' ? ('sheet' as const) : ('piece' as const),
              amount: 10000,
            },
          ]
        : [],
    );
  };

  it('each mix carries its estimate; without prices every priced line is counted missing', () => {
    const r = suggestRoomMixes(input(rect()));
    expect(r.mixes.length).toBeGreaterThan(0);
    for (const m of r.mixes) {
      expect(m.estimate.total).toBe(0);
      expect(m.estimate.missing.length).toBeGreaterThan(0);
      // The same as the editor's pure estimate of the same project.
      expect(projectEstimate(m.project, m.model, []).est).toEqual(m.estimate);
    }
    expect(r.overBudget).toBeUndefined();
  });

  it('a ceiling hides the mixes above it and counts them; none left names the cheapest', () => {
    const open = suggestRoomMixes(input(rect()));
    const prices = open.mixes.flatMap((m) => pricesFor(m.project));
    const priced = suggestRoomMixes(input(rect(), { prices }));
    const totals = priced.mixes.map((m) => m.estimate.total).sort((a, b) => a - b);
    expect(totals[0]).toBeGreaterThan(0);
    const low = totals[0],
      high = totals[totals.length - 1];

    // A ceiling at the cheapest: costlier mixes are hidden and counted.
    expect(high).toBeGreaterThan(low);
    const r = suggestRoomMixes(input(rect(), { prices, ceiling: low }));
    expect(r.mixes.length).toBeGreaterThan(0);
    for (const m of r.mixes) expect(m.estimate.total).toBeLessThanOrEqual(low);
    expect(r.overBudget).toBeGreaterThan(0);
    expect(r.cheapest).toBeGreaterThan(low);

    // A ceiling under every mix (every one costs more than 0 here): no mix, the count and the cheapest, and no
    // "no mix could be built" error.
    const none = suggestRoomMixes(input(rect(), { prices, ceiling: 0 }));
    expect(none.mixes).toEqual([]);
    expect(none.overBudget).toBeGreaterThan(0);
    expect(none.cheapest).toBeGreaterThan(0);
    expect(none.cheapest).toBeLessThanOrEqual(low);
    expect(none.problems.map((p) => p.code)).not.toContain('room-no-mix');

    // No ceiling: nothing hidden.
    expect(suggestRoomMixes(input(rect(), { prices })).overBudget).toBeUndefined();
  });

  /** The board names of every door and drawer front of a mix. */
  const frontBoards = (p: Project) =>
    p.items.flatMap((it) => {
      const byId = new Map(it.design.materials.map((m) => [m.id, m.name]));
      return buildModel(it.design)
        .panels.filter((x) => x.role === 'door' || x.role === 'drawer-front')
        .map((x) => byId.get(x.materialId));
    });

  it('a style changes every mix’s fronts; no style (Any) keeps the defaults', () => {
    const style = builtInStyles().find((s) => s.id === 'all-oak')!;
    const r = suggestRoomMixes(input(rect(), { style }));
    expect(r.mixes.length).toBeGreaterThan(0);
    for (const m of r.mixes) {
      expect(m.model.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      const fronts = frontBoards(m.project);
      expect(fronts.length).toBeGreaterThan(0);
      expect(new Set(fronts)).toEqual(new Set([style.front.name]));
    }
    const plain = suggestRoomMixes(input(rect()));
    for (const m of plain.mixes) expect(frontBoards(m.project)).not.toContain(style.front.name);
  });
});

describe('Fill the room Refine: island (ADR-210, G-342)', () => {
  it('an empty walkway is an error, never prefilled; a bad one is named', () => {
    const empty = checkRoom(input(rect(), { island: {} }));
    expect(empty.map((d) => [d.code, d.message])).toContainEqual([
      'room-island',
      'Type the walkway width to place an island.',
    ]);
    expect(empty.find((d) => d.code === 'room-island')!.severity).toBe('error');
    const r = suggestRoomMixes(input(rect(), { island: {} }));
    expect(r.mixes).toEqual([]);
    expect(r.problems.map((p) => p.message)).toContain(
      'Type the walkway width to place an island.',
    );
    for (const bad of [0, -100, 12.5])
      expect(checkRoom(input(rect(), { island: { walkway: bad } })).map((d) => d.code)).toContain(
        'room-island',
      );
    // No island asked: no island problem.
    expect(checkRoom(input(rect())).map((d) => d.code)).not.toContain('room-island');
  });

  it('rectangle rooms only', () => {
    expect(isRectangle(rect())).toBe(true);
    expect(isRectangle(lRoom())).toBe(false);
    const ds = checkRoom({ ...input(lRoom(), { island: { walkway: 1000 } }), walls: [0] });
    expect(ds.map((d) => d.message)).toContain('An island needs a rectangle room.');
  });

  it('too small a room for the walkway is the error the ADR names', () => {
    const r = suggestRoomMixes(input(rect(3600, 3000), { island: { walkway: 2000 } }));
    expect(r.mixes).toEqual([]);
    expect(r.problems.map((p) => p.message)).toContain(
      'The room is too small for an island with this walkway.',
    );
  });

  it('island mixes: base cabinets only, parallel to the wall, the walkway kept in front and behind', () => {
    const room = rect(4800, 4200);
    const walkway = 1000;
    const r = suggestRoomMixes(input(room, { island: { walkway } }));
    expect(r.problems.filter((p) => p.severity === 'error')).toEqual([]);
    expect(r.mixes.length).toBeGreaterThan(0);
    const plain = suggestRoomMixes(input(room));
    for (const m of r.mixes) {
      expect(m.island).toBeTruthy();
      expect(m.model.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      const n = plain.mixes.find((x) => x.key === m.key)?.project.items.length;
      // The island's pieces come after the run's.
      const island = n === undefined ? [] : m.project.items.slice(n);
      if (n === undefined) continue;
      expect(island.length).toBeGreaterThan(0);
      const run = m.project.items.slice(0, n).filter((i) => i.placement?.kind !== 'above');
      const runFront = Math.max(...run.map((i) => boundsOf(i)).map((b) => b.z + b.d));
      const ib = island.map(boundsOf);
      for (const b of ib) {
        // Base cabinets only: on the floor, no taller than a base.
        expect(b.y).toBe(0);
        expect(b.h).toBeLessThan(1000);
      }
      // Parallel to wall 1 (along x), all at one depth.
      expect(new Set(ib.map((b) => b.z)).size).toBe(1);
      const islandBack = Math.min(...ib.map((b) => b.z));
      const islandFront = Math.max(...ib.map((b) => b.z + b.d));
      // Its fronts face the run across the walkway (the gap is at least the walkway) and the walkway stays behind it.
      expect(islandBack - runFront).toBeGreaterThanOrEqual(walkway);
      expect(4200 - islandFront).toBeGreaterThanOrEqual(walkway);
      // It faces the wall: turned half a turn from the run.
      expect(island.every((i) => i.rotationY === 180)).toBe(true);
    }
  });
});
