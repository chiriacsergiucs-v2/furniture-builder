/**
 * Construction guidance as a registry of rules (ADR-0035), run by `buildModel` after the generators for every
 * design, whether it came from the catalog or was built by hand. Thresholds are typical values the user can change
 * (`design.settings.rules`); every rule is a warning or a hardware reminder, never an error.
 */
import type { Design, Diagnostic, FurnitureModel, HardwareItem, Material, Mm, Panel, RuleSettings } from './types'

/** Typical defaults. Not standards: confirm against your board maker and hardware datasheets. */
export const RULE_DEFAULTS: Required<Omit<RuleSettings, 'roomHeight'>> = {
  shelfSpan: 800,
  doorMaxWidth: 600,
  hangerDepth: 530,
}

/** Storage taller than this gets an anti-tip wall fixing in the hardware list. */
export const ANTI_TIP_HEIGHT = 1000

export interface RuleResult { diagnostics: Diagnostic[]; hardware: HardwareItem[] }
export interface Rule {
  code: string
  /** What the rule looks at, for the reader of this file. */
  appliesTo: string
  check: (design: Design, model: FurnitureModel, settings: Required<Omit<RuleSettings, 'roomHeight'>> & { roomHeight?: Mm }, materials: Map<string, Material>) => RuleResult
}

const none = (): RuleResult => ({ diagnostics: [], hardware: [] })
const warn = (code: string, message: string, nodeId?: string, panelIds?: string[]): Diagnostic => ({ severity: 'warning', code, message, nodeId, ...(panelIds ? { panelIds } : {}) })

/** Plywood is stiffer than particleboard or MDF of the same thickness (typical ratio, guidance only). */
const isPlywood = (m: Material) => /ply|placaj/i.test(`${m.id} ${m.name}`)

/** Span of a shelf: its length along its grain axis, which the cabinet generator sets along the span. */
const spanOf = (p: Panel) => (p.grainAxis === 'x' ? p.box.w : p.grainAxis === 'z' ? p.box.d : p.box.h)
/** Width of a hinged door across its face (doors on a turned corner wing face sideways). */
const faceWidth = (p: Panel) => (p.thicknessAxis === 'z' ? p.box.w : p.box.d)

export const rules: Rule[] = [
  {
    code: 'shelf-span', appliesTo: 'shelf panels',
    check: (_d, model, s, mats) => {
      const out = none()
      const seen = new Set<string>()
      for (const p of model.panels) {
        if (p.role !== 'shelf' || seen.has(p.nodeId)) continue
        const m = mats.get(p.materialId)
        if (!m) continue
        const limit = Math.round((s.shelfSpan * (isPlywood(m) ? 1.2 : 1) * m.thickness) / 18)
        const span = spanOf(p)
        if (span > limit) {
          seen.add(p.nodeId)
          out.diagnostics.push(warn('shelf-span', `Shelf span ${span} mm is long for ${m.thickness} mm ${m.name} and may sag (typical limit ${limit} mm — confirm for your board and load).`, p.nodeId, [p.id]))
        }
      }
      return out
    },
  },
  {
    code: 'door-wide', appliesTo: 'hinged doors',
    check: (_d, model, s) => {
      const out = none()
      for (const p of model.panels) {
        if (p.role !== 'door' || !/^Door/.test(p.label)) continue
        const w = faceWidth(p)
        if (w > s.doorMaxWidth) out.diagnostics.push(warn('door-wide', `Door ${w} mm wide; over ~${s.doorMaxWidth} mm (typical) consider two doors.`, p.nodeId, [p.id]))
      }
      return out
    },
  },
  {
    code: 'hanging-shallow', appliesTo: 'hanging spaces',
    check: (_d, model, s) => {
      const out = none()
      for (const sp of model.spaces) {
        if (sp.kind !== 'hanging') continue
        const depth = sp.view === 'side' ? sp.box.w : sp.box.d
        if (depth < s.hangerDepth) out.diagnostics.push(warn('hanging-shallow', `Opening depth ${depth} mm; hangers usually need about ${s.hangerDepth} mm (typical).`, sp.nodeId))
      }
      return out
    },
  },
  {
    code: 'anti-tip', appliesTo: 'tall storage on the floor',
    check: (d, model) => {
      const out = none()
      const p = d.product
      const tall = (p.kind === 'cabinet' && p.params.mount !== 'wall') || p.kind === 'corner'
      if (tall && model.bounds.h > ANTI_TIP_HEIGHT) {
        out.hardware.push({ nodeId: p.id, kind: 'wall-fixing', label: 'Anti-tip wall fixing', quantity: 1, note: `the piece is ${model.bounds.h} mm tall — fix it to the wall; choose the fixing for your wall type (typical guidance)` })
      }
      return out
    },
  },
  {
    code: 'tilt-up', appliesTo: 'tall pieces when a room height is set',
    check: (d, model, s) => {
      const out = none()
      if (!s.roomHeight || d.product.kind === 'panel') return out
      const { h, d: depth, w } = model.bounds
      const diag = Math.ceil(Math.sqrt(h * h + Math.min(depth, w) ** 2))
      if (diag >= s.roomHeight) out.diagnostics.push(warn('tilt-up', `Assembled lying down, the piece needs ${diag} mm to stand up, but the room is ${s.roomHeight} mm high. Build it in place or split it.`, d.product.id))
      return out
    },
  },
  {
    code: 'hardware-to-choose', appliesTo: 'catalog pieces that need hardware from a datasheet',
    check: d => {
      const out = none()
      const what = d.catalog?.hardwareToChoose
      if (what) out.diagnostics.push(warn('hardware-to-choose', `Choose the ${what} from the maker's datasheet and check its fitting sizes against this piece.`, d.product.id))
      return out
    },
  },
  {
    code: 'frame-guidance', appliesTo: 'frame furniture',
    check: (d, model) => {
      const out = none()
      const p = d.product
      if (p.kind !== 'frame') return out
      const f = p.params
      if (f.slats.gap > 70 && (f.top === 'slats' || f.kind === 'bed')) out.diagnostics.push(warn('slat-gap', `Slat gap ${f.slats.gap} mm; mattress and seat makers usually ask for 70 mm or less (check yours).`, p.id))
      if (f.kind === 'bed' && f.bed) {
        if (f.bed.tierGap > 0) out.diagnostics.push(warn('safety-not-checked', 'Bunk beds are covered by safety standards (EN 747 and others). Mobila does not check guard rails, openings or ladder against them; this is not a compliance check.', p.id))
        if (f.bed.mattress.w < 700) out.diagnostics.push(warn('safety-not-checked', 'Cots and cradles are covered by safety standards (EN 716 and others). Mobila does not check bar spacing or side height; this is not a compliance check.', p.id))
      }
      if (f.kind !== 'bed' && f.apron.height > 0) {
        const span = model.panels.filter(x => x.role === 'apron').reduce((a, x) => Math.max(a, x.box.w, x.box.d), 0)
        if (span > 1800) out.diagnostics.push(warn('frame-span', `Rails span ${span} mm between legs; long tables usually get a centre leg or rail (typical).`, p.id))
      }
      return out
    },
  },
]

/** Run every rule. Unknown or absent settings fall back to the typical defaults. */
export function runRules(design: Design, model: FurnitureModel, materials: Map<string, Material>): RuleResult {
  const s = { ...RULE_DEFAULTS, ...(design.settings?.rules ?? {}) }
  const out = none()
  for (const r of rules) {
    const res = r.check(design, model, s, materials)
    out.diagnostics.push(...res.diagnostics)
    out.hardware.push(...res.hardware)
  }
  return out
}
