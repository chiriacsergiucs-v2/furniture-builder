import { useMemo } from 'react';
import { getPrintLang, PRINT_DATE_LOCALE, pt } from '../core/i18n/print';
import { formatMoney } from '../core/prices';
import { useDesign } from '../store/designStore';
import { PieceElevation } from './Elevation';
import { useUi } from './shell/uiStore';
import { useEstimate } from './useEstimate';
import { useView } from './useView';

/**
 * Client sheet (ADR-206): one A4 page to sell from, in the print language (ADR-157) — the piece or project name and
 * date, one picture, the piece list (name, W × H × D mm, quantity) and the estimate total (ADR-062; seller prices name
 * the seller and the export date, ADR-161/172). Lines without a price are counted, never hidden. The picture is the
 * last render of this session, else a still of the open 3D view, else the front view. Sizes come from the model only.
 */
export function PrintClient() {
  const view = useView();
  const pieces = useDesign((s) =>
    s.project && !s.editingItemId ? s.projectModel?.pieces : undefined,
  );
  const picture = useUi((s) => s.clientPicture);
  const { est, currency } = useEstimate();
  const locale = PRINT_DATE_LOCALE[getPrintLang()];
  const list = useMemo(() => {
    if (view.mode === 'design' || !pieces) {
      const b = view.model.bounds;
      return [{ key: 'design', name: view.title, w: b.w, h: b.h, d: b.d, quantity: 1 }];
    }
    return pieces.map((pc) => ({
      key: pc.item.id,
      name: pc.item.design.name,
      w: pc.model.bounds.w,
      h: pc.model.bounds.h,
      d: pc.model.bounds.d,
      quantity: pc.item.quantity,
    }));
  }, [view, pieces]);
  return (
    <div className="print-root" aria-hidden="true">
      <header className="pr-head">
        <h1>{view.title}</h1>
        <p>
          {pt('Fișă pentru client')} · {new Date().toLocaleDateString(locale)}
        </p>
      </header>
      <section className="pr-block pr-client-pic">
        {picture ? (
          <img src={picture} alt="" />
        ) : (
          <div className="pr-elev">
            <PieceElevation
              model={view.model}
              materials={view.materials}
              label={`${pt('Vedere frontală')}: ${view.title}`}
            />
          </div>
        )}
      </section>
      <section className="pr-block">
        <table className="pr-table">
          <thead>
            <tr>
              <th>{pt('Piesă')}</th>
              <th>{pt('Dimensiuni L × Î × A, mm')}</th>
              <th>{pt('Buc.')}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.key}>
                <td>{p.name}</td>
                <td className="n">
                  {p.w} × {p.h} × {p.d}
                </td>
                <td className="n">{p.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="pr-block pr-client-total">
        <h2>
          {pt('Preț estimat')}: {formatMoney(est.total)} {currency}
        </h2>
        {est.missing.length > 0 && (
          <p>
            {est.missing.length} {pt('linii fără preț')}
          </p>
        )}
        {est.sellers.length > 0 && (
          <p className="pr-note">
            {pt('Prețuri de vânzător: {sellers}', { sellers: est.sellers.join('; ') })}
          </p>
        )}
      </section>
    </div>
  );
}
