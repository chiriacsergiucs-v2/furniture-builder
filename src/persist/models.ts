/**
 * 3D models from the device (ADR-076), browser side: import a file the user picked, read a stored model for the 3D
 * view, and carry models inside exported project files. Imported files are untrusted: `checkGltf` (core) runs before
 * any parser, nothing is executed, nothing is requested from the network, and every problem comes back as a message.
 */
import { newId } from '../core/design';
import { t } from '../core/i18n';
import {
  checkGltf,
  MODEL_LIMITS,
  sizeFromMetres,
  type ModelItem,
  type ModelSize,
} from '../core/model3d';
import { base64ToBytes, bytesToBase64 } from '../core/surface';
import { db, loadModel, saveModel, type StoredModel } from './db';

export type ModelImport = { ok: true; model: StoredModel } | { ok: false; problem: string };

/** The reader with three.js; loaded only when needed, like the 3D view (ADR-013). */
const reader = () => import('./gltf');

/** Read, check, measure and store one file. Never throws. */
export async function importModelFile(file: File): Promise<ModelImport> {
  const no = (problem: string): ModelImport => ({ ok: false, problem });
  // Refuse an oversize file before reading it into memory.
  if (file.size > MODEL_LIMITS.bytes)
    return no(
      t('{name} is {size} MB; the limit is {limit} MB.', {
        name: file.name,
        size: (file.size / 1024 / 1024).toFixed(1),
        limit: MODEL_LIMITS.bytes / 1024 / 1024,
      }),
    );
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return no(t('{name} could not be read.', { name: file.name }));
  }
  const check = checkGltf(file.name, bytes);
  if (!check.ok) return check;
  let g: Awaited<ReturnType<typeof reader>>;
  try {
    g = await reader();
  } catch {
    return no(t('The 3D reader could not be loaded; reload the app and try again.'));
  }
  // One copy only: the parser reads it without keeping or changing it, and the same bytes are stored.
  const buffer = bytes.buffer as ArrayBuffer;
  let size: ModelSize;
  let thumb: ArrayBuffer | undefined;
  try {
    const scene = await g.parseGltf(buffer);
    const m = g.measure(scene);
    if (
      !(m.size.x > 0 || m.size.y > 0 || m.size.z > 0) ||
      ![m.size.x, m.size.y, m.size.z].every(Number.isFinite)
    )
      return no(t('{name} has no size to show.', { name: file.name }));
    if (m.triangles > MODEL_LIMITS.triangles)
      return no(
        t('{name} has {n} triangles; the limit is {limit}.', {
          name: file.name,
          n: m.triangles.toLocaleString('en'),
          limit: MODEL_LIMITS.triangles.toLocaleString('en'),
        }),
      );
    size = sizeFromMetres(m.size.x, m.size.y, m.size.z);
    thumb = await g.thumbnail(scene);
  } catch {
    return no(t('{name} could not be read as a 3D model.', { name: file.name }));
  }
  const model: StoredModel = {
    id: `mdl-${newId()}${newId()}`,
    name: check.name,
    format: check.format,
    bytes: buffer,
    size,
    triangles: check.triangles,
    ...(thumb ? { thumb } : {}),
    createdAt: new Date().toISOString(),
  };
  try {
    await saveModel(model);
  } catch {
    return no(t('{name} could not be saved on this device.', { name: file.name }));
  }
  return { ok: true, model };
}

/** A parsed model ready to show: the scene, and its centre and size in metres. */
export interface ModelScene {
  scene: import('three').Object3D;
  center: [number, number, number];
  size: [number, number, number];
}
const scenes = new Map<string, Promise<ModelScene | null>>();
/** The stored model parsed once per id; null when it is not on this device or cannot be read. Never rejects. */
export function loadModelScene(id: string): Promise<ModelScene | null> {
  const hit = scenes.get(id);
  if (hit) return hit;
  const wait = (async () => {
    try {
      const row = await loadModel(id);
      if (!row || !checkGltf(`${row.name}.${row.format}`, new Uint8Array(row.bytes)).ok)
        return null;
      const g = await reader();
      const scene = await g.parseGltf(row.bytes);
      const m = g.measure(scene);
      return {
        scene,
        center: [m.center.x, m.center.y, m.center.z] as [number, number, number],
        size: [m.size.x, m.size.y, m.size.z] as [number, number, number],
      };
    } catch {
      return null;
    }
  })();
  scenes.set(id, wait);
  // A model not found now may be imported later: try again next time.
  wait.then((s) => (s ? undefined : scenes.delete(id)));
  return wait;
}
/** Drop a parsed model from memory (after it was deleted from the library). */
export const forgetModelScene = (id: string) => scenes.delete(id);

/** A stored model with exactly these bytes and name, so importing the same file again does not store it twice. */
async function sameModel(name: string, bytes: ArrayBuffer, database = db) {
  const a = new Uint8Array(bytes);
  const rows = await database.models
    .filter((r) => r.name === name && r.bytes?.byteLength === bytes.byteLength)
    .toArray();
  return rows.find((r) => {
    const b = new Uint8Array(r.bytes);
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Project files carry their models (ADR-076, like pictures in ADR-048)
// ---------------------------------------------------------------------------

export interface ModelFile {
  id: string;
  name: string;
  format: 'glb' | 'gltf';
  size: ModelSize;
  data: string;
  thumb?: string;
}

/** The project with every model its items use that is on this device, as base64 (`models3d`). */
export async function withModels<T extends { models?: ModelItem[] }>(
  data: T,
  database = db,
): Promise<T & { models3d?: ModelFile[] }> {
  const files: ModelFile[] = [];
  for (const id of new Set((data.models ?? []).map((m) => m.modelId))) {
    const row = await loadModel(id, database);
    if (row)
      files.push({
        id,
        name: row.name,
        format: row.format,
        size: row.size,
        data: bytesToBase64(row.bytes),
        ...(row.thumb ? { thumb: bytesToBase64(row.thumb) } : {}),
      });
  }
  return files.length ? { ...data, models3d: files } : data;
}

const isSize = (s: unknown): s is ModelSize =>
  !!s &&
  typeof s === 'object' &&
  ['w', 'h', 'd'].every((k) => {
    const v = (s as Record<string, unknown>)[k];
    return typeof v === 'number' && Number.isSafeInteger(v) && v >= 1 && v <= 1e7;
  });

/**
 * Stores the models an imported project file carries under new ids and points its items at them; returns the file
 * without them. Each model is checked like a picked file; a bad one is skipped and reported, and its item is drawn as
 * a box. Never throws.
 */
export async function takeModels(
  data: unknown,
  database = db,
): Promise<{ data: unknown; problems: string[] }> {
  if (!data || typeof data !== 'object' || !('models3d' in data)) return { data, problems: [] };
  const { models3d, ...rest } = data as Record<string, unknown>;
  const problems: string[] = [];
  const ids = new Map<string, string>();
  if (!Array.isArray(models3d))
    return { data: rest, problems: [t('The 3D models in the file could not be read.')] };
  for (const f of models3d as Partial<ModelFile>[]) {
    const label = typeof f?.name === 'string' ? f.name.slice(0, 80) : t('a 3D model');
    if (
      !f ||
      typeof f.id !== 'string' ||
      typeof f.name !== 'string' ||
      (f.format !== 'glb' && f.format !== 'gltf') ||
      typeof f.data !== 'string' ||
      !isSize(f.size)
    ) {
      problems.push(t('{name} was skipped: it is not a valid 3D model entry.', { name: label }));
      continue;
    }
    try {
      const bytes = base64ToBytes(f.data);
      const check = checkGltf(`${f.name}.${f.format}`, new Uint8Array(bytes));
      if (!check.ok) {
        problems.push(t('{name} was skipped: {problem}', { name: label, problem: check.problem }));
        continue;
      }
      const same = await sameModel(check.name, bytes, database);
      if (same) {
        ids.set(f.id, same.id);
        continue;
      }
      let thumb: ArrayBuffer | undefined;
      try {
        thumb = typeof f.thumb === 'string' ? base64ToBytes(f.thumb) : undefined;
      } catch {
        thumb = undefined;
      }
      const id = `mdl-${newId()}${newId()}`;
      await saveModel(
        {
          id,
          name: check.name,
          format: check.format,
          bytes,
          size: f.size,
          triangles: check.triangles,
          ...(thumb ? { thumb } : {}),
          createdAt: new Date().toISOString(),
        },
        database,
      );
      ids.set(f.id, id);
    } catch {
      problems.push(t('{name} could not be saved on this device.', { name: label }));
    }
  }
  const items = (rest as { models?: unknown }).models;
  if (Array.isArray(items))
    rest.models = items.map((m) =>
      m && typeof m === 'object' && ids.has((m as ModelItem).modelId)
        ? { ...m, modelId: ids.get((m as ModelItem).modelId) }
        : m,
    );
  return { data: rest, problems };
}
