import { useMemo } from 'react'
import { cutlist, edgeBandMeters, hardwareSummary, areaM2 } from '../core/cutlist'
import { kerfOf, sheetOf } from '../core/design'
import { nest } from '../core/nesting'
import { nestingJobs } from '../core/nesting/fromDesign'
import { drillingRo, hardwareRo, partRo } from '../core/ro'
import { useDesign } from '../store/designStore'
import { Elevation } from './Elevation'
import { SheetSvg } from './Sheets'

/**
 * Printable cutting sheet for the panel shop, in Romanian, A4 portrait (ADR-0020). Rendered only while printing;
 * everything comes from the model and the cut list — no geometry is computed here.
 */
export function PrintSheet() {
  const design = useDesign(s => s.design)
  const model = useDesign(s => s.model)
  const rows = useMemo(() => cutlist(model, design.materials), [model, design.materials])
  const bands = useMemo(() => edgeBandMeters(model, design.materials), [model, design.materials])
  const hw = useMemo(() => hardwareSummary(model), [model])
  const layouts = useMemo(() => {
    const { jobs, rows: r } = nestingJobs(design, model)
    return { jobs, rows: r, results: jobs.map(j => nest(j)) }
  }, [design, model])
  const b = model.bounds
  const byMat = [...new Set(rows.map(r => r.materialId))]
  const warnings = model.diagnostics.filter(d => d.severity === 'warning')
  const labelOf = (key: string) => layouts.rows.find(r => r.panelIds[0] === key)

  return (
    <div className="print-root" aria-hidden="true">
      <header className="pr-head">
        <h1>{design.name}</h1>
        <p>Fișă de debitare · {new Date().toLocaleDateString('ro-RO')} · gabarit {b.w} × {b.h} × {b.d} mm</p>
        <p className="pr-note">Dimensiuni finite, în mm. Cantul este marcat (L = pe lungime, l = pe lățime), nu scăzut din dimensiuni. Fibra urmează lungimea la plăcile cu fibră. Tăietură {kerfOf(design)} mm.</p>
      </header>

      <section className="pr-block pr-elev">
        <h2>Vedere frontală</h2>
        <Elevation />
      </section>

      <section className="pr-block">
        <h2>Listă de piese</h2>
        {byMat.map(mid => {
          const list = rows.filter(r => r.materialId === mid)
          return (
            <table key={mid} className="pr-table">
              <caption>{list[0].materialName} — {areaM2(rows, mid).toFixed(2)} m²{bands.get(mid) ? `, cant ${bands.get(mid)!.toFixed(1)} m` : ''}{list[0].grain ? ', fibră pe lungime' : ''}</caption>
              <thead><tr><th>Denumire</th><th>Gros.</th><th>Lungime</th><th>Lățime</th><th>Buc.</th><th>Cant L</th><th>Cant l</th><th>Găurire</th></tr></thead>
              <tbody>
                {list.map(r => (
                  <tr key={r.panelIds[0]}>
                    <td>{[...new Set(r.labels.map(partRo))].join(', ')}</td>
                    <td className="n">{r.thickness}</td><td className="n">{r.length}</td><td className="n">{r.width}</td>
                    <td className="n">{r.quantity}</td><td className="n">{r.edgesL}</td><td className="n">{r.edgesW}</td>
                    <td className="drill">{drillingRo(r.drilling)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        })}
      </section>

      {hw.length > 0 && (
        <section className="pr-block">
          <h2>Feronerie</h2>
          <table className="pr-table">
            <thead><tr><th>Buc.</th><th>Articol</th><th>Dimensiune</th><th>Notă</th></tr></thead>
            <tbody>
              {hw.map((h, i) => { const ro = hardwareRo(h); return <tr key={i}><td className="n">{h.quantity}</td><td>{ro.item}</td><td className="n">{h.sizeMm ? `${h.sizeMm} mm` : ''}</td><td>{ro.note}</td></tr> })}
            </tbody>
          </table>
          <p className="pr-note">Șuruburile și elementele de îmbinare nu sunt incluse.</p>
        </section>
      )}

      {warnings.length > 0 && (
        <section className="pr-block">
          <h2>De verificat</h2>
          <ul className="pr-warn">{warnings.map((w, i) => <li key={i}>{w.message}</li>)}</ul>
        </section>
      )}

      <section className="pr-block pr-sheets">
        <h2>Plan de debitare</h2>
        <p className="pr-note">Așezare euristică pentru tăieturi cap la cap; nu garantează numărul minim de plăci.</p>
        <table className="pr-table">
          <thead><tr><th>Plăci</th><th>Material</th><th>Format</th><th>Margine</th><th>Utilizare</th></tr></thead>
          <tbody>
            {layouts.results.map((r, i) => {
              const m = design.materials.find(x => x.id === r.materialId)!
              return <tr key={r.materialId}><td className="n">{r.valid ? r.stats.sheetsUsed : '—'}</td><td>{layouts.jobs[i].materialName}</td><td className="n">{layouts.jobs[i].sheet.length} × {layouts.jobs[i].sheet.width}</td><td className="n">{sheetOf(m).trim} mm</td><td className="n">{r.valid ? `${Math.round(r.stats.utilisation * 100)}%` : 'invalid'}</td></tr>
            })}
          </tbody>
        </table>
        {layouts.results.filter(r => r.valid).map((r, i) => (
          <div key={r.materialId} className="pr-mat">
            {r.sheets.map(s => (
              <div key={s.index} className="pr-sheet">
                <h3>{layouts.jobs[i].materialName} — placa {s.index + 1} din {r.sheets.length}</h3>
                <SheetSvg sheet={s} color={design.materials.find(m => m.id === r.materialId)?.color ?? '#ddd'} labelOf={k => { const row = labelOf(k); return row ? { ...row, labels: row.labels.map(partRo) } : undefined }} onHover={() => {}} />
              </div>
            ))}
          </div>
        ))}
      </section>
    </div>
  )
}
