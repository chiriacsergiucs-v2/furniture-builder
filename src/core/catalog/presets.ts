/**
 * Layout presets (ADR-033): the inside of every interior-only cabinet variant, offered as "Apply layout…" on any
 * space. Applying keeps the selected space's id (so selection survives), gives every other node a fresh id, and never
 * touches outer sizes or materials. One undo step, because it goes through the normal space update.
 */
import { newId } from '../design'
import type { Space } from '../types'
import { insertable, type CatalogFamily } from './types'

export interface LayoutPreset { id: string; family: string; name: string; space: () => Space }

const renew = (s: Space): Space => (s.kind === 'split' ? { ...s, id: newId(), children: s.children.map(renew) } : { ...s, id: newId() })

export function layoutPresets(families: CatalogFamily[]): LayoutPreset[] {
  const out: LayoutPreset[] = []
  for (const f of families) for (const v of f.variants) {
    if (v.kind !== 'interior' || !insertable(v) || (f.root !== 'cabinet')) continue
    const d = v.create!()
    if (d.product.kind !== 'cabinet') continue
    const interior = d.product.params.interior
    out.push({ id: `${f.id}/${v.id}`, family: f.name, name: v.name, space: () => renew(structuredClone(interior)) })
  }
  return out
}

/** Replace a space's contents with a preset, keeping its id. */
export function applyLayout(target: Space, preset: Space): Space {
  return { ...preset, id: target.id }
}
