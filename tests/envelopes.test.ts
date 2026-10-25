import { describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { templates } from '../src/core/design';
import { envelopesOf, kneeSpan } from '../src/core/envelopes';
import {
  buildProjectModel,
  makeItem,
  newProject,
  placeItem,
  PROJECT_SCHEMA,
  validateProject,
  type Project,
  type ProjectItem,
} from '../src/core/project';
import { shapeOutline, type Room } from '../src/core/room';
import type { Box } from '../src/core/types';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
const room = (width: number, depth: number, height: number): Room => ({
  height,
  outline: shapeOutline('rectangle', { width, depth, cutWidth: 0, cutDepth: 0, offset: 0 }),
  features: [],
});
function project(items: ProjectItem[], r?: Room): Project {
  return { ...newProject('Zones'), items, ...(r ? { room: r } : {}) };
}
const item = (id: string, patch: Partial<ProjectItem> = {}): ProjectItem => ({
  ...makeItem(newProject(), t(id)),
  ...patch,
});
const diag = (p: Project, code: string) =>
  buildProjectModel(p).diagnostics.filter((d) => d.code === code);

describe('chair space (ADR-073)', () => {
  it('has no default: a desk without a chair depth gets no chair zone', () => {
    const d = item('desk-pedestal');
    expect(placeItem(d).envelopes.filter((e) => e.kind === 'chair')).toEqual([]);
  });
  it('sits in front of the knee space, as deep as the user set, as high as the desk', () => {
    const d = t('desk-pedestal');
    const knee = kneeSpan(d)!;
    const env = envelopesOf(d, { chairDepth: 700 }, false);
    const chair = env.find((e) => e.kind === 'chair')!;
    const p = d.product.kind === 'desk' ? d.product.params : null;
    expect(chair.box).toEqual({
      x: knee.x0,
      y: 0,
      z: p!.depth,
      w: knee.x1 - knee.x0,
      h: p!.height,
      d: 700,
    });
    expect(kneeSpan(t('chest'))).toBeNull();
  });
  it('warns when another piece stands in the chair space, and not when it is clear', () => {
    const desk = item('desk-pedestal', { zones: { chairDepth: 700 } });
    const b = placeItem(desk).bounds;
    const chest = (z: number) => item('chest', { position: { x: 0, y: 0, z } });
    expect(diag(project([desk, chest(b.z + b.d + 700)]), 'chair-space-blocked')).toEqual([]);
    const hit = diag(project([desk, chest(b.z + b.d + 500)]), 'chair-space-blocked');
    expect(hit).toHaveLength(1);
    expect(hit[0].severity).toBe('warning');
    expect(hit[0].message).toMatch(/Chest of drawers is in the way/);
  });
  it('turns with the desk and warns when it reaches through a wall', () => {
    const desk = item('desk-pedestal', {
      zones: { chairDepth: 900 },
      rotationY: 180,
      position: { x: 0, y: 0, z: 500 },
    });
    const pc = placeItem(desk);
    const chair = pc.envelopes.find((e) => e.kind === 'chair')!;
    // Turned to face the back wall: the chair space lies between the wall and the desk.
    expect(chair.box.z + chair.box.d).toBe(pc.bounds.z);
    const w = diag(project([desk], room(3000, 3000, 2500)), 'chair-space-blocked');
    expect(w).toHaveLength(1);
    expect(w[0].message).toMatch(/wall/);
  });
});

describe('installation space (ADR-073)', () => {
  it('uses the side diagonal against the room height: a warning, an error only if assembled lying down', () => {
    const w = item('wardrobe');
    const b = placeItem(w).bounds;
    const diagonal = Math.ceil(Math.hypot(b.h, b.d));
    const inst = placeItem(w).envelopes.find((e) => e.kind === 'installation')!;
    expect(inst.need).toBe(diagonal);
    expect(inst.box).toMatchObject({ y: b.h, h: diagonal - b.h, w: b.w, d: b.d });
    // Room exactly as high as the diagonal: fine. One mm lower: a warning; lying down: an error.
    expect(diag(project([w], room(4000, 4000, diagonal)), 'installation-height')).toEqual([]);
    const low = diag(project([w], room(4000, 4000, diagonal - 1)), 'installation-height');
    expect(low.map((d) => d.severity)).toEqual(['warning']);
    const lying = { ...w, zones: { lyingDown: true } };
    const err = diag(project([lying], room(4000, 4000, diagonal - 1)), 'installation-height');
    expect(err.map((d) => d.severity)).toEqual(['error']);
    expect(err[0].message).toContain(`${diagonal} mm`);
    // A room higher than the piece but lower than its diagonal: the piece fits standing, not tipping up.
    expect(b.h).toBeLessThan(diagonal - 1);
  });
  it('wall-hung pieces and pieces set on another piece get none; a piece resting on it does not block it', () => {
    expect(placeItem(item('wall-cabinet')).envelopes).toEqual([]);
    const base = item('base-door', { position: { x: 0, y: 0, z: 0 } });
    const top = item('chest', {
      placement: { kind: 'above', baseId: base.id, gap: 0, offsetX: 0 },
    });
    const p = project([base, top]);
    expect(placeItem(buildProjectModel(p).pieces[1].item).envelopes).toEqual([]);
    expect(diag(p, 'installation-blocked')).toEqual([]);
    // A free piece hanging over it in its installation space is in the way.
    const bb = placeItem(base).bounds;
    const over = item('wall-cabinet', {
      placement: undefined,
      position: { x: 0, y: bb.h + 10, z: 0 },
    });
    expect(diag(project([base, over]), 'installation-blocked')).toHaveLength(1);
  });
});

describe('service zone (ADR-073)', () => {
  it('needs a depth from the user; behind a piece against the wall it is blocked', () => {
    const noDepth = item('base-door', { zones: { service: { side: 'back' } } });
    expect(placeItem(noDepth).envelopes.filter((e) => e.kind === 'service')).toEqual([]);
    const back = item('base-door', {
      zones: { service: { side: 'back', depth: 100 } },
      position: { x: 500, y: 0, z: 0 },
    });
    const s = placeItem(back).envelopes.find((e) => e.kind === 'service')!;
    expect(s.box).toMatchObject({ z: -100, d: 100 });
    const w = diag(project([back], room(3000, 3000, 2500)), 'service-zone-blocked');
    expect(w.map((d) => d.severity)).toEqual(['warning']);
    const moved = { ...back, position: { x: 500, y: 0, z: 100 } };
    expect(diag(project([moved], room(3000, 3000, 2500)), 'service-zone-blocked')).toEqual([]);
  });
  it('left and right zones sit beside the piece and see a neighbour', () => {
    const a = item('base-door', {
      zones: { service: { side: 'right', depth: 50 } },
      position: { x: 0, y: 0, z: 0 },
    });
    const ab = placeItem(a).bounds;
    const b = item('base-door', { position: { x: ab.w + 20, y: 0, z: 0 } });
    expect(diag(project([a, b]), 'service-zone-blocked')).toHaveLength(1);
  });
});

describe('Clearances overlay zones (ADR-073)', () => {
  it('lists bodies, openings, chair and service zones with their worst problem', () => {
    const desk = item('desk-pedestal', { zones: { chairDepth: 700 } });
    const b = placeItem(desk).bounds;
    const chest = item('chest', { position: { x: 0, y: 0, z: b.z + b.d + 300 } });
    const pm = buildProjectModel(project([desk, chest]));
    const kinds = new Set(pm.zones.map((z) => z.kind));
    expect(kinds).toEqual(new Set(['body', 'drawer', 'chair']));
    expect(pm.zones.find((z) => z.kind === 'chair')!.severity).toBe('warning');
    const clear = buildProjectModel(
      project([desk, { ...chest, position: { x: 0, y: 0, z: b.z + b.d + 1500 } }]),
    );
    expect(clear.zones.every((z) => z.severity === 'none')).toBe(true);
    // Overlapping bodies are errors on both pieces.
    const overlap = buildProjectModel(
      project([desk, { ...chest, position: { x: 0, y: 0, z: 0 } }]),
    );
    expect(overlap.zones.filter((z) => z.kind === 'body').map((z) => z.severity)).toEqual([
      'error',
      'error',
    ]);
  });
  it('a door swing that hits something shows as a warning zone', () => {
    const a = item('base-door', { position: { x: 0, y: 0, z: 0 } });
    const ab = placeItem(a).bounds;
    const b = item('chest', { position: { x: 0, y: 0, z: ab.z + ab.d + 100 } });
    const pm = buildProjectModel(project([a, b]));
    expect(pm.zones.find((z) => z.kind === 'door')!.severity).toBe('warning');
  });
});

describe('project schemaVersion with zones (ADR-073, ADR-011)', () => {
  it('new projects are written at the current version; version-1 files still load', () => {
    expect(newProject().schemaVersion).toBe(PROJECT_SCHEMA);
    expect(PROJECT_SCHEMA).toBeGreaterThan(1);
    const v1 = { ...project([item('chest')]), schemaVersion: 1 as const };
    expect(validateProject(v1)).toEqual([]);
    expect(validateProject(JSON.parse(JSON.stringify(v1)))).toEqual([]);
    expect(validateProject({ ...v1, schemaVersion: 99 })).toContain(
      'Unsupported project schemaVersion',
    );
  });
  it('validates the zone settings on an item', () => {
    const ok = project([
      item('desk-pedestal', {
        zones: { chairDepth: 800, service: { side: 'back', depth: 50 }, lyingDown: true },
      }),
    ]);
    expect(validateProject(ok)).toEqual([]);
    for (const zones of [
      { chairDepth: 0 },
      { chairDepth: 12.5 },
      { service: { side: 'top', depth: 10 } },
      { service: { side: 'back', depth: -1 } },
      { lyingDown: 'yes' },
      'x',
    ]) {
      const bad = project([{ ...item('chest'), zones } as unknown as ProjectItem]);
      expect(validateProject(bad)).toContain('Invalid item clearance zones');
    }
  });
  it('a chair depth on a non-desk piece is kept but draws nothing', () => {
    const c = item('chest', { zones: { chairDepth: 700 } });
    expect(envelopesOf(c.design, c.zones, false, buildModel(c.design))).toEqual([]);
  });
});

it('random placed pieces keep the envelope invariants (seeded fuzz, ADR-073)', () => {
  let seed = Number(process.env.SEED ?? 7331);
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
  const ids = ['desk-pedestal', 'desk-gables', 'wardrobe', 'base-door', 'chest', 'bookcase'];
  const N = Number(process.env.FUZZ_N ?? 3000) / 30;
  const touches = (a: Box, b: Box) =>
    a.x <= b.x + b.w && b.x <= a.x + a.w && a.z <= b.z + b.d && b.z <= a.z + a.d;
  for (let i = 0; i < N; i++) {
    const items = Array.from({ length: 1 + Math.floor(rnd() * 3) }, () =>
      item(pick(ids), {
        rotationY: pick([0, 90, 180, 270] as const),
        position: { x: Math.round(rnd() * 3000), y: 0, z: Math.round(rnd() * 3000) },
        placement: { kind: 'floor' },
        zones: {
          chairDepth: rnd() < 0.7 ? 1 + Math.floor(rnd() * 1200) : undefined,
          service:
            rnd() < 0.6
              ? {
                  side: pick(['front', 'back', 'left', 'right'] as const),
                  depth: 1 + Math.floor(rnd() * 600),
                }
              : undefined,
          lyingDown: rnd() < 0.5,
        },
      }),
    );
    const p = project(
      items,
      rnd() < 0.5 ? room(4000, 4000, 1800 + Math.floor(rnd() * 1200)) : undefined,
    );
    expect(validateProject(JSON.parse(JSON.stringify(p)))).toEqual([]);
    const pm = buildProjectModel(p);
    for (const pc of pm.pieces)
      for (const e of pc.envelopes) {
        const b = e.box;
        for (const k of ['x', 'y', 'z', 'w', 'h', 'd'] as const)
          expect(Number.isSafeInteger(b[k])).toBe(true);
        expect(b.w > 0 && b.h > 0 && b.d > 0).toBe(true);
        // Outside the piece's own outline, touching it on one side.
        expect(
          b.x >= pc.bounds.x + pc.bounds.w ||
            b.x + b.w <= pc.bounds.x ||
            b.z >= pc.bounds.z + pc.bounds.d ||
            b.z + b.d <= pc.bounds.z ||
            b.y >= pc.bounds.y + pc.bounds.h,
        ).toBe(true);
        expect(touches(b, pc.bounds)).toBe(true);
        if (e.kind === 'installation') expect(b.y + b.h).toBe(e.need);
      }
    // Errors from these zones only ever come from a piece assembled lying down.
    for (const d of pm.diagnostics.filter((x) => x.code === 'installation-height'))
      if (d.severity === 'error')
        expect(p.items.find((it) => it.id === d.nodeId)?.zones?.lyingDown).toBe(true);
  }
});
