import Dexie, { type Table } from 'dexie'
import { validateDesign } from '../core/design'
import type { Design } from '../core/types'

export interface StoredDesign { id: string; name: string; updatedAt: string; design: Design }

/**
 * Local-only storage (IndexedDB). Nothing leaves the device. New database name: the rebuild is a clean
 * break, so old `mobila-cutlist-build-kit` data is neither read nor touched.
 */
class FurnitureDb extends Dexie {
  designs!: Table<StoredDesign, string>
  constructor(name = 'furniture-builder') {
    super(name)
    // Never edit a shipped version block; add version(2) for any change.
    this.version(1).stores({ designs: 'id, updatedAt, name' })
  }
}

export const db = new FurnitureDb()

export async function saveDesign(d: Design, database = db): Promise<void> {
  await database.designs.put({ id: d.id, name: d.name, updatedAt: d.updatedAt, design: d })
}

export async function listDesigns(database = db): Promise<StoredDesign[]> {
  return database.designs.orderBy('updatedAt').reverse().toArray()
}

/** Returns the design only if it still validates; corrupt rows are skipped, never deleted. */
export async function loadDesign(id: string, database = db): Promise<Design | undefined> {
  const row = await database.designs.get(id)
  if (!row || validateDesign(row.design).length) return undefined
  return row.design
}

export const deleteDesign = (id: string, database = db) => database.designs.delete(id)

const LAST_KEY = 'furniture-builder:last-design'
export const rememberLast = (id: string) => { try { localStorage.setItem(LAST_KEY, id) } catch { /* private mode */ } }
export const lastDesignId = (): string | null => { try { return localStorage.getItem(LAST_KEY) } catch { return null } }
