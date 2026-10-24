import { useEffect, useMemo, useState } from 'react'
import { CURRENCY_ID, DEFAULT_CURRENCY, estimate, formatMoney, linePrice, parseMoney, parsePricesCsv, pricesCsv, unitsFor, type PriceEntry } from '../core/prices'
import { NOT_COUNTED, shoppingCsvRo, shoppingList, type ShopLine, type ShopSection, type ShopUnit } from '../core/shopping'
import { listPrices, savePrice, savePrices } from '../persist/db'
import { useDesign } from '../store/designStore'
import { Icon } from './icons'
import { useNesting } from './useNesting'
import { useView } from './useView'

const SECTIONS: { id: ShopSection; title: string }[] = [
  { id: 'boards', title: 'Boards' }, { id: 'banding', title: 'Edge banding' }, { id: 'hardware', title: 'Hardware' },
  { id: 'run', title: 'Run parts' }, { id: 'choose', title: 'To choose before buying' },
]
const UNIT: Record<ShopUnit, string> = { sheet: 'sheets', m2: 'm²', m: 'm', piece: 'pcs' }
const PER: Record<ShopUnit, string> = { sheet: 'per sheet', m2: 'per m²', m: 'per m', piece: 'per piece' }

function save(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  Object.assign(document.createElement('a'), { href: url, download: name }).click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Shopping list (ADR-0061) with the cost estimate from the user's own prices (ADR-0059): boards in sheets from the
 * layout (or m²), banding, hardware, run parts, and what is still to choose. Saved prices stay on this device.
 */
export function ShoppingList() {
  const view = useView()
  const runParts = useDesign(s => (s.project && !s.editingItemId ? s.project.runParts : undefined))
  const n = useNesting(true)
  const [prices, setPrices] = useState<PriceEntry[]>([])
  const [editing, setEditing] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => { listPrices().then(setPrices).catch(() => setMsg('Prices could not be read from this browser.')) }, [])
  const sheets = useMemo(() => (n.status === 'done' ? new Map(n.results.filter(r => r.valid).map(r => [r.materialId, r.stats.sheetsUsed])) : null), [n])
  const lines = useMemo(() => shoppingList({ rows: view.rows, materials: view.materials, hardware: view.hardware, sheets, runParts, diagnostics: view.diagnostics }), [view, sheets, runParts])
  const map = useMemo(() => new Map(prices.map(p => [p.id, p])), [prices])
  const currency = map.get(CURRENCY_ID)?.text ?? DEFAULT_CURRENCY
  const est = useMemo(() => estimate(lines, prices), [lines, prices])
  const setPrice = (e: PriceEntry) => { setPrices(ps => [...ps.filter(p => p.id !== e.id), e]); void savePrice(e).catch(() => setMsg('The price could not be saved on this device.')) }
  const importCsv = async (f: File) => {
    const r = parsePricesCsv(await f.text())
    if (!r.prices.length) { setMsg(`No prices imported. ${r.problems.slice(0, 3).join(' ')}`); return }
    await savePrices(r.prices)
    setPrices(await listPrices())
    setMsg(`${r.prices.length} prices imported${r.problems.length ? `, ${r.problems.length} rows skipped: ${r.problems.slice(0, 3).join(' ')}` : ''}.`)
  }
  const printList = () => {
    const w = window.open('', '_blank')
    if (!w) return
    const rowsHtml = SECTIONS.map(s => {
      const ls = lines.filter(l => l.section === s.id)
      return ls.length ? `<h2>${s.title}</h2><table><tr><th>Qty</th><th>Item</th><th>Details</th><th>Price</th></tr>${ls.map(l => { const p = linePrice(l, map); return `<tr><td>${l.quantity} ${UNIT[l.unit]}</td><td>${esc(l.label)}</td><td>${esc(l.detail)}</td><td>${p === null ? '' : `${formatMoney(p)} ${esc(currency)}`}</td></tr>` }).join('')}</table>` : ''
    }).join('')
    w.document.write(`<!doctype html><meta charset="utf-8"><title>Shopping list — ${esc(view.title)}</title><style>body{font:12px sans-serif;margin:16px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:3px 6px;text-align:left}h2{font-size:14px;margin:14px 0 4px}</style><h1>Shopping list — ${esc(view.title)}</h1>${rowsHtml}<p>${esc(NOT_COUNTED)}</p><p>Estimate: ${formatMoney(est.total)} ${esc(currency)}${est.missing.length ? ` — ${est.missing.length} prices missing` : ''} (your prices)</p>`)
    w.document.close(); w.focus(); w.print()
  }
  const blocked = view.diagnostics.some(d => d.severity === 'error')
  return (
    <div className="shopping">
      {blocked && <p className="alert error blocked"><Icon name="alert-circle" className="sm" /><span>Fix the problems under Checks first; sheets are counted only for a valid design. Boards are shown in m² until then.</span></p>}
      <p className="estimate" role="status">
        <strong>Estimate: {formatMoney(est.total)} {currency}</strong>
        {est.missing.length ? <span className="warn"> — {est.missing.length} {est.missing.length === 1 ? 'price' : 'prices'} missing (incomplete)</span> : est.priced ? <span> — every line priced</span> : null}
        <span className="hint"> · your prices, saved on this device</span>
      </p>
      <div className="split-actions">
        <button type="button" className="btn sm" aria-pressed={editing} onClick={() => setEditing(v => !v)}><Icon name="pencil" className="sm" />{editing ? 'Done with prices' : 'Prices'}</button>
        <button type="button" className="btn sm" onClick={() => save(`${view.title}-shopping.csv`, shoppingCsvRo(lines, l => linePrice(l, map), currency), 'text/csv;charset=utf-8')}><Icon name="download" className="sm" />Shopping list CSV</button>
        <button type="button" className="btn sm" onClick={printList}><Icon name="printer" className="sm" />Print shopping list</button>
      </div>
      {editing && (
        <div className="price-tools">
          <label className="field"><span>Currency</span><input defaultValue={currency} onBlur={e => { const t = e.target.value.trim(); if (t) setPrice({ id: CURRENCY_ID, unit: 'piece', amount: 0, text: t }) }} /></label>
          <button type="button" className="btn sm" onClick={() => save('my-prices.csv', pricesCsv(prices), 'text/csv;charset=utf-8')} disabled={!prices.length}><Icon name="download" className="sm" />Export prices</button>
          <label className="btn sm file-btn"><Icon name="upload" className="sm" />Import prices
            <input type="file" accept=".csv,text/csv,text/plain" onChange={e => { const f = e.target.files?.[0]; if (f) void importCsv(f); e.target.value = '' }} />
          </label>
        </div>
      )}
      {msg && <p className="hint" role="status">{msg}</p>}
      {SECTIONS.map(s => {
        const ls = lines.filter(l => l.section === s.id)
        if (!ls.length) return null
        return (
          <section key={s.id} aria-label={s.title}>
            <h3 className="list-head">{s.title}</h3>
            <table className="cut shop">
              <thead><tr><th scope="col">Qty</th><th scope="col">Item</th><th scope="col">Details</th>{s.id !== 'run' && s.id !== 'choose' && <th scope="col">Price</th>}</tr></thead>
              <tbody>
                {ls.map((l, i) => <Line key={`${l.label}-${i}`} l={l} map={map} currency={currency} editing={editing} onPrice={setPrice} />)}
              </tbody>
            </table>
          </section>
        )
      })}
      <p className="hint">{NOT_COUNTED}</p>
    </div>
  )
}

function Line({ l, map, currency, editing, onPrice }: { l: ShopLine; map: Map<string, PriceEntry>; currency: string; editing: boolean; onPrice: (e: PriceEntry) => void }) {
  const e = l.priceKey ? map.get(l.priceKey) : undefined
  const units = unitsFor(l)
  const [unit, setUnit] = useState<ShopUnit>(e?.unit && units.includes(e.unit) ? e.unit : units[0])
  const [bad, setBad] = useState(false)
  const p = linePrice(l, map)
  const priced = l.section !== 'run' && l.section !== 'choose'
  return (
    <tr>
      <td className="num">{l.unit === 'sheet' || l.unit === 'piece' ? l.quantity : l.quantity.toFixed(2)} {UNIT[l.unit]}</td>
      <td>{l.label}</td>
      <td className="note">{l.detail}</td>
      {priced && <td className="num">
        {editing && l.priceKey ? (
          <span className="price-edit">
            <input aria-label={`Price of ${l.label}`} inputMode="decimal" defaultValue={e && e.unit === unit ? (e.amount / 100).toFixed(2) : ''} className={bad ? 'bad' : undefined}
              onBlur={ev => { const a = parseMoney(ev.target.value); setBad(ev.target.value.trim() !== '' && a === null); if (a !== null) onPrice({ id: l.priceKey!, unit, amount: a }) }} />
            {units.length > 1 ? (
              <select aria-label={`Price unit of ${l.label}`} value={unit} onChange={ev => setUnit(ev.target.value as ShopUnit)}>{units.map(u => <option key={u} value={u}>{PER[u]}</option>)}</select>
            ) : <span>{PER[unit]}</span>}
          </span>
        ) : p === null ? <span className="hint">{l.priceKey && e && e.unit === 'sheet' && l.sheets == null ? 'sheets not laid out' : 'price missing'}</span> : `${formatMoney(p)} ${currency}`}
      </td>}
    </tr>
  )
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
