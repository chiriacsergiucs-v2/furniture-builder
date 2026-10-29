import { newId, validateDesign } from './design';
import { validateProject, type Project } from './project';
import { validateLocalTemplate, type LocalTemplate } from './catalog/local';
import type { Design } from './types';
import { t } from './i18n';

/**
 * Folder backup of everything saved on this device (ADR-133). Pure: the persist layer reads the tables and writes
 * the files. One file per item, in a folder per table (G-241). Designs and projects are written as the same JSON
 * the app's Import reads; every other row is written as it is stored, with binary fields as base64.
 */

/** Every saved table, in backup order, with its key field. */
export const BACKUP_TABLES = [
  ['designs', 'id'],
  ['projects', 'id'],
  ['templates', 'id'],
  ['projectTemplates', 'id'],
  ['projectVersions', 'id'],
  ['images', 'id'],
  ['models', 'id'],
  ['decors', 'id'],
  ['prices', 'id'],
  ['gapMarks', 'gapId'],
  ['researchMarks', 'id'],
  ['researchDocs', 'key'],
] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number][0];
export const keyOf = (t: BackupTable): string => BACKUP_TABLES.find(([n]) => n === t)![1];

export interface BackupFile {
  path: string;
  text: string;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromBase64(b64: string): ArrayBuffer {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out.buffer;
}

/** JSON with ArrayBuffers as `{ "$bytes": base64 }`, so pictures and 3D models survive as text files. */
export const encodeRow = (row: unknown): string =>
  JSON.stringify(
    row,
    function (this: unknown, _k, v: unknown) {
      if (v instanceof ArrayBuffer) return { $bytes: toBase64(new Uint8Array(v)) };
      if (ArrayBuffer.isView(v))
        return { $bytes: toBase64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)) };
      return v;
    },
    2,
  );
export const decodeRow = (text: string): unknown =>
  JSON.parse(text, (_k, v: unknown) =>
    isObj(v) && typeof v.$bytes === 'string' && Object.keys(v).length === 1
      ? fromBase64(v.$bytes)
      : v,
  );

/** A file name from a key: letters, digits, dot, dash and underscore only; never empty. */
export const safeName = (key: string): string =>
  (key.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 120) || 'item').replace(/^\.+/, '_');

/**
 * The files of a backup, one per row. Unreadable rows are copied as they are (ADR-012): nothing is validated or
 * dropped on the way out. Two keys that map to the same file name get a numbered suffix.
 */
export function planBackup(tables: Partial<Record<BackupTable, unknown[]>>): BackupFile[] {
  const files: BackupFile[] = [];
  for (const [table, key] of BACKUP_TABLES) {
    const used = new Set<string>();
    (tables[table] ?? []).forEach((row, i) => {
      const k = isObj(row) && typeof row[key] === 'string' ? (row[key] as string) : `row-${i}`;
      let name = safeName(k);
      for (let n = 2; used.has(name); n++) name = `${safeName(k)}-${n}`;
      used.add(name);
      // Designs and projects as the documents Import reads; the stored row when it has no document.
      const doc =
        table === 'designs' && isObj(row) && 'design' in row
          ? row.design
          : table === 'projects' && isObj(row) && 'project' in row
            ? row.project
            : row;
      files.push({ path: `${table}/${name}.json`, text: encodeRow(doc) });
    });
  }
  return files;
}

/** What a restore stores: whole documents for designs, projects and templates, stored rows for the rest. */
export type RestoreAction =
  | { table: 'designs'; design: Design }
  | { table: 'projects'; project: Project }
  | { table: 'templates'; template: LocalTemplate }
  | {
      table: Exclude<BackupTable, 'designs' | 'projects' | 'templates'>;
      row: Record<string, unknown>;
    };

export interface RestorePlan {
  actions: RestoreAction[];
  /** Files that were not restored, with the reason, by path. */
  skipped: { path: string; reason: string }[];
  /** Items already saved exactly as in the backup. */
  identical: number;
}

export interface Existing {
  designs: Design[];
  projects: Project[];
  templates: LocalTemplate[];
  /** Keys already stored in every other table. */
  keys: Partial<Record<BackupTable, Set<string>>>;
}

/** An item's content without its id and save time: a restored copy of it counts as the same item. */
const print = (doc: unknown): string => {
  if (!isObj(doc)) return JSON.stringify(doc);
  return JSON.stringify({ ...doc, id: undefined, updatedAt: undefined });
};

/**
 * Restore never deletes or overwrites a saved row (ADR-012). An item identical to a saved one is skipped; every
 * other design, project or template is restored as a new copy with a new id (ADR-011, G-244). Other rows (pictures,
 * 3D models, prices …) are added only when their key is free, so designs still find their pictures. Invalid files
 * are listed by name, never thrown.
 */
export function planRestore(files: BackupFile[], existing: Existing): RestorePlan {
  const plan: RestorePlan = { actions: [], skipped: [], identical: 0 };
  const seen = {
    designs: new Set(existing.designs.map(print)),
    projects: new Set(existing.projects.map(print)),
    templates: new Set(existing.templates.map(print)),
  };
  const keys = new Map<string, Set<string>>(
    Object.entries(existing.keys).map(([t, s]) => [t, new Set(s)]),
  );
  for (const f of files) {
    const table = BACKUP_TABLES.find(([t]) => f.path.startsWith(`${t}/`))?.[0];
    if (!table || !f.path.endsWith('.json')) {
      plan.skipped.push({ path: f.path, reason: t('not part of a backup') });
      continue;
    }
    let value: unknown;
    try {
      value = decodeRow(f.text);
    } catch {
      plan.skipped.push({ path: f.path, reason: t('not readable as JSON') });
      continue;
    }
    if (table === 'designs' || table === 'projects' || table === 'templates') {
      const errs =
        table === 'designs'
          ? validateDesign(value)
          : table === 'projects'
            ? validateProject(value)
            : validateLocalTemplate(value);
      if (errs.length) {
        plan.skipped.push({ path: f.path, reason: errs.slice(0, 2).join('; ') });
        continue;
      }
      const doc = value as { id: string };
      if (seen[table].has(print(doc))) {
        plan.identical++;
        continue;
      }
      seen[table].add(print(doc));
      const copy = { ...doc, id: newId() };
      if (table === 'designs') plan.actions.push({ table, design: copy as Design });
      else if (table === 'projects') plan.actions.push({ table, project: copy as Project });
      else plan.actions.push({ table, template: copy as LocalTemplate });
      continue;
    }
    const key = keyOf(table);
    if (!isObj(value) || typeof value[key] !== 'string') {
      plan.skipped.push({ path: f.path, reason: t('no {key}', { key }) });
      continue;
    }
    const set = keys.get(table) ?? new Set<string>();
    keys.set(table, set);
    if (set.has(value[key] as string)) {
      plan.identical++;
      continue;
    }
    set.add(value[key] as string);
    plan.actions.push({ table, row: value });
  }
  return plan;
}

/** "Last backup: 28 Oct 2026, 14:05 — 23 items", or the failure. */
export interface BackupStatus {
  at: string;
  items: number;
  error?: string;
}
