// A chosen worktop joint adds one "To choose before buying" line with no count, size or type (G-409, ADR-205, ADR-010).
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import {
  buildProjectModel,
  makeItem,
  newProject,
  planRuns,
  projectCutlist,
  projectHardware,
  runPartKey,
  type Project,
  type WorktopJoint,
} from '../src/core/project';
import { shoppingList, worktopJointList } from '../src/core/shopping';

const base = () => templates.find((x) => x.id === 'base-door')!.create();

function lKitchen(): Project {
  let p: Project = newProject('L kitchen');
  for (let i = 0; i < 2; i++) p = { ...p, items: [...p.items, makeItem(p, base())] };
  for (let i = 0; i < 2; i++) {
    const it = makeItem(p, base());
    p = {
      ...p,
      items: [...p.items, { ...it, rotationY: 90, position: { x: 0, y: 0, z: 578 + i * 600 } }],
    };
  }
  return { ...p, runParts: planRuns(p, { sides: true }).parts };
}
const withJoint = (p: Project, kind: WorktopJoint['kind']): Project => {
  const tops = (p.runParts ?? []).filter((r) => r.kind === 'worktop');
  const a = tops.find((r) => r.grainAxis === 'x')!;
  const b = tops.find((r) => r.grainAxis === 'z')!;
  return {
    ...p,
    worktopJoints: [
      {
        id: 'j1',
        a: runPartKey(a),
        b: runPartKey(b),
        kind,
        ...(kind === 'butt' ? { through: 'a' as const } : {}),
      },
    ],
  };
};
const list = (p: Project) => {
  const pm = buildProjectModel(p);
  return shoppingList({
    rows: projectCutlist(p),
    materials: pm.materials,
    hardware: projectHardware(p),
    sheets: null,
    runParts: p.runParts,
    worktopJoints: worktopJointList(p),
  });
};
const fixings = (p: Project) =>
  list(p).filter((l) => l.label === 'Worktop joint fixings (your choice)');

describe('worktop joint fixings on the shopping list (G-409)', () => {
  it('a corner with no chosen joint adds no line', () => {
    expect(fixings(lKitchen())).toHaveLength(0);
  });
  it.each(['mitre', 'butt'] as const)(
    'a %s joint adds one line under "To choose" with no size or type',
    (kind) => {
      const lines = fixings(withJoint(lKitchen(), kind));
      expect(lines).toHaveLength(1);
      expect(lines[0].section).toBe('choose');
      expect(lines[0].quantity).toBe(1);
      expect(lines[0].detail).toMatch(
        kind === 'mitre' ? /^mitred joint between / : /^butt joint between /,
      );
      // No supplier value is invented (ADR-010): no mm size, no product.
      expect(lines[0].detail).not.toMatch(/\d+ ?mm/);
      expect(lines[0].product).toBeUndefined();
      expect(lines[0].priceKey).toBeUndefined();
    },
  );
});
