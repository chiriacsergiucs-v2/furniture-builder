import type { Mode } from './shell/uiStore';

/** What the stage shows (ADR-081): the drawing, the 3D view, or both side by side. */
export type StageView = 'front' | '3d' | 'both';

export const NO_3D_REASON = '3D preview is not available in this browser';

export interface ViewOption {
  id: StageView;
  label: string;
  disabled: boolean;
  /** Why the option is disabled, shown as its title. */
  reason?: string;
}

/** The View switch: Front (Plan in a project) · 3D · Both; 3D and Both need WebGL. */
export function viewOptions(inProject: boolean, has3d: boolean): ViewOption[] {
  const no3d = has3d ? {} : { reason: NO_3D_REASON };
  return [
    { id: 'front', label: inProject ? 'Plan' : 'Front', disabled: false },
    { id: '3d', label: '3D', disabled: !has3d, ...no3d },
    { id: 'both', label: 'Both', disabled: !has3d, ...no3d },
  ];
}

/** The view a mode opens with: Both from 1500 px, else 3D in Build & Preview and the drawing in Compose. */
export function defaultView(mode: Mode, wide: boolean, has3d: boolean): StageView {
  if (!has3d) return 'front';
  if (wide) return 'both';
  return mode === 'build' ? '3d' : 'front';
}

/** What is shown: on a phone Compose is the drawing only, so the canvas is never mounted there (ADR-014). */
export function shownView(view: StageView, mode: Mode, phone: boolean): StageView {
  return phone && mode !== 'build' ? 'front' : view;
}

/** Whether the switch is offered: from 760 px always, on a phone only in Build & Preview. */
export function showsSwitch(mode: Mode, phone: boolean): boolean {
  return !phone || mode === 'build';
}

export const shows3d = (v: StageView): boolean => v !== 'front';
export const showsDrawing = (v: StageView): boolean => v !== '3d';

/** Placing, drawing the room or a tapped check needs the drawing: 3D gives way to it, Both already shows it. */
export function bringDrawingForward(view: StageView): StageView {
  return view === '3d' ? 'front' : view;
}
