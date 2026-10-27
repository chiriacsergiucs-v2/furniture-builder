import { useMemo } from 'react';
import { sheetOf } from '../core/design';
import type { NestJob, NestResult, SheetLayout } from '../core/nesting/types';
import { useDesign } from '../store/designStore';
import { useNesting } from './useNesting';
import { useResultView } from './useView';
import { InfoTip } from './controls';
import { Icon } from './icons';

const REASON: Record<string, string> = {
  'too-large': 'larger than the usable sheet',
  'no-sheet-left': 'no sheets left in stock',
  'invalid-job': 'sheet settings are invalid',
};

export function Sheets() {
  const n = useNesting(true, true);
  const view = useResultView();
  const setHighlight = useDesign((s) => s.setHighlight);
  if (n.blocked)
    return (
      <p className="alert error blocked">
        <Icon name="alert-circle" className="sm" />
        <span>
          Fix the problems under Checks first; sheets are laid out only for a valid design.
        </span>
      </p>
    );
  if (n.status === 'idle' || n.status === 'running')
    return <p className="loading">Laying out sheets…</p>;
  if (n.status === 'error')
    return (
      <p className="alert error blocked">
        <Icon name="alert-circle" className="sm" />
        <span>{n.error}</span>
      </p>
    );
  const kerf = view.kerf;
  const matOf = (id: string) => view.materials.find((m) => m.id === id);
  return (
    <div className="sheets">
      <p className="summary">
        Saw cut {kerf} mm; trim per material below.{' '}
        <InfoTip label="About the sheet layout" align="start">
          Heuristic layout for a panel saw (edge-to-edge cuts): usually close to the fewest sheets,
          not guaranteed.
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
        <strong>Sheets to buy</strong>
      </caption>
      <thead>
        <tr>
          <th scope="col">Qty</th>
          <th scope="col">Board</th>
          <th scope="col">Sheet</th>
          <th scope="col">Used</th>
        </tr>
      </thead>
      <tbody>
        {results.map((r, i) => (
          <tr key={r.materialId}>
            <td className="num">{r.valid ? r.stats.sheetsUsed : '—'}</td>
            <td>{jobs[i].materialName}</td>
            <td className="num">
              {jobs[i].sheet.length} × {jobs[i].sheet.width}
            </td>
            <td className="num">
              {r.valid ? `${Math.round(r.stats.utilisation * 100)}%` : 'invalid'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MaterialSheets({
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
        <h3>{job.materialName}</h3>
        <p className="alert error blocked">
          <Icon name="alert-circle" className="sm" />
          <span>
            This layout failed its own check and is not shown:{' '}
            {result.errors.slice(0, 3).join('; ')}
          </span>
        </p>
      </section>
    );
  }
  return (
    <section className="mat-sheets">
      <h3>
        {job.materialName}{' '}
        <span>
          {result.stats.sheetsUsed} {result.stats.sheetsUsed === 1 ? 'sheet' : 'sheets'},{' '}
          {Math.round(result.stats.utilisation * 100)}% used, trim {trim} mm
          {job.grain ? ', grain along the length' : ''}
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
                  {q} × {labelOf(key)?.labels.join(', ') ?? key} not placed:{' '}
                  {REASON[reason] ?? reason}.
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
  const placements = useMemo(
    () => sheet.placements.map((p) => ({ ...p, info: labelOf(p.key) })),
    [sheet, labelOf],
  );
  return (
    <figure className="sheet">
      <figcaption>Sheet {sheet.index + 1}</figcaption>
      <svg
        viewBox={`0 0 ${sheet.length} ${sheet.width}`}
        role="img"
        aria-label={`Sheet ${sheet.index + 1}: ${sheet.placements.length} parts`}
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
          const label = p.info?.labels[0] ?? '';
          const dims = `${p.rotated ? p.width : p.length}×${p.rotated ? p.length : p.width}`;
          const big = p.length > fs * 4.2 && p.width > fs * 1.6;
          return (
            <g
              key={`${p.key}-${p.instance}`}
              className="sh-part"
              onMouseEnter={() => onHover(p.info?.panelIds ?? [])}
              onMouseLeave={() => onHover([])}
            >
              <rect x={p.x} y={p.y} width={p.length} height={p.width} style={{ fill: color }} />
              {big && (
                <text
                  x={p.x + p.length / 2}
                  y={p.y + p.width / 2 - fs * 0.3}
                  fontSize={fs}
                  textAnchor="middle"
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
