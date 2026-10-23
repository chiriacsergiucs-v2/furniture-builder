/**
 * Step library of the New-piece wizard (ADR-0044). Each step owns its fields (answer keys), says when it shows,
 * writes its answers into model input (`apply`) and gives the short text used on cards (`summary`). Construction
 * types pick the steps they use; nothing here depends on a particular type.
 */
import { defaultMaterials, fr, mm, newId } from '../design'
import { FUNCTION_LABEL, FUNCTIONS } from '../catalog/types'
import type { CabinetParams, Design, DeskParams, FrameParams, Product, Space, SplitSize } from '../types'
import type { Answers, Compartment, Option, StepDef } from './types'

export const MAX_DIVIDERS = 7
export const MAX_COMP_SHELVES = 20
export const MAX_COMP_DRAWERS = 10

// ---------------------------------------------------------------------------
// Reading answers
// ---------------------------------------------------------------------------

export const num = (a: Answers, k: string, d = 0): number => (typeof a[k] === 'number' ? (a[k] as number) : d)
export const str = (a: Answers, k: string, d = ''): string => (typeof a[k] === 'string' ? (a[k] as string) : d)

/** Compartments = dividers + 1 (a whole number from 1; bad input counts as one compartment). */
export const compartmentCount = (a: Answers): number => {
  const n = num(a, 'dividers', 0)
  return Number.isInteger(n) && n >= 0 && n <= MAX_DIVIDERS ? n + 1 : 1
}

export const DEFAULT_COMPARTMENT: Compartment = { kind: 'shelves', shelves: 2, drawers: 3 }

const isCompartment = (c: unknown): c is Compartment =>
  !!c && typeof c === 'object' && typeof (c as Compartment).kind === 'string' && typeof (c as Compartment).shelves === 'number' && typeof (c as Compartment).drawers === 'number'

/** One entry per compartment: the answers' list, cut or padded with a copy of its last entry. */
export function compartmentsOf(a: Answers, n = compartmentCount(a)): Compartment[] {
  const raw = Array.isArray(a.compartments) ? (a.compartments as unknown[]).filter(isCompartment) : []
  const last = raw[raw.length - 1] ?? DEFAULT_COMPARTMENT
  return Array.from({ length: n }, (_, i) => ({ ...(raw[i] ?? last) }))
}

/** A per-compartment list of strings or numbers, cut or padded with `fill`. */
export function listOf<T extends string | number>(a: Answers, k: string, fill: T, n = compartmentCount(a)): T[] {
  const raw = Array.isArray(a[k]) ? (a[k] as T[]) : []
  return Array.from({ length: n }, (_, i) => (i < raw.length ? raw[i] : fill))
}

// ---------------------------------------------------------------------------
// Writing model input
// ---------------------------------------------------------------------------

type Kind = Product['kind']
/** Change the params of one product root; other roots pass through unchanged. */
const onProduct = <P,>(d: Design, kind: Kind, fn: (p: P) => P): Design =>
  d.product.kind === kind ? { ...d, product: { ...d.product, params: fn(d.product.params as P) } as Product } : d

const onCabinet = (d: Design, fn: (p: CabinetParams) => CabinetParams) => onProduct<CabinetParams>(d, 'cabinet', fn)

/** The compartments of a cabinet interior: the children of a side-by-side split, or the interior itself. */
const withLeaves = (s: Space, fn: (c: Space, i: number) => Space): Space =>
  s.kind === 'split' && s.axis === 'x' ? { ...s, children: s.children.map(fn) } : fn(s, 0)
const everySpace = (s: Space, fn: (c: Space) => Space): Space => {
  const n = fn(s)
  return n.kind === 'split' ? { ...n, children: n.children.map(c => everySpace(c, fn)) } : n
}

/** The space a content answer stands for. Keeps the compartment's id and front. */
export function contentSpace(c: Compartment, keep: Space): Space {
  const base = { id: keep.id, front: keep.front ?? null, ...(keep.handle ? { handle: keep.handle } : {}) }
  switch (c.kind) {
    case 'open': return { ...base, kind: 'empty' }
    case 'drawers': return { ...base, kind: 'drawers', count: c.drawers }
    case 'hanging': return { ...base, kind: 'hanging', railDrop: 50 }
    case 'shelves-drawers': return { ...base, kind: 'split', axis: 'y', sizes: [fr(2), fr(1)],
      children: [{ id: newId(), kind: 'shelves', count: c.shelves }, { id: newId(), kind: 'drawers', count: c.drawers }] }
    default: return { ...base, kind: 'shelves', count: c.shelves }
  }
}

const doors = (v: string) => (v === 'single' ? { kind: 'doors' as const, count: 1 as const } : v === 'pair' ? { kind: 'doors' as const, count: 2 as const } : null)

/** The board answer goes to each root's main board. */
const BOARD_KEYS: Partial<Record<Kind, string[]>> = { cabinet: ['bodyMaterialId'], frame: ['panelMaterialId'], desk: ['topMaterialId'] }

// ---------------------------------------------------------------------------
// Options and labels
// ---------------------------------------------------------------------------

export const CONTENT_KINDS: (Option & { uses: ('shelves' | 'drawers')[] })[] = [
  { value: 'open', label: 'Open', uses: [] },
  { value: 'shelves', label: 'Shelves', uses: ['shelves'] },
  { value: 'drawers', label: 'Drawers', uses: ['drawers'] },
  { value: 'hanging', label: 'Hanging rail', uses: [] },
  { value: 'shelves-drawers', label: 'Shelves over drawers', uses: ['shelves', 'drawers'] },
]
export const contentUses = (kind: string) => CONTENT_KINDS.find(k => k.value === kind)?.uses ?? []

const BOARD_OPTIONS: Option[] = defaultMaterials().filter(m => m.thickness >= 16).map(m => ({ value: m.id, label: `${m.name} (${m.thickness} mm)` }))
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function contentText(c: Compartment): string {
  switch (c.kind) {
    case 'open': return 'open'
    case 'drawers': return plural(c.drawers, 'drawer')
    case 'hanging': return 'hanging rail'
    case 'shelves-drawers': return `${plural(c.shelves, 'shelf', 'shelves')} over ${plural(c.drawers, 'drawer')}`
    default: return c.shelves ? plural(c.shelves, 'shelf', 'shelves') : 'open'
  }
}

const FRONT_TEXT: Record<string, string> = { none: 'no doors', single: 'one door', pair: 'pair of doors', sliding: 'sliding doors' }

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

export const BASICS = 'basics'
export const TYPE = 'type'
export const REVIEW = 'review'

const mmField = (id: string, label: string, def: number, min: number, max: number, help?: string) =>
  ({ id, label, kind: 'int' as const, unit: 'mm' as const, default: def, min, max, help })

export const STEPS: StepDef[] = [
  {
    id: BASICS, title: 'Size', help: 'Overall size in whole millimetres (width, height from the floor, depth). Until you change them, sizes and name follow the type you pick next.',
    fields: [
      { id: 'name', label: 'Name', kind: 'text', default: 'New piece' },
      { id: 'category', label: 'Category', kind: 'choice', default: 'storage', options: FUNCTIONS.map(f => ({ value: f, label: FUNCTION_LABEL[f] })) },
      mmField('width', 'Width', 800, 100, 5000),
      mmField('height', 'Height', 900, 100, 3000),
      mmField('depth', 'Depth', 450, 100, 2000),
      { id: 'board', label: 'Board', kind: 'choice', default: 'pal18', options: BOARD_OPTIONS, help: 'Panel thickness comes from the board.' },
    ],
    apply: (a, d) => {
      const keys = BOARD_KEYS[d.product.kind] ?? []
      const params = { ...d.product.params, width: num(a, 'width'), height: num(a, 'height'), depth: num(a, 'depth'), ...Object.fromEntries(keys.map(k => [k, str(a, 'board')])) }
      const category = FUNCTION_LABEL[str(a, 'category') as keyof typeof FUNCTION_LABEL]
      return { ...d, name: str(a, 'name').trim() || d.name, product: { ...d.product, params } as Product, ...(category ? { catalog: { ...d.catalog, category } } : {}) }
    },
    summary: a => `${num(a, 'width')} × ${num(a, 'height')} × ${num(a, 'depth')} mm`,
  },
  { id: TYPE, title: 'Type', help: 'What kind of construction. The next steps ask only what applies to it.', fields: [{ id: 'type', label: 'Construction type', kind: 'choice' }] },
  {
    id: 'divisions', title: 'Dividers', help: 'Vertical dividers split the inside into compartments, left to right.',
    fields: [
      { id: 'dividers', label: 'Vertical dividers', kind: 'int', default: 0, min: 0, max: MAX_DIVIDERS },
      { id: 'spacing', label: 'Compartment widths', kind: 'choice', default: 'equal', options: [{ value: 'equal', label: 'Equal' }, { value: 'custom', label: 'Custom' }], visible: a => compartmentCount(a) > 1 },
      { id: 'widths', label: 'Width of each compartment (0 = share the rest)', kind: 'perCompartmentMm', unit: 'mm', default: [], min: 0, max: 5000, count: compartmentCount,
        visible: a => compartmentCount(a) > 1 && str(a, 'spacing') === 'custom' },
    ],
    apply: (a, d) => onCabinet(d, p => {
      const n = compartmentCount(a)
      if (n === 1) return { ...p, interior: { id: p.interior.id, kind: 'empty' } }
      const widths = listOf<number>(a, 'widths', 0, n)
      const sizes: SplitSize[] = str(a, 'spacing') === 'custom' ? widths.map(w => (w > 0 ? mm(w) : fr())) : widths.map(() => fr())
      return { ...p, interior: { id: p.interior.id, kind: 'split', axis: 'x', sizes, children: sizes.map(() => ({ id: newId(), kind: 'empty' })) } }
    }),
    summary: a => {
      const n = compartmentCount(a) - 1
      return (n ? plural(n, 'divider') : 'no dividers') + (n && str(a, 'spacing') === 'custom' ? ' (custom widths)' : '')
    },
  },
  {
    id: 'contents', title: 'Contents', help: 'What each compartment holds, left to right.',
    fields: [{ id: 'compartments', label: 'Compartment', kind: 'compartments', options: CONTENT_KINDS, count: compartmentCount, min: 0, max: MAX_COMP_SHELVES }],
    apply: (a, d) => onCabinet(d, p => {
      const cs = compartmentsOf(a)
      return { ...p, interior: withLeaves(p.interior, (s, i) => contentSpace(cs[i] ?? DEFAULT_COMPARTMENT, s)) }
    }),
    summary: a => {
      const t = compartmentsOf(a).map(contentText)
      return t.every(x => x === t[0]) ? (t.length > 1 ? `${t[0]} each` : t[0]) : t.join(' | ')
    },
  },
  {
    id: 'fronts', title: 'Doors', help: 'Doors over the whole piece, or chosen per compartment. Drawers have their own fronts.',
    fields: [
      { id: 'fronts', label: 'Doors', kind: 'choice', default: 'none', options: [
        { value: 'none', label: 'None' }, { value: 'single', label: 'One door' }, { value: 'pair', label: 'Pair' },
        { value: 'sliding', label: 'Sliding pair' }, { value: 'per', label: 'Per compartment' }] },
      { id: 'frontsPer', label: 'Doors on compartment', kind: 'perCompartment', default: [], count: compartmentCount,
        options: [{ value: 'none', label: 'None' }, { value: 'single', label: 'One' }, { value: 'pair', label: 'Pair' }], visible: a => str(a, 'fronts') === 'per' },
      { id: 'handle', label: 'Handles', kind: 'choice', default: 'bar', options: [{ value: 'bar', label: 'Bar' }, { value: 'knob', label: 'Knob' }, { value: 'push', label: 'Push to open' }],
        help: 'Hole spacing 128 mm for bars (typical); check your handle.' },
    ],
    apply: (a, d) => onCabinet(d, p => {
      const f = str(a, 'fronts', 'none')
      const per = listOf<string>(a, 'frontsPer', 'none')
      const handle = { kind: str(a, 'handle', 'bar') as 'bar' | 'knob' | 'push' }
      let interior = everySpace(p.interior, s => ({ ...s, handle }))
      if (f === 'single' || f === 'pair') interior = { ...interior, front: doors(f) }
      else if (f === 'sliding') interior = { ...interior, front: { kind: 'sliding', count: 2 } }
      else if (f === 'per') interior = withLeaves(interior, (s, i) => ({ ...s, front: doors(per[i] ?? 'none') }))
      return { ...p, interior }
    }),
    summary: a => {
      const f = str(a, 'fronts', 'none')
      if (f !== 'per') return FRONT_TEXT[f] ?? ''
      const per = listOf<string>(a, 'frontsPer', 'none')
      if (per.length === 1) return FRONT_TEXT[per[0]] ?? ''
      const n = per.filter(x => x !== 'none').length
      return n ? `doors on ${plural(n, 'compartment')}` : 'no doors'
    },
  },
  {
    id: 'base', title: 'Base', help: 'What the piece stands on. Legs come with the table and bench types.',
    fields: [
      { id: 'base', label: 'Base', kind: 'choice', default: 'plinth', options: [{ value: 'plinth', label: 'Plinth' }, { value: 'none', label: 'None (on the floor)' }, { value: 'wall', label: 'Hung on the wall' }] },
      { ...mmField('plinthHeight', 'Plinth height', 80, 30, 300), visible: a => str(a, 'base') === 'plinth' },
      { ...mmField('mountHeight', 'Underside above the floor', 1450, 0, 2500), visible: a => str(a, 'base') === 'wall' },
    ],
    apply: (a, d) => onCabinet(d, p => {
      const b = str(a, 'base', 'plinth')
      if (b === 'wall') return { ...p, mount: 'wall', mountHeight: num(a, 'mountHeight'), plinthHeight: 0 }
      return { ...p, mount: 'floor', mountHeight: undefined, plinthHeight: b === 'plinth' ? num(a, 'plinthHeight') : 0 }
    }),
    summary: a => ({ plinth: 'on a plinth', none: 'no plinth', wall: 'wall-hung' }[str(a, 'base', 'plinth')] ?? ''),
  },
  {
    id: 'carcass', title: 'Back', help: 'A back panel keeps the box square; open shelving can go without.',
    fields: [{ id: 'back', label: 'Back panel', kind: 'choice', default: 'applied', options: [
      { value: 'applied', label: 'Nailed on the back' }, { value: 'inset', label: 'Set in' }, { value: 'none', label: 'No back' }] }],
    apply: (a, d) => onCabinet(d, p => ({ ...p, back: str(a, 'back', 'applied') as CabinetParams['back'] })),
    summary: a => ({ applied: 'back panel', inset: 'set-in back', none: 'open back' }[str(a, 'back', 'applied')] ?? ''),
  },
  {
    id: 'frame', title: 'Frame', help: 'Legs, rails under the top and stretchers between the legs.',
    fields: [
      { id: 'top', label: 'Top', kind: 'choice', default: 'panel', options: [{ value: 'panel', label: 'Panel' }, { value: 'slats', label: 'Slats' }] },
      { id: 'stretchers', label: 'Stretchers', kind: 'choice', default: 'none', options: [{ value: 'none', label: 'None' }, { value: 'box', label: 'Box' }, { value: 'h', label: 'H' }] },
      { id: 'lowerShelf', label: 'Lower shelf', kind: 'choice', default: 'none', options: [{ value: 'none', label: 'None' }, { value: 'yes', label: 'Yes' }] },
      { ...mmField('shelfHeight', 'Lower shelf height', 150, 30, 1000), visible: a => str(a, 'lowerShelf') === 'yes' },
      { ...mmField('legSize', 'Leg section (square)', 60, 25, 150), help: 'Solid timber; a layout default, not a load rating.' },
    ],
    apply: (a, d) => onProduct<FrameParams>(d, 'frame', p => ({
      ...p, top: str(a, 'top', 'panel') as FrameParams['top'], stretchers: str(a, 'stretchers', 'none') as FrameParams['stretchers'],
      shelf: str(a, 'lowerShelf') === 'yes' ? { height: num(a, 'shelfHeight') } : null, leg: { w: num(a, 'legSize'), d: num(a, 'legSize') },
    })),
    summary: a => [str(a, 'top') === 'slats' ? 'slatted top' : 'panel top',
      { box: 'box stretchers', h: 'H stretchers' }[str(a, 'stretchers')] ?? '', str(a, 'lowerShelf') === 'yes' ? 'lower shelf' : '',
      `${num(a, 'legSize')} mm legs`].filter(Boolean).join(' · '),
  },
  {
    id: 'desk', title: 'Desk', help: 'What carries the top: panel gables or drawer pedestals.',
    fields: [
      { id: 'support', label: 'Support', kind: 'choice', default: 'pedestal-left', options: [
        { value: 'gables', label: 'Two gables' }, { value: 'pedestal-left', label: 'Pedestal left' },
        { value: 'pedestal-right', label: 'Pedestal right' }, { value: 'two-pedestals', label: 'Two pedestals' }] },
      { id: 'pedestalDrawers', label: 'Drawers per pedestal', kind: 'int', default: 3, min: 1, max: 6, visible: a => str(a, 'support') !== 'gables' },
      { id: 'modesty', label: 'Modesty panel', kind: 'choice', default: 'yes', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
    ],
    apply: (a, d) => onProduct<DeskParams>(d, 'desk', p => {
      const n = num(a, 'pedestalDrawers', 3)
      return { ...p, support: str(a, 'support') as DeskParams['support'],
        pedestal: { ...p.pedestal, drawerCount: n, left: { id: newId(), kind: 'drawers', count: n }, right: { id: newId(), kind: 'drawers', count: n } },
        modesty: { ...p.modesty, enabled: str(a, 'modesty') === 'yes' } }
    }),
    summary: a => {
      const s = str(a, 'support')
      const ped = { 'pedestal-left': 'pedestal left', 'pedestal-right': 'pedestal right', 'two-pedestals': 'two pedestals' }[s]
      return [ped ? `${ped}, ${plural(num(a, 'pedestalDrawers'), 'drawer')} each` : 'two gables', str(a, 'modesty') === 'yes' ? 'modesty panel' : ''].filter(Boolean).join(' · ')
    },
  },
  {
    id: 'bed', title: 'Bed', help: 'The bed is sized from its mattress; the height asked first is the headboard height.',
    fields: [
      mmField('mattressWidth', 'Mattress width', 1600, 600, 2200),
      mmField('mattressLength', 'Mattress length', 2000, 1600, 2400),
      mmField('deckHeight', 'Slats above the floor', 380, 150, 700),
      { id: 'footboard', label: 'Footboard', kind: 'choice', default: 'none', options: [{ value: 'none', label: 'Low (rails height)' }, { value: 'yes', label: 'Raised' }] },
      { ...mmField('footboardHeight', 'Footboard height', 600, 300, 1500), visible: a => str(a, 'footboard') === 'yes' },
    ],
    apply: (a, d) => onProduct<FrameParams>(d, 'frame', p => p.bed ? ({
      ...p, bed: { ...p.bed, mattress: { w: num(a, 'mattressWidth'), l: num(a, 'mattressLength') }, deckHeight: num(a, 'deckHeight'),
        headboardHeight: num(a, 'height'), footboardHeight: str(a, 'footboard') === 'yes' ? num(a, 'footboardHeight') : 0, tierGap: 0 },
    }) : p),
    summary: a => [`${num(a, 'mattressWidth')} × ${num(a, 'mattressLength')} mattress`, `slats at ${num(a, 'deckHeight')} mm`,
      str(a, 'footboard') === 'yes' ? `footboard ${num(a, 'footboardHeight')} mm` : 'low foot'].join(' · '),
  },
  { id: REVIEW, title: 'Review', help: 'Check the picture, parts and problems, then create the piece.', fields: [] },
]

export const stepById = new Map(STEPS.map(s => [s.id, s]))
