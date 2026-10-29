import { useSyncExternalStore } from 'react';

/** A room axis the section cuts across: x along the wall (width), y up (height), z out from the wall (depth). */
export type SectionAxis = 'x' | 'y' | 'z';

/**
 * The 3D view's Section and Isolate (ADR-122): what is shown only, never the model, checks or exports. Section hides
 * everything past a cut plane across one axis (any of the three, user answer 2026-10-27 "Accept default"); Isolate
 * shows only the selected pieces. This page only, never saved; it stays while the 3D view is hidden and shown again.
 */
export interface SectionState {
  on: boolean;
  axis: SectionAxis;
  /** Where the cut is, mm along the axis; null = the middle of what is shown. */
  at: number | null;
  isolate: boolean;
}

let now: SectionState = { on: false, axis: 'z', at: null, isolate: false };
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function setSection(patch: Partial<SectionState>) {
  now = { ...now, ...patch };
  listeners.forEach((f) => f());
}

/** The Section and Isolate settings. */
export const useSection = () => useSyncExternalStore(subscribe, () => now);

/** The cut position (mm) for `s` within the shown extent `[min, max]` along its axis: the middle when not set. */
export const cutAt = (s: Pick<SectionState, 'at'>, min: number, max: number): number =>
  s.at === null ? Math.round((min + max) / 2) : Math.min(max, Math.max(min, s.at));

export const AXIS_LABEL: Record<SectionAxis, string> = { x: 'Width', y: 'Height', z: 'Depth' };
