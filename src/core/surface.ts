import { t } from './i18n';
import { inPlaneAxes } from './geometry';
import type { Axis, BoardFinish, Face, MaterialImage, Mm, Panel } from './types';

/**
 * Pictures on boards (ADR-048): which files are accepted, how big they are kept, and how one picture is laid on
 * each face of a part. Pure: no DOM, no storage, no three.js.
 */
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
/** Larger files are refused before decoding (phones run out of memory on huge photos). */
export const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
/** Longest edge kept after import; larger pictures are scaled down, keeping their proportions. */
export const MAX_TEXTURE_PX = 2048;
/** Board covered by one picture when it is first added: this length along the picture's width. */
export const DEFAULT_TILE_LENGTH: Mm = 1000;
export const MAX_TILE: Mm = 10_000;

/** Board finishes (ADR-067), in the order the Materials dialog shows them. */
export const FINISHES: { value: BoardFinish; label: string }[] = [
  { value: 'matte', label: t('Matte') },
  { value: 'satin', label: t('Satin') },
  { value: 'gloss', label: t('Gloss') },
];
export const isFinish = (v: unknown): v is BoardFinish => FINISHES.some((f) => f.value === v);

/**
 * How a finish looks in the realistic 3D view and in renders (ADR-067). Rendering values tuned by eye, not supplier
 * or physical specs (ADR-010). Absent = matte.
 */
export function finishLook(f: BoardFinish | undefined): {
  roughness: number;
  clearcoat: number;
  clearcoatRoughness: number;
} {
  switch (f) {
    case 'gloss':
      return { roughness: 0.15, clearcoat: 0.6, clearcoatRoughness: 0.08 };
    case 'satin':
      return { roughness: 0.5, clearcoat: 0, clearcoatRoughness: 0 };
    default:
      return { roughness: 0.85, clearcoat: 0, clearcoatRoughness: 0 };
  }
}

/** Why a picked file cannot be used, or null. Never throws. */
export function imageFileProblem(file: {
  name: string;
  type: string;
  size: number;
}): string | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type))
    return t('{name} is not a PNG, JPEG or WebP picture.', { name: file.name || t('This file') });
  if (file.size <= 0) return t('{name} is empty.', { name: file.name || t('This file') });
  if (file.size > MAX_IMAGE_BYTES)
    return t('{name} is larger than {mb} MB.', {
      name: file.name,
      mb: MAX_IMAGE_BYTES / 1024 / 1024,
    });
  return null;
}

/** Pixel size after scaling down to `max` on the longest edge (never scaled up), whole pixels, at least 1. */
export function fitWithin(w: number, h: number, max = MAX_TEXTURE_PX): { w: number; h: number } {
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/** Board covered by one picture when it is added: 1000 mm along its width, its proportions kept. */
export function defaultTile(w: number, h: number): { tileLength: Mm; tileWidth: Mm } {
  const tileWidth = Math.min(
    MAX_TILE,
    Math.max(1, Math.round((DEFAULT_TILE_LENGTH * h) / Math.max(1, w))),
  );
  return { tileLength: DEFAULT_TILE_LENGTH, tileWidth };
}

const isTile = (v: unknown) =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 1 && v <= MAX_TILE;

/** Problems with a stored picture reference (design validation). */
export function materialImageProblems(img: unknown): string[] {
  if (!img || typeof img !== 'object' || Array.isArray(img))
    return [t('picture must be an object')];
  const i = img as Record<string, unknown>;
  const errs: string[] = [];
  if (typeof i.id !== 'string' || !i.id || i.id.length > 200) errs.push(t('picture id missing'));
  if (typeof i.name !== 'string' || i.name.length > 500) errs.push(t('picture name missing'));
  if (!isTile(i.tileLength) || !isTile(i.tileWidth))
    errs.push(t('picture size must be whole mm from 1 to {max}', { max: MAX_TILE }));
  if (i.turn !== undefined && typeof i.turn !== 'boolean')
    errs.push(t('picture turn must be true or false'));
  return errs;
}

const size = (p: Panel, a: Axis) => (a === 'x' ? p.box.w : a === 'y' ? p.box.h : p.box.d);

/** The axis the picture's width runs along on this part: its grain axis, or the other in-plane axis when turned. */
export function imageRunAxis(p: Panel, img: Pick<MaterialImage, 'turn'>): Axis {
  if (!img.turn) return p.grainAxis;
  const [a, b] = inPlaneAxes(p.thicknessAxis);
  return p.grainAxis === a ? b : a;
}

/**
 * How the picture sits on a face spanned by axes `s` and `t`: texture coordinates per mm, so a point `sMm` along
 * `s` and `tMm` along `t` shows picture position `sMm·u + tMm·v` (1 = one whole picture). On an end face, which does
 * not contain the run axis, the picture runs along the face's longer-than-thickness axis.
 */
export function faceMapping(
  p: Panel,
  img: MaterialImage,
  s: Axis,
  t: Axis,
): { u: [number, number]; v: [number, number] } {
  const run = imageRunAxis(p, img);
  const along = run === s ? 's' : run === t ? 't' : s === p.thicknessAxis ? 't' : 's';
  const L = img.tileLength,
    W = img.tileWidth;
  return along === 's' ? { u: [1 / L, 0], v: [0, 1 / W] } : { u: [0, 1 / W], v: [1 / L, 0] };
}

/** The six faces of a box in three.js `BoxGeometry` order, with the axes its texture coordinates run along. */
export const BOX_FACES: { face: Face; s: Axis; t: Axis }[] = [
  { face: '+x', s: 'z', t: 'y' },
  { face: '-x', s: 'z', t: 'y' },
  { face: '+y', s: 'x', t: 'z' },
  { face: '-y', s: 'x', t: 'z' },
  { face: '+z', s: 'x', t: 'y' },
  { face: '-z', s: 'x', t: 'y' },
];

/**
 * Texture coordinates for a box part's four corners per face, in `BoxGeometry` order: each face's 0…1 corner
 * coordinates scaled to the part's size in mm and mapped by `faceMapping`. 24 pairs.
 */
export function boxUvs(p: Panel, img: MaterialImage): number[] {
  const out: number[] = [];
  for (const f of BOX_FACES) {
    const m = faceMapping(p, img, f.s, f.t);
    const S = size(p, f.s),
      T = size(p, f.t);
    // BoxGeometry writes each face's corners as (0,1) (1,1) (0,0) (1,0).
    for (const [a, b] of [
      [0, 1],
      [1, 1],
      [0, 0],
      [1, 0],
    ]) {
      const sm = a * S,
        tm = b * T;
      out.push(sm * m.u[0] + tm * m.v[0], sm * m.u[1] + tm * m.v[1]);
    }
  }
  return out;
}

/** Texture coordinates for points given in mm along `s` and `t` (pairs), e.g. a profiled board's outline. */
export function planeUvs(
  p: Panel,
  img: MaterialImage,
  s: Axis,
  t: Axis,
  pointsMm: number[],
): number[] {
  const m = faceMapping(p, img, s, t);
  const out: number[] = [];
  for (let i = 0; i + 1 < pointsMm.length; i += 2) {
    const sm = pointsMm[i],
      tm = pointsMm[i + 1];
    out.push(sm * m.u[0] + tm * m.v[0], sm * m.u[1] + tm * m.v[1]);
  }
  return out;
}

/**
 * A picture carried inside an exported design or project file (ADR-048, user answer 2026-10-24): the stored bytes
 * as base64, so the file opens with its pictures on another device.
 */
export interface PictureFile {
  id: string;
  name: string;
  type: string;
  width: number;
  height: number;
  data: string;
}

export function pictureFileProblems(x: unknown): string[] {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return [t('picture must be an object')];
  const p = x as Record<string, unknown>;
  const errs: string[] = [];
  if (typeof p.id !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(p.id))
    errs.push(t('picture id missing'));
  if (typeof p.name !== 'string' || p.name.length > 500) errs.push(t('picture name missing'));
  if (typeof p.type !== 'string' || !(IMAGE_TYPES as readonly string[]).includes(p.type))
    errs.push(t('picture type must be PNG, JPEG or WebP'));
  for (const k of ['width', 'height'])
    if (!(
      Number.isSafeInteger(p[k]) &&
      (p[k] as number) >= 1 &&
      (p[k] as number) <= MAX_TEXTURE_PX
    ))
      errs.push(t('picture {k} must be 1 to {max} px', { k, max: MAX_TEXTURE_PX }));
  if (
    typeof p.data !== 'string' ||
    !p.data ||
    p.data.length > MAX_IMAGE_BYTES * 2 ||
    !/^[A-Za-z0-9+/]+=*$/.test(p.data)
  )
    errs.push(t('picture data must be base64'));
  return errs;
}

export function bytesToBase64(bytes: ArrayBuffer): string {
  const u = new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}
export function base64ToBytes(b64: string): ArrayBuffer {
  const s = atob(b64);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u.buffer;
}

/** Picture ids the materials of these designs (or wall backgrounds, ADR-145) refer to. */
export const imageIdsOf = (designs: { materials: { image?: { id: string } }[] }[]): Set<string> =>
  new Set(designs.flatMap((d) => d.materials.flatMap((m) => (m.image ? [m.image.id] : []))));
