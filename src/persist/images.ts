import { newId } from '../core/design';
import { t } from '@furniture-builder/i18n';
import {
  base64ToBytes,
  bytesToBase64,
  defaultTile,
  fitWithin,
  imageFileProblem,
  imageIdsOf,
  MAX_FILE_PICTURES,
  pictureFileProblems,
  sniffPictureType,
  type PictureFile,
} from '../core/surface';
import type { MaterialImage } from '../core/types';
import { db, loadImage, saveImage } from './db';

/**
 * Pictures for materials (ADR-048), browser side: import a file the user picked, and carry pictures in and out of
 * files. The views share one object URL per stored picture through `src/ui/useImageUrls.ts` (ADR-223). Nothing is
 * uploaded; problems come back as messages, never as exceptions.
 */
export type ImportResult =
  { ok: true; image: MaterialImage; color: string } | { ok: false; problem: string };

const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0');

/** A picture decoded and drawn again as JPEG, at most the texture size, with its average colour. */
type EncodeResult =
  | { ok: true; bytes: ArrayBuffer; type: string; width: number; height: number; color: string }
  | { ok: false; problem: string };
/**
 * Decodes picture bytes and draws them again (G-542): only pixels reach storage, whatever else the file carried. Every
 * picture takes this path: one the user picks, one inside an imported file and one in a backup.
 */
export type PictureEncoder = (
  bytes: ArrayBuffer,
  type: string,
  name: string,
) => Promise<EncodeResult>;

export const encodePicture: PictureEncoder = async (bytes, type, name) => {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined')
    return { ok: false, problem: t('This browser cannot prepare pictures.') };
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(new Blob([bytes], { type }));
  } catch {
    return { ok: false, problem: t('{name} could not be read as a picture.', { name }) };
  }
  try {
    const { w, h } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { ok: false, problem: t('This browser cannot prepare pictures.') };
    ctx.drawImage(bitmap, 0, 0, w, h);
    // Average colour: the plain colour used where pictures are not drawn (cut sheets, catalog pictures).
    const one = document.createElement('canvas');
    one.width = 1;
    one.height = 1;
    const c1 = one.getContext('2d');
    c1?.drawImage(canvas, 0, 0, 1, 1);
    const px = c1?.getImageData(0, 0, 1, 1).data;
    const color = px ? `#${hex(px[0])}${hex(px[1])}${hex(px[2])}` : '#cccccc';
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.9));
    if (!blob) return { ok: false, problem: t('{name} could not be prepared.', { name }) };
    return {
      ok: true,
      bytes: await blob.arrayBuffer(),
      type: blob.type || 'image/jpeg',
      width: w,
      height: h,
      color,
    };
  } catch {
    return { ok: false, problem: t('{name} could not be prepared.', { name }) };
  } finally {
    bitmap.close();
  }
};

export async function importImage(file: File): Promise<ImportResult> {
  const problem = imageFileProblem(file);
  if (problem) return { ok: false, problem };
  let bytes: ArrayBuffer;
  try {
    bytes = await file.arrayBuffer();
  } catch {
    return { ok: false, problem: t('{name} could not be read as a picture.', { name: file.name }) };
  }
  const pic = await encodePicture(bytes, file.type, file.name);
  if (!pic.ok) return pic;
  try {
    const id = `img-${newId()}${newId()}`;
    await saveImage({
      id,
      name: file.name,
      type: pic.type,
      width: pic.width,
      height: pic.height,
      bytes: pic.bytes,
      createdAt: new Date().toISOString(),
    });
    return {
      ok: true,
      image: { id, name: file.name, ...defaultTile(pic.width, pic.height) },
      color: pic.color,
    };
  } catch {
    return {
      ok: false,
      problem: t('{name} could not be saved on this device.', { name: file.name }),
    };
  }
}

/**
 * A design or project file with its pictures inside (ADR-048, user answer 2026-10-24): `pictures` holds every
 * picture its materials use that is on this device. Older files without it still open.
 */
export async function withPictures<T extends object>(
  data: T,
  designs: { materials: { image?: { id: string } }[] }[],
): Promise<T & { pictures?: PictureFile[] }> {
  const pictures: PictureFile[] = [];
  for (const id of imageIdsOf(designs)) {
    const row = await loadImage(id);
    if (row)
      pictures.push({
        id,
        name: row.name,
        type: row.type,
        width: row.width,
        height: row.height,
        data: bytesToBase64(row.bytes),
      });
  }
  return pictures.length ? { ...data, pictures } : data;
}

/**
 * Stores the pictures carried by an imported file (skipping ids already on this device) and returns the file without
 * them. Each picture's bytes must be its declared type and are decoded and drawn again before they are stored (G-542,
 * G-565); at most MAX_FILE_PICTURES are read. A bad picture is skipped and reported; its material then shows the plain
 * colour. Never throws.
 */
export async function takePictures(
  data: unknown,
  database = db,
  encode: PictureEncoder = encodePicture,
): Promise<{ data: unknown; problems: string[] }> {
  if (!data || typeof data !== 'object' || !('pictures' in data)) return { data, problems: [] };
  const { pictures, ...rest } = data as Record<string, unknown>;
  const problems: string[] = [];
  if (!Array.isArray(pictures))
    return { data: rest, problems: [t('The pictures in the file could not be read.')] };
  if (pictures.length > MAX_FILE_PICTURES)
    problems.push(
      t('The file holds {n} pictures; {over} over the limit of {max} were skipped.', {
        n: pictures.length,
        over: pictures.length - MAX_FILE_PICTURES,
        max: MAX_FILE_PICTURES,
      }),
    );
  for (const p of pictures.slice(0, MAX_FILE_PICTURES)) {
    const errs = pictureFileProblems(p);
    if (errs.length) {
      problems.push(t('A picture was skipped: {problems}.', { problems: errs.join(', ') }));
      continue;
    }
    const f = p as PictureFile;
    try {
      if (await database.images.get(f.id)) continue;
      const bytes = base64ToBytes(f.data);
      if (sniffPictureType(bytes) !== f.type) {
        problems.push(
          t('A picture was skipped: {problems}.', {
            problems: t('picture bytes do not match its type'),
          }),
        );
        continue;
      }
      const pic = await encode(bytes, f.type, f.name);
      if (!pic.ok) {
        problems.push(pic.problem);
        continue;
      }
      await saveImage(
        {
          id: f.id,
          name: f.name,
          type: pic.type,
          width: pic.width,
          height: pic.height,
          bytes: pic.bytes,
          createdAt: new Date().toISOString(),
        },
        database,
      );
    } catch {
      problems.push(t('The picture {name} could not be saved on this device.', { name: f.name }));
    }
  }
  return { data: rest, problems };
}
