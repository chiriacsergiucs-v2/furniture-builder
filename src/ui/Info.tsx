import { FEATURES, type FeatureDomain } from '../core/features';
import { t } from '../core/i18n';
import { Icon } from './icons';
import { PHONE, useMediaQuery } from './useMediaQuery';

function count(d: FeatureDomain): number {
  return (d.features?.length ?? 0) + (d.children ?? []).reduce((n, c) => n + count(c), 0);
}

function Domain({ d, open }: { d: FeatureDomain; open: boolean }) {
  return (
    <details className="info-domain" open={open}>
      <summary>
        {t(d.name)} <span className="count">{count(d)}</span>
      </summary>
      {d.features && (
        <ul>
          {d.features.map((f) => (
            <li key={f.name}>
              <strong>{t(f.name)}</strong>
              {f.detail && <> — {t(f.detail)}</>}{' '}
              <small className="hint">{f.adrs.join(', ')}</small>
            </li>
          ))}
        </ul>
      )}
      {d.children?.map((c) => <Domain key={c.name} d={c} open={open} />)}
    </details>
  );
}

/**
 * Information and guides (ADR-158): what the app can do, as a tree of domains with each feature's ADRs. Domains
 * start open on a wide screen and closed on a phone.
 */
export function InfoPage({ onDone }: { onDone: () => void }) {
  const wide = !useMediaQuery(PHONE);
  const total = FEATURES.reduce((n, d) => n + count(d), 0);
  return (
    <main className="catalog-page info-page" aria-label={t('Information and guides')}>
      <header className="catalog-head">
        <div>
          <h1>{t('Information and guides')}</h1>
          <p className="hint">
            {t('What this version of the app can do: {n|# feature|# features}, grouped by domain.', {
              n: total,
            })}
          </p>
        </div>
        <button type="button" className="btn outline" onClick={onDone}>
          <Icon name="chevron-left" className="sm" />
          {t('Back to the editor')}
        </button>
      </header>
      <section aria-labelledby="info-features">
        <h2 id="info-features">{t('Features')}</h2>
        {FEATURES.map((d) => (
          <Domain key={d.name} d={d} open={wide} />
        ))}
      </section>
    </main>
  );
}
