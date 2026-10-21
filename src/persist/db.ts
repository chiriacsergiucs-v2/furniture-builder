import Dexie, { type Table } from 'dexie'
import { validateDesign } from '../core/design'
import { validateProject, type Project } from '../core/project'
import type { Design } from '../core/types'

export interface StoredDesign { id: string; name: string; updatedAt: string; design: Design }
export interface StoredProject { id: string; name: string; updatedAt: string; project: Project }

/**
 * Local-only storage (IndexedDB). Nothing leaves the device. New database name: the rebuild is a clean
 * break, so old `mobila-cutlist-build-kit` data is neither read nor touched.
 */
class FurnitureDb extends Dexie {
  designs!: Table<StoredDesign, string>
  projects!: Table<StoredProject, string>
  constructor(name = 'furniture-builder') {
    super(name)
    // Never edit a shipped version block; add a new version for any change (ADR-0012).
    this.version(1).stores({ designs: 'id, updatedAt, name' })
    // v2 (ADR-0022): projects with several pieces. Designs untouched.
    this.version(2).stores({ designs: 'id, updatedAt, name', projects: 'id, updatedAt, name' })
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

export async function saveProject(p: Project, database = db): Promise<void> {
  await database.projects.put({ id: p.id, name: p.name, updatedAt: p.updatedAt, project: p })
}
export const listProjects = (database = db): Promise<StoredProject[]> => database.projects.orderBy('updatedAt').reverse().toArray()
/** Returns the project only if it still validates; corrupt rows are skipped, never deleted. */
export async function loadProject(id: string, database = db): Promise<Project | undefined> {
  const row = await database.projects.get(id)
  if (!row || validateProject(row.project).length) return undefined
  return row.project
}
export const deleteProject = (id: string, database = db) => database.projects.delete(id)

const LAST_KEY = 'furniture-builder:last-design'
const LAST_PROJECT_KEY = 'furniture-builder:last-project'
export const rememberLastProject = (id: string | null) => { try { if (id) localStorage.setItem(LAST_PROJECT_KEY, id); else localStorage.removeItem(LAST_PROJECT_KEY) } catch { /* private mode */ } }
export const lastProjectId = (): string | null => { try { return localStorage.getItem(LAST_PROJECT_KEY) } catch { return null } }
export const rememberLast = (id: string) => { try { localStorage.setItem(LAST_KEY, id) } catch { /* private mode */ } }
export const lastDesignId = (): string | null => { try { return localStorage.getItem(LAST_KEY) } catch { return null } }
