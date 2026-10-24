import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildModel } from '../src/core/build'
import { catalogFamilies, insertable, insertVariant } from '../src/core/catalog'
import { snapshotSvg } from '../src/core/snapshot'
import type { FurnitureModel, Material, Panel } from '../src/core/types'

/**
 * Catalog pictures are made before the app runs (ADR-042): `npm run catalog:snapshots` writes
 * `public/catalog/<variant>.svg`; this test fails when a committed picture no longer matches its design.
 */
const dir = new URL('../public/catalog/', import.meta.url)
const shipped = catalogFamilies.flatMap(f => f.variants.filter(insertable).map(v => ({ f, v })))

describe('catalog snapshots (ADR-042)', () => {
  it('every item that opens has a committed picture of its current design, and nothing else is there', () => {
    for (const { f, v } of shipped) {
      const d = insertVariant(f, v, '')!
      const svg = snapshotSvg(buildModel(d), d.materials)
      const file = new URL(`${v.id}.svg`, dir)
      if (process.env.WRITE_SNAPSHOTS) writeFileSync(file, svg)
      expect(existsSync(file), `${v.id}.svg missing: run npm run catalog:snapshots`).toBe(true)
      expect(readFileSync(file, 'utf8'), `${v.id}.svg is stale: run npm run catalog:snapshots`).toBe(svg)
    }
    const expected = new Set(shipped.map(({ v }) => `${v.id}.svg`))
    expect(readdirSync(dir).filter(n => !expected.has(n))).toEqual([])
  })
})

const mat: Material = { id: 'm', name: 'M', thickness: 18, grain: false, color: '#808080' }
const panel = (id: string, x: number, y: number, z: number, w: number, h: number, d: number, materialId = 'm'): Panel =>
  ({ id, nodeId: id, role: 'side', label: id, materialId, box: { x, y, z, w, h, d }, thicknessAxis: 'x', grainAxis: 'y', banded: [] })
const model = (panels: Panel[]): FurnitureModel => ({ panels, spaces: [], hardware: [], diagnostics: [], bounds: { x: 0, y: 0, z: 0, w: 0, h: 0, d: 0 } })
const order = (svg: string, colours: string[]) => colours.map(c => svg.indexOf(c))

describe('snapshot renderer', () => {
  const red: Material = { ...mat, id: 'r', color: '#ff0000' }, blue: Material = { ...mat, id: 'b', color: '#0000ff' }
  it('draws three faces per panel, the nearer panel last, whatever the input order', () => {
    const back = panel('back', 0, 0, 0, 100, 100, 10, 'r'), front = panel('front', 0, 0, 50, 100, 100, 10, 'b')
    for (const ps of [[back, front], [front, back]]) {
      const svg = snapshotSvg(model(ps), [red, blue])
      expect(svg.match(/<path /g)).toHaveLength(6)
      const [r, b] = order(svg, ['stroke="#8c0000"', 'stroke="#00008c"'])
      expect(r).toBeLessThan(b)
    }
  })
  it('a part on top is drawn after the one it stands on; a part to the right after the one on its left', () => {
    const low = panel('low', 0, 0, 0, 100, 20, 100, 'r'), high = panel('high', 0, 20, 0, 100, 20, 100, 'b')
    let [r, b] = order(snapshotSvg(model([high, low]), [red, blue]), ['stroke="#8c0000"', 'stroke="#00008c"'])
    expect(r).toBeLessThan(b)
    const left = panel('left', 0, 0, 0, 20, 100, 100, 'r'), right = panel('right', 20, 0, 0, 20, 100, 100, 'b')
    ;[r, b] = order(snapshotSvg(model([right, left]), [red, blue]), ['stroke="#8c0000"', 'stroke="#00008c"'])
    expect(r).toBeLessThan(b)
  })
  it('is deterministic and fits the requested size', () => {
    const m = buildModel(catalogFamilies[0].variants[0].create!())
    const a = snapshotSvg(m, catalogFamilies[0].variants[0].create!().materials, 200)
    expect(snapshotSvg(m, catalogFamilies[0].variants[0].create!().materials, 200)).toBe(a)
    const [, w, h] = /viewBox="0 0 (\d+) (\d+)"/.exec(a)!.map(Number)
    expect(Math.max(w, h)).toBe(200)
  })
})
