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
  runUnitFits,
  type SellerLookup,
} from '../core/prices';
import { sinkList } from '../core/project';
import { productIndex, sellerPriceLookup } from '../core/sellers';
import { shoppingList, type ShopLine } from '../core/shopping';
import { useDesign } from '../store/designStore';
import { useFastenerChoices, useFastenerCounts } from './Fasteners';
import { usePrices } from '../store/priceStore';
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
  const runProducts = useDesign((s) =>
    s.project && !s.editingItemId ? s.project.runProducts : undefined,
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
  // Seller prices (ADR-161): the bundled catalogs load only when a line links a seller product (a run part's too).
  const cats = useSellerCatalogs(
    !!runProducts ||
      Object.keys(view.hardwareProducts ?? {}).length > 0 ||
      !!view.sellerItems?.length ||
      view.rows.some((r) => r.band?.product) ||
      [...view.materials, ...(runParts ?? []).map((r) => r.material)].some(
        (m) => m.product || m.band?.product || m.frontBand?.product,
      ),
  );
  const index = useMemo(() => (cats && cats !== 'error' ? productIndex(cats) : null), [cats]);
  // Run parts whose product's unit fits are priced by it and leave their board's line (ADR-206).
  const runPriced = useMemo(() => {
    const out = new Set<string>();
    if (!index || !runProducts) return out;
    const price = sellerPriceLookup(index);
    for (const [k, v] of Object.entries(runProducts)) {
      const sp = price(v);
      if (sp && runUnitFits(sp.unit)) out.add(k);
    }
    return out;
  }, [index, runProducts]);
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
        runProducts,
        runPriced,
      }),
    [view, sheets, runParts, sinks, fastenerCounts, fastenerChoices, runProducts, runPriced],
  );
  const seller = useMemo<SellerLookup | undefined>(
    () => (index ? sellerPriceLookup(index) : undefined),
    [index],
  );
  const currency = useMemo(
    () => prices.find((p) => p.id === CURRENCY_ID)?.text ?? DEFAULT_CURRENCY,
    [prices],
  );
  const est = useMemo(() => estimate(lines, prices, seller), [lines, prices, seller]);
  return { lines, prices, priceState, seller, est, currency, sheets };
}
