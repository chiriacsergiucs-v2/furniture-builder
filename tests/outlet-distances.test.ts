// Outlet distances the user sets (ADR-299, G-406): an outlet nearer a sink cut-out, a hob cut-out or a pipe than the
// distance the user entered is a warning labelled as their rule; an empty distance is no check; nothing is built in
// (ADR-010). The room's `outletDistances` needs project schemaVersion 22 and older files still load (ADR-011).
import { describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import {
  buildProjectModel,
  makeItem,
  newProject,
  planRuns,
  PROJECT_SCHEMA,
  PROJECT_SCHEMAS,
  validateProject,
  type Project,
} from '../src/core/project';
import { outletDistanceChecks, shapeOutline, type Room, type RoomFeature } from '../src/core/room';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
const feature = (f: Partial<RoomFeature>): RoomFeature => ({
  id: 'o',
  kind: 'outlet',
  wall: 0,
  from: 200,
  width: 80,
  sill: 1100,
  height: 80,
  depth: 0,
  label: 'Outlet 1',
  ...f,
});
const room = (features: RoomFeature[], outletDistances?: Room['outletDistances']): Room => ({
  height: 2600,
  outline: shapeOutline('rectangle', {
    width: 3000,
    depth: 3000,
    cutWidth: 0,
    cutDepth: 0,
    offset: 0,
  }),
  features,
  ...(outletDistances ? { outletDistances } : {}),
});
/** One base unit on the back wall with its run worktop, a sink cut-out over it, and the room. */
function kitchen(r: Room, hob = false): Project {
  let p = newProject('Outlets');
  p = { ...p, items: [makeItem(p, t('base-door'))] };
  p = { ...p, runParts: planRuns(p).parts, room: r };
  const cut = [{ id: 'c1', baseId: p.items[0].id, w: 400, d: 400 }];
  return hob ? { ...p, hobs: cut } : { ...p, sinks: cut };
}
const near = (p: Project) =>
  buildProjectModel(p).diagnostics.filter((d) => d.code === 'outlet-near');

describe('outlet distances the user sets (ADR-299)', () => {
  it('no distances, or empty ones: no check at all', () => {
    expect(near(kitchen(room([feature({})])))).toEqual([]);
    expect(near(kitchen(room([feature({})], {})))).toEqual([]);
    // A hob rule does not check a sink.
    expect(near(kitchen(room([feature({})], { hob: 5000 })))).toEqual([]);
  });

  it('an outlet nearer a sink cut-out than the distance set warns, labelled as the user rule', () => {
    const d = near(kitchen(room([feature({})], { sink: 5000 })));
    expect(d).toHaveLength(1);
    expect(d[0].severity).toBe('warning');
    expect(d[0].nodeId).toBe('sink:c1');
    expect(d[0].message).toMatch(
      /^Outlet 1 is \d+ mm from a sink cut-out, closer than the 5000 mm you set \(your rule\)\.$/,
    );
    // Far enough by the same rule: nothing.
    expect(near(kitchen(room([feature({})], { sink: 1 })))).toEqual([]);
  });

  it('the measured gap is the shortest straight line, and only a closer outlet warns', () => {
    const r = room([feature({})], { hob: 100 });
    const cut = {
      id: 'hob:h',
      kind: 'hob' as const,
      box: { x: 0, y: 900, z: 0, w: 600, h: 40, d: 600 },
    };
    // The outlet's zone starts 1100 mm up, 160 mm above the worktop top (940): 160 mm away.
    expect(outletDistanceChecks({ ...r, outletDistances: { hob: 160 } }, [cut])).toEqual([]);
    const d = outletDistanceChecks({ ...r, outletDistances: { hob: 161 } }, [cut]);
    expect(d.map((x) => x.message)).toEqual([
      'Outlet 1 is 160 mm from a hob cut-out, closer than the 161 mm you set (your rule).',
    ]);
    expect(near(kitchen(room([feature({})], { hob: 5000 }), true))).toHaveLength(1);
  });

  it('an outlet nearer a pipe than the distance set warns; farther does not', () => {
    const pipe = feature({
      id: 'p',
      kind: 'pipe',
      from: 500,
      width: 100,
      height: 100,
      label: 'Pipe 1',
    });
    // Outlet ends at 280 along the wall, the pipe starts at 500: 220 mm apart.
    const d = outletDistanceChecks(room([feature({}), pipe], { pipe: 300 }), []);
    expect(d.map((x) => `${x.severity}:${x.message}`)).toEqual([
      'warning:Outlet 1 is 220 mm from Pipe 1, closer than the 300 mm you set (your rule).',
    ]);
    expect(outletDistanceChecks(room([feature({}), pipe], { pipe: 220 }), [])).toEqual([]);
    expect(outletDistanceChecks(room([feature({}), pipe]), [])).toEqual([]);
  });

  it('schemaVersion 22 stores the distances; 21 refuses them and older files still load; bad values refused', () => {
    expect(PROJECT_SCHEMA).toBe(23);
    expect(PROJECT_SCHEMAS).toContain(21);
    const p = kitchen(room([feature({})], { sink: 600, pipe: 300 }));
    expect(validateProject(p)).toEqual([]);
    expect(validateProject({ ...p, schemaVersion: 21 })).toContain(
      'Outlet distances need project schemaVersion 22',
    );
    const old = kitchen(room([feature({})]));
    expect(validateProject({ ...old, schemaVersion: 21 })).toEqual([]);
    for (const bad of [{ sink: 0 }, { hob: 12.5 }, { tap: 300 }, 'x'])
      expect(
        validateProject({ ...p, room: { ...p.room!, outletDistances: bad } } as unknown as Project),
      ).toContain('Invalid outlet distances');
  });
});
