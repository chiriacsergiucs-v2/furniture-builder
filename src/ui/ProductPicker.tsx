import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { t } from '../core/i18n';
import { formatMoney } from '../core/prices';
import { loadSellerCatalogs, type Offer, type SellerCatalog } from '../core/sellers';
import type { SellerProduct } from '../core/sellers/types';
import { Dialog } from './Dialogs';
import { Toggle } from './controls';
import { Icon } from './icons';

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
const STOCK: Record<SellerProduct['s'], string> = {
  in: t('In stock'),
  out: t('Out of stock'),
  order: t('On order'),
  preorder: t('Pre-order'),
  online: t('Online only'),
  other: '',
};

function readPictures(): boolean {
  try {
    return localStorage.getItem(PICTURES_KEY) !== 'off';
  } catch {
    return true;
  }
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
export function sizesText(p: SellerProduct): string {
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
  const list = useMemo(
    () => (cats && cats !== 'error' && open ? offers(cats, query) : []),
    [cats, offers, query, open],
  );
  const setPics = (v: boolean) => {
    setPictures(v);
    try {
      localStorage.setItem(PICTURES_KEY, v ? 'on' : 'off');
    } catch {
      // Not remembered on this device; the choice still holds while the page is open.
    }
  };
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
        <Toggle label={t('Show seller pictures (online)')} checked={pictures} onChange={setPics} />
        {pictures && (
          <p className="hint">{t('Pictures load from the seller’s site while this is on.')}</p>
        )}
        {cats === null && open && <p role="status">{t('Loading seller products…')}</p>}
        {cats === 'error' && (
          <p className="alert error" role="alert">
            <Icon name="alert-circle" className="sm" />
            <span>{t('Seller products could not be loaded.')}</span>
          </p>
        )}
        {cats && cats !== 'error' && !list.length && (
          <p role="status">{t('No product matches.')}</p>
        )}
        <ul className="products" aria-label={t('Seller products')}>
          {list.map((o) => (
            <li key={`${o.seller.id}:${o.p.id}`}>
              {pictures && o.p.i && (
                <Suspense fallback={null}>
                  <SellerPicture src={o.seller.imageBase + o.p.i} alt="" />
                </Suspense>
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
      </div>
    </Dialog>
  );
}
