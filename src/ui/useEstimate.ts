/**
 * The cost estimate of what is shown (ADR-062, ADR-161, ADR-172): the shopping lines of the derived view, the user's
 * prices and the seller prices, as one hook shared by the Shopping list and the header chip so both show one number.
 */
import { useEffect, useMemo } from 'react';
import {
  CURRENCY_ID,
  DEFAULT_CURRENCY,
  estimate,
  type Estimate,
  type PriceEntry,
  type SellerLookup,
} from '../core/prices';
import { sinkList } from '../core/project';
import { productIndex, sellerPriceLookup } from '../core/sellers';
import { shoppingList, type ShopLine } from '../core/shopping';
import { useDesign } from '../store/designStore';
import { useFastenerChoices, useFastenerCounts } from './Fasteners';
import { usePrices } from './priceStore';
import { useSellerCatalogs } from './ProductPicker';
import { useNesting } from './useNesting';
import { useView } from './useView';

export interface EstimateView {
  lines: ShopLine[];
  prices: PriceEntry[];
  priceState: 'idle' | 'loading' | 'ready' | 'failed';
  seller: SellerLookup | undefined;
  est: Estimate;
  currency: string;
  /** The sheets per board from the layout, or null until it is laid out. */
  sheets: Map<string, number> | null;
}

export function useEstimate(): EstimateView {
  const view = useView();
  const runParts = useDesign((s) =>
    s.project && !s.editingItemId ? s.project.runParts : undefined,
  );
  const shownProject = useDesign((s) => (s.project && !s.editingItemId ? s.project : undefined));
  const sinks = useMemo(() => (shownProject ? sinkList(shownProject) : []), [shownProject]);
  const n = useNesting(true);
  const fastenerCounts = useFastenerCounts();
  const fastenerChoices = useFastenerChoices();
  const prices = usePrices((s) => s.prices);
  const priceState = usePrices((s) => s.state);
  const load = usePrices((s) => s.load);
  useEffect(() => load(), [load]);
  const sheets = useMemo(
    () =>
      n.status === 'done'
        ? new Map(n.results.filter((r) => r.valid).map((r) => [r.materialId, r.stats.sheetsUsed]))
        : null,
    [n],
  );
  const lines = useMemo(
    () =>
      shoppingList({
        rows: view.rows,
        materials: view.materials,
        hardware: view.hardware,
        sheets,
        runParts,
        sinks,
        diagnostics: view.diagnostics,
        fasteners: { counts: fastenerCounts, choices: fastenerChoices },
        hardwareProducts: view.hardwareProducts,
        sellerItems: view.sellerItems,
      }),
    [view, sheets, runParts, sinks, fastenerCounts, fastenerChoices],
  );
  // Seller prices (ADR-161): the bundled catalogs load only when a line links a seller product.
  const cats = useSellerCatalogs(lines.some((l) => l.product));
  const seller = useMemo<SellerLookup | undefined>(
    () => (cats && cats !== 'error' ? sellerPriceLookup(productIndex(cats)) : undefined),
    [cats],
  );
  const currency = useMemo(
    () => prices.find((p) => p.id === CURRENCY_ID)?.text ?? DEFAULT_CURRENCY,
    [prices],
  );
  const est = useMemo(() => estimate(lines, prices, seller), [lines, prices, seller]);
  return { lines, prices, priceState, seller, est, currency, sheets };
}
