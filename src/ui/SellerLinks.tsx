import { useCallback, useState } from 'react';
import { t, tr } from '../core/i18n';
import { bandFromOffer, bandOffers, boardOffers, boardPatch, type Offer } from '../core/sellers';
import type { SellerCatalog } from '../core/sellers';
import type { Material, ProductRef } from '../core/types';
import { useDesign } from '../store/designStore';
import { ProductPicker } from './ProductPicker';
import { Icon } from './icons';

/** "Seller product: <name>" with a way to drop the link (the board or band keeps its values). */
function Linked({ product, onUnlink }: { product?: ProductRef; onUnlink: () => void }) {
  if (!product) return null;
  return (
    <p className="hint seller-linked">
      {t('Seller product: {name}', { name: product.name })}{' '}
      <button type="button" className="btn sm ghost" onClick={onUnlink}>
        {t('Unlink')}
      </button>
    </p>
  );
}

/**
 * ADR-160: take a board from a seller. Boards and worktops of the board's thickness come first; the pick sets the
 * name, thickness, sheet size and labels the seller states. Grain, colour and picture stay.
 */
export function BoardProduct({ m }: { m: Material }) {
  const update = useDesign((s) => s.updateMaterial);
  const [open, setOpen] = useState(false);
  const offers = useCallback((cats: SellerCatalog[], q: string) => boardOffers(cats, m, q), [m]);
  return (
    <div className="seller-row">
      <button type="button" className="btn sm outline" onClick={() => setOpen(true)}>
        <Icon name="search" className="sm" />
        {t('Product from a seller')}
      </button>
      <Linked product={m.product} onUnlink={() => update(m.id, { product: undefined })} />
      <ProductPicker
        open={open}
        title={t('Product from a seller for {name}', { name: tr(m.name) })}
        hint={t(
          'Boards and worktops, {n} mm first. The pick sets the name, thickness, sheet size and labels; grain, colour and picture stay.',
          { n: m.thickness },
        )}
        offers={offers}
        onClose={() => setOpen(false)}
        onPick={(o: Offer) => {
          update(m.id, boardPatch(o, m));
          setOpen(false);
        }}
      />
    </div>
  );
}

/** ADR-160: take a board's edge band (or its front band) from a seller; bands at least as wide as the board. */
export function BandProduct({ m, front }: { m: Material; front?: boolean }) {
  const update = useDesign((s) => s.updateMaterial);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const band = front ? m.frontBand : m.band;
  const offers = useCallback((cats: SellerCatalog[], q: string) => bandOffers(cats, m, q), [m]);
  return (
    <div className="seller-row">
      <button type="button" className="btn sm outline" onClick={() => setOpen(true)}>
        <Icon name="search" className="sm" />
        {front ? t('Front band from a seller') : t('Band from a seller')}
      </button>
      {band?.product && (
        <Linked
          product={band.product}
          onUnlink={() => {
            const { product: _drop, ...rest } = band;
            void _drop;
            update(m.id, front ? { frontBand: rest } : { band: rest });
          }}
        />
      )}
      {msg && (
        <p className="alert error" role="alert">
          <Icon name="alert-circle" className="sm" />
          <span>{msg}</span>
        </p>
      )}
      <ProductPicker
        open={open}
        title={t('Edge band from a seller for {name}', { name: tr(m.name) })}
        hint={t(
          'Bands at least {n} mm wide, the same decor code first. The pick sets type, thickness, width and code.',
          { n: m.thickness },
        )}
        offers={offers}
        onClose={() => setOpen(false)}
        onPick={(o: Offer) => {
          const b = bandFromOffer(o, band);
          setMsg(b ? null : t('The seller states no thickness or width for this band.'));
          if (b) update(m.id, front ? { frontBand: b } : { band: b });
          setOpen(false);
        }}
      />
    </div>
  );
}
