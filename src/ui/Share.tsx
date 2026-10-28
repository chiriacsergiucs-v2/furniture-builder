import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  shareIdFrom,
  shareLink,
  SHARE_KEY,
  type SharedItem,
  type ShareLink,
} from '../core/account';
import type { LocalTable } from '../core/sync';
import { buildModel } from '../core/build';
import { cutlist, hardwareSummary } from '../core/cutlist';
import { kerfOf, newId, validateDesign } from '../core/design';
import { validateLocalTemplate, type LocalTemplate } from '../core/catalog/local';
import { frontSvg } from '../core/snapshot';
import type { Design } from '../core/types';
import { saveDesign, saveTemplate } from '../persist/db';
import { online, useAccount } from '../store/accountStore';
import { useDesign } from '../store/designStore';
import { Dialog } from './Dialogs';
import { Icon } from './icons';
import { ViewOverride, type ViewData } from './useView';

const Viewer3D = lazy(() => import('../viewer/Viewer3D'));
const appBase = () => `${location.origin}${location.pathname}`;

/** Share link for a piece or template in the account (ADR-138): the link, Copy link, its links and Stop sharing. */
export function ShareLinkDialog() {
  const item = useAccount((s) => s.shareFor);
  return item ? <ShareLinkFor key={`${item.table}:${item.id}`} item={item} /> : null;
}

function ShareLinkFor({ item }: { item: { table: LocalTable; id: string; name: string } }) {
  const set = useAccount((s) => s.set);
  const [links, setLinks] = useState<ShareLink[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState(0);
  useEffect(() => {
    let live = true;
    (async () => {
      const c = await online();
      const rid = await c.remoteIdOf(item.table, item.id);
      return rid ? (await c.listShares()).filter((s) => s.recordId === rid && !s.stoppedAt) : [];
    })().then(
      (l) => live && setLinks(l),
      (e: Error) => {
        if (!live) return;
        setError(e.message);
        setLinks([]);
      },
    );
    return () => {
      live = false;
    };
  }, [item, round]);
  const load = () => setRound((n) => n + 1);
  const close = () => set({ shareFor: null });
  const make = async () => {
    setBusy(true);
    setError(null);
    const r = await (await online()).createShare(item.table, item.id);
    setBusy(false);
    if (!r.ok) setError(r.error);
    else load();
  };
  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
    } catch {
      setError('This browser did not allow copying. Select the link and copy it.');
    }
  };
  return (
    <Dialog
      open
      onClose={close}
      title={`Share link: ${item.name}`}
      footer={
        <button type="button" className="btn solid" onClick={close}>
          Done
        </button>
      }
    >
      <div className="share-dialog">
        <p className="hint">
          Anyone with the link can open a copy of the latest saved version. Your item never changes.
          Stop sharing turns a link off.
        </p>
        {links === null ? (
          <p className="loading">Loading…</p>
        ) : (
          links.map((s) => {
            const url = shareLink(appBase(), s.id);
            return (
              <div key={s.id} className="share-row">
                <input
                  className="input"
                  readOnly
                  value={url}
                  aria-label="Share link"
                  onFocus={(e) => e.target.select()}
                />
                <button type="button" className="btn sm" onClick={() => void copy(url)}>
                  <Icon name="copy" className="sm" />
                  {copied === url ? 'Copied' : 'Copy link'}
                </button>
                <button
                  type="button"
                  className="btn sm"
                  onClick={async () => {
                    await (await online()).stopShare(s.id);
                    load();
                  }}
                >
                  Stop sharing
                </button>
              </div>
            );
          })
        )}
        {error && (
          <p className="alert error" role="alert">
            <Icon name="alert-circle" className="sm" />
            <span>{error}</span>
          </p>
        )}
        <button
          type="button"
          className={`btn${busy ? ' loading' : ''}`}
          disabled={busy}
          onClick={() => void make()}
        >
          <Icon name="link" className="sm" />
          {links?.length ? 'Make another link' : 'Make a link'}
        </button>
      </div>
    </Dialog>
  );
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

const DESIGN_KIND: Record<string, string> = { design: 'Piece', template: 'Template' };

/** The design a shared piece or template shows: the piece, or the template's first variant. */
function previewDesign(item: SharedItem): Design | null {
  if (item.kind === 'design')
    return validateDesign(item.body).length ? null : (item.body as Design);
  if (item.kind === 'template') {
    if (validateLocalTemplate(item.body).length) return null;
    return (item.body as LocalTemplate).family.variants[0]?.design ?? null;
  }
  return null;
}

/**
 * The shared item's preview (ADR-143): name, kind, outer size, the front view, the part count and the 3D view; then
 * Open a copy (validated, new ids, ADR-132) or Cancel. Nothing is saved before Open a copy.
 */
export function SharedItemDialog({ onOpened }: { onOpened: () => void }) {
  const opening = useAccount((s) => s.opening);
  return opening ? <SharedItemFor key={opening} opening={opening} onOpened={onOpened} /> : null;
}

function SharedItemFor({ opening, onOpened }: { opening: string; onOpened: () => void }) {
  const set = useAccount((s) => s.set);
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const [state, setState] = useState<{ item?: SharedItem; error?: string } | null>(() =>
    opening === 'invalid'
      ? { error: 'This link no longer works. Ask the owner for a new one.' }
      : offline
        ? { error: 'You are offline. Open this link when you are back online.' }
        : null,
  );
  const [show3d, setShow3d] = useState(false);
  useEffect(() => {
    if (opening === 'invalid' || offline) return;
    let live = true;
    void online()
      .then((c) => c.openShare(opening))
      .then((r) => live && setState(r.ok ? { item: r.item } : { error: r.error }))
      .catch((e: Error) => live && setState({ error: e.message }));
    return () => {
      live = false;
    };
  }, [opening, offline]);
  const design = useMemo(() => (state?.item ? previewDesign(state.item) : null), [state]);
  const view = useMemo((): ViewData | null => {
    if (!design) return null;
    const model = buildModel(design);
    return {
      mode: 'design',
      title: `shared:${design.id}`,
      model,
      pieces: [model.panels],
      materials: design.materials,
      rows: cutlist(model, design.materials),
      hardware: hardwareSummary(model),
      diagnostics: model.diagnostics,
      kerf: kerfOf(design),
      jobs: () => [],
    };
  }, [design]);
  const close = () => set({ opening: null });
  const parts = view ? view.rows.reduce((n, r) => n + r.quantity, 0) : 0;
  const b = view?.model.bounds;
  const open = async () => {
    const item = state!.item!;
    const now = new Date().toISOString();
    if (item.kind === 'design') {
      const copy = { ...(item.body as Design), id: newId(), updatedAt: now };
      await saveDesign(copy);
      useDesign.getState().load(copy);
      close();
      onOpened();
    } else {
      const t = item.body as LocalTemplate;
      await saveTemplate({ ...t, id: newId(), shadows: undefined, updatedAt: now });
      set({ opening: null });
      location.hash = '#catalog';
    }
  };
  return (
    <Dialog
      open
      onClose={close}
      title={state?.item ? state.item.name : 'Shared item'}
      wide
      footer={
        <>
          <button type="button" className="btn ghost" onClick={close}>
            Cancel
          </button>
          {state?.item && view && (
            <button type="button" className="btn primary" onClick={() => void open()}>
              Open a copy
            </button>
          )}
        </>
      }
    >
      <div className="shared-preview">
        {!state ? (
          <p className="loading">Opening the link…</p>
        ) : state.error ? (
          <p className="alert error" role="alert">
            <Icon name="alert-circle" className="sm" />
            <span>{state.error}</span>
          </p>
        ) : !view ? (
          <p className="alert error" role="alert">
            This shared item is not a valid piece or template, so it cannot be opened.
          </p>
        ) : (
          <>
            <p className="hint">
              {DESIGN_KIND[state.item!.kind] ?? 'Item'} · {b!.w} × {b!.h} × {b!.d} mm · {parts}{' '}
              parts. Open a copy to save it on this device; the original is not changed.
            </p>
            {view.diagnostics.some((d) => d.severity === 'error') && (
              <p className="alert warning" role="status">
                It has problems to fix:{' '}
                {view.diagnostics.filter((d) => d.severity === 'error').length} errors.
              </p>
            )}
            <div className="shared-views">
              <figure className="shared-front" aria-label="Front view">
                <img
                  alt={`Front view of ${state.item!.name}`}
                  src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(frontSvg(view.model, view.materials))}`}
                />
              </figure>
              {show3d ? (
                <div className="shared-3d view three active">
                  <ViewOverride.Provider value={view}>
                    <Suspense fallback={<p className="loading">Loading 3D…</p>}>
                      <Viewer3D />
                    </Suspense>
                  </ViewOverride.Provider>
                </div>
              ) : (
                <button type="button" className="btn" onClick={() => setShow3d(true)}>
                  <Icon name="cube" className="sm" />
                  Show in 3D
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
