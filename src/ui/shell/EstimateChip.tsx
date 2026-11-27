import { t } from '@furniture-builder/i18n';
import { formatMoney } from '../../core/prices';
import { useDesign } from '../../store/designStore';
import { useUi } from '../../store/uiStore';
import { useEstimate } from '../useEstimate';

/**
 * The running cost estimate (ADR-172): what the Shopping list shows, in the header (a phone: the mode row, amount
 * only). Tapping it opens Build & Preview › Shopping list.
 */
export function EstimateChip({ compact = false }: { compact?: boolean }) {
  const { est, currency, priceState } = useEstimate();
  const setMode = useUi((s) => s.setMode);
  const setTab = useDesign((s) => s.setTab);
  const none =
    priceState !== 'ready' ||
    (!est.priced && !est.missing.length) ||
    (!est.priced && est.total === 0);
  const amount = t('{amount} {currency}', { amount: formatMoney(est.total), currency });
  // A price list the device could not read is said as such, not as "No prices yet" (ADR-260).
  const full =
    priceState === 'failed'
      ? t('Prices could not be read')
      : none
        ? t('No prices yet')
        : est.missing.length
          ? t('Estimate: {amount} · {n} missing', { amount, n: est.missing.length })
          : t('Estimate: {amount}', { amount });
  return (
    <button
      type="button"
      className={`estimate-chip ${none ? 'none' : est.missing.length ? 'partial' : ''}`}
      aria-label={`${full} — ${t('Open the Shopping list')}`}
      title={t('Open the Shopping list')}
      onClick={() => {
        setMode('build');
        setTab('shopping');
      }}
    >
      {compact && !none ? amount : full}
    </button>
  );
}
