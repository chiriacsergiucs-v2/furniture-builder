import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { t } from '@furniture-builder/i18n';
import { formatMoney } from '../core/prices';
import {
  hostedPicture,
  loadSellerCatalogs,
  thumbUrl,
  type Offer,
  type SellerCatalog,
} from '../core/sellers';
import type { SellerProduct } from '../core/sellers/types';
import { Dialog } from './Dialog';
import { Toggle } from './controls';
import { Icon } from './icons';
import { useCatalogFinder } from '../store/useCatalogFinder';
import { offerKinds, offersOfKind } from './catalogFinder';
import type { ProductKind } from '../core/sellers/types';
import { readLocal, writeLocal } from '../persist/localPrefs';

// Seller pictures come from the seller's site: shown by default, the user's exception to ADR-126 (ADR-161); off when
// switched off on this device.
const SellerPicture = lazy(() => import('../online/SellerPicture'));
const PICTURES_KEY = 'fb.sellerPictures';

const PER: Record<SellerProduct['u'], string> = {
  piece: t('per piece'),
  m: t('per m'),
  m2: t('per m²'),
  pack: t('per pack'),
  set: t('per set'),
};
/** The finder's kind chips (ADR-291). */
const KIND: Record<ProductKind, string> = {
  board: t('Boards'),
  worktop: t('Worktops'),
  'edge-band': t('Edge bands'),
  hinge: t('Hinges'),
  runner: t('Runners'),
  'push-latch': t('Push latches'),
  'flap-stay': t('Flap stays'),
  'shelf-pin': t('Shelf pins'),
  'wall-bracket': t('Wall brackets'),
  handle: t('Handles'),
  leg: t('Legs'),
  other: t('Other'),
};
/** How many products the finder lists first, and how many each "Show more" adds (ADR-291). */
const PICKER_PAGE = 30;
const STOCK: Record<SellerProduct['s'], string> = {
  in: t('In stock'),
  out: t('Out of stock'),
  order: t('On order'),
  preorder: t('Pre-order'),
  online: t('Online only'),
  other: '',
};

/** A board picture the app ships itself (ADR-162): no seller request; hidden when it cannot be shown (offline). */
function AppPicture({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      className="seller-pic"
      src={src}
      alt=""
      width={72}
      height={72}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function readPictures(): boolean {
  return readLocal(PICTURES_KEY, (v) => v !== 'off', true);
}

/** The bundled seller catalogs, loaded on first use (a lazy chunk, ADR-161). */
export function useSellerCatalogs(enabled = true): SellerCatalog[] | null | 'error' {
  const [cats, setCats] = useState<SellerCatalog[] | null | 'error'>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    loadSellerCatalogs()
      .then((c) => live && setCats(c))
      .catch(() => live && setCats('error'));
    return () => {
      live = false;
    };
  }, [enabled]);
  return cats;
}

/** "2800 × 2070 × 18 mm", "43 × 2 mm" — only the sizes the seller states. */
function sizesText(p: SellerProduct): string {
  if (p.k === 'edge-band')
    return p.w && p.t ? t('{w} × {t} mm', { w: p.w, t: (p.t / 10).toString() }) : '';
  const s = [p.l, p.w, p.t].filter((v): v is number => v !== undefined);
  if (p.L) s.push(p.L);
  return s.length ? `${s.join(' × ')} mm` : '';
}

/**
 * Seller products to pick from (ADR-161): the best matches first, a search over every product, the price as the
 * seller states it with the export date, and a link to the seller's page. Nothing changes until "Use this".
 */
export function ProductPicker({
  open,
  title,
  hint,
  offers,
  onPick,
  onClose,
}: {
  open: boolean;
  title: string;
  /** What is shown first and why. */
  hint: string;
  offers: (cats: SellerCatalog[], query: string) => Offer[];
  onPick: (o: Offer) => void;
  onClose: () => void;
}) {
  const cats = useSellerCatalogs(open);
  const [query, setQuery] = useState('');
  const [pictures, setPictures] = useState(readPictures);
  const [finder] = useCatalogFinder();
  const [kind, setKind] = useState<ProductKind | ''>('');
  const [limit, setLimit] = useState({ key: '', n: PICKER_PAGE });
  const all = useMemo(
    () => (cats && cats !== 'error' && open ? offers(cats, query) : []),
    [cats, offers, query, open],
  );
  // The finder (ADR-291): kind chips over the caller's list, a count, and one page at a time; a new search or kind
  // starts at the first page again (state that follows its inputs, adjusted while rendering).
  const kinds = useMemo(() => (finder ? offerKinds(all) : []), [finder, all]);
  const activeKind = kind && kinds.includes(kind) ? kind : '';
  const matching = finder ? offersOfKind(all, activeKind) : all;
  const pageKey = `${query}|${activeKind}`;
  if (finder && limit.key !== pageKey) setLimit({ key: pageKey, n: PICKER_PAGE });
  const shownN = limit.key === pageKey ? limit.n : PICKER_PAGE;
  const list = finder ? matching.slice(0, shownN) : matching;
  const setPics = (v: boolean) => {
    setPictures(v);
    // Not remembered when storage is blocked; the choice still holds while the page is open.
    writeLocal(PICTURES_KEY, v ? 'on' : 'off');
  };
  const pictureToggle = (
    <>
      <Toggle label={t('Show seller pictures (online)')} checked={pictures} onChange={setPics} />
      {pictures && (
        <p className="hint">{t('Pictures load from the seller’s site while this is on.')}</p>
      )}
    </>
  );
  return (
    <Dialog open={open} onClose={onClose} title={title} wide>
      <div className="product-picker">
        <p className="hint">{hint}</p>
        <label className="field">
          <span>{t('Search products')}</span>
          <input
            type="search"
            value={query}
            placeholder={t('name, code or maker')}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {!finder && pictureToggle}
        {finder && kinds.length > 1 && (
          <div className="chips finder-kinds" role="group" aria-label={t('Product kind')}>
            {(['', ...kinds] as const).map((k) => (
              <button
                key={k || 'all'}
                type="button"
                className={`chip-toggle ${activeKind === k ? 'on' : ''}`}
                aria-pressed={activeKind === k}
                onClick={() => setKind(k)}
              >
                {k ? KIND[k] : t('All kinds')}
              </button>
            ))}
          </div>
        )}
        {finder && cats && cats !== 'error' && matching.length > 0 && (
          <p className="hint" aria-live="polite">
            {t('{n|# product|# products}', { n: matching.length })}
          </p>
        )}
        {cats === null && open && <p role="status">{t('Loading seller products…')}</p>}
        {cats === 'error' && (
          <p className="alert error" role="alert">
            <Icon name="alert-circle" className="sm" />
            <span>{t('Seller products could not be loaded.')}</span>
          </p>
        )}
        {cats && cats !== 'error' && !matching.length && (
          <p role="status">{t('No product matches.')}</p>
        )}
        <ul className="products" aria-label={t('Seller products')}>
          {list.map((o) => (
            <li key={`${o.seller.id}:${o.p.id}`}>
              {hostedPicture(o) ? (
                <AppPicture src={import.meta.env.BASE_URL + hostedPicture(o)} />
              ) : (
                pictures &&
                thumbUrl(o) && (
                  <Suspense fallback={null}>
                    <SellerPicture src={thumbUrl(o)!} alt="" />
                  </Suspense>
                )
              )}
              <div className="product-text">
                <strong>{o.p.n}</strong>
                <span className="note">
                  {[o.p.m, o.p.code, sizesText(o.p), STOCK[o.p.s]].filter(Boolean).join(' · ')}
                </span>
                <span>
                  {t('{price} {currency} {per}', {
                    price: formatMoney(o.p.p),
                    currency: o.seller.currency,
                    per: PER[o.p.u],
                  })}{' '}
                  <span className="note">
                    {t('{seller}, {date}', { seller: o.seller.name, date: o.seller.extracted })}
                  </span>
                </span>
              </div>
              <div className="product-actions">
                <button type="button" className="btn sm" onClick={() => onPick(o)}>
                  {t('Use this')}
                </button>
                {o.p.a && (
                  <a
                    className="btn sm ghost"
                    href={o.seller.origin + o.p.a}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('Seller page')}
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
        {finder && matching.length > list.length && (
          <button
            type="button"
            className="btn outline"
            onClick={() => setLimit({ key: pageKey, n: shownN + PICKER_PAGE })}
          >
            {t('Show {n} more', { n: Math.min(PICKER_PAGE, matching.length - list.length) })}
          </button>
        )}
        {finder && pictureToggle}
      </div>
    </Dialog>
  );
}
