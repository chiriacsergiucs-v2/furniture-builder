import Dexie, { type Table } from 'dexie';
import { newId, upgradeDesign, validateDesign } from '../core/design';
import { PROJECT_SCHEMA, validateProject, type Project } from '../core/project';
import { validateLocalTemplate, type LocalTemplate } from '../core/catalog/local';
import type { Design } from '../core/types';
import { validateBand, type Band, type Decor } from '../core/materials';
import type { ModelFormat, ModelSize } from '../core/model3d';
import { validatePrice, type PriceEntry } from '../core/prices';
import { validFastenerChoice, type FastenerChoice, type JointType } from '../core/fasteners';
import { validateProjectTemplate, type ProjectTemplate } from '../core/projectTemplate';
import { validateBundle, validateMark, type StoredBundle } from '../core/research/catalog';
import type { ResearchMark } from '../core/research/types';
import { validateGapMark, type GapMark } from '../core/gaps';
import { validateVersion, type ProjectVersion } from '../core/projectVersion';
import type { BackupTable } from '../core/backup';
import { emitSavedChange } from './events';
import type { AccountLink } from '../core/sync';
import { t } from '../core/i18n';

/** A device setting kept in IndexedDB (ADR-133): values that localStorage cannot hold, like a folder handle. */
export interface SettingRow {
  key: string;
  value: unknown;
}

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
  projectVersions!: Table<ProjectVersion, string>;
  settings!: Table<SettingRow, string>;
  accountLinks!: Table<AccountLink, [string, string, string]>;
  bands!: Table<Band, string>;
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
    // v10 (ADR-123): kept versions of projects, kept until the user deletes them. Earlier tables untouched (additive).
    this.version(10).stores({
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
      projectVersions: 'id, projectId, savedAt',
    });
    // v11 (ADR-133, ADR-128): device settings that are not localStorage-safe, e.g. the backup folder handle, kept by
    // key; and the links between saved items and account records. Earlier tables untouched (additive).
    this.version(11).stores({
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
      projectVersions: 'id, projectId, savedAt',
      settings: 'key',
      // ADR-128 (G-222): which saved item is which record in which account; kept apart from the documents, so the
      // link never travels in exported files or design codes.
      accountLinks: '[accountId+table+localId], accountId, remoteId',
    });
    // v12 (ADR-212, G-038): the band list the user imported. Earlier tables untouched (additive).
    this.version(12).stores({
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
      projectVersions: 'id, projectId, savedAt',
      settings: 'key',
      accountLinks: '[accountId+table+localId], accountId, remoteId',
      bands: 'id',
    });
  }
}

/**
 * The raw database handle. Used only inside `src/persist` and by tests (ADR-223): the app goes through the named
 * functions below (the ui through `src/store/libraryStore.ts`); `tests/layering.test.ts` refuses any other import.
 */
export const db = new FurnitureDb();
/** The database type, for functions that take another instance (tests). */
export type Database = FurnitureDb;

/**
 * Report saved rows after their write succeeded (ADR-235): the folder backup, the account upload and the lists that
 * follow saves listen (`src/persist/events.ts`). Every write function below calls it itself; no Dexie hook does, so a
 * `put` never reads the row first. `tests/persist.test.ts` lists every write function and checks that it reports.
 */
export function savedRows(table: BackupTable, keys: Iterable<unknown>, deleted = false): void {
  for (const key of keys) emitSavedChange({ table, key: String(key), deleted });
}
const saved =
  <T>(table: BackupTable, keys: Iterable<unknown>, deleted = false) =>
  (r: T): T => {
    savedRows(table, keys, deleted);
    return r;
  };

export async function saveDesign(d: Design, database = db): Promise<void> {
  await database.designs.put({ id: d.id, name: d.name, updatedAt: d.updatedAt, design: d });
  savedRows('designs', [d.id]);
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

export const deleteDesign = (id: string, database = db) =>
  database.designs.delete(id).then(saved('designs', [id], true));

/** How many design and project rows are saved (readable or not), e.g. for the device-only notice (ADR-140). */
export const countDesigns = (database = db): Promise<number> => database.designs.count();
export const countProjects = (database = db): Promise<number> => database.projects.count();
/** Every stored design and template row as it is, unread rows included, for the account upload (ADR-128). */
export const designRows = (database = db): Promise<StoredDesign[]> => database.designs.toArray();
export const templateRows = (database = db): Promise<StoredTemplate[]> =>
  database.templates.toArray();

export async function saveProject(p: Project, database = db): Promise<void> {
  await database.projects.put({ id: p.id, name: p.name, updatedAt: p.updatedAt, project: p });
  savedRows('projects', [p.id]);
}
export const listProjects = (database = db): Promise<StoredProject[]> =>
  database.projects.orderBy('updatedAt').reverse().toArray();
/** Returns the project only if it still validates; corrupt rows are skipped, never deleted. */
export async function loadProject(id: string, database = db): Promise<Project | undefined> {
  const row = await database.projects.get(id);
  if (!row || validateProject(row.project).length) return undefined;
  return row.project;
}
export const deleteProject = (id: string, database = db) =>
  database.projects.delete(id).then(saved('projects', [id], true));

/** The result of copying a saved row (ADR-227): the new id, or why the row could not be copied. */
export type CopyResult = { ok: true; id: string } | { ok: false; reason: string };

/** The validation problems of a stored document; one that throws on the way is a problem too (ADR-008). */
const problems = (check: (v: unknown) => string[], doc: unknown): string[] => {
  try {
    return check(doc);
  } catch (e) {
    return [(e as Error).message || t('unknown error')];
  }
};
const refused = (errs: string[]): CopyResult => ({
  ok: false,
  reason: errs.length
    ? errs.slice(0, 2).join('; ')
    : t('Saved work could not be read from this browser.'),
});

/**
 * Duplicate a saved design (ADR-227): read through the same validating path as `loadDesign` (older versions upgraded
 * in memory), then save a copy with a new id, `name` and the current `schemaVersion`. A row that does not validate is
 * refused and left as it is (ADR-011, ADR-012).
 */
export async function copyDesign(id: string, name: string, database = db): Promise<CopyResult> {
  const row = await database.designs.get(id);
  if (!row) return refused([]);
  const errs = problems(validateDesign, row.design);
  if (errs.length) return refused(errs);
  const now = new Date().toISOString();
  const copy: Design = {
    ...upgradeDesign(row.design),
    id: newId(),
    name,
    createdAt: now,
    updatedAt: now,
  };
  await saveDesign(copy, database);
  return { ok: true, id: copy.id };
}

/** Duplicate a saved project (ADR-227), as `copyDesign`: validated first, written at `PROJECT_SCHEMA`. */
export async function copyProject(id: string, name: string, database = db): Promise<CopyResult> {
  const row = await database.projects.get(id);
  if (!row) return refused([]);
  const errs = problems(validateProject, row.project);
  if (errs.length) return refused(errs);
  const now = new Date().toISOString();
  const copy: Project = {
    ...row.project,
    schemaVersion: PROJECT_SCHEMA,
    id: newId(),
    name,
    createdAt: now,
    updatedAt: now,
  };
  await saveProject(copy, database);
  return { ok: true, id: copy.id };
}

/** Keep a version of a project (ADR-123); a version is never rewritten. */
export async function saveProjectVersion(v: ProjectVersion, database = db): Promise<void> {
  await database.projectVersions.add(v);
  savedRows('projectVersions', [v.id]);
}
/** A project's kept versions, newest first; unreadable rows are skipped and kept (ADR-012). */
export async function listProjectVersions(
  projectId: string,
  database = db,
): Promise<ProjectVersion[]> {
  const rows = await database.projectVersions.where('projectId').equals(projectId).toArray();
  const usable = (v: unknown) => {
    try {
      return !validateVersion(v).length;
    } catch {
      return false;
    }
  };
  return rows.filter(usable).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}
/**
 * Kept versions whose project is gone (ADR-211, G-389): readable versions whose `projectId` has no project row, newest
 * first. Unreadable rows are skipped and kept (ADR-012); nothing here deletes anything.
 */
export async function listOrphanVersions(database = db): Promise<ProjectVersion[]> {
  const [ids, rows] = await Promise.all([
    database.projects.toCollection().primaryKeys(),
    database.projectVersions.toArray(),
  ]);
  const live = new Set<string>(ids.map(String));
  const usable = (v: unknown) => {
    try {
      return !validateVersion(v).length;
    } catch {
      return false;
    }
  };
  return rows
    .filter((v) => usable(v) && !live.has(v.projectId))
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}
/** Only on the user's Delete (ADR-123, G-156: nothing removes versions automatically). */
export const deleteProjectVersion = (id: string, database = db) =>
  database.projectVersions.delete(id).then(saved('projectVersions', [id], true));
/**
 * Only on the user's Delete versions when a project is deleted (ADR-203, G-190): the rows `listProjectVersions`
 * returned, by id; rows the app cannot read are never in that list and stay (ADR-012).
 */
export const deleteProjectVersions = (ids: readonly string[], database = db) =>
  database.projectVersions.bulkDelete([...ids]).then(saved('projectVersions', ids, true));

export async function saveTemplate(t: LocalTemplate, database = db): Promise<void> {
  await database.templates.put({ id: t.id, updatedAt: t.updatedAt, template: t });
  savedRows('templates', [t.id]);
}
/** Local templates that still validate; unreadable rows are skipped and kept (ADR-012). */
export async function listTemplates(database = db): Promise<LocalTemplate[]> {
  const rows = await database.templates.orderBy('updatedAt').reverse().toArray();
  return rows.filter((r) => !validateLocalTemplate(r.template).length).map((r) => r.template);
}
export const deleteTemplate = (id: string, database = db) =>
  database.templates.delete(id).then(saved('templates', [id], true));

export async function saveResearchBundle(s: StoredBundle, database = db): Promise<void> {
  await database.researchDocs.put(s);
  savedRows('researchDocs', [s.key]);
}
/** Stored editions that still validate; unreadable rows are skipped and kept (ADR-012). */
export async function listResearchBundles(database = db): Promise<StoredBundle[]> {
  const rows = await database.researchDocs.toArray();
  return rows.filter((r) => !validateBundle(r.bundle).length);
}
export async function saveResearchMarks(marks: ResearchMark[], database = db): Promise<void> {
  await database.researchMarks.bulkPut(marks);
  savedRows(
    'researchMarks',
    marks.map((m) => m.id),
  );
}
/** Decisions that still validate; unreadable rows are skipped and kept (ADR-012). */
export async function listResearchMarks(database = db): Promise<ResearchMark[]> {
  const rows = await database.researchMarks.toArray();
  return rows.filter((r) => !validateMark(r).length);
}

export async function saveGapMark(mark: GapMark, database = db): Promise<void> {
  await database.gapMarks.put(mark);
  savedRows('gapMarks', [mark.gapId]);
}
/** Marks read from a gap-marks file (ADR-212), already merged newer-wins by `readGapMarksFile`. */
export async function saveGapMarks(marks: GapMark[], database = db): Promise<void> {
  await database.gapMarks.bulkPut(marks);
  savedRows(
    'gapMarks',
    marks.map((m) => m.gapId),
  );
}
/** Gap marks that still validate; unreadable rows are skipped and kept (ADR-012). */
export async function listGapMarks(database = db): Promise<GapMark[]> {
  const rows = await database.gapMarks.toArray();
  return rows.filter(validateGapMark);
}

export async function saveImage(img: StoredImage, database = db): Promise<void> {
  await database.images.put(img);
  savedRows('images', [img.id]);
}
/** Stored picture rows as they are (unreadable ones too), `undefined` where none (ADR-128). */
export const imageRows = (ids: string[], database = db) => database.images.bulkGet(ids);

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
  const old = await database.transaction('rw', database.decors, async () => {
    const keys = await database.decors.toCollection().primaryKeys();
    await database.decors.clear();
    await database.decors.bulkPut(decors);
    return keys;
  });
  const kept = new Set(decors.map((d) => d.id));
  savedRows(
    'decors',
    old.filter((k) => !kept.has(k)),
    true,
  );
  savedRows(
    'decors',
    decors.map((d) => d.id),
  );
}
export const listDecors = (database = db): Promise<Decor[]> => database.decors.toArray();
export async function clearDecors(database = db): Promise<void> {
  const keys = await database.transaction('rw', database.decors, async () => {
    const k = await database.decors.toCollection().primaryKeys();
    await database.decors.clear();
    return k;
  });
  savedRows('decors', keys, true);
}

/** A new band-list import replaces the list (ADR-212), as the decor list does. */
export async function replaceBands(bands: Band[], database = db): Promise<void> {
  await database.transaction('rw', database.bands, async () => {
    await database.bands.clear();
    await database.bands.bulkPut(bands);
  });
}
/** The band list; unreadable rows are skipped and kept (ADR-012). */
export async function listBands(database = db): Promise<Band[]> {
  const rows = await database.bands.toArray();
  return rows.filter(validateBand);
}

export async function saveProjectTemplate(t: ProjectTemplate, database = db): Promise<void> {
  await database.projectTemplates.put({
    id: t.id,
    name: t.name,
    updatedAt: t.updatedAt,
    template: t,
  });
  savedRows('projectTemplates', [t.id]);
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
  database.projectTemplates.delete(id).then(saved('projectTemplates', [id], true));

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
type FastenerRow = PriceEntry & { per?: unknown; edge?: unknown };
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
      // The edge distance (ADR-209): an extra field on the same row, no new Dexie version or index.
      ...(r.edge !== undefined ? { edge: r.edge as number } : {}),
    }))
    .filter(validFastenerChoice);
}
export const saveFastener = (c: FastenerChoice, database = db) =>
  database.prices
    .put({
      id: FASTENER_PREFIX + c.joint,
      unit: 'piece',
      amount: 0,
      text: c.name,
      per: c.per,
      ...(c.edge !== undefined ? { edge: c.edge } : {}),
    } as FastenerRow)
    .then(saved('prices', [FASTENER_PREFIX + c.joint]));
export const deleteFastener = (joint: JointType, database = db) =>
  database.prices
    .delete(FASTENER_PREFIX + joint)
    .then(saved('prices', [FASTENER_PREFIX + joint], true));
export const savePrice = (e: PriceEntry, database = db) =>
  database.prices.put(e).then(saved('prices', [e.id]));
export const savePrices = (list: PriceEntry[], database = db) =>
  database.prices.bulkPut(list).then(
    saved(
      'prices',
      list.map((e) => e.id),
    ),
  );
export const deletePrice = (id: string, database = db) =>
  database.prices.delete(id).then(saved('prices', [id], true));

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
export const deleteImages = (ids: string[], database = db) =>
  database.images.bulkDelete(ids).then(saved('images', ids, true));

/** A stored model if its row is readable; an unreadable row is left in place (ADR-012). */
export async function loadModel(id: string, database = db): Promise<StoredModel | undefined> {
  const row = await database.models.get(id);
  return row && row.bytes instanceof ArrayBuffer && row.bytes.byteLength > 0 ? row : undefined;
}
export const saveModel = (m: StoredModel, database = db) =>
  database.models.put(m).then(saved('models', [m.id]));
/** Readable models, newest first (ADR-076). */
export async function listModels(database = db): Promise<StoredModel[]> {
  const rows = await database.models.orderBy('createdAt').reverse().toArray();
  return rows.filter((r) => r.bytes instanceof ArrayBuffer && typeof r.name === 'string');
}
/**
 * Delete a model from the library unless a project or a project template still uses it (ADR-076, ADR-208, ADR-012).
 * Saved rows are searched as text, so a row the app cannot read still keeps its models; `keep` holds ids the open
 * project uses.
 */
export async function deleteModelIfUnused(
  id: string,
  keep: Iterable<string> = [],
  database = db,
): Promise<{ deleted: boolean; usedBy: string[] }> {
  const r = await database.transaction(
    'rw',
    database.models,
    database.projects,
    database.projectTemplates,
    async () => {
      const usedBy = [
        ...(await database.projects.toArray())
          .filter((r) => JSON.stringify(r).includes(`"${id}"`))
          .map((r) => (typeof r.name === 'string' ? r.name : t('a saved project'))),
        ...(await database.projectTemplates.toArray())
          .filter((r) => JSON.stringify(r).includes(`"${id}"`))
          .map((r) =>
            typeof r.name === 'string'
              ? t('the project template {name}', { name: r.name })
              : t('a project template'),
          ),
      ];
      if (new Set(keep).has(id)) usedBy.unshift(t('the open project'));
      if (usedBy.length) return { deleted: false, usedBy };
      await database.models.delete(id);
      return { deleted: true, usedBy };
    },
  );
  if (r.deleted) savedRows('models', [id], true);
  return r;
}

// Links between saved items and account records (ADR-128). Not saved work: no change is reported.
export const accountLinksOf = (accountId: string, database = db): Promise<AccountLink[]> =>
  database.accountLinks.where('accountId').equals(accountId).toArray();
export const allAccountLinks = (database = db): Promise<AccountLink[]> =>
  database.accountLinks.toArray();
export const loadAccountLink = (
  accountId: string,
  table: string,
  localId: string,
  database = db,
): Promise<AccountLink | undefined> => database.accountLinks.get([accountId, table, localId]);
export const saveAccountLink = (l: AccountLink, database = db) => database.accountLinks.put(l);
export const deleteAccountLink = (l: AccountLink, database = db) =>
  database.accountLinks.delete([l.accountId, l.table, l.localId]);

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

export async function getSetting<T>(key: string, database = db): Promise<T | undefined> {
  try {
    return (await database.settings.get(key))?.value as T | undefined;
  } catch {
    return undefined;
  }
}
export const setSetting = (key: string, value: unknown, database = db) =>
  database.settings.put({ key, value });
export const deleteSetting = (key: string, database = db) => database.settings.delete(key);
