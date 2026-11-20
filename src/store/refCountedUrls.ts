/**
 * A ref-counted cache of object URLs (ADR-048, ADR-146): one URL per key, shared between the views and revoked when the
 * last view releases it. `'missing'` stands for "nothing to show" and is never revoked. Only the loader differs between
 * the stored-picture cache (`useImageUrls`) and the straightened wall-picture cache (`wallPictures`).
 */
export function refCountedUrls<U extends string, A extends unknown[]>(
  load: (...args: A) => Promise<U | 'missing'>,
) {
  const cache = new Map<
    string,
    { refs: number; url?: U | 'missing'; wait: Promise<U | 'missing'> }
  >();

  function acquire(key: string, ...args: A): Promise<U | 'missing'> {
    const hit = cache.get(key);
    if (hit) {
      hit.refs++;
      return hit.wait;
    }
    const entry: { refs: number; url?: U | 'missing'; wait: Promise<U | 'missing'> } = {
      refs: 1,
      wait: Promise.resolve('missing'),
    };
    entry.wait = load(...args).then((url) => {
      entry.url = url;
      // Released while loading: free it straight away.
      if (entry.refs <= 0 && url !== 'missing') URL.revokeObjectURL(url);
      return url;
    });
    cache.set(key, entry);
    return entry.wait;
  }

  function release(key: string) {
    const e = cache.get(key);
    if (!e) return;
    if (--e.refs > 0) return;
    cache.delete(key);
    if (e.url && e.url !== 'missing') URL.revokeObjectURL(e.url);
  }

  return { acquire, release };
}
