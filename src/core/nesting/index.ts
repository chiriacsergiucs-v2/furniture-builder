import type { CutRow } from '../cutlist'
import type { NestJob } from './types'

export * from './types'
export { nest } from './place'
export { validateNest } from './validate'

export interface SheetSettings {
  sheet: NestJob['sheet']
  trim: number
  kerf: number
}

/**
 * One job per material that has settings, in first-seen cut-list order. Rows of materials without settings are
 * skipped (the caller reports missing stock). Key = first panel id of the row; sizes are finished sizes (ADR-0009).
 */
export function jobsFromCutlist(rows: CutRow[], settings: Map<string, SheetSettings>): NestJob[] {
  const jobs = new Map<string, NestJob>()
  for (const r of rows) {
    // Solid timber goes to the lengths list, never onto sheets (ADR-0038).
    if (r.solid) continue
    const s = settings.get(r.materialId)
    if (!s) continue
    let job = jobs.get(r.materialId)
    if (!job) {
      job = {
        materialId: r.materialId, materialName: r.materialName, thickness: r.thickness, grain: r.grain,
        sheet: { ...s.sheet }, trim: s.trim, kerf: s.kerf, parts: [],
      }
      jobs.set(r.materialId, job)
    }
    job.parts.push({ key: r.panelIds[0], label: r.labels.join(', '), length: r.length, width: r.width, quantity: r.quantity })
  }
  return [...jobs.values()]
}
