import Dexie, { type Table } from 'dexie';
import { validateDesign } from '../core/design';
import { validateProject, type Project } from '../core/project';
import { validateLocalTemplate, type LocalTemplate } from '../core/catalog/local';
import type { Design } from '../core/types';
import type { Decor } from '../core/materials';
import type { ModelFormat, ModelSize } from '../core/model3d';
import { validatePrice, type PriceEntry } from '../core/prices';
import { validFastenerChoice, type FastenerChoice, type JointType } from '../core/fasteners';
import { validateProjectTemplate, type ProjectTemplate } from '../core/projectTemplate';
import { validateBundle, validateMark, type StoredBundle } from '../core/research/catalog';
import type { ResearchMark } from '../core/research/types';
import { validateGapMark, type GapMark } from '../core/gaps';

export interface StoredDesign {
  id: string;
  name: string;
  updatedAt: string;
  design: Design;
}
export interface StoredProject {
  id: string;
  name: string;
  updatedAt: string;
  project: Project;
}
export interface StoredProjectTemplate {
  id: string;
  name: string;
  updatedAt: string;
  template: ProjectTemplate;
}
export interface StoredTemplate {
  id: string;
  updatedAt: string;
  template: LocalTemplate;
}
/** A picture added to a material (ADR-048), already scaled down. Bytes, not a Blob: every browser stores those. */
export interface StoredImage {
  id: string;
  name: string;
  type: string;
  width: number;
  height: number;
  bytes: ArrayBuffer;
  createdAt: string;
}

/** A 3D model file from the device (ADR-076), kept as it was picked; projects refer to it by id. */
export interface StoredModel {
  id: string;
  name: string;
  format: ModelFormat;
  bytes: ArrayBuffer;
  /** Size in mm from the model's bounds (glTF metres × 1000). */
  size: ModelSize;
  triangles: number;
  /** A small rendered picture (PNG) for the library list; absent when it could not be drawn. */
  thumb?: ArrayBuffer;
  createdAt: string;
}

/**
 * Local-only storage (IndexedDB). Nothing leaves the device. New database name: the rebuild is a clean
 * break, so old `mobila-cutlist-build-kit` data is neither read nor touched.
 */
class FurnitureDb extends Dexie {
  designs!: Table<StoredDesign, string>;
  projects!: Table<StoredProject, string>;
  templates!: Table<StoredTemplate, string>;
  researchDocs!: Table<StoredBundle, string>;
  researchMarks!: Table<ResearchMark, string>;
  images!: Table<StoredImage, string>;
  decors!: Table<Decor, string>;
  projectTemplates!: Table<StoredProjectTemplate, string>;
  prices!: Table<PriceEntry, string>;
  models!: Table<StoredModel, string>;
  gapMarks!: Table<GapMark, string>;
  constructor(name = 'furniture-builder') {
    super(name);
    // Never edit a shipped version block; add a new version for any change (ADR-012).
    this.version(1).stores({ designs: 'id, updatedAt, name' });
    // v2 (ADR-022): projects with several pieces. Designs untouched.
    this.version(2).stores({ designs: 'id, updatedAt, name', projects: 'id, updatedAt, name' });
    // v3 (ADR-034): templates edited on this device. Designs and projects untouched (additive table).
    this.version(3).stores({
      designs: 'id, updatedAt, name',
      projects: 'id, updatedAt, name',
      templates: 'id, updatedAt',
    });
    // v4 (ADR-043): research papers (one row per edition) and the user's decisions on them, kept apart so a
    // re-import never touches a decision. Earlier tables untouched (additive).
    this.version(4).stores({
      designs: 'id, updatedAt, name',
      projects: 'id, updatedAt, name',
      templates: 'id, updatedAt',
      researchDocs: 'key, docId',
      researchMarks: 'id, updatedAt',
    });
    // v5 (ADR-048): pictures for materials, referenced by id from a design's material. Earlier tables untouched.
    this.version(5).stores({
      designs: 'id, updatedAt, name',
      projects: 'id, updatedAt, name',
      templates: 'id, updatedAt',
      researchDocs: 'key, docId',
      researchMarks: 'id, updatedAt',
      images: 'id',
    });
    // v6 (ADR-049): the decor list the user imported. Earlier tables untouched.
    this.version(6).stores({
      designs: 'id, updatedAt, name',
      projects: 'id, updatedAt, name',
      templates: 'id, updatedAt',
      researchDocs: 'key, docId',
      researchMarks: 'id, updatedAt',
      images: 'id',
      decors: 'id',
    });
    // v7 (ADR-060, ADR-062): project templates and the user's own price list. Earlier tables untouched.
    this.version(7).stores({
      designs: 'id, updatedAt, name',
      projects: 'id, updatedAt, name',
      templates: 'id, updatedAt',
      researchDocs: 'key, docId',
      researchMarks: 'id, updatedAt',
      images: 'id',
      decors: 'id',
      projectTemplates: 'id, updatedAt, name',
      prices: 'id',
    });
    // v8 (ADR-076): 3D model files for display-only project items. Earlier tables untouched (additive).
    this.version(8).stores({
      designs: 'id, updatedAt, name',
      projects: 'id, updatedAt, name',
      templates: 'id, updatedAt',
      researchDocs: 'key, docId',
      researchMarks: 'id, updatedAt',
      images: 'id',
      decors: 'id',
      projectTemplates: 'id, updatedAt, name',
      prices: 'id',
      models: 'id, createdAt',
    });
    // v9 (ADR-101): the user's marks on gaps (acknowledge, make an ADR, a note). Earlier tables untouched (additive).
    this.version(9).stores({
      designs: 'id, updatedAt, name',
      projects: 'id, updatedAt, name',
      templates: 'id, updatedAt',
      researchDocs: 'key, docId',
      researchMarks: 'id, updatedAt',
      images: 'id',
      decors: 'id',
      projectTemplates: 'id, updatedAt, name',
      prices: 'id',
      models: 'id, createdAt',
      gapMarks: 'gapId, updatedAt',
    });
  }
}

export const db = new FurnitureDb();

export async function saveDesign(d: Design, database = db): Promise<void> {
  await database.designs.put({ id: d.id, name: d.name, updatedAt: d.updatedAt, design: d });
}

export async function listDesigns(database = db): Promise<StoredDesign[]> {
  return database.designs.orderBy('updatedAt').reverse().toArray();
}

/** Returns the design only if it still validates; corrupt rows are skipped, never deleted. */
export async function loadDesign(id: string, database = db): Promise<Design | undefined> {
  const row = await database.designs.get(id);
  if (!row || validateDesign(row.design).length) return undefined;
  return row.design;
}

export const deleteDesign = (id: string, database = db) => database.designs.delete(id);

export async function saveProject(p: Project, database = db): Promise<void> {
  await database.projects.put({ id: p.id, name: p.name, updatedAt: p.updatedAt, project: p });
}
export const listProjects = (database = db): Promise<StoredProject[]> =>
  database.projects.orderBy('updatedAt').reverse().toArray();
/** Returns the project only if it still validates; corrupt rows are skipped, never deleted. */
export async function loadProject(id: string, database = db): Promise<Project | undefined> {
  const row = await database.projects.get(id);
  if (!row || validateProject(row.project).length) return undefined;
  return row.project;
}
export const deleteProject = (id: string, database = db) => database.projects.delete(id);

export async function saveTemplate(t: LocalTemplate, database = db): Promise<void> {
  await database.templates.put({ id: t.id, updatedAt: t.updatedAt, template: t });
}
/** Local templates that still validate; unreadable rows are skipped and kept (ADR-012). */
export async function listTemplates(database = db): Promise<LocalTemplate[]> {
  const rows = await database.templates.orderBy('updatedAt').reverse().toArray();
  return rows.filter((r) => !validateLocalTemplate(r.template).length).map((r) => r.template);
}
export const deleteTemplate = (id: string, database = db) => database.templates.delete(id);

export async function saveResearchBundle(s: StoredBundle, database = db): Promise<void> {
  await database.researchDocs.put(s);
}
/** Stored editions that still validate; unreadable rows are skipped and kept (ADR-012). */
export async function listResearchBundles(database = db): Promise<StoredBundle[]> {
  const rows = await database.researchDocs.toArray();
  return rows.filter((r) => !validateBundle(r.bundle).length);
}
export async function saveResearchMarks(marks: ResearchMark[], database = db): Promise<void> {
  await database.researchMarks.bulkPut(marks);
}
/** Decisions that still validate; unreadable rows are skipped and kept (ADR-012). */
export async function listResearchMarks(database = db): Promise<ResearchMark[]> {
  const rows = await database.researchMarks.toArray();
  return rows.filter((r) => !validateMark(r).length);
}

export async function saveGapMark(mark: GapMark, database = db): Promise<void> {
  await database.gapMarks.put(mark);
}
/** Gap marks that still validate; unreadable rows are skipped and kept (ADR-012). */
export async function listGapMarks(database = db): Promise<GapMark[]> {
  const rows = await database.gapMarks.toArray();
  return rows.filter(validateGapMark);
}

export async function saveImage(img: StoredImage, database = db): Promise<void> {
  await database.images.put(img);
}
/** The stored picture if it is readable; an unreadable row is left in place (ADR-012). */
export async function loadImage(id: string, database = db): Promise<StoredImage | undefined> {
  const row = await database.images.get(id);
  const ok =
    row &&
    row.bytes instanceof ArrayBuffer &&
    row.bytes.byteLength > 0 &&
    typeof row.type === 'string';
  return ok ? row : undefined;
}

/** Replaces the stored decor list with the user's new one (ADR-049). */
export async function replaceDecors(decors: Decor[], database = db): Promise<void> {
  await database.transaction('rw', database.decors, async () => {
    await database.decors.clear();
    await database.decors.bulkPut(decors);
  });
}
export const listDecors = (database = db): Promise<Decor[]> => database.decors.toArray();
export const clearDecors = (database = db) => database.decors.clear();

export async function saveProjectTemplate(t: ProjectTemplate, database = db): Promise<void> {
  await database.projectTemplates.put({
    id: t.id,
    name: t.name,
    updatedAt: t.updatedAt,
    template: t,
  });
}
/** Project templates that still validate; unreadable rows are skipped and kept (ADR-012). */
export async function listProjectTemplates(database = db): Promise<ProjectTemplate[]> {
  const rows = await database.projectTemplates.orderBy('updatedAt').reverse().toArray();
  // Each row on its own: one that cannot be read is skipped (and kept), never the whole list (ADR-012).
  const usable = (t: unknown) => {
    try {
      return !validateProjectTemplate(t).length;
    } catch {
      return false;
    }
  };
  return rows.filter((r) => usable(r.template)).map((r) => r.template);
}
export const deleteProjectTemplate = (id: string, database = db) =>
  database.projectTemplates.delete(id);

/** The user's price list (ADR-062); unreadable rows are skipped and kept. Fastener rows (ADR-074) are not prices. */
export async function listPrices(database = db): Promise<PriceEntry[]> {
  return (await database.prices.toArray()).filter(
    (r) => !r.id.startsWith(FASTENER_PREFIX) && !validatePrice(r).length,
  );
}

/**
 * The user's fastener list (ADR-074): one row per joint type in the existing `prices` table, id
 * `fastener:<joint type>`, so no new Dexie version is needed. Unreadable rows are skipped and kept (ADR-012).
 */
export const FASTENER_PREFIX = 'fastener:';
type FastenerRow = PriceEntry & { per?: unknown };
export async function listFasteners(database = db): Promise<FastenerChoice[]> {
  const rows = (await database.prices
    .where('id')
    .startsWith(FASTENER_PREFIX)
    .toArray()) as FastenerRow[];
  return rows
    .map((r) => ({
      joint: r.id.slice(FASTENER_PREFIX.length) as JointType,
      name: r.text ?? '',
      per: r.per as number,
    }))
    .filter(validFastenerChoice);
}
export const saveFastener = (c: FastenerChoice, database = db) =>
  database.prices.put({
    id: FASTENER_PREFIX + c.joint,
    unit: 'piece',
    amount: 0,
    text: c.name,
    per: c.per,
  } as FastenerRow);
export const deleteFastener = (joint: JointType, database = db) =>
  database.prices.delete(FASTENER_PREFIX + joint);
export const savePrice = (e: PriceEntry, database = db) => database.prices.put(e);
export const savePrices = (list: PriceEntry[], database = db) => database.prices.bulkPut(list);
export const deletePrice = (id: string, database = db) => database.prices.delete(id);

/**
 * Pictures no stored design, project or template refers to (ADR-048 cleanup). Rows are searched as text, so rows
 * the app cannot read still keep their pictures (ADR-012). `keep`: ids in use by what is open but not yet saved.
 */
export async function unusedImageIds(
  keep: Iterable<string> = [],
  database = db,
): Promise<string[]> {
  const ids = await database.images.toCollection().primaryKeys();
  const text = [
    ...(await database.designs.toArray()),
    ...(await database.projects.toArray()),
    ...(await database.templates.toArray()),
    ...(await database.projectTemplates.toArray()),
  ]
    .map((r) => JSON.stringify(r))
    .join('\n');
  const kept = new Set(keep);
  return ids.filter((id) => !kept.has(id) && !text.includes(`"${id}"`));
}
export const deleteImages = (ids: string[], database = db) => database.images.bulkDelete(ids);

/** A stored model if its row is readable; an unreadable row is left in place (ADR-012). */
export async function loadModel(id: string, database = db): Promise<StoredModel | undefined> {
  const row = await database.models.get(id);
  return row && row.bytes instanceof ArrayBuffer && row.bytes.byteLength > 0 ? row : undefined;
}
export const saveModel = (m: StoredModel, database = db) => database.models.put(m);
/** Readable models, newest first (ADR-076). */
export async function listModels(database = db): Promise<StoredModel[]> {
  const rows = await database.models.orderBy('createdAt').reverse().toArray();
  return rows.filter((r) => r.bytes instanceof ArrayBuffer && typeof r.name === 'string');
}
/**
 * Delete a model from the library unless a project still uses it (ADR-076, ADR-012). Saved projects are searched as
 * text, so a project the app cannot read still keeps its models; `keep` holds ids the open project uses.
 */
export async function deleteModelIfUnused(
  id: string,
  keep: Iterable<string> = [],
  database = db,
): Promise<{ deleted: boolean; usedBy: string[] }> {
  return database.transaction('rw', database.models, database.projects, async () => {
    const usedBy = (await database.projects.toArray())
      .filter((r) => JSON.stringify(r).includes(`"${id}"`))
      .map((r) => (typeof r.name === 'string' ? r.name : 'a saved project'));
    if (new Set(keep).has(id)) usedBy.unshift('the open project');
    if (usedBy.length) return { deleted: false, usedBy };
    await database.models.delete(id);
    return { deleted: true, usedBy };
  });
}

const LAST_KEY = 'furniture-builder:last-design';
const LAST_PROJECT_KEY = 'furniture-builder:last-project';
export const rememberLastProject = (id: string | null) => {
  try {
    if (id) localStorage.setItem(LAST_PROJECT_KEY, id);
    else localStorage.removeItem(LAST_PROJECT_KEY);
  } catch {
    /* private mode */
  }
};
export const lastProjectId = (): string | null => {
  try {
    return localStorage.getItem(LAST_PROJECT_KEY);
  } catch {
    return null;
  }
};
export const rememberLast = (id: string) => {
  try {
    localStorage.setItem(LAST_KEY, id);
  } catch {
    /* private mode */
  }
};
export const lastDesignId = (): string | null => {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
};
