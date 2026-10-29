import {
  BACKUP_TABLES,
  planBackup,
  planRestore,
  type BackupFile,
  type BackupStatus,
  type BackupTable,
  type RestorePlan,
} from '../core/backup';
import { validateDesign } from '../core/design';
import { validateProject } from '../core/project';
import { validateLocalTemplate } from '../core/catalog/local';
import { unzipStore, zipStore } from '../core/zip';
import type { Design } from '../core/types';
import type { Project } from '../core/project';
import type { LocalTemplate } from '../core/catalog/local';
import { db, getSetting, saveDesign, saveProject, saveTemplate, setSetting } from './db';
import { onSavedChange } from './events';

/**
 * Persistent storage and the folder backup (ADR-133). Browser APIs only: what to write and what to restore is decided
 * in `src/core/backup.ts`.
 */

// File System Access types this app uses (not all are in TypeScript's DOM library yet).
type Permission = 'granted' | 'denied' | 'prompt';
interface DirHandle {
  kind: 'directory';
  name: string;
  getDirectoryHandle(name: string, o?: { create?: boolean }): Promise<DirHandle>;
  getFileHandle(name: string, o?: { create?: boolean }): Promise<FileHandleLike>;
  removeEntry(name: string): Promise<void>;
  values(): AsyncIterable<DirHandle | FileHandleLike>;
  queryPermission?(o: { mode: 'readwrite' }): Promise<Permission>;
  requestPermission?(o: { mode: 'readwrite' }): Promise<Permission>;
}
interface FileHandleLike {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{
    write(d: string | Uint8Array): Promise<void>;
    close(): Promise<void>;
  }>;
}
type PickerWindow = Window & {
  showDirectoryPicker?: (o?: { mode?: 'readwrite'; id?: string }) => Promise<DirHandle>;
};

const FOLDER_KEY = 'backup-folder';
const STATUS_KEY = 'backup-status';
const PERSIST_ASKED_KEY = 'persist-asked';

export interface StorageState {
  /** The browser offers persistent storage at all. */
  supported: boolean;
  /** The browser will not clear saved data on its own. */
  persisted: boolean;
  usage?: number;
  quota?: number;
}

export async function storageState(): Promise<StorageState> {
  const s = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!s?.persisted) return { supported: false, persisted: false };
  try {
    const [persisted, est] = await Promise.all([
      s.persisted(),
      s.estimate?.().catch(() => ({}) as StorageEstimate) ?? Promise.resolve({} as StorageEstimate),
    ]);
    return { supported: true, persisted, usage: est.usage, quota: est.quota };
  } catch {
    return { supported: true, persisted: false };
  }
}

/** Ask the browser to keep saved data. The answer is shown, never hidden (ADR-133). */
export async function askPersist(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

/** At the first save on this device, ask once (G-239); later the button in Settings asks again. */
export async function askPersistOnce(): Promise<void> {
  if (await getSetting<boolean>(PERSIST_ASKED_KEY)) return;
  await setSetting(PERSIST_ASKED_KEY, true).catch(() => {});
  await askPersist();
}

export const folderAccess = (): boolean =>
  typeof window !== 'undefined' &&
  typeof (window as PickerWindow).showDirectoryPicker === 'function';

export interface FolderState {
  name?: string;
  /** 'none': no folder chosen; 'prompt': chosen, but the browser asks again after a restart. */
  permission: Permission | 'none';
}

/** The chosen folder: kept in memory for this visit, read from IndexedDB once after a restart. */
let chosen: DirHandle | undefined;
const folder = async () => (chosen ??= await getSetting<DirHandle>(FOLDER_KEY));

export async function folderState(): Promise<FolderState> {
  const h = await folder();
  if (!h) return { permission: 'none' };
  try {
    return {
      name: h.name,
      permission: (await h.queryPermission?.({ mode: 'readwrite' })) ?? 'granted',
    };
  } catch {
    return { name: h.name, permission: 'prompt' };
  }
}

/** Choose the backup folder (a user gesture). Returns the state after. */
export async function chooseFolder(): Promise<FolderState | 'cancelled'> {
  const pick = (window as PickerWindow).showDirectoryPicker;
  if (!pick) return { permission: 'none' };
  try {
    const h = await pick({ mode: 'readwrite', id: 'furniture-builder-backup' });
    chosen = h;
    await setSetting(FOLDER_KEY, h);
    return { name: h.name, permission: 'granted' };
  } catch {
    return 'cancelled';
  }
}

/** After a restart the browser asks again: "Allow backup folder" (a user gesture). */
export async function allowFolder(): Promise<FolderState> {
  const h = await folder();
  if (!h) return { permission: 'none' };
  try {
    return {
      name: h.name,
      permission: (await h.requestPermission?.({ mode: 'readwrite' })) ?? 'granted',
    };
  } catch {
    return { name: h.name, permission: 'denied' };
  }
}

/** Every saved table as stored, unreadable rows included (they are copied as they are). */
export async function readTables(database = db): Promise<Partial<Record<BackupTable, unknown[]>>> {
  const out: Partial<Record<BackupTable, unknown[]>> = {};
  for (const [name] of BACKUP_TABLES) out[name] = await database.table(name).toArray();
  return out;
}

export const lastBackup = () => getSetting<BackupStatus>(STATUS_KEY);
const record = async (s: BackupStatus) => {
  await setSetting(STATUS_KEY, s).catch(() => {});
  for (const l of statusListeners) l(s);
  return s;
};
const statusListeners = new Set<(s: BackupStatus) => void>();
export function onBackupStatus(l: (s: BackupStatus) => void): () => void {
  statusListeners.add(l);
  return () => statusListeners.delete(l);
}

/** What was last written per path in this session: unchanged files are not written again. */
const written = new Map<string, string>();

async function writeFolder(root: DirHandle, files: BackupFile[]): Promise<void> {
  const byDir = new Map<string, BackupFile[]>();
  for (const f of files) {
    const [dir] = f.path.split('/');
    byDir.set(dir, [...(byDir.get(dir) ?? []), f]);
  }
  for (const [name] of BACKUP_TABLES) {
    const list = byDir.get(name) ?? [];
    const dir = await root.getDirectoryHandle(name, { create: true });
    const keep = new Set(list.map((f) => f.path.split('/')[1]));
    for (const f of list) {
      if (written.get(f.path) === f.text) continue;
      const w = await (
        await dir.getFileHandle(f.path.split('/')[1], { create: true })
      ).createWritable();
      await w.write(f.text);
      await w.close();
      written.set(f.path, f.text);
    }
    // A file for an item deleted since the last backup goes too, so a restore never brings it back. Only the
    // backup's own .json files in its own table folders are touched; saved data never is.
    for await (const e of dir.values())
      if (e.kind === 'file' && e.name.endsWith('.json') && !keep.has(e.name)) {
        await dir.removeEntry(e.name);
        written.delete(`${name}/${e.name}`);
      }
  }
}

/** Back up now to the chosen folder. Without a folder, or without permission, says so. */
export async function backupNow(): Promise<BackupStatus> {
  const at = new Date().toISOString();
  const h = await folder();
  if (!h) return record({ at, items: 0, error: 'No backup folder chosen.' });
  try {
    if ((await h.queryPermission?.({ mode: 'readwrite' })) === 'prompt')
      return record({ at, items: 0, error: 'Allow the backup folder again to back up.' });
    const files = planBackup(await readTables());
    await writeFolder(h, files);
    return record({ at, items: files.length });
  } catch (e) {
    return record({
      at,
      items: 0,
      error: `Backup failed: ${(e as Error).message || 'unknown error'}`,
    });
  }
}

/** The same backup as one .zip download, where folders are not available (G-243). */
export async function backupZip(): Promise<{ blob: Blob; name: string; status: BackupStatus }> {
  const enc = new TextEncoder();
  const files = planBackup(await readTables());
  const bytes = zipStore(
    files.map((f) => ({ name: f.path, data: enc.encode(f.text) })),
    new Date(),
  );
  const day = new Date().toISOString().slice(0, 10);
  const status = await record({ at: new Date().toISOString(), items: files.length });
  return {
    blob: new Blob([bytes as BlobPart], { type: 'application/zip' }),
    name: `furniture-builder-backup-${day}.zip`,
    status,
  };
}

let timer: ReturnType<typeof setTimeout> | undefined;
/**
 * Back up automatically a few seconds after saved data changes, while a folder is chosen and allowed (G-242).
 * Returns the unsubscribe function.
 */
export function startAutoBackup(delayMs = 4000): () => void {
  return onSavedChange((c) => {
    if (c.table === 'settings') return;
    void askPersistOnce();
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const s = await folderState();
      if (s.permission === 'granted') await backupNow();
    }, delayMs);
  });
}

async function existing() {
  const [designs, projects, templates] = await Promise.all([
    db.designs.toArray(),
    db.projects.toArray(),
    db.templates.toArray(),
  ]);
  const keys: Partial<Record<BackupTable, Set<string>>> = {};
  for (const [name, key] of BACKUP_TABLES)
    if (name !== 'designs' && name !== 'projects' && name !== 'templates')
      keys[name] = new Set(
        (await db.table(name).toArray()).map((r: Record<string, unknown>) => String(r[key])),
      );
  return {
    designs: designs.map((r) => r.design).filter((d) => !validateDesign(d).length) as Design[],
    projects: projects.map((r) => r.project).filter((p) => !validateProject(p).length) as Project[],
    templates: templates
      .map((r) => r.template)
      .filter((t) => !validateLocalTemplate(t).length) as LocalTemplate[],
    keys,
  };
}

/** Restore files read from a folder or a .zip: new copies only, nothing overwritten (G-244). */
export async function restoreFiles(files: BackupFile[]): Promise<RestorePlan> {
  const plan = planRestore(files, await existing());
  for (const a of plan.actions) {
    if (a.table === 'designs') await saveDesign(a.design);
    else if (a.table === 'projects') await saveProject(a.project);
    else if (a.table === 'templates') await saveTemplate(a.template);
    else await db.table(a.table).add(a.row);
  }
  return plan;
}

/** Read every table folder of a chosen backup folder. */
export async function restoreFromFolder(): Promise<RestorePlan | 'cancelled'> {
  const pick = (window as PickerWindow).showDirectoryPicker;
  if (!pick) return 'cancelled';
  let root: DirHandle;
  try {
    root = await pick({ id: 'furniture-builder-backup' });
  } catch {
    return 'cancelled';
  }
  const files: BackupFile[] = [];
  for await (const d of root.values()) {
    if (d.kind !== 'directory') continue;
    for await (const f of d.values())
      if (f.kind === 'file')
        files.push({ path: `${d.name}/${f.name}`, text: await (await f.getFile()).text() });
  }
  return restoreFiles(files);
}

/** Restore a backup .zip (or a set of files picked with their folder names). */
export async function restoreFromZip(file: File): Promise<RestorePlan> {
  const { files, skipped } = unzipStore(new Uint8Array(await file.arrayBuffer()));
  const dec = new TextDecoder();
  const plan = await restoreFiles(files.map((f) => ({ path: f.name, text: dec.decode(f.data) })));
  plan.skipped.push(
    ...skipped.map((path) => ({ path, reason: 'compressed; not written by this app' })),
  );
  return plan;
}
