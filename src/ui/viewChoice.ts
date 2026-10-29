import { getLang, t } from '../core/i18n';

/** What the stage shows (ADR-081): the 2D drawing, the 3D view, or both side by side. */
export type StageView = 'front' | '3d' | 'both';

export const NO_3D_REASON = t('3D preview is not available in this browser');

export interface ViewOption {
  id: StageView;
  label: string;
  disabled: boolean;
  /** Why the option is disabled, shown as its title. */
  reason?: string;
}

/**
 * The View switch, the same in Compose and Build & Preview, piece and project (ADR-144): 2D · 3D · Both.
 * 3D and Both need WebGL.
 */
export function viewOptions(has3d: boolean): ViewOption[] {
  const no3d = has3d ? {} : { reason: NO_3D_REASON };
  return [
    { id: 'front', label: '2D', disabled: false },
    { id: '3d', label: '3D', disabled: !has3d, ...no3d },
    { id: 'both', label: getLang() === 'ru' ? 'Оба' : 'Both', disabled: !has3d, ...no3d },
  ];
}

/** The view the editor opens with, in either mode (ADR-144, G-268): 2D below 1500 px, Both from 1500 px. */
export function defaultView(wide: boolean, has3d: boolean): StageView {
  return has3d && wide ? 'both' : 'front';
}

export const shows3d = (v: StageView): boolean => v !== 'front';
export const showsDrawing = (v: StageView): boolean => v !== '3d';

/** Placing, drawing the room or a tapped check needs the drawing: 3D gives way to it, Both already shows it. */
export function bringDrawingForward(view: StageView): StageView {
  return view === '3d' ? 'front' : view;
}

/** The view tools of the stage and the plan (ADR-144). */
export type ViewTool =
  | 'fronts'
  | 'select'
  | 'move'
  | 'turn'
  | 'snap'
  | 'clearances'
  | 'exploded'
  | 'reset'
  | 'look'
  | 'render';

/** On a phone these stay in the row in both modes; every other view tool sits behind Options (G-269). */
export const PHONE_INLINE: readonly ViewTool[] = ['fronts', 'select', 'move', 'turn'];

/** Whether a tool goes behind the Options button: only on a phone, and never the inline ones. */
export const inOptions = (tool: ViewTool, phone: boolean): boolean =>
  phone && !PHONE_INLINE.includes(tool);
