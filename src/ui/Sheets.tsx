import { useMemo } from 'react';
import { sheetOf } from '../core/design';
import { t, tr } from '@furniture-builder/i18n';
import type { NestJob, NestResult, SheetLayout } from '@furniture-builder/nesting';
import { useDesign } from '../store/designStore';
import { useNesting } from './useNesting';
import { useView } from '../store/useView';
import { InfoTip } from './controls';
import { Icon } from './icons';

const REASON: Record<string, string> = {
  'too-large': t('larger than the usable sheet'),
  'no-sheet-left': t('no sheets left in stock'),
  'invalid-job': t('sheet settings are invalid'),
};

export function Sheets() {
  const n = useNesting(true);
  const view = useView();
  const setHighlight = useDesign((s) => s.setHighlight);
  if (n.blocked)
    return (
      <p className="alert error blocked">
        <Icon name="alert-circle" className="sm" />
        <span>
          {t('Fix the problems under Checks first; sheets are laid out only for a valid design.')}
        </span>
      </p>
    );
  if (n.status === 'idle' || n.status === 'running')
    return <p className="loading">{t('Laying out sheets…')}</p>;
  if (n.status === 'error')
    return (
      <p className="alert error blocked">
        <Icon name="alert-circle" className="sm" />
        <span>{tr(n.error)}</span>
      </p>
    );
  const kerf = view.kerf;
  const matOf = (id: string) => view.materials.find((m) => m.id === id);
  return (
    <div className="sheets">
      <p className="summary">
        {t('Saw cut {kerf} mm; trim per material below.', { kerf })}{' '}
        <InfoTip label={t('About the sheet layout')} align="start">
          {t(
            'Heuristic layout for a panel saw (edge-to-edge cuts): usually close to the fewest sheets, not guaranteed.',
          )}
        </InfoTip>
      </p>
      <BuyList results={n.results} jobs={n.jobs} />
      {n.results.map((r, i) => {
        const m = matOf(r.materialId);
        return (
          <MaterialSheets
            key={r.materialId}
            result={r}
            job={n.jobs[i]}
            color={m?.color ?? '#ddd'}
            labelOf={(key) => n.rows.find((row) => row.panelIds[0] === key)}
            onHover={setHighlight}
            trim={m ? sheetOf(m).trim : n.jobs[i].trim}
          />
        );
      })}
    </div>
  );
}

function BuyList({ results, jobs }: { results: NestResult[]; jobs: NestJob[] }) {
  return (
    <table className="cut buy">
      <caption>
        <strong>{t('Sheets to buy')}</strong>
      </caption>
      <thead>
        <tr>
          <th scope="col" className="num">
            {t('Qty')}
          </th>
          <th scope="col">{t('Board')}</th>
          <th scope="col" className="num">
            {t('Sheet')}
          </th>
          <th scope="col" className="num">
            {t('Used')}
          </th>
        </tr>
      </thead>
      <tbody>
        {results.map((r, i) => (
          <tr key={r.materialId}>
            <td className="num">{r.valid ? r.stats.sheetsUsed : '—'}</td>
            <td>{tr(jobs[i].materialName)}</td>
            <td className="num">
              {jobs[i].sheet.length} × {jobs[i].sheet.width}
            </td>
            <td className="num">
              {r.valid ? `${Math.round(r.stats.utilisation * 100)}%` : t('invalid')}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function MaterialSheets({
  result,
  job,
  color,
  labelOf,
  onHover,
  trim,
}: {
  result: NestResult;
  job: NestJob;
  color: string;
  trim: number;
  labelOf: (key: string) => { labels: string[]; panelIds: string[] } | undefined;
  onHover: (ids: string[]) => void;
}) {
  if (!result.valid) {
    return (
      <section className="mat-sheets">
        <h3>{tr(job.materialName)}</h3>
        <p className="alert error blocked">
          <Icon name="alert-circle" className="sm" />
          <span>
            {t('This layout failed its own check and is not shown:')}{' '}
            {result.errors.slice(0, 3).join('; ')}
          </span>
        </p>
      </section>
    );
  }
  return (
    <section className="mat-sheets">
      <h3>
        {tr(job.materialName)}{' '}
        <span>
          {t('{n|# sheet|# sheets}, {used}% used, trim {trim} mm', {
            n: result.stats.sheetsUsed,
            used: Math.round(result.stats.utilisation * 100),
            trim,
          })}
          {job.grain ? t(', grain along the length') : ''}
        </span>
      </h3>
      {result.unplaced.length > 0 && (
        <ul className="inline-diags">
          {Object.entries(
            result.unplaced.reduce<Record<string, number>>(
              (a, u) => ({ ...a, [`${u.key}|${u.reason}`]: (a[`${u.key}|${u.reason}`] ?? 0) + 1 }),
              {},
            ),
          ).map(([k, q]) => {
            const [key, reason] = k.split('|');
            return (
              <li key={k} className="alert error">
                <Icon name="alert-circle" className="sm" />
                <span>
                  {t('{q} × {parts} not placed: {reason}.', {
                    q,
                    parts:
                      labelOf(key)
                        ?.labels.map((l) => tr(l))
                        .join(', ') ?? key,
                    reason: REASON[reason] ?? reason,
                  })}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {result.sheets.map((s) => (
        <SheetSvg key={s.index} sheet={s} color={color} labelOf={labelOf} onHover={onHover} />
      ))}
    </section>
  );
}

/**
 * Whether a label drawn on a board colour reads better in light or dark text (WCAG relative luminance, contrast
 * against white versus black); 'dark' for anything that is not a 3- or 6-digit hex colour.
 */
export function textOnColor(hex: string): 'light' | 'dark' {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 'dark';
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  const lin = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4);
  // Contrast with white is 1.05 / (lum + 0.05); with black (lum + 0.05) / 0.05.
  return 1.05 / (lum + 0.05) > (lum + 0.05) / 0.05 ? 'light' : 'dark';
}

export function SheetSvg({
  sheet,
  color,
  labelOf,
  onHover,
}: {
  sheet: SheetLayout;
  color: string;
  labelOf: (key: string) => { labels: string[]; panelIds: string[] } | undefined;
  onHover: (ids: string[]) => void;
}) {
  const fs = Math.max(sheet.length, sheet.width) / 26;
  const textStyle =
    textOnColor(color) === 'light' ? { fill: 'var(--on-primary, #fff)' } : undefined;
  const placements = useMemo(
    () => sheet.placements.map((p) => ({ ...p, info: labelOf(p.key) })),
    [sheet, labelOf],
  );
  return (
    <figure className="sheet">
      <figcaption>{t('Sheet {n}', { n: sheet.index + 1 })}</figcaption>
      <svg
        viewBox={`0 0 ${sheet.length} ${sheet.width}`}
        role="img"
        aria-label={t('Sheet {n}: {count} parts', {
          n: sheet.index + 1,
          count: sheet.placements.length,
        })}
      >
        <rect className="sh-sheet" x={0} y={0} width={sheet.length} height={sheet.width} />
        <rect
          className="sh-usable"
          x={sheet.usable.x}
          y={sheet.usable.y}
          width={sheet.usable.length}
          height={sheet.usable.width}
        />
        {placements.map((p) => {
          const label = tr(p.info?.labels[0] ?? '');
          const dims = `${p.rotated ? p.width : p.length}×${p.rotated ? p.length : p.width}`;
          const big = p.length > fs * 4.2 && p.width > fs * 1.6;
          return (
            <g
              key={`${p.key}-${p.instance}`}
              className="sh-part"
              tabIndex={0}
              onMouseEnter={() => onHover(p.info?.panelIds ?? [])}
              onMouseLeave={() => onHover([])}
              onFocus={() => onHover(p.info?.panelIds ?? [])}
              onBlur={() => onHover([])}
              onClick={() => onHover(p.info?.panelIds ?? [])}
            >
              <title>{label ? `${label} ${dims}` : dims}</title>
              <rect x={p.x} y={p.y} width={p.length} height={p.width} style={{ fill: color }} />
              {big && (
                <text
                  x={p.x + p.length / 2}
                  y={p.y + p.width / 2 - fs * 0.3}
                  fontSize={fs}
                  textAnchor="middle"
                  style={textStyle}
                >
                  {dims}
                </text>
              )}
              {big && p.width > fs * 3 && (
                <text
                  className="sh-label"
                  x={p.x + p.length / 2}
                  y={p.y + p.width / 2 + fs}
                  fontSize={fs * 0.8}
                  textAnchor="middle"
                  style={textStyle}
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
