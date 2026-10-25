/**
 * 3D models from the user's device as display-only project items (ADR-076): a fridge, a sink, a chair. Pure code:
 * the file check run before anything parses a file, the item shape and its validation, the box an item takes in the
 * room and the checks on that box. Model items are never cut, priced, bought or nested: they live in
 * `Project.models`, apart from the pieces, so nothing that reads `Project.items` can reach them.
 */
import { overlaps } from './geometry';
import type { Box, Diagnostic, Mm } from './types';

/** Default limits (ADR-076, open question: the user may change them). */
export const MODEL_LIMITS = { bytes: 30 * 1024 * 1024, triangles: 500_000 } as const;

export type ModelFormat = 'glb' | 'gltf';
export type ModelTurn = 0 | 90 | 180 | 270;
/** The side of the model, as it is in the file, that is its front. */
export type ModelFront = 'front' | 'right' | 'back' | 'left';
export interface ModelSize {
  w: Mm;
  h: Mm;
  d: Mm;
}

/** A display-only item in a project: a reference to a stored model, its size, where it stands and how it is turned. */
export interface ModelItem {
  id: string;
  /** Row id in the device's `models` table. */
  modelId: string;
  name: string;
  /** Size in mm before turning: w along the file's x, h up, d along the file's z (proportions locked). */
  size: ModelSize;
  /** The lowest corner (min x, y, z) of its turned box in the room. */
  position: { x: Mm; y: Mm; z: Mm };
  /** Quarter turn about the vertical axis, as for pieces: 90 turns its front to face +x. */
  rotationY: ModelTurn;
  /** Absent = 'front': the file's +z side is the front (the glTF convention). */
  front?: ModelFront;
}

/** The turn that brings the named side of the file's model to the front (+z). */
export const FRONT_TURN: Record<ModelFront, ModelTurn> = {
  front: 0,
  left: 90,
  back: 180,
  right: 270,
};

/** Total turn of the model in the room: its own front fix, then the item's turn. */
export const modelYaw = (m: Pick<ModelItem, 'rotationY' | 'front'>): ModelTurn =>
  ((FRONT_TURN[m.front ?? 'front'] + m.rotationY) % 360) as ModelTurn;

/** The box the item takes in the room (whole mm): its size turned by quarter turns, placed at its position. */
export function modelBox(m: ModelItem): Box {
  const across = modelYaw(m) % 180 !== 0;
  return {
    ...m.position,
    w: across ? m.size.d : m.size.w,
    h: m.size.h,
    d: across ? m.size.w : m.size.d,
  };
}

/** The size with a new width, proportions kept; every side stays at least 1 mm. */
export function scaleToWidth(size: ModelSize, w: Mm): ModelSize {
  const k = w / size.w;
  return { w, h: Math.max(1, Math.round(size.h * k)), d: Math.max(1, Math.round(size.d * k)) };
}

/** Whole-mm size from a model's bounds in metres (glTF units); a flat side becomes 1 mm. */
export const sizeFromMetres = (x: number, y: number, z: number): ModelSize => ({
  w: Math.max(1, Math.round(x * 1000)),
  h: Math.max(1, Math.round(y * 1000)),
  d: Math.max(1, Math.round(z * 1000)),
});

/** A new item for a stored model, standing on the floor `right` mm from the left, against the back wall. */
export function makeModelItem(
  id: string,
  model: { id: string; name: string; size: ModelSize },
  right: Mm,
): ModelItem {
  return {
    id,
    modelId: model.id,
    name: model.name,
    size: { ...model.size },
    position: { x: right, y: 0, z: 0 },
    rotationY: 0,
  };
}

// ---------------------------------------------------------------------------
// The file check (before any parser sees the file)
// ---------------------------------------------------------------------------

export type GltfCheck =
  | { ok: true; format: ModelFormat; triangles: number; name: string }
  | { ok: false; problem: string };

const MB = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
const GLB_MAGIC = 0x46546c67; // 'glTF'
const JSON_CHUNK = 0x4e4f534a; // 'JSON'
/** Extensions that need a decoder fetched from elsewhere: refused, so nothing is ever downloaded (ADR-002). */
const NEEDS_DECODER: Record<string, string> = {
  KHR_draco_mesh_compression: 'Draco compression',
  EXT_meshopt_compression: 'meshopt compression',
  KHR_meshopt_compression: 'meshopt compression',
  KHR_texture_basisu: 'Basis Universal textures',
};

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** The name shown for a model: the file name without its extension, at most 80 characters. */
export const modelName = (fileName: string) =>
  (fileName.replace(/\.(glb|gltf)$/i, '').trim() || '3D model').slice(0, 80);

/** Triangles drawn: every primitive of every mesh, times the nodes that show it (at least once). */
export function countTriangles(json: Record<string, unknown>): number {
  const accessors = arr(json.accessors);
  const uses = new Map<number, number>();
  for (const n of arr(json.nodes))
    if (isObj(n) && typeof n.mesh === 'number') uses.set(n.mesh, (uses.get(n.mesh) ?? 0) + 1);
  let total = 0;
  arr(json.meshes).forEach((mesh, i) => {
    if (!isObj(mesh)) return;
    let own = 0;
    for (const p of arr(mesh.primitives)) {
      if (!isObj(p)) continue;
      const attrs = isObj(p.attributes) ? p.attributes : {};
      const ref = typeof p.indices === 'number' ? p.indices : attrs.POSITION;
      const acc = typeof ref === 'number' ? accessors[ref] : undefined;
      const n = isObj(acc) && typeof acc.count === 'number' && acc.count > 0 ? acc.count : 0;
      const mode = typeof p.mode === 'number' ? p.mode : 4;
      own += mode === 4 ? Math.floor(n / 3) : mode === 5 || mode === 6 ? Math.max(0, n - 2) : 0;
    }
    total += own * Math.max(1, uses.get(i) ?? 0);
  });
  return total;
}

/** URIs that point outside the file: anything but an embedded `data:` URI. */
function externalUris(json: Record<string, unknown>): string[] {
  return [...arr(json.buffers), ...arr(json.images)].flatMap((b) =>
    isObj(b) && typeof b.uri === 'string' && !/^data:/i.test(b.uri.trim()) ? [b.uri] : [],
  );
}

/**
 * Checks a file the user picked before any parser reads it (ADR-076): GLB or glTF 2.0, within the size and triangle
 * limits, every buffer and image inside the file, no decoder that would have to be downloaded. Never throws.
 */
export function checkGltf(
  fileName: string,
  bytes: Uint8Array,
  limits: { bytes: number; triangles: number } = MODEL_LIMITS,
): GltfCheck {
  const name = modelName(fileName);
  const no = (problem: string): GltfCheck => ({ ok: false, problem });
  if (!bytes.byteLength) return no(`${fileName} is empty.`);
  if (bytes.byteLength > limits.bytes)
    return no(`${fileName} is ${MB(bytes.byteLength)}; the limit is ${MB(limits.bytes)}.`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const glb = bytes.byteLength >= 12 && view.getUint32(0, true) === GLB_MAGIC;
  let json: unknown;
  try {
    if (glb) {
      if (view.getUint32(4, true) !== 2) return no(`${fileName} is not a glTF 2.0 file.`);
      if (bytes.byteLength < 20 || view.getUint32(16, true) !== JSON_CHUNK)
        return no(`${fileName} could not be read as a 3D model.`);
      const len = view.getUint32(12, true);
      if (20 + len > bytes.byteLength) return no(`${fileName} is cut short.`);
      json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + len)));
    } else {
      if (!/\.gltf$/i.test(fileName) && !/\.glb$/i.test(fileName))
        return no(`${fileName} is not a .glb or .gltf file.`);
      json = JSON.parse(new TextDecoder().decode(bytes));
    }
  } catch {
    return no(`${fileName} could not be read as a 3D model.`);
  }
  if (!isObj(json) || !isObj(json.asset) || !/^2\./.test(String(json.asset.version)))
    return no(`${fileName} is not a glTF 2.0 file.`);
  const outside = externalUris(json);
  if (outside.length)
    return no(
      `${fileName} uses files outside it (${outside.slice(0, 2).join(', ')}); export it as one .glb or a .gltf with embedded data.`,
    );
  if (!glb && arr(json.buffers).some((b) => isObj(b) && b.uri === undefined))
    return no(`${fileName} has a buffer with no data; export it as one .glb file.`);
  const needs = arr(json.extensionsRequired).flatMap((e) =>
    typeof e === 'string' && NEEDS_DECODER[e] ? [NEEDS_DECODER[e]] : [],
  );
  if (needs.length)
    return no(`${fileName} uses ${needs[0]}, which this app cannot read; export it without.`);
  // A declared count the file cannot back (a sparse accessor, say) would make the parser allocate it all: refuse
  // anything far past what the triangle limit needs, so a crafted file cannot exhaust the tab's memory.
  const elements = arr(json.accessors).reduce<number>(
    (n, a) => n + (isObj(a) && typeof a.count === 'number' && a.count > 0 ? a.count : 0),
    0,
  );
  if (elements > limits.triangles * 40)
    return no(`${fileName} declares more data than a model within the limits needs.`);
  const triangles = countTriangles(json);
  if (triangles > limits.triangles)
    return no(
      `${fileName} has ${triangles.toLocaleString('en')} triangles; the limit is ${limits.triangles.toLocaleString('en')}.`,
    );
  if (!arr(json.meshes).length) return no(`${fileName} has no shapes to show.`);
  return { ok: true, format: glb ? 'glb' : 'gltf', triangles, name };
}

// ---------------------------------------------------------------------------
// Validation and checks
// ---------------------------------------------------------------------------

const isInt = (v: unknown, min = -1e7) =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= 1e7;

/** Problems with a project's `models` list; `ids` are the piece ids already taken (ids are unique across both). */
export function validateModelItems(list: unknown, ids: Set<string>): string[] {
  if (!Array.isArray(list)) return ['Invalid 3D models'];
  const errs: string[] = [];
  for (const m of list) {
    const ok =
      isObj(m) &&
      typeof m.id === 'string' &&
      !!m.id &&
      !ids.has(m.id) &&
      typeof m.modelId === 'string' &&
      !!m.modelId &&
      typeof m.name === 'string' &&
      m.name.length <= 200 &&
      isObj(m.size) &&
      ['w', 'h', 'd'].every((k) => isInt((m.size as Record<string, unknown>)[k], 1)) &&
      isObj(m.position) &&
      isInt(m.position.x) &&
      isInt(m.position.y, 0) &&
      isInt(m.position.z) &&
      [0, 90, 180, 270].includes(m.rotationY as number) &&
      (m.front === undefined || (m.front as string) in FRONT_TURN);
    if (!ok) {
      errs.push('Invalid 3D model item');
      continue;
    }
    ids.add(m.id as string);
  }
  return errs;
}

/**
 * Checks on model boxes (ADR-076): a model may touch a piece or another model but not take the same space. Errors,
 * like pieces that overlap (ADR-008).
 */
export function modelChecks(
  models: ModelItem[],
  pieces: { id: string; name: string; bounds: Box; hitsPanels: (b: Box) => boolean }[],
): Diagnostic[] {
  const out: Diagnostic[] = [];
  const boxes = models.map(modelBox);
  models.forEach((m, i) => {
    const hit = pieces.find((pc) => overlaps(pc.bounds, boxes[i]) && pc.hitsPanels(boxes[i]));
    if (hit)
      out.push({
        severity: 'error',
        code: 'model-overlap',
        message: `${m.name} (3D model) and ${hit.name} overlap in the room.`,
        nodeId: m.id,
      });
    for (let j = 0; j < i; j++)
      if (overlaps(boxes[j], boxes[i]))
        out.push({
          severity: 'error',
          code: 'model-overlap',
          message: `${models[j].name} and ${m.name} (3D models) overlap in the room.`,
          nodeId: m.id,
        });
  });
  return out;
}
