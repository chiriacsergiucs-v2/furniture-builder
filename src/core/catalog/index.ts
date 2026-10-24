/**
 * The shipped template catalog (ADR-032, ADR-033, ADR-039): families of complete design snapshots.
 * Insert = deep copy with a new id and the origin recorded (ADR-028); later catalog changes never reach a copy.
 * The list must match `docs/catalog.md` (a test compares them).
 */
import { newId, upgradeDesign } from '../design'
import type { Design } from '../types'
import { tables, seating, sleeping } from './furniture'
import { kitchen } from './kitchen'
import { storage } from './storage'
import { insertable, type CatalogFamily, type CatalogVariant } from './types'

export * from './types'

export const catalogFamilies: CatalogFamily[] = [...kitchen, ...storage, ...tables, ...seating, ...sleeping]

export const findFamily = (id: string) => catalogFamilies.find(f => f.id === id)

/** The variants a family offers in Start from, default first; reference families are browsed in the Catalog tab only. */
export const startFamilies = (families: CatalogFamily[] = catalogFamilies) =>
  families.filter(f => f.support !== 'reference' && f.variants.some(insertable))

/**
 * A new, independent design from a variant: fresh design id, origin recorded, hardware still to choose noted.
 * Null when the variant cannot be built yet (its requirements are not built or it has no design).
 */
export function insertVariant(family: Pick<CatalogFamily, 'id' | 'name' | 'catalogVersion'>, variant: CatalogVariant, now = new Date().toISOString()): Design | null {
  if (!insertable(variant)) return null
  const d = upgradeDesign(structuredClone(variant.create!()))
  return {
    ...d, id: newId(), createdAt: now, updatedAt: now,
    catalog: {
      category: family.name,
      ...(variant.hardware ? { hardwareToChoose: variant.hardware } : {}),
      origin: { catalogId: family.id, variantId: variant.id, revision: family.catalogVersion, productName: `${family.name} — ${variant.name}`, takenAt: now },
    },
  }
}
