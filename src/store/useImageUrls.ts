import { useEffect, useState } from 'react';
import { loadImage } from './libraryStore';
import { refCountedUrls } from './refCountedUrls';

/*
 * One object URL per stored picture, shared between the views (ADR-048); moved from `src/persist/images.ts` so storage
 * imports no React (ADR-223).
 */

/** 'missing': no readable picture with that id on this device. */
export type ImageUrl = string | 'missing';

const { acquire, release } = refCountedUrls((id: string): Promise<ImageUrl> =>
  loadImage(id).then(
    (row) => (row ? URL.createObjectURL(new Blob([row.bytes], { type: row.type })) : 'missing'),
    () => 'missing' as const,
  ),
);

/**
 * Object URLs for the given picture ids, loaded from this device; released when no view uses them any more.
 * `ids` should be a stable, sorted key (joined with ',') so the effect runs only when the set changes.
 */
export function useImageUrls(key: string): Map<string, ImageUrl> {
  const [urls, setUrls] = useState<{ key: string; map: Map<string, ImageUrl> }>({
    key: '',
    map: new Map(),
  });
  useEffect(() => {
    const ids = key ? key.split(',') : [];
    let live = true;
    Promise.all(ids.map((id) => acquire(id, id).then((u) => [id, u] as const))).then((pairs) => {
      if (live) setUrls({ key, map: new Map(pairs) });
    });
    return () => {
      live = false;
      ids.forEach(release);
    };
  }, [key]);
  return urls.key === key ? urls.map : EMPTY;
}
const EMPTY = new Map<string, ImageUrl>();

/** Sorted, de-duplicated picture ids of the materials, as the key `useImageUrls` takes. */
export const imageKey = (materials: { image?: { id: string } }[]) =>
  [...new Set(materials.flatMap((m) => (m.image ? [m.image.id] : [])))].sort().join(',');
