/**
 * The saved library on this device (ADR-223): the one way `src/ui` reads and writes saved designs, projects, versions,
 * project templates and the other saved lists. Each action calls the `src/persist/db.ts` function of the same name on
 * the app's database, so every write reports its change exactly as before (ADR-235: the folder backup and the
 * account upload follow it), and storage keeps its rules (ADR-012: unreadable rows are skipped and kept). The ui never
 * imports `src/persist/db` or the raw database (`tests/layering.test.ts`).
 *
 * Actions call the persist function (imported as `stored_<name>`) when they run, not a copy taken at load, so a test
 * that mocks or spies on `src/persist/db` sees the ui's calls.
 */
import type { Band, Decor } from '../core/materials';
import type { Design } from '../core/types';
import type { Project } from '../core/project';
import type { ProjectTemplate } from '../core/projectTemplate';
import type { ProjectVersion } from '../core/projectVersion';
import type { LocalTemplate } from '../core/catalog/local';
import type { GapMark } from '../core/gaps';
import type { PriceEntry } from '../core/prices';
import {
  clearDecors as stored_clearDecors,
  copyDesign as stored_copyDesign,
  copyProject as stored_copyProject,
  countDesigns as stored_countDesigns,
  countProjects as stored_countProjects,
  deleteDesign as stored_deleteDesign,
  deleteImages as stored_deleteImages,
  deleteModelIfUnused as stored_deleteModelIfUnused,
  deleteProject as stored_deleteProject,
  deleteProjectTemplate as stored_deleteProjectTemplate,
  deleteProjectVersion as stored_deleteProjectVersion,
  deleteProjectVersions as stored_deleteProjectVersions,
  getSetting as stored_getSetting,
  lastDesignId as stored_lastDesignId,
  lastProjectId as stored_lastProjectId,
  listBands as stored_listBands,
  listDecors as stored_listDecors,
  listDesigns as stored_listDesigns,
  listGapMarks as stored_listGapMarks,
  listModels as stored_listModels,
  listOrphanVersions as stored_listOrphanVersions,
  listProjectTemplates as stored_listProjectTemplates,
  listProjectVersions as stored_listProjectVersions,
  listProjects as stored_listProjects,
  loadDesign as stored_loadDesign,
  loadImage as stored_loadImage,
  loadModel as stored_loadModel,
  loadProject as stored_loadProject,
  rememberLast as stored_rememberLast,
  rememberLastProject as stored_rememberLastProject,
  replaceBands as stored_replaceBands,
  clearBands as stored_clearBands,
  replaceDecors as stored_replaceDecors,
  saveDesign as stored_saveDesign,
  saveGapMark as stored_saveGapMark,
  saveGapMarks as stored_saveGapMarks,
  savePrices as stored_savePrices,
  saveProject as stored_saveProject,
  saveProjectTemplate as stored_saveProjectTemplate,
  saveTemplate as stored_saveTemplate,
  setSetting as stored_setSetting,
  unusedImageIds as stored_unusedImageIds,
} from '../persist/db';

export type { CopyResult, StoredDesign, StoredModel, StoredProject } from '../persist/db';

// ---- Designs (pieces) ------------------------------------------------------------------------------------------------
export const saveDesign = (d: Design) => stored_saveDesign(d);
export const listDesigns = () => stored_listDesigns();
export const loadDesign = (id: string) => stored_loadDesign(id);
export const deleteDesign = (id: string) => stored_deleteDesign(id);
export const copyDesign = (id: string, name: string) => stored_copyDesign(id, name);

// ---- Projects --------------------------------------------------------------------------------------------------------
export const saveProject = (p: Project) => stored_saveProject(p);
export const listProjects = () => stored_listProjects();
export const loadProject = (id: string) => stored_loadProject(id);
export const deleteProject = (id: string) => stored_deleteProject(id);
export const copyProject = (id: string, name: string) => stored_copyProject(id, name);

// ---- Kept project versions (ADR-123, ADR-211) ------------------------------------------------------------------------
export const listProjectVersions = (projectId: string): Promise<ProjectVersion[]> =>
  stored_listProjectVersions(projectId);
export const listOrphanVersions = () => stored_listOrphanVersions();
export const deleteProjectVersion = (id: string) => stored_deleteProjectVersion(id);
export const deleteProjectVersions = (ids: readonly string[]) => stored_deleteProjectVersions(ids);

// ---- Project templates (ADR-060) -------------------------------------------------------------------------------------
export const saveProjectTemplate = (t: ProjectTemplate) => stored_saveProjectTemplate(t);
export const listProjectTemplates = () => stored_listProjectTemplates();
export const deleteProjectTemplate = (id: string) => stored_deleteProjectTemplate(id);

// ---- Templates edited on this device (ADR-034) -----------------------------------------------------------------------
export const saveTemplate = (t: LocalTemplate) => stored_saveTemplate(t);

// ---- What was open last (localStorage) -------------------------------------------------------------------------------
export const lastDesignId = () => stored_lastDesignId();
export const lastProjectId = () => stored_lastProjectId();
export const rememberLast = (id: string) => stored_rememberLast(id);
export const rememberLastProject = (id: string | null) => stored_rememberLastProject(id);

// ---- Decor and band lists (ADR-049, ADR-212) -------------------------------------------------------------------------
export const listDecors = () => stored_listDecors();
export const replaceDecors = (decors: Decor[]) => stored_replaceDecors(decors);
export const clearDecors = () => stored_clearDecors();
export const listBands = () => stored_listBands();
export const replaceBands = (bands: Band[]) => stored_replaceBands(bands);
export const clearBands = () => stored_clearBands();

// ---- Marks on gaps (ADR-101) -----------------------------------------------------------------------------------------
export const listGapMarks = () => stored_listGapMarks();
export const saveGapMark = (mark: GapMark) => stored_saveGapMark(mark);
export const saveGapMarks = (marks: GapMark[]) => stored_saveGapMarks(marks);

// ---- Prices (ADR-062) ------------------------------------------------------------------------------------------------
export const savePrices = (list: PriceEntry[]) => stored_savePrices(list);

// ---- Pictures (ADR-048) and 3D models (ADR-076) ----------------------------------------------------------------------
export const loadImage = (id: string) => stored_loadImage(id);
export const unusedImageIds = (keep?: Iterable<string>) => stored_unusedImageIds(keep);
export const deleteImages = (ids: string[]) => stored_deleteImages(ids);
export const listModels = () => stored_listModels();
export const loadModel = (id: string) => stored_loadModel(id);
export const deleteModelIfUnused = (id: string, keep?: Iterable<string>) =>
  stored_deleteModelIfUnused(id, keep);

// ---- Device settings (ADR-133) and counts ----------------------------------------------------------------------------
export const getSetting = <T>(key: string) => stored_getSetting<T>(key);
export const setSetting = (key: string, value: unknown) => stored_setSetting(key, value);
export const countDesigns = () => stored_countDesigns();
export const countProjects = () => stored_countProjects();
