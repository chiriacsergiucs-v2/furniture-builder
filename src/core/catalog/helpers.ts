/** Small builders for catalog variants: every call makes fresh node ids, so each insert is an independent copy. */
import { cabinet, cornerDefaults, deskDefaults, fr, frameDefaults, mm, newId, panelDefaults, templates, wrap } from '../design'
import type { CabinetParams, CornerParams, DeskParams, Design, DoorsFront, FlapFront, FrameKind, FrameParams, Front, PanelParams, Space, SplitSize } from '../types'

export { fr, mm }

export const door = (count: 1 | 2, hinge?: 'left' | 'right'): DoorsFront => ({ kind: 'doors', count, ...(hinge ? { hinge } : {}) })
export const sliding = (count: 2 | 3 | 4): Front => ({ kind: 'sliding', count, overlap: 30, track: 80 })
export const flap = (direction: FlapFront['direction']): Front => ({ kind: 'flap', count: 1, direction })

export const shelves = (count: number, front?: Front | null, adjustable = false): Space => ({ id: newId(), kind: 'shelves', count, front: front ?? null, ...(adjustable ? { adjustable } : {}) })
export const drawers = (count: number, heights?: SplitSize[], front?: Front | null): Space => ({ id: newId(), kind: 'drawers', count, front: front ?? null, ...(heights ? { heights } : {}) })
export const hanging = (front?: Front | null): Space => ({ id: newId(), kind: 'hanging', railDrop: 60, front: front ?? null })
export const empty = (front?: Front | null): Space => ({ id: newId(), kind: 'empty', front: front ?? null })
export const splitX = (sizes: SplitSize[], children: Space[], front?: Front | null): Space => ({ id: newId(), kind: 'split', axis: 'x', sizes, children, front: front ?? null })
export const splitY = (sizes: SplitSize[], children: Space[], front?: Front | null): Space => ({ id: newId(), kind: 'split', axis: 'y', sizes, children, front: front ?? null })
export const even = (n: number) => Array.from({ length: n }, () => fr())

/** A cabinet design. */
export const cab = (name: string, over: Partial<CabinetParams>, interior: Space): Design => cabinet(name, over, interior)

/** Kitchen base unit: 720 mm carcass on a 100 mm plinth, 560 deep (ADR-0036 defaults, to confirm). */
export const KITCHEN_BASE: Partial<CabinetParams> = { width: 600, height: 820, depth: 560, plinthHeight: 100, plinthSetback: 50, top: 'between', back: 'applied' }
export const KITCHEN_WALL: Partial<CabinetParams> = { width: 600, height: 720, depth: 320, mount: 'wall', mountHeight: 1450, plinthHeight: 0, back: 'inset', backInset: 18 }
export const KITCHEN_TALL: Partial<CabinetParams> = { width: 600, height: 2200, depth: 560, plinthHeight: 100, plinthSetback: 50 }
export const base = (name: string, over: Partial<CabinetParams>, interior: Space) => cab(name, { ...KITCHEN_BASE, ...over }, interior)
export const wallUnit = (name: string, over: Partial<CabinetParams>, interior: Space) => cab(name, { ...KITCHEN_WALL, ...over }, interior)
export const tall = (name: string, over: Partial<CabinetParams>, interior: Space) => cab(name, { ...KITCHEN_TALL, ...over }, interior)

export const corner = (name: string, variant: CornerParams['variant'], over: Partial<CornerParams>): Design =>
  wrap(name, { kind: 'corner', id: newId(), params: { ...cornerDefaults(variant), ...over } })
export const desk = (name: string, over: Partial<DeskParams>): Design => wrap(name, { kind: 'desk', id: newId(), params: { ...deskDefaults(), ...over } })
export const panel = (name: string, purpose: PanelParams['purpose'], over: Partial<PanelParams> = {}): Design =>
  wrap(name, { kind: 'panel', id: newId(), params: { ...panelDefaults(purpose), ...over } })
export const frame = (name: string, kind: FrameKind, over: Partial<FrameParams> = {}): Design => wrap(name, { kind: 'frame', id: newId(), params: { ...frameDefaults(kind), ...over } })
export const bed = (name: string, over: Partial<NonNullable<FrameParams['bed']>>, frameOver: Partial<FrameParams> = {}): Design =>
  frame(name, 'bed', { ...frameOver, bed: { ...frameDefaults('bed').bed!, ...over } })

/** A legacy template (ADR-0032: existing ids kept as variant ids, built exactly as before). */
export const legacy = (id: string) => () => templates.find(t => t.id === id)!.create()
