import { useMemo } from 'react';
import { areaM2, bandMetersFromRows } from '../core/cutlist';
import { sheetOf } from '../core/design';
import { nest } from '../core/nesting';
import { getPrintLang, PRINT_DATE_LOCALE, pt } from '../core/i18n/print';
import { boardBandRo, drillingRo, hardwareRo, partRo } from '../core/ro';
import { useDesign } from '../store/designStore';
import { Elevation } from './Elevation';
import { SheetSvg } from './Sheets';
import { useView } from './useView';
import { OVERLAP, PAGE, profileTemplates } from '../core/template';

/**
 * Printable cutting sheet for the panel shop, A4 portrait (ADR-020), in the print language (ADR-157). Rendered only while printing;
 * everything comes from the model and the cut list — no geometry is computed here.
 */
export function PrintSheet() {
  const view = useView();
  const project = useDesign((s) => s.project);
  const rows = view.rows;
  const bands = useMemo(() => bandMetersFromRows(rows), [rows]);
  const hw = view.hardware;
  const layouts = useMemo(() => {
    const jobs = view.jobs();
    return { jobs, rows, results: jobs.map((j) => nest(j)) };
  }, [view, rows]);
  const b = view.model.bounds;
  const byMat = [...new Set(rows.map((r) => r.materialId))];
  const warnings = view.diagnostics.filter((d) => d.severity === 'warning');
  const labelOf = (key: string) => layouts.rows.find((r) => r.panelIds[0] === key);
  const colorOf = (id: string) => view.materials.find((m) => m.id === id)?.color ?? '#ddd';
  const templates = useMemo(() => profileTemplates(view.model.panels), [view]);
  const locale = PRINT_DATE_LOCALE[getPrintLang()];
  const mm = pt('mm');

  return (
    <div className="print-root" aria-hidden="true">
      <header className="pr-head">
        <h1>{view.title}</h1>
        <p>
          {pt('Fișă de debitare')}
          {view.mode === 'project' ? ` · ${pt('proiect')}` : ''} ·{' '}
          {new Date().toLocaleDateString(locale)} ·{' '}
          {pt('gabarit {w} × {h} × {d} mm', { w: b.w, h: b.h, d: b.d })}
        </p>
        <p className="pr-note">
          {pt(
            'Dimensiuni finite, în mm. Cantul este marcat (L = pe lungime, l = pe lățime), nu scăzut din dimensiuni. Fibra urmează lungimea la plăcile cu fibră. Tăietură {kerf} mm.',
            { kerf: view.kerf },
          )}
        </p>
      </header>

      {view.mode === 'design' ? (
        <section className="pr-block pr-elev">
          <h2>{pt('Vedere frontală')}</h2>
          <Elevation />
        </section>
      ) : (
        project && (
          <section className="pr-block">
            <h2>{pt('Piese în proiect')}</h2>
            <table className="pr-table">
              <thead>
                <tr>
                  <th>{pt('Piesă')}</th>
                  <th>{pt('Buc.')}</th>
                  <th>{pt('Poziție x / y / z')}</th>
                  <th>{pt('Rotire')}</th>
                </tr>
              </thead>
              <tbody>
                {project.items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.design.name}</td>
                    <td className="n">{i.quantity}</td>
                    <td className="n">
                      {i.position.x} / {i.position.y} / {i.position.z}
                    </td>
                    <td className="n">{i.rotationY}°</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )
      )}

      <section className="pr-block">
        <h2>{pt('Listă de piese')}</h2>
        {byMat.map((mid) => {
          const list = rows.filter((r) => r.materialId === mid);
          return (
            <table key={mid} className="pr-table">
              <caption>
                {list[0].materialName} — {areaM2(rows, mid).toFixed(2)} m²
                {bands.get(mid) ? `, ${pt('cant {m} m', { m: bands.get(mid)!.toFixed(1) })}` : ''}
                {list[0].grain ? `, ${pt('fibră pe lungime')}` : ''}
                {boardBandRo(list) ? `; ${boardBandRo(list)}` : ''}
              </caption>
              <thead>
                <tr>
                  <th>{pt('Denumire')}</th>
                  <th>{pt('Gros.')}</th>
                  <th>{pt('Lungime')}</th>
                  <th>{pt('Lățime')}</th>
                  <th>{pt('Buc.')}</th>
                  <th>{pt('Cant L')}</th>
                  <th>{pt('Cant l')}</th>
                  <th>{pt('Găurire')}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.panelIds[0]}>
                    <td>{[...new Set(r.labels.map(partRo))].join(', ')}</td>
                    <td className="n">{r.thickness}</td>
                    <td className="n">{r.length}</td>
                    <td className="n">{r.width}</td>
                    <td className="n">{r.quantity}</td>
                    <td className="n">{r.edgesL}</td>
                    <td className="n">{r.edgesW}</td>
                    <td className="drill">{drillingRo(r.drilling)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
        })}
      </section>

      {hw.length > 0 && (
        <section className="pr-block">
          <h2>{pt('Feronerie')}</h2>
          <table className="pr-table">
            <thead>
              <tr>
                <th>{pt('Buc.')}</th>
                <th>{pt('Articol')}</th>
                <th>{pt('Dimensiune')}</th>
                <th>{pt('Notă')}</th>
              </tr>
            </thead>
            <tbody>
              {hw.map((h, i) => {
                const ro = hardwareRo(h);
                return (
                  <tr key={i}>
                    <td className="n">{h.quantity}</td>
                    <td>{ro.item}</td>
                    <td className="n">{h.sizeMm ? `${h.sizeMm} ${mm}` : ''}</td>
                    <td>{ro.note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="pr-note">
            {pt(
              'Șuruburile și elementele de îmbinare nu sunt incluse, în afara îmbinărilor cu șuruburi numite în proiect (șuruburile le alegeți dvs.).',
            )}
          </p>
        </section>
      )}

      {warnings.length > 0 && (
        <section className="pr-block">
          <h2>{pt('De verificat')}</h2>
          <ul className="pr-warn">
            {warnings.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        </section>
      )}

      {templates.length > 0 && (
        <section className="pr-block pr-templates">
          <h2>{pt('Șabloane la scară 1:1')}</h2>
          <p className="pr-note">
            {pt(
              'Tipăriți la 100% (fără „potrivire în pagină”) și verificați bara de 100 mm. Foile se suprapun {overlap} mm: lipiți-le după marcaje. Linia punctată este semifabricatul din lista de piese.',
              { overlap: OVERLAP },
            )}
          </p>
          <table className="pr-table">
            <thead>
              <tr>
                <th>{pt('Piesă')}</th>
                <th>{pt('Buc.')}</th>
                <th>{pt('Semifabricat')}</th>
                <th>{pt('Puncte (mm, de la colțul stânga-sus)')}</th>
                <th>{pt('Foi')}</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((tp) => (
                <tr key={tp.key}>
                  <td>{partRo(tp.label)}</td>
                  <td className="n">{tp.quantity}</td>
                  <td className="n">
                    {tp.w} × {tp.h}
                  </td>
                  <td className="drill">{tp.points.map(([x, y]) => `${x},${y}`).join(' · ')}</td>
                  <td className="n">{tp.tiles.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {templates.flatMap((tp) =>
            tp.tiles.map((tile) => (
              <div key={`${tp.key}-${tile.col}-${tile.row}`} className="pr-template">
                <h3>
                  {pt('Șablon {part} — foaia {i} din {n} (coloana {col}, rândul {row})', {
                    part: partRo(tp.label),
                    i: tile.row * tp.cols + tile.col + 1,
                    n: tp.tiles.length,
                    col: tile.col + 1,
                    row: tile.row + 1,
                  })}
                </h3>
                <svg
                  width={`${PAGE.w}mm`}
                  height={`${PAGE.h}mm`}
                  viewBox={`${tile.x0} ${tile.y0} ${PAGE.w} ${PAGE.h}`}
                >
                  <rect className="tp-blank" x={0} y={0} width={tp.w} height={tp.h} />
                  <polygon
                    className="tp-cut"
                    points={tp.points.map(([x, y]) => `${x},${y}`).join(' ')}
                  />
                  {[
                    [0, 0],
                    [PAGE.w, 0],
                    [0, PAGE.h],
                    [PAGE.w, PAGE.h],
                  ].map(([dx, dy], k) => (
                    <path
                      key={k}
                      className="tp-mark"
                      d={`M${tile.x0 + dx - 4} ${tile.y0 + dy}h8M${tile.x0 + dx} ${tile.y0 + dy - 4}v8`}
                    />
                  ))}
                  <g
                    className="tp-scale"
                    transform={`translate(${tile.x0 + 8} ${tile.y0 + PAGE.h - 10})`}
                  >
                    <path d="M0 0h100M0 -3v6M100 -3v6" />
                    <text x={50} y={-4} textAnchor="middle">
                      100 {mm}
                    </text>
                  </g>
                </svg>
              </div>
            )),
          )}
        </section>
      )}

      <section className="pr-block pr-sheets">
        <h2>{pt('Plan de debitare')}</h2>
        <p className="pr-note">
          {pt(
            'Așezare euristică pentru tăieturi cap la cap; nu garantează numărul minim de plăci.',
          )}
        </p>
        <table className="pr-table">
          <thead>
            <tr>
              <th>{pt('Plăci')}</th>
              <th>{pt('Material')}</th>
              <th>{pt('Format')}</th>
              <th>{pt('Margine')}</th>
              <th>{pt('Utilizare')}</th>
            </tr>
          </thead>
          <tbody>
            {layouts.results.map((r, i) => {
              const m = view.materials.find((x) => x.id === r.materialId)!;
              return (
                <tr key={r.materialId}>
                  <td className="n">{r.valid ? r.stats.sheetsUsed : '—'}</td>
                  <td>{layouts.jobs[i].materialName}</td>
                  <td className="n">
                    {layouts.jobs[i].sheet.length} × {layouts.jobs[i].sheet.width}
                  </td>
                  <td className="n">
                    {sheetOf(m).trim} {mm}
                  </td>
                  <td className="n">
                    {r.valid ? `${Math.round(r.stats.utilisation * 100)}%` : pt('invalid')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {layouts.results
          .filter((r) => r.valid)
          .map((r, i) => (
            <div key={r.materialId} className="pr-mat">
              {r.sheets.map((s) => (
                <div key={s.index} className="pr-sheet">
                  <h3>
                    {layouts.jobs[i].materialName} —{' '}
                    {pt('placa {i} din {n}', { i: s.index + 1, n: r.sheets.length })}
                  </h3>
                  <SheetSvg
                    sheet={s}
                    color={colorOf(r.materialId)}
                    labelOf={(k) => {
                      const row = labelOf(k);
                      return row ? { ...row, labels: row.labels.map(partRo) } : undefined;
                    }}
                    onHover={() => {}}
                  />
                </div>
              ))}
            </div>
          ))}
      </section>
    </div>
  );
}
