import { useMemo, useState, type ReactNode } from 'react';
import { MAX_LEFTOVERS, sheetOf } from '../core/design';
import type { Material } from '../core/types';
import { t, tr } from '@furniture-builder/i18n';
import type { NestJob, NestResult, SheetLayout } from '@furniture-builder/nesting';
import { useDesign } from '../store/designStore';
import { useNesting } from './useNesting';
import { useView } from '../store/useView';
import { InfoTip, MmField } from './controls';
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
          >
            {view.mode === 'design' && m && <Leftovers material={m} />}
          </MaterialSheets>
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
            <td className="num">{r.valid ? r.stats.sheetsUsed - r.stats.leftoversUsed : '—'}</td>
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
  children,
}: {
  result: NestResult;
  job: NestJob;
  color: string;
  trim: number;
  /** Shown under the board's heading, e.g. its leftover pieces (ADR-302). */
  children?: ReactNode;
  labelOf: (key: string) => { labels: string[]; panelIds: string[] } | undefined;
  onHover: (ids: string[]) => void;
}) {
  if (!result.valid) {
    return (
      <section className="mat-sheets">
        <h3>{tr(job.materialName)}</h3>
        {children}
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
      {children}
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

/**
 * A board's leftover pieces (ADR-302): saved on the board, filled before any full sheet. Each change is one undo step.
 */
function Leftovers({ material: m }: { material: Material }) {
  const update = useDesign((s) => s.updateMaterial);
  const list = m.leftovers ?? [];
  const sheet = sheetOf(m);
  const min = 2 * sheet.trim + 1;
  const save = (next: NonNullable<Material['leftovers']>) =>
    update(m.id, { leftovers: next.length ? next : undefined });
  return (
    <details className="leftovers" open={list.length > 0 || undefined}>
      <summary>
        {t('Leftovers')} {list.length > 0 && <span className="count">{list.length}</span>}
      </summary>
      <p className="hint">
        {t(
          'Pieces of this board you already have. Parts go on them first; only full sheets are bought.',
        )}
      </p>
      {list.map((o, i) => (
        <div className="sheet-fields leftover" key={i}>
          <MmField
            label={
              m.grain
                ? t('Leftover {n} length, along the grain', { n: i + 1 })
                : t('Leftover {n} length', { n: i + 1 })
            }
            value={o.length}
            min={min}
            max={20000}
            onChange={(v) => save(list.map((x, k) => (k === i ? { ...x, length: v } : x)))}
          />
          <MmField
            label={t('Leftover {n} width', { n: i + 1 })}
            value={o.width}
            min={min}
            max={20000}
            onChange={(v) => save(list.map((x, k) => (k === i ? { ...x, width: v } : x)))}
          />
          <button
            type="button"
            className="ghost"
            onClick={() => save(list.filter((_, k) => k !== i))}
          >
            <Icon name="trash" className="sm" /> {t('Remove leftover {n}', { n: i + 1 })}
          </button>
        </div>
      ))}
      {list.length < MAX_LEFTOVERS && (
        <button
          type="button"
          onClick={() =>
            save([
              ...list,
              { length: Math.round(sheet.length / 2), width: Math.round(sheet.width / 2) },
            ])
          }
        >
          <Icon name="plus" className="sm" /> {t('Add leftover')}
        </button>
      )}
    </details>
  );
}

/** Font size and turn that fit `text` inside a part `l` × `w` (sheet units), at most `fs`. */
function fitText(text: string, l: number, w: number, fs: number) {
  const em = text.length * 0.62;
  const across = Math.min(fs, (l * 0.9) / em, w * 0.75);
  const upright = Math.min(fs, (w * 0.9) / em, l * 0.75);
  return upright > across * 1.2 ? { size: upright, turn: true } : { size: across, turn: false };
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
    () =>
      sheet.placements.map((p) => {
        const info = labelOf(p.key);
        return {
          ...p,
          info,
          id: `${p.key}-${p.instance}`,
          // Every label of the cut-list row, as the Parts tab lists them.
          label: info?.labels.map((l) => tr(l)).join(', ') ?? '',
          dims: `${p.rotated ? p.width : p.length}×${p.rotated ? p.length : p.width}`,
        };
      }),
    [sheet, labelOf],
  );
  const [picked, setPicked] = useState<string | null>(null);
  const sel = placements.find((p) => p.id === picked);
  const pick = (p: (typeof placements)[number]) => {
    const next = picked === p.id ? null : p.id;
    setPicked(next);
    onHover(next ? (p.info?.panelIds ?? []) : []);
  };
  const what = (p: (typeof placements)[number]) =>
    t('{part}, {size} mm', { part: p.label || t('Part'), size: p.dims.replace('×', ' × ') });
  // The popup sits over the picked part, kept inside the drawing so the page never scrolls sideways.
  const pop = sel && {
    left: `${Math.min(85, Math.max(15, ((sel.x + sel.length / 2) / sheet.length) * 100))}%`,
    ...(sel.y / sheet.width > 0.25
      ? { top: `${(sel.y / sheet.width) * 100}%`, transform: 'translate(-50%, -100%)' }
      : { top: `${((sel.y + sel.width) / sheet.width) * 100}%`, transform: 'translate(-50%, 0)' }),
  };
  return (
    <figure className="sheet">
      <figcaption>
        {sheet.leftover !== undefined
          ? t('Sheet {n} · leftover {l} × {w} mm', {
              n: sheet.index + 1,
              l: sheet.length,
              w: sheet.width,
            })
          : t('Sheet {n}', { n: sheet.index + 1 })}
      </figcaption>
      <p className="sh-info" aria-live="polite">
        {sel ? what(sel) : t('Tap a part to see what it is.')}
      </p>
      <div className="sh-draw">
        <svg
          viewBox={`0 0 ${sheet.length} ${sheet.width}`}
          role="img"
          aria-label={t('Sheet {n}: {count} parts', {
            n: sheet.index + 1,
            count: sheet.placements.length,
          })}
        >
          <rect
            className="sh-sheet"
            x={0}
            y={0}
            width={sheet.length}
            height={sheet.width}
            onClick={() => {
              setPicked(null);
              onHover([]);
            }}
          />
          <rect
            className="sh-usable"
            x={sheet.usable.x}
            y={sheet.usable.y}
            width={sheet.usable.length}
            height={sheet.usable.width}
            onClick={() => {
              setPicked(null);
              onHover([]);
            }}
          />
          {placements.map((p) => {
            const big = p.length > fs * 4.2 && p.width > fs * 1.6;
            const fit = fitText(p.dims, p.length, p.width, fs);
            const cx = p.x + p.length / 2,
              cy = p.y + p.width / 2;
            return (
              <g
                key={p.id}
                className={`sh-part${picked === p.id ? ' on' : ''}`}
                tabIndex={0}
                role="button"
                aria-pressed={picked === p.id}
                aria-label={what(p)}
                onMouseEnter={() => onHover(p.info?.panelIds ?? [])}
                onMouseLeave={() => onHover(picked ? (sel?.info?.panelIds ?? []) : [])}
                onFocus={() => onHover(p.info?.panelIds ?? [])}
                onBlur={() => onHover([])}
                onClick={() => pick(p)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' && e.key !== ' ') return;
                  e.preventDefault();
                  pick(p);
                }}
              >
                <title>{p.label ? `${p.label} ${p.dims}` : p.dims}</title>
                <rect x={p.x} y={p.y} width={p.length} height={p.width} style={{ fill: color }} />
                {/* The size is always drawn, shrunk (and turned on a tall part) to fit. */}
                <text
                  x={cx}
                  y={big ? cy - fs * 0.3 : cy}
                  fontSize={big ? fs : fit.size}
                  textAnchor="middle"
                  dominantBaseline={big ? undefined : 'middle'}
                  transform={!big && fit.turn ? `rotate(-90 ${cx} ${cy})` : undefined}
                  style={textStyle}
                >
                  {p.dims}
                </text>
                {big && p.width > fs * 3 && (
                  <text
                    className="sh-label"
                    x={cx}
                    y={cy + fs}
                    fontSize={fs * 0.8}
                    textAnchor="middle"
                    style={textStyle}
                  >
                    {p.info?.labels[0] ? tr(p.info.labels[0]) : ''}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {sel && pop && (
          <div className="sh-pop" role="status" style={pop}>
            <strong>{sel.label || t('Part')}</strong>
            <span>{t('{size} mm', { size: sel.dims.replace('×', ' × ') })}</span>
          </div>
        )}
      </div>
    </figure>
  );
}
