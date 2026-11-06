import { useCallback, useMemo, useState } from 'react';
import {
  CURRENCY_ID,
  formatMoney,
  linePrice,
  parseMoney,
  parsePricesCsv,
  priceSource,
  pricesCsv,
  unitPrice,
  unitsFor,
  type PriceEntry,
  type SellerLookup,
  type UnitPer,
} from '../core/prices';
import {
  anyOffers,
  hardwareOffers,
  refOf,
  runPartOffers,
  type Offer,
  type SellerCatalog,
} from '../core/sellers';
import type { HardwareProduct } from '../core/types';
import { validPer } from '../core/design';
import { notCountedPrint } from '../core/fasteners';
import { ProductPicker } from './ProductPicker';
import {
  NOT_COUNTED,
  shopSectionPrint,
  shoppingCsvRo,
  unitPricePrint,
  type ShopLine,
  type ShopSection,
  type ShopUnit,
} from '../core/shopping';
import { t, tr } from '../core/i18n';
import { pt } from '../core/i18n/print';
import { savePrices } from '../persist/db';
import { useDesign } from '../store/designStore';
import { usePrices } from './priceStore';
import { useEstimate } from './useEstimate';
import { GuidanceTip, InfoTip } from './controls';
import { Icon } from './icons';
import { useView } from './useView';

const SECTIONS: { id: ShopSection; title: string }[] = [
  { id: 'boards', title: 'Boards' },
  { id: 'banding', title: 'Edge banding' },
  { id: 'hardware', title: 'Hardware' },
  { id: 'run', title: 'Run parts' },
  { id: 'choose', title: 'To choose before buying' },
];
/** The section titles on screen, in the app's language (ADR-154); the printed list uses the print language (ADR-181). */
const SECTION_TITLE: Record<ShopSection, string> = {
  boards: t('Boards'),
  banding: t('Edge banding'),
  hardware: t('Hardware'),
  run: t('Run parts'),
  choose: t('To choose before buying'),
};
const UNIT_SHOWN: Record<ShopUnit, string> = {
  sheet: t('sheets'),
  m2: t('m²'),
  m: t('m'),
  piece: t('pcs'),
};
/** What a unit price is per, under a row's total (ADR-181). */
const UNIT_ONE: Record<UnitPer, string> = {
  sheet: t('sheet'),
  m2: t('m²'),
  m: t('m'),
  piece: t('piece'),
  worktop: t('worktop board'),
};
const PER: Record<ShopUnit, string> = {
  sheet: t('per sheet'),
  m2: t('per m²'),
  m: t('per m'),
  piece: t('per piece'),
};

function save(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  Object.assign(document.createElement('a'), { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Shopping list (ADR-064) with the cost estimate from the user's own prices (ADR-062): boards in sheets from the
 * layout (or m²), banding, hardware, run parts, and what is still to choose. Saved prices stay on this device.
 */
export function ShoppingList() {
  const view = useView();
  const shownProject = useDesign((s) => (s.project && !s.editingItemId ? s.project : undefined));
  const projectView = !!shownProject;
  const addSellerItem = useDesign((s) => s.addSellerItem);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // The lines, prices and estimate are the header chip's too (ADR-172): one number everywhere.
  const { lines, prices, priceState, seller, est, currency } = useEstimate();
  const reloadPrices = usePrices((s) => s.reload);
  const storePrice = usePrices((s) => s.setPrice);
  // A device that refused the price list says so until another message replaces it.
  const shown =
    msg ?? (priceState === 'failed' ? t('Prices could not be read from this browser.') : null);
  const map = useMemo(() => new Map(prices.map((p) => [p.id, p])), [prices]);
  const any = useCallback((c: SellerCatalog[], q: string) => anyOffers(c, q), []);
  const setPrice = (e: PriceEntry) => {
    void storePrice(e).catch(() => setMsg(t('The price could not be saved on this device.')));
  };
  const importCsv = async (f: File) => {
    const r = parsePricesCsv(await f.text());
    if (!r.prices.length) {
      setMsg(
        `${t('No prices imported.')} ${r.problems
          .slice(0, 3)
          .map((p) => tr(p))
          .join(' ')}`,
      );
      return;
    }
    await savePrices(r.prices);
    await reloadPrices();
    setMsg(
      `${t('{n} prices imported', { n: r.prices.length })}${
        r.problems.length
          ? t(', {n} rows skipped: {list}', {
              n: r.problems.length,
              list: r.problems
                .slice(0, 3)
                .map((p) => tr(p))
                .join(' '),
            })
          : ''
      }.`,
    );
  };
  const printList = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const rowsHtml = SECTIONS.map((s) => {
      const ls = lines.filter((l) => l.section === s.id);
      return ls.length
        ? `<h2>${esc(shopSectionPrint(s.id))}</h2><table><tr><th>${esc(pt('Cantitate'))}</th><th>${esc(pt('Articol'))}</th><th>${esc(pt('Detalii'))}</th><th>${esc(pt('Preț'))}</th><th>${esc(pt('Preț unitar'))}</th></tr>${ls
            .map((l) => {
              const p = linePrice(l, map, seller);
              const u = unitPrice(l, map, seller);
              return `<tr><td>${l.quantity} ${UNIT_SHOWN[l.unit]}</td><td>${esc(l.printLabel ?? tr(l.label))}</td><td>${esc(l.printDetail ?? tr(l.detail))}</td><td>${p === null ? '' : `${formatMoney(p)} ${esc(currency)}`}</td><td>${u ? esc(unitPricePrint(u, currency)) : ''}</td></tr>`;
            })
            .join('')}</table>`
        : '';
    }).join('');
    const title = esc(pt('Listă de cumpărături — {name}', { name: view.title }));
    const estimate = esc(
      t('Estimate: {total} {currency}', { total: formatMoney(est.total), currency }) +
        (est.missing.length
          ? t(' — {n|# price missing|# prices missing}', { n: est.missing.length })
          : '') +
        (est.fromSeller
          ? t(' (your prices; {n|# line|# lines} at seller prices: {sellers})', {
              n: est.fromSeller,
              sellers: est.sellers.join('; '),
            })
          : t(' (your prices)')),
    );
    w.document.write(
      `<!doctype html><meta charset="utf-8"><title>${title}</title><style>body{font:12px sans-serif;margin:16px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:3px 6px;text-align:left}h2{font-size:14px;margin:14px 0 4px}</style><h1>${title}</h1>${rowsHtml}<p>${esc(notCountedPrint())}</p><p>${estimate}</p>`,
    );
    w.document.close();
    w.focus();
    w.print();
  };
  const blocked = view.diagnostics.some((d) => d.severity === 'error');
  // ADR-008: errors block every export, like Parts CSV and Print cutting sheet.
  const blockedTitle = blocked ? t('Fix the problems listed under Checks first') : undefined;
  return (
    <div className="shopping">
      {blocked && (
        <p className="alert error blocked">
          <Icon name="alert-circle" className="sm" />
          <span>
            {t(
              'Fix the problems under Checks first; sheets are counted only for a valid design. Boards are shown in m² until then.',
            )}
          </span>
        </p>
      )}
      <div className="info-row">
        <p className="estimate" role="status">
          <strong>
            {t('Estimate: {amount} {currency}', { amount: formatMoney(est.total), currency })}
          </strong>
          {est.missing.length ? (
            <span className="warn">
              {' '}
              {t('— {n|# price|# prices} missing (incomplete)', { n: est.missing.length })}
            </span>
          ) : est.priced ? (
            <span>{t(' — every line priced')}</span>
          ) : null}
          {est.fromSeller > 0 && (
            <span className="note">
              {' '}
              {t('{n|# line|# lines} at seller prices: {sellers}', {
                n: est.fromSeller,
                sellers: est.sellers.join('; '),
              })}
            </span>
          )}
        </p>
        <InfoTip label={t('About the estimate')}>
          {t(
            'Your prices, saved on this device, come first. Otherwise a linked seller product’s price is used, as the seller published it on the date shown.',
          )}
        </InfoTip>
        <GuidanceTip topic={t('what is not counted')} align="end">
          {tr(NOT_COUNTED)}
        </GuidanceTip>
      </div>
      <div className="split-actions">
        <button
          type="button"
          className="btn sm"
          aria-pressed={editing}
          onClick={() => setEditing((v) => !v)}
        >
          <Icon name="pencil" className="sm" />
          {editing ? t('Done with prices') : t('Prices')}
        </button>
        <button
          type="button"
          className="btn sm"
          disabled={blocked}
          title={blockedTitle ?? t('Download the shopping list as CSV')}
          onClick={() =>
            save(
              `${view.title}-shopping.csv`,
              shoppingCsvRo(
                lines,
                (l) => linePrice(l, map, seller),
                currency,
                (l) => unitPrice(l, map, seller),
              ),
              'text/csv;charset=utf-8',
            )
          }
        >
          <Icon name="download" className="sm" />
          {t('Shopping list CSV')}
        </button>
        <button
          type="button"
          className="btn sm"
          disabled={blocked}
          title={blockedTitle ?? t('Print the shopping list or save it as PDF')}
          onClick={printList}
        >
          <Icon name="printer" className="sm" />
          {t('Print shopping list')}
        </button>
        <button
          type="button"
          className="btn sm"
          disabled={projectView}
          title={projectView ? t('Open a piece to add a seller product to it') : undefined}
          onClick={() => setAdding(true)}
        >
          <Icon name="plus" className="sm" />
          {t('Add seller product')}
        </button>
      </div>
      <ProductPicker
        open={adding}
        title={t('Add seller product')}
        hint={t('Any product of a seller, added to this piece’s shopping list.')}
        offers={any}
        onClose={() => setAdding(false)}
        onPick={(o: Offer) => {
          addSellerItem({ ...refOf(o), quantity: 1 });
          setAdding(false);
        }}
      />
      {editing && (
        <div className="price-tools">
          <label className="field">
            <span>{t('Currency')}</span>
            <input
              defaultValue={currency}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v) setPrice({ id: CURRENCY_ID, unit: 'piece', amount: 0, text: v });
              }}
            />
          </label>
          <button
            type="button"
            className="btn sm"
            onClick={() => save('my-prices.csv', pricesCsv(prices), 'text/csv;charset=utf-8')}
            disabled={!prices.length}
          >
            <Icon name="download" className="sm" />
            {t('Export prices')}
          </button>
          <label className="btn sm file-btn">
            <Icon name="upload" className="sm" />
            {t('Import prices')}
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importCsv(f);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      )}
      {shown && (
        <p className="hint" role="status">
          {shown}
        </p>
      )}
      {SECTIONS.map((s) => {
        const ls = lines.filter((l) => l.section === s.id);
        if (!ls.length) return null;
        return (
          <section key={s.id} aria-label={SECTION_TITLE[s.id]}>
            <h3 className="list-head">{SECTION_TITLE[s.id]}</h3>
            <table className="cut shop">
              <thead>
                <tr>
                  <th scope="col">{t('Qty')}</th>
                  <th scope="col">{t('Item')}</th>
                  <th scope="col">{t('Details')}</th>
                  {s.id !== 'choose' && <th scope="col">{t('Price')}</th>}
                </tr>
              </thead>
              <tbody>
                {ls.map((l, i) => (
                  <Line
                    key={`${l.label}-${i}`}
                    l={l}
                    map={map}
                    currency={currency}
                    editing={editing}
                    onPrice={setPrice}
                    seller={seller}
                    projectView={projectView}
                  />
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}

function Line({
  l,
  map,
  currency,
  editing,
  onPrice,
  seller,
  projectView,
}: {
  l: ShopLine;
  map: Map<string, PriceEntry>;
  currency: string;
  editing: boolean;
  onPrice: (e: PriceEntry) => void;
  seller?: SellerLookup;
  projectView: boolean;
}) {
  const e = l.priceKey ? map.get(l.priceKey) : undefined;
  const units = unitsFor(l);
  const [unit, setUnit] = useState<ShopUnit>(e?.unit && units.includes(e.unit) ? e.unit : units[0]);
  const [bad, setBad] = useState(false);
  const p = linePrice(l, map, seller);
  const u = unitPrice(l, map, seller);
  const fromSeller = p !== null && priceSource(l, map, seller) === 'seller';
  // Run parts show a price once their own product prices them (ADR-206); otherwise their board's line does.
  const priced = l.section !== 'choose';
  const sellerRow =
    l.productKey !== undefined || l.itemIndex !== undefined || l.runKey !== undefined;
  return (
    <>
      <tr className={sellerRow ? 'has-seller' : undefined}>
        <td className="num">
          {l.unit === 'sheet' || l.unit === 'piece' ? l.quantity : l.quantity.toFixed(2)}{' '}
          {UNIT_SHOWN[l.unit]}
        </td>
        <td>{tr(l.label)}</td>
        <td className="note">{tr(l.detail)}</td>
        {priced && (
          <td className="num">
            {editing && l.priceKey ? (
              <span className="price-edit">
                <input
                  aria-label={t('Price of {item}', { item: tr(l.label) })}
                  inputMode="decimal"
                  defaultValue={e && e.unit === unit ? (e.amount / 100).toFixed(2) : ''}
                  className={bad ? 'bad' : undefined}
                  onBlur={(ev) => {
                    const a = parseMoney(ev.target.value);
                    setBad(ev.target.value.trim() !== '' && a === null);
                    if (a !== null) onPrice({ id: l.priceKey!, unit, amount: a });
                  }}
                />
                {units.length > 1 ? (
                  <select
                    aria-label={t('Price unit of {item}', { item: tr(l.label) })}
                    value={unit}
                    onChange={(ev) => setUnit(ev.target.value as ShopUnit)}
                  >
                    {units.map((u) => (
                      <option key={u} value={u}>
                        {u === 'piece' && l.worktop ? t('per worktop board') : PER[u]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span>{PER[unit]}</span>
                )}
              </span>
            ) : p === null && l.section === 'run' ? (
              <span className="hint">{t('with its board')}</span>
            ) : p === null ? (
              <span className="hint">
                {l.priceKey &&
                e &&
                (e.unit === 'sheet' || (e.unit === 'piece' && l.worktop)) &&
                l.sheets == null
                  ? t('sheets not laid out')
                  : '—'}
              </span>
            ) : (
              <>
                {`${formatMoney(p)} ${currency}`}
                {fromSeller && <span className="note"> {t('seller price')}</span>}
                {u && (
                  <div className="hint unit-price">
                    {t('{price} {currency} / {unit}', {
                      price: formatMoney(u.amount),
                      currency,
                      unit: UNIT_ONE[u.per],
                    })}
                  </div>
                )}
              </>
            )}
          </td>
        )}
      </tr>
      {sellerRow && (
        <tr className="seller-row">
          <td colSpan={priced ? 4 : 3}>
            <LineProduct l={l} projectView={projectView} />
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * ADR-161: the seller product of a hardware line (the line's kind first) with the seller units bought per item, or
 * an added item's quantity. Boards and bands are linked under Materials.
 */
function LineProduct({ l, projectView }: { l: ShopLine; projectView: boolean }) {
  const setLineProduct = useDesign((s) => s.setHardwareProduct);
  const setRunProduct = useDesign((s) => s.setRunProduct);
  const setQuantity = useDesign((s) => s.setSellerItemQuantity);
  const [open, setOpen] = useState(false);
  const [bad, setBad] = useState(false);
  const { hardwareKind, sizeMm, runKey } = l;
  // A run part (ADR-206) is linked in the project; a hardware or fastener line in the design (ADR-161, ADR-206).
  const productKey = runKey ?? l.productKey;
  const worktop = /worktop/i.test(l.label);
  const setHardwareProduct = (key: string, hp: HardwareProduct | undefined) =>
    runKey ? setRunProduct(key, hp) : setLineProduct(key, hp);
  const offers = useCallback(
    (c: SellerCatalog[], q: string) =>
      runKey ? runPartOffers(c, worktop, q) : hardwareOffers(c, hardwareKind, sizeMm, q),
    [hardwareKind, sizeMm, runKey, worktop],
  );
  if (l.itemIndex !== undefined) {
    if (projectView) return null;
    const i = l.itemIndex;
    return (
      <span className="seller-line">
        <label className="field inline">
          <span>{t('Quantity')}</span>
          <input
            type="number"
            min={0}
            max={9999}
            step={1}
            aria-label={t('Quantity of {item}', { item: l.label })}
            defaultValue={l.quantity}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (Number.isInteger(v) && v >= 0 && v <= 9999) setQuantity(i, v);
            }}
          />
        </label>
        <button type="button" className="btn sm ghost" onClick={() => setQuantity(i, 0)}>
          {t('Remove')}
        </button>
      </span>
    );
  }
  if (!productKey) return null;
  const item = tr(l.label);
  return (
    <span className="seller-line">
      {l.product && (
        <span className="note">{t('Seller product: {name}', { name: l.product.name })}</span>
      )}
      <button
        type="button"
        className="btn sm outline"
        aria-label={t('Product for {item}', { item })}
        onClick={() => setOpen(true)}
      >
        <Icon name="search" className="sm" />
        {t('Product')}
      </button>
      {l.product && (
        <>
          <label className="field inline">
            <span>{t('Seller units per item')}</span>
            <input
              inputMode="decimal"
              aria-label={t('Seller units per item for {item}', { item })}
              defaultValue={String(l.per ?? 1)}
              className={bad ? 'bad' : undefined}
              onBlur={(e) => {
                const v = Number(e.target.value.trim().replace(',', '.'));
                const ok = validPer(v);
                setBad(!ok);
                if (ok && l.product) setHardwareProduct(productKey, { ...l.product, per: v });
              }}
            />
          </label>
          <button
            type="button"
            className="btn sm ghost"
            onClick={() => setHardwareProduct(productKey, undefined)}
          >
            {t('Unlink')}
          </button>
        </>
      )}
      <ProductPicker
        open={open}
        title={t('Product for {item}', { item })}
        hint={
          runKey
            ? t(
                'Boards and worktops first. A product priced per piece or per metre prices this part instead of its board.',
              )
            : t(
                'Products of this kind first (runners of the same length first). The price counts 1 seller unit per item until you change it.',
              )
        }
        offers={offers}
        onClose={() => setOpen(false)}
        onPick={(o: Offer) => {
          setHardwareProduct(productKey, { ...refOf(o), per: l.per ?? 1 });
          setOpen(false);
        }}
      />
    </span>
  );
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
