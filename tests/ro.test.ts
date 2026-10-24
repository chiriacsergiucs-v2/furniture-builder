import { describe, expect, it } from 'vitest'
import { buildModel } from '../src/core/build'
import { cutlist, hardwareSummary } from '../src/core/cutlist'
import { templates } from '../src/core/design'
import { CSV_HEADERS_RO, cutlistCsvRo, drillingRo, hardwareRo, partRo } from '../src/core/ro'

describe('Romanian output for the panel shop (ADR-020)', () => {
  it('CSV: Romanian headers, semicolons, UTF-8 BOM, translated part names', () => {
    const d = templates.find(t => t.id === 'chest')!.create()
    const csv = cutlistCsvRo(cutlist(buildModel(d), d.materials))
    expect(csv.startsWith('﻿')).toBe(true)
    const [head, ...lines] = csv.slice(1).trim().split('\r\n')
    expect(head.split(';')).toEqual(CSV_HEADERS_RO)
    expect(lines.length).toBeGreaterThan(3)
    expect(csv).toContain('Lateral stânga / Lateral dreapta')
    expect(csv).toContain('Front sertar')
    for (const l of lines) expect(l.split(';').length).toBe(CSV_HEADERS_RO.length)
  })
  it('every part label used by the generators has a Romanian name', () => {
    const seen = new Set<string>()
    // Loose panels carry the name the user typed; it is printed as written.
    for (const t of templates) for (const p of buildModel(t.create()).panels) if (p.role !== 'loose') seen.add(p.label)
    for (const label of seen) expect(partRo(label), label).not.toBe(label)
  })
  it('hardware and drilling read in Romanian', () => {
    const d = templates.find(t => t.id === 'wardrobe')!.create()
    for (const h of hardwareSummary(buildModel(d))) expect(hardwareRo(h).item).toMatch(/[ăâîșțA-Z]/)
    expect(drillingRo('2 rows × 14 holes ø5, 37 mm from edges, one face')).toBe('2 rânduri × 14 găuri ø5, la 37 mm de margini, o față')
    expect(drillingRo('handle holes ø5 at 10/20, 138/20 mm from left/bottom')).toBe('găuri mâner ø5 la 10/20, 138/20 mm de la stânga/jos')
  })
})
