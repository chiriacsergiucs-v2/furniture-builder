import { useEffect, useRef, useState, type ReactNode } from 'react'
import { kerfOf, newId, sheetOf, templates, validateDesign } from '../core/design'
import type { Design, Material } from '../core/types'
import { deleteDesign, listDesigns, saveDesign, type StoredDesign } from '../persist/db'
import { useDesign } from '../store/designStore'
import { MmField, Toggle } from './controls'

function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} className="dialog" onClose={onClose} onClick={e => { if (e.target === ref.current) onClose() }} aria-label={title}>
      <header><h2>{title}</h2><button type="button" className="close" onClick={onClose} aria-label="Close">×</button></header>
      <div className="dialog-body">{children}</div>
    </dialog>
  )
}

export function NewDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const load = useDesign(s => s.load)
  return (
    <Dialog open={open} onClose={onClose} title="Start a new piece">
      <ul className="template-list">
        {templates.map(t => (
          <li key={t.id}>
            <button type="button" onClick={() => { load(t.create()); onClose() }}>
              <strong>{t.name}</strong>
              <span>{t.description}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="hint">Your current piece is already saved on this device.</p>
    </Dialog>
  )
}

export function LibraryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const load = useDesign(s => s.load)
  const currentId = useDesign(s => s.design.id)
  const [rows, setRows] = useState<StoredDesign[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const refresh = () => listDesigns().then(setRows).catch(() => setError('Saved pieces could not be read from this browser.'))
  useEffect(() => { if (open) refresh() }, [open])

  const importFile = async (f: File) => {
    try {
      const data: unknown = JSON.parse(await f.text())
      const errs = validateDesign(data)
      if (errs.length) { setError(`That file is not a valid design: ${errs.slice(0, 3).join('; ')}.`); return }
      const d = data as Design
      const copy = { ...d, id: newId(), updatedAt: new Date().toISOString() }
      await saveDesign(copy)
      load(copy); onClose()
    } catch { setError('That file could not be read as JSON.') }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Saved pieces">
      {error && <p className="field-error" role="alert">{error}</p>}
      {rows === null ? <p className="hint">Loading…</p> : rows.length === 0 ? (
        <p className="empty">Nothing saved yet. Pieces save automatically as you edit.</p>
      ) : (
        <ul className="library">
          {rows.map(r => (
            <li key={r.id} className={r.id === currentId ? 'current' : ''}>
              <button type="button" className="open" onClick={() => { load(r.design, { fromStorage: true }); onClose() }}>
                <strong>{r.name}</strong>
                <span>{({ desk: 'Desk', corner: 'Corner unit', cabinet: 'Cabinet' } as const)[r.design.product.kind]}, edited {new Date(r.updatedAt).toLocaleString()}</span>
              </button>
              <button type="button" className="mini" onClick={async () => {
                const now = new Date().toISOString()
                await saveDesign({ ...r.design, id: newId(), name: `${r.name} (copy)`, createdAt: now, updatedAt: now }); refresh()
              }}>Duplicate</button>
              <button type="button" className="mini danger" disabled={r.id === currentId} title={r.id === currentId ? 'Open another piece first' : undefined}
                onClick={async () => { if (confirm(`Delete “${r.name}”? This cannot be undone.`)) { await deleteDesign(r.id); refresh() } }}>Delete</button>
            </li>
          ))}
        </ul>
      )}
      <label className="file-btn">
        Import a design file
        <input type="file" accept="application/json,.json" onChange={e => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = '' }} />
      </label>
    </Dialog>
  )
}

export function MaterialsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const materials = useDesign(s => s.design.materials)
  const kerf = useDesign(s => kerfOf(s.design))
  const setKerf = useDesign(s => s.setKerf)
  const update = useDesign(s => s.updateMaterial)
  const add = useDesign(s => s.addMaterial)
  return (
    <Dialog open={open} onClose={onClose} title="Materials in this piece">
      <MmField label="Saw cut (kerf)" value={kerf} min={0} max={20} step={1} onChange={setKerf} hint="Material lost in every cut. Sheet length runs along the grain." />
      <ul className="materials">
        {materials.map((m: Material) => (
          <li key={m.id}>
            <input type="color" aria-label={`${m.name} colour`} value={m.color} onChange={e => update(m.id, { color: e.target.value })} />
            <input className="mat-name" aria-label="Name" defaultValue={m.name} key={m.name} onBlur={e => e.target.value.trim() && update(m.id, { name: e.target.value.trim() })} />
            <MmField label="Thickness" value={m.thickness} min={1} max={60} step={1} onChange={v => update(m.id, { thickness: v })} />
            <Toggle label="Has grain" checked={m.grain} onChange={v => update(m.id, { grain: v })} />
            <div className="sheet-fields">
              <MmField label="Sheet length" value={sheetOf(m).length} min={300} max={6000} onChange={v => update(m.id, { sheet: { ...sheetOf(m), length: v } })} />
              <MmField label="Sheet width" value={sheetOf(m).width} min={300} max={3000} onChange={v => update(m.id, { sheet: { ...sheetOf(m), width: v } })} />
              <MmField label="Trim each edge" value={sheetOf(m).trim} min={0} max={50} step={1} onChange={v => update(m.id, { sheet: { ...sheetOf(m), trim: v } })} />
              <MmField label="Sheets in stock" unit="" value={sheetOf(m).count ?? 0} min={0} max={999} step={1} hint="0 = buy as needed"
                onChange={v => update(m.id, { sheet: { ...sheetOf(m), count: v === 0 ? null : v } })} />
            </div>
          </li>
        ))}
      </ul>
      <button type="button" className="secondary" onClick={() => add({ id: newId(), name: 'New board', thickness: 18, grain: false, color: '#d8d4cc' })}>Add a material</button>
      <p className="hint">Changing a thickness rebuilds every part made from that board.</p>
    </Dialog>
  )
}
