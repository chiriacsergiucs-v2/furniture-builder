import { useEffect, useState } from 'react';
import { loadImage } from '../store/libraryStore';

/*
 * One object URL per stored picture, shared between the views (ADR-048); moved from `src/persist/images.ts` so storage
 * imports no React (ADR-223).
 */

/** 'missing': no readable picture with that id on this device. */
export type ImageUrl = string | 'missing';

const cache = new Map<string, { refs: number; url?: ImageUrl; wait: Promise<ImageUrl> }>();

function acquire(id: string): Promise<ImageUrl> {
  const hit = cache.get(id);
  if (hit) {
    hit.refs++;
    return hit.wait;
  }
  const entry: { refs: number; url?: ImageUrl; wait: Promise<ImageUrl> } = {
    refs: 1,
    wait: Promise.resolve('missing'),
  };
  entry.wait = loadImage(id)
    .then(
      (row) => (row ? URL.createObjectURL(new Blob([row.bytes], { type: row.type })) : 'missing'),
      () => 'missing' as const,
    )
    .then((url) => {
      entry.url = url;
      // Released while loading: free it straight away.
      if (entry.refs <= 0 && url !== 'missing') URL.revokeObjectURL(url);
      return url;
    });
  cache.set(id, entry);
  return entry.wait;
}

function release(id: string) {
  const e = cache.get(id);
  if (!e) return;
  if (--e.refs > 0) return;
  cache.delete(id);
  if (e.url && e.url !== 'missing') URL.revokeObjectURL(e.url);
}

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
    Promise.all(ids.map((id) => acquire(id).then((u) => [id, u] as const))).then((pairs) => {
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
