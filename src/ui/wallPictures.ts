import { useEffect, useMemo, useState } from 'react';
import type { WallFinish, WallImage } from '../core/room';
import { fitWithin } from '../core/surface';
import { project, straightenMap } from '../core/wallPicture';
import { imageKey, useImageUrls, type ImageUrl } from '../persist/images';

/**
 * Wall pictures as drawn (ADR-146): the stored picture, or for a straightened one the part of the photo inside the
 * wall's four corners, straightened into a rectangle on this device each time it is shown (never saved). Shared by
 * the 3D view and the front view. Keyed by `pictureKey`.
 */
export const pictureKey = (img: WallImage) =>
  img.straighten ? `${img.id}|${img.straighten.flat().join(',')}` : img.id;

// One straightened picture per key, shared between the views and freed when no view uses it.
const cache = new Map<string, { refs: number; url?: ImageUrl; wait: Promise<ImageUrl> }>();

function acquire(key: string, src: string, img: WallImage): Promise<ImageUrl> {
  const hit = cache.get(key);
  if (hit) {
    hit.refs++;
    return hit.wait;
  }
  const entry: { refs: number; url?: ImageUrl; wait: Promise<ImageUrl> } = {
    refs: 1,
    wait: Promise.resolve('missing'),
  };
  entry.wait = straighten(src, img)
    .catch(() => 'missing' as const)
    .then((url) => {
      entry.url = url;
      if (entry.refs <= 0 && url !== 'missing') URL.revokeObjectURL(url);
      return url;
    });
  cache.set(key, entry);
  return entry.wait;
}

function release(key: string) {
  const e = cache.get(key);
  if (!e || --e.refs > 0) return;
  cache.delete(key);
  if (e.url && e.url !== 'missing') URL.revokeObjectURL(e.url);
}

/** The photo's part inside `img.straighten`, straightened into a rectangle (bilinear), as an object URL. */
async function straighten(src: string, img: WallImage): Promise<ImageUrl> {
  const m = img.straighten && straightenMap(img.straighten);
  if (!m) return 'missing';
  const el = new Image();
  el.src = src;
  await el.decode();
  const sw = el.naturalWidth,
    sh = el.naturalHeight;
  const from = document.createElement('canvas');
  from.width = sw;
  from.height = sh;
  const fc = from.getContext('2d');
  if (!fc) return 'missing';
  fc.drawImage(el, 0, 0);
  const px = fc.getImageData(0, 0, sw, sh).data;
  // The output keeps about the photo's own detail: the corners' mean width and height in photo pixels.
  const [bl, br, tr, tl] = img.straighten!.map(([x, y]) => [(x / 1e4) * sw, (y / 1e4) * sh]);
  const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const { w, h } = fitWithin(
    Math.max(1, (dist(bl, br) + dist(tl, tr)) / 2),
    Math.max(1, (dist(bl, tl) + dist(br, tr)) / 2),
  );
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const oc = out.getContext('2d');
  if (!oc) return 'missing';
  const data = oc.createImageData(w, h);
  const o = data.data;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const p = project(m, (i + 0.5) / w, (j + 0.5) / h);
      const k = (j * w + i) * 4;
      if (!p) continue;
      const x = Math.min(sw - 1, Math.max(0, p[0] * sw - 0.5)),
        y = Math.min(sh - 1, Math.max(0, p[1] * sh - 0.5));
      const x0 = Math.floor(x),
        y0 = Math.floor(y),
        x1 = Math.min(sw - 1, x0 + 1),
        y1 = Math.min(sh - 1, y0 + 1),
        fx = x - x0,
        fy = y - y0;
      const a = (y0 * sw + x0) * 4,
        b = (y0 * sw + x1) * 4,
        c = (y1 * sw + x0) * 4,
        d = (y1 * sw + x1) * 4;
      for (let ch = 0; ch < 4; ch++)
        o[k + ch] =
          (px[a + ch] * (1 - fx) + px[b + ch] * fx) * (1 - fy) +
          (px[c + ch] * (1 - fx) + px[d + ch] * fx) * fy;
    }
  oc.putImageData(data, 0, 0);
  const blob = await new Promise<Blob | null>((res) => out.toBlob(res, 'image/jpeg', 0.9));
  return blob ? URL.createObjectURL(blob) : 'missing';
}

/** Wall pictures as drawn, by `pictureKey`: 'missing' when the picture is not on this device. */
export function useWallPictureUrls(walls: WallFinish[]): Map<string, ImageUrl> {
  const raw = useImageUrls(imageKey(walls));
  const straight = useMemo(
    () => walls.flatMap((f) => (f.image?.straighten ? [f.image] : [])),
    [walls],
  );
  const [done, setDone] = useState<Map<string, ImageUrl>>(new Map());
  const want = straight
    .map((img) => `${pictureKey(img)}>${raw.get(img.id) ?? ''}`)
    .sort()
    .join(';');
  useEffect(() => {
    let live = true;
    const jobs = straight.flatMap((img) => {
      const src = raw.get(img.id);
      return src ? [{ key: pictureKey(img), src, img }] : [];
    });
    Promise.all(
      jobs.map((j) =>
        j.src === 'missing'
          ? Promise.resolve([j.key, 'missing' as ImageUrl] as const)
          : acquire(j.key, j.src, j.img).then((u) => [j.key, u] as const),
      ),
    ).then((pairs) => {
      if (live) setDone(new Map(pairs));
    });
    return () => {
      live = false;
      jobs.forEach((j) => j.src !== 'missing' && release(j.key));
    };
    // `want` names every picture and its source; `straight` and `raw` follow it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want]);
  return useMemo(() => {
    const m = new Map<string, ImageUrl>();
    for (const f of walls) {
      const img = f.image;
      if (!img) continue;
      const u = img.straighten ? done.get(pictureKey(img)) : raw.get(img.id);
      if (u) m.set(pictureKey(img), u);
    }
    return m;
  }, [walls, raw, done]);
}
