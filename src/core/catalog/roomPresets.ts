/**
 * Room presets (ADR-210, G-025): three shipped project templates (ADR-060), built at runtime from shipped families'
 * first insertable variant in a 3600 × 3000 rectangle room (ADR-173's default), every piece's back on a wall. New…
 * lists them; one becomes a project through `projectFromTemplate`. A preset whose variant is not insertable is not
 * listed. Pure: geometry comes from the pieces' own footprints (`placedBounds`), never computed in the UI.
 */
import { t } from '../i18n';
import { makeItem, newProject, placedBounds, type Project, type ProjectItem } from '../project';
import { templateFromProject, type ProjectTemplate } from '../projectTemplate';
import {
  DEFAULT_ROOM_HEIGHT,
  shapeOutline,
  wallBox,
  wallInward,
  wallLength,
  type Room,
} from '../room';
import { turnFor } from '../roomfill';
import { suggestMixes } from '../wallfill';
import type { Design, Mm } from '../types';
import { findFamily, insertVariant } from './index';
import { insertable } from './types';

export interface RoomPreset {
  id: string;
  name: string;
  template: ProjectTemplate;
}

/** The preset room: ADR-173's default rectangle. */
const presetRoom = (): Room => {
  const sizes = { width: 3600, depth: 3000, cutWidth: 1500, cutDepth: 1500, offset: 0 };
  return {
    height: DEFAULT_ROOM_HEIGHT,
    outline: shapeOutline('rectangle', sizes),
    features: [],
    shape: { kind: 'rectangle', sizes },
  };
};

/** A new copy of a shipped family's first insertable variant; null when there is none. */
function firstVariant(familyId: string): Design | null {
  const f = findFamily(familyId);
  const v = f?.variants.find(insertable);
  return f && v ? insertVariant(f, v, '2026-01-01T00:00:00.000Z') : null;
}

/** The footprint along and across wall `wall` of a design turned to stand with its back on it. */
function footOn(p: Project, room: Room, wall: number, d: Design): { along: Mm; across: Mm } {
  const rotationY = turnFor(wallInward(room, wall));
  const made = makeItem(p, d);
  const foot = placedBounds({ ...made, rotationY, position: { x: 0, y: 0, z: 0 } });
  return rotationY % 180 === 0
    ? { along: foot.w, across: foot.d }
    : { along: foot.d, across: foot.w };
}

/** `d` standing with its back on wall `wall`, `from` mm along it from its start corner. */
function onWall(p: Project, room: Room, wall: number, from: Mm, d: Design, base?: ProjectItem) {
  const rotationY = turnFor(wallInward(room, wall));
  const made = base ?? makeItem(p, d);
  const { along, across } = footOn(p, room, wall, d);
  const box = wallBox(room, wall, from, along, across, 0, 1);
  const item: ProjectItem = {
    ...made,
    rotationY,
    position: { x: box.x, y: made.position.y, z: box.z },
  };
  p.items.push(item);
  return item;
}

/** Designs side by side on a wall, centred along it; null when they do not fit. */
function centred(p: Project, room: Room, wall: number, designs: Design[]): boolean {
  const widths = designs.map((d) => footOn(p, room, wall, d).along);
  const total = widths.reduce((a, b) => a + b, 0);
  const len = wallLength(room, wall);
  if (total > len) return false;
  let at = Math.floor((len - total) / 2);
  designs.forEach((d, i) => {
    onWall(p, room, wall, at, d);
    at += widths[i];
  });
  return true;
}

function bedroom(): Project | null {
  const bed = firstVariant('bed');
  const a = firstVariant('nightstand');
  const b = firstVariant('nightstand');
  const wardrobe = firstVariant('wardrobe');
  if (!bed || !a || !b || !wardrobe) return null;
  const p = newProject(t('Bedroom: bed, two nightstands and a wardrobe'));
  const room = presetRoom();
  p.room = room;
  // The bed between its nightstands from the corner of wall 1; the wardrobe on wall 3 at the other side of the room,
  // so its doors open clear of the bed.
  let at = 0;
  for (const d of [a, bed, b]) {
    const w = footOn(p, room, 0, d).along;
    if (at + w > wallLength(room, 0)) return null;
    onWall(p, room, 0, at, d);
    at += w;
  }
  if (footOn(p, room, 2, wardrobe).along > wallLength(room, 2)) return null;
  onWall(p, room, 2, 0, wardrobe);
  return p;
}

function office(): Project | null {
  const desk = firstVariant('desk');
  const bookcase = firstVariant('bookcase');
  if (!desk || !bookcase) return null;
  const p = newProject(t('Home office: desk and bookcase'));
  const room = presetRoom();
  p.room = room;
  // The desk on wall 1, the bookcase on wall 3.
  if (!centred(p, room, 0, [desk])) return null;
  if (!centred(p, room, 2, [bookcase])) return null;
  return p;
}

function kitchenDesk(): Project | null {
  const desk = firstVariant('desk');
  if (!desk) return null;
  const room = presetRoom();
  // Fill a wall's first mix for a 2400 mm stretch of wall 1 (ADR-103/104).
  const mix = suggestMixes({ width: 2400, depth: 560, height: room.height }).mixes[0];
  if (!mix) return null;
  const p = newProject(t('Kitchen and desk'));
  p.room = room;
  const rotationY = turnFor(wallInward(room, 0));
  for (const it of mix.project.items) {
    // A top box stays on its tall cabinet; every other piece keeps its place along the wall, its back on it.
    if (it.placement?.kind === 'above') {
      p.items.push({ ...it, rotationY, position: { ...it.position, z: 0 } });
      continue;
    }
    onWall(p, room, 0, it.position.x, it.design, it);
  }
  // The desk on wall 3, opposite: it never touches the kitchen.
  if (!centred(p, room, 2, [desk])) return null;
  return p;
}

/** The shipped room presets that can be built now, as project templates (ADR-210). */
export function roomPresets(): RoomPreset[] {
  const out: RoomPreset[] = [];
  const add = (id: string, p: Project | null) => {
    if (p)
      out.push({
        id,
        name: p.name,
        template: templateFromProject(p, p.name, { includeRoom: true }),
      });
  };
  add('bedroom', bedroom());
  add('office', office());
  add('kitchen-desk', kitchenDesk());
  return out;
}
