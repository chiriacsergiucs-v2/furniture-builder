import { useMemo } from 'react'
import { areaM2, cutlist, edgeBandMeters, hardwareSummary } from '../core/cutlist'
import { useDesign, type Tab } from '../store/designStore'

export function Output() {
  const tab = useDesign(s => s.tab)
  const setTab = useDesign(s => s.setTab)
  const model = useDesign(s => s.model)
  const errors = model.diagnostics.filter(d => d.severity === 'error').length
  const warnings = model.diagnostics.length - errors
  const tabs: { id: Tab; label: string; badge?: number; kind?: string }[] = [
    { id: 'parts', label: 'Parts' },
    { id: 'hardware', label: 'Hardware' },
    { id: 'checks', label: 'Checks', badge: errors || warnings || undefined, kind: errors ? 'error' : 'warning' },
  ]
  return (
    <section className="output" aria-label="Results">
      <div className="tabs" role="tablist">
        {tabs.map(t => (
          <button key={t.id} role="tab" type="button" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`}
            className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.label}{t.badge ? <span className={`badge ${t.kind}`}>{t.badge}</span> : null}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="tabpanel">
        {tab === 'parts' && <Parts />}
        {tab === 'hardware' && <Hardware />}
        {tab === 'checks' && <Checks />}
      </div>
    </section>
  )
}

function Parts() {
  const model = useDesign(s => s.model)
  const materials = useDesign(s => s.design.materials)
  const setHighlight = useDesign(s => s.setHighlight)
  const highlight = useDesign(s => s.highlight)
  const rows = useMemo(() => cutlist(model, materials), [model, materials])
  const bands = useMemo(() => edgeBandMeters(model, materials), [model, materials])
  const blocked = model.diagnostics.some(d => d.severity === 'error')
  const byMat = useMemo(() => {
    const m = new Map<string, typeof rows>()
    for (const r of rows) m.set(r.materialId, [...(m.get(r.materialId) ?? []), r])
    return [...m.entries()]
  }, [rows])
  const total = rows.reduce((n, r) => n + r.quantity, 0)

  return (
    <div className="parts">
      {blocked && <p className="blocked">This design has problems (see Checks). Fix them before cutting.</p>}
      <p className="summary">{total} parts in {byMat.length} {byMat.length === 1 ? 'material' : 'materials'}. Sizes are finished sizes; edges marked for banding.</p>
      {byMat.map(([mid, list]) => {
        const name = list[0].materialName
        return (
          <table key={mid} className="cut">
            <caption>
              <strong>{name}</strong>
              <span>{areaM2(rows, mid).toFixed(2)} m²{bands.get(mid) ? `, ${bands.get(mid)!.toFixed(1)} m edge band` : ''}{list[0].grain ? ', grain along length' : ''}</span>
            </caption>
            <thead><tr><th scope="col">Qty</th><th scope="col">Length</th><th scope="col">Width</th><th scope="col">Edges</th><th scope="col">Part</th></tr></thead>
            <tbody>
              {list.map(r => {
                const on = r.panelIds.some(id => highlight.includes(id))
                return (
                  <tr key={r.panelIds[0]} className={on ? 'on' : ''} tabIndex={0}
                    onMouseEnter={() => setHighlight(r.panelIds)} onMouseLeave={() => setHighlight([])}
                    onFocus={() => setHighlight(r.panelIds)} onBlur={() => setHighlight([])}>
                    <td className="num">{r.quantity}</td>
                    <td className="num">{r.length}</td>
                    <td className="num">{r.width}</td>
                    <td><EdgeMark l={r.edgesL} w={r.edgesW} /></td>
                    <td className="labels">{r.labels.join(', ')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )
      })}
    </div>
  )
}

/** Small rectangle with the banded edges drawn heavy: long sides = length edges, short sides = width edges. */
function EdgeMark({ l, w }: { l: number; w: number }) {
  return (
    <span className="edgemark" title={`Banded: ${l} along length, ${w} along width`}>
      <svg viewBox="0 0 30 16" aria-hidden="true">
        <rect x="3" y="3" width="24" height="10" className="e-body" />
        <line x1="3" y1="3" x2="27" y2="3" className={l >= 1 ? 'e-on' : 'e-off'} />
        <line x1="3" y1="13" x2="27" y2="13" className={l >= 2 ? 'e-on' : 'e-off'} />
        <line x1="3" y1="3" x2="3" y2="13" className={w >= 1 ? 'e-on' : 'e-off'} />
        <line x1="27" y1="3" x2="27" y2="13" className={w >= 2 ? 'e-on' : 'e-off'} />
      </svg>
      <span className="e-text">L{l} W{w}</span>
    </span>
  )
}

function Hardware() {
  const model = useDesign(s => s.model)
  const items = hardwareSummary(model)
  if (!items.length) return <p className="empty">No hardware needed yet. Add drawers, doors or a hanging rail.</p>
  return (
    <div className="hardware">
      <table className="cut">
        <thead><tr><th scope="col">Qty</th><th scope="col">Item</th><th scope="col">Size</th><th scope="col">Note</th></tr></thead>
        <tbody>
          {items.map((h, i) => (
            <tr key={i}><td className="num">{h.quantity}</td><td>{h.label}</td><td className="num">{h.sizeMm ? `${h.sizeMm} mm` : ''}</td><td className="note">{h.note}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="hint">Screws, connectors and handles are not listed. Hinge counts follow common guidance; your hinge maker's datasheet decides.</p>
    </div>
  )
}

function Checks() {
  const diags = useDesign(s => s.model.diagnostics)
  const select = useDesign(s => s.select)
  const productId = useDesign(s => s.design.product.id)
  const setHighlight = useDesign(s => s.setHighlight)
  if (!diags.length) return <p className="empty ok">No problems found. Parts fit, nothing overlaps, every size is a whole millimetre.</p>
  const sorted = [...diags].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1))
  return (
    <ul className="checks">
      {sorted.map((d, i) => (
        <li key={i} className={d.severity}>
          <button type="button" onClick={() => { select(d.nodeId && d.nodeId !== productId ? d.nodeId : null); setHighlight(d.panelIds ?? []) }}>
            <span className="sev">{d.severity === 'error' ? 'Problem' : 'Check'}</span>
            <span>{d.message}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
