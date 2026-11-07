import { lazy, Suspense, useEffect } from 'react';
import { shareIdFrom, SHARE_KEY } from '../core/account';
import { useAccount } from '../store/accountStore';

// The share dialogs load on first use (ADR-222).
const ShareLinkFor = lazy(() =>
  import('./ShareDialogs').then((m) => ({ default: m.ShareLinkFor })),
);
const SharedItemFor = lazy(() =>
  import('./ShareDialogs').then((m) => ({ default: m.SharedItemFor })),
);

/** Share link for a piece or template in the account (ADR-138): the link, Copy link, its links and Stop sharing. */
export function ShareLinkDialog() {
  const item = useAccount((s) => s.shareFor);
  return item ? (
    <Suspense fallback={null}>
      <ShareLinkFor key={`${item.table}:${item.id}`} item={item} />
    </Suspense>
  ) : null;
}

/** A link `…#share=<id>` (ADR-138): opened at once (G-216), then previewed before Open a copy (ADR-143). */
export function useShareLink(): void {
  const set = useAccount((s) => s.set);
  useEffect(() => {
    const check = () => {
      if (typeof location === 'undefined' || !location.hash.startsWith(SHARE_KEY)) return;
      const id = shareIdFrom(location.hash);
      history.replaceState(null, '', `${location.pathname}${location.search}#projects`);
      set({ opening: id ?? 'invalid' });
    };
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, [set]);
}

/**
 * The shared item's preview (ADR-143): name, kind, outer size, the front view, the part count and the 3D view; then
 * Open a copy (validated, new ids, ADR-132) or Cancel. Nothing is saved before Open a copy.
 */
export function SharedItemDialog({ onOpened }: { onOpened: () => void }) {
  const opening = useAccount((s) => s.opening);
  return opening ? (
    <Suspense fallback={null}>
      <SharedItemFor key={opening} opening={opening} onOpened={onOpened} />
    </Suspense>
  ) : null;
}
