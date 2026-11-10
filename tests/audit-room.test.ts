// ADR-257 (UI audit, Room and walls): room problems name features in the user's language, a new feature takes a free
// number, a repeated corner tap adds no wall, and a same-point scale tap keeps Set the scale on.
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { loadDictionary, setLang } from '../src/core/i18n';
import { buildProjectModel, newProject } from '../src/core/project';
import { outlineIssues, shapeOutline } from '../src/core/room';
import { newPlanPicture } from '../src/core/planPicture';
import { newFeature } from '../src/ui/RoomFeatures';
import { useDesign } from '../src/store/designStore';
import type { Room } from '../src/core/types';

afterEach(() => setLang('en'));
const rect = (): Room =>
  ({
    height: 2500,
    outline: shapeOutline('rectangle', {
      width: 3000,
      depth: 3000,
      cutWidth: 0,
      cutDepth: 0,
      offset: 0,
    }),
    features: [],
  }) as unknown as Room;

describe('ADR-257 room and walls', () => {
  it('a room problem names the door in Russian', async () => {
    await loadDictionary('ru');
    setLang('ru');
    const room = rect();
    const door = { ...newFeature(room, 'door'), from: 2800 };
    const p = { ...newProject('R'), room: { ...room, features: [door] } };
    const msgs = buildProjectModel(p).diagnostics.map((d) => d.message);
    expect(msgs.some((m) => m.startsWith('Дверь 1'))).toBe(true);
    expect(msgs.some((m) => m.startsWith('Door 1'))).toBe(false);
  });

  it('a new feature takes the lowest free number', () => {
    let room = rect();
    room = { ...room, features: [...room.features, newFeature(room, 'door')] };
    room = { ...room, features: [...room.features, newFeature(room, 'door')] };
    room = { ...room, features: room.features.slice(1) };
    room = { ...room, features: [...room.features, newFeature(room, 'door')] };
    expect(room.features.map((f) => f.label).sort()).toEqual(['Door 1', 'Door 2']);
  });

  it('a corner tapped twice adds no wall', () => {
    const st = () => useDesign.getState();
    st().openProject(newProject('Draw'));
    st().startDrawRoom();
    for (const [x, z] of [
      [0, 0],
      [4000, 0],
      [4000, 0],
      [4000, 3000],
      [0, 3000],
    ])
      st().addRoomCorner(x, z);
    st().finishDrawRoom();
    expect(st().project!.room!.outline).toHaveLength(4);
    expect(outlineIssues(st().project!.room!.outline)).toEqual([]);
  });

  it('two scale taps on one spot keep Set the scale on and say so', () => {
    const st = () => useDesign.getState();
    st().openProject({
      ...newProject('S'),
      planPicture: newPlanPicture('img-x', 'plan.png', 800),
    } as never);
    st().startScalePlan();
    st().addScalePoint([100, 100]);
    st().addScalePoint([100, 100]);
    expect(st().scalingPlan).toHaveLength(1);
    expect(st().scaleSamePoint).toBe(true);
  });
});
