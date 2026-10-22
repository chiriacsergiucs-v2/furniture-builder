import { useEffect, useRef, useState, type ReactNode } from 'react'
import { kerfOf, newId, sheetOf, templates, validateDesign } from '../core/design'
import type { Design, Material } from '../core/types'
import { newProject, validateProject, type Project } from '../core/project'
import { sampleProjects } from '../core/samples/mobila'
import { deleteDesign, deleteProject, listDesigns, listProjects, saveDesign, saveProject, type StoredDesign, type StoredProject } from '../persist/db'
import { useDesign } from '../store/designStore'
import { MmField, Toggle } from './controls'
import { Icon } from './icons'
import { AddPieceList } from './Project'
import { TemplateButton, templateGlyph } from './Templates'

/** Modal shell: header (title + close), scrolling body, optional footer for actions. Esc and backdrop close it. */
function Dialog({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} className="dialog" onClose={onClose} onClick={e => { if (e.target === ref.current) onClose() }} aria-label={title}>
      <header><h2>{title}</h2><button type="button" className="btn icon ghost sm close" onClick={onClose} aria-label="Close"><Icon name="x" /></button></header>
      <div className="dialog-body">{children}</div>
      {footer && <div className="dialog-footer">{footer}</div>}
    </dialog>
  )
}

export function NewDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const load = useDesign(s => s.load)
  const openProject = useDesign(s => s.openProject)
  return (
    <Dialog open={open} onClose={onClose} title="Start something new"
      footer={<p className="hint start">What you have open now is already saved on this device.</p>}>
      <button type="button" className="row-btn" onClick={() => { const p = newProject(); void saveProject(p); openProject(p); onClose() }}>
        <span className="glyph"><Icon name="project" /></span>
        <span><strong>Project with several pieces</strong><span className="sub">A kitchen, a bedroom or a room: place pieces, then get one parts list and one set of sheets.</span></span>
        <Icon name="chevron-right" className="chev sm" />
      </button>
      <h3 className="list-head">Mobila rooms</h3>
      <ul className="template-list">
        {sampleProjects.map(sp => (
          <li key={sp.id}>
            <button type="button" className="row-btn" onClick={() => {
              const now = new Date().toISOString()
              const p = { ...sp.create(), id: newId(), createdAt: now, updatedAt: now }
              void saveProject(p); openProject(p); onClose()
            }}>
              <span className="glyph"><Icon name="project" /></span>
              <span><strong>{sp.name}</strong><span className="sub">{sp.description}</span></span>
              <Icon name="chevron-right" className="chev sm" />
            </button>
          </li>
        ))}
      </ul>
      <h3 className="list-head">Or a single piece</h3>
      <ul className="template-list template-grid">
        {templates.map(t => <li key={t.id}><TemplateButton t={t} onPick={() => { load(t.create()); onClose() }} /></li>)}
      </ul>
    </Dialog>
  )
}

export function AddPieceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Add a piece to the project">
      {open && <AddPieceList onDone={onClose} />}
    </Dialog>
  )
}

export function LibraryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const load = useDesign(s => s.load)
  const openProject = useDesign(s => s.openProject)
  const currentId = useDesign(s => (s.project ? s.project.id : s.design.id))
  const [rows, setRows] = useState<StoredDesign[] | null>(null)
  const [projects, setProjects] = useState<StoredProject[]>([])
  const [error, setError] = useState<string | null>(null)
  const refresh = () => {
    listDesigns().then(setRows).catch(() => setError('Saved pieces could not be read from this browser.'))
    listProjects().then(setProjects).catch(() => setProjects([]))
  }
  useEffect(() => { if (open) refresh() }, [open])

  const importFile = async (f: File) => {
    try {
      const data: unknown = JSON.parse(await f.text())
      if (data && typeof data === 'object' && 'items' in data) {
        const perrs = validateProject(data)
        if (perrs.length) { setError(`That file is not a valid project: ${perrs.slice(0, 3).join('; ')}.`); return }
        const p = { ...(data as Project), id: newId(), updatedAt: new Date().toISOString() }
        await saveProject(p)
        openProject(p); onClose(); return
      }
      const errs = validateDesign(data)
      if (errs.length) { setError(`That file is not a valid design: ${errs.slice(0, 3).join('; ')}.`); return }
      const d = data as Design
      const copy = { ...d, id: newId(), updatedAt: new Date().toISOString() }
      await saveDesign(copy)
      load(copy); onClose()
    } catch { setError('That file could not be read as JSON.') }
  }

  const when = (iso: string) => new Date(iso).toLocaleString()
  const dup = (r: StoredDesign | StoredProject, kind: 'piece' | 'project') => async () => {
    const now = new Date().toISOString()
    if (kind === 'project') { const p = (r as StoredProject).project; await saveProject({ ...p, id: newId(), name: `${r.name} (copy)`, createdAt: now, updatedAt: now }) }
    else { const d = (r as StoredDesign).design; await saveDesign({ ...d, id: newId(), name: `${r.name} (copy)`, createdAt: now, updatedAt: now }) }
    refresh()
  }
  const rowActions = (r: StoredDesign | StoredProject, kind: 'piece' | 'project') => (
    <>
      <button type="button" className="btn sm" onClick={dup(r, kind)} title="Duplicate"><Icon name="copy" className="sm" /><span className="lbl">Duplicate</span></button>
      <button type="button" className="btn sm danger" disabled={r.id === currentId} title={r.id === currentId ? (kind === 'project' ? 'Open something else first' : 'Open another piece first') : 'Delete'}
        onClick={async () => {
          if (!confirm(kind === 'project' ? `Delete project “${r.name}”? This cannot be undone.` : `Delete “${r.name}”? This cannot be undone.`)) return
          if (kind === 'project') await deleteProject(r.id); else await deleteDesign(r.id)
          refresh()
        }}><Icon name="trash" className="sm" /><span className="lbl">Delete</span></button>
    </>
  )

  return (
    <Dialog open={open} onClose={onClose} title="Saved on this device"
      footer={<label className="btn outline file-btn"><Icon name="upload" />Import a design or project file
        <input type="file" accept="application/json,.json" onChange={e => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = '' }} />
      </label>}>
      {error && <p className="alert error" role="alert"><Icon name="alert-circle" className="sm" /><span>{error}</span></p>}
      {projects.length > 0 && (
        <>
          <h3 className="list-head">Projects</h3>
          <ul className="library">
            {projects.map(r => (
              <li key={r.id} className={r.id === currentId ? 'current' : ''}>
                <button type="button" className="row-btn" aria-current={r.id === currentId ? 'true' : undefined} onClick={() => { openProject(r.project); onClose() }}>
                  <span className="glyph"><Icon name="project" /></span>
                  <span><strong>{r.name}</strong><span className="sub">{r.project.items.length} {r.project.items.length === 1 ? 'piece' : 'pieces'}, edited {when(r.updatedAt)}</span></span>
                </button>
                {rowActions(r, 'project')}
              </li>
            ))}
          </ul>
          <h3 className="list-head">Pieces</h3>
        </>
      )}
      {rows === null ? <p className="loading">Loading…</p> : rows.length === 0 ? (
        <p className="empty center"><Icon name="folder" />Nothing saved yet. Pieces save automatically as you edit.</p>
      ) : (
        <ul className="library">
          {rows.map(r => (
            <li key={r.id} className={r.id === currentId ? 'current' : ''}>
              <button type="button" className="row-btn" aria-current={r.id === currentId ? 'true' : undefined} onClick={() => { load(r.design, { fromStorage: true }); onClose() }}>
                <span className="glyph"><Icon name={templateGlyph(r.design.product.kind)} /></span>
                <span><strong>{r.name}</strong><span className="sub">{({ desk: 'Desk', corner: 'Corner unit', cabinet: 'Cabinet', panels: 'Loose panels' } as const)[r.design.product.kind]}, edited {when(r.updatedAt)}</span></span>
              </button>
              {rowActions(r, 'piece')}
            </li>
          ))}
        </ul>
      )}
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
    <Dialog open={open} onClose={onClose} title="Materials in this piece"
      footer={<>
        <p className="hint start">Changing a thickness rebuilds every part made from that board.</p>
        <button type="button" className="btn outline" onClick={() => add({ id: newId(), name: 'New board', thickness: 18, grain: false, color: '#d8d4cc' })}><Icon name="plus" />Add a material</button>
      </>}>
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
    </Dialog>
  )
}
