import { useEffect, useRef, useState, type ReactNode } from 'react'
import { kerfOf, newId, sheetOf, validateDesign } from '../core/design'
import type { Design, Material, MaterialKind, MaterialMaker } from '../core/types'
import { DECOR_COLUMNS, decorPatch, KINDS, MAKERS, parseDecorList, type Decor } from '../core/materials'
import { newProject, validateProject, type Project } from '../core/project'
import { sampleProjects } from '../core/samples/mobila'
import { clearDecors, deleteDesign, deleteImages, deleteProject, listDecors, replaceDecors, unusedImageIds, listDesigns, listProjects, saveDesign, saveProject, type StoredDesign, type StoredProject } from '../persist/db'
import { useDesign } from '../store/designStore'
import { MmField, Select, Toggle } from './controls'
import { Icon } from './icons'
import { AddPieceList } from './Project'
import { templateGlyph } from './Templates'
import { StartFrom } from './Catalog'
import { askConfirm } from './Confirm'
import { importImage, takePictures, useImageUrls } from '../persist/images'
import { imageIdsOf, MAX_TILE } from '../core/surface'

/** Modal shell: header (title + close), scrolling body, optional footer for actions. Esc and backdrop close it. */
export function Dialog({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} className={`dialog ${wide ? 'wide' : ''}`} onClose={onClose} onClick={e => { if (e.target === ref.current) onClose() }} aria-label={title}>
      <header><h2>{title}</h2><button type="button" className="btn icon ghost sm close" onClick={onClose} aria-label="Close"><Icon name="x" /></button></header>
      <div className="dialog-body">{children}</div>
      {footer && <div className="dialog-footer">{footer}</div>}
    </dialog>
  )
}

/**
 * Projects shipped with the app (the Mobila rooms): on every deployed copy, no import needed. Each opens as a new
 * project of the user's own, saved on this device; the shipped one never changes.
 */
export function BuiltInProjects({ onOpened }: { onOpened: () => void }) {
  const openProject = useDesign(s => s.openProject)
  return (
    <>
      <h3 className="list-head">Built in the app</h3>
      <p className="hint">Mobila rooms, available on the deployed app. Each opens as your own copy.</p>
      <ul className="template-list">
        {sampleProjects.map(sp => (
          <li key={sp.id}>
            <button type="button" className="row-btn" onClick={() => {
              const now = new Date().toISOString()
              const p = { ...sp.create(), id: newId(), createdAt: now, updatedAt: now }
              void saveProject(p); openProject(p); onOpened()
            }}>
              <span className="glyph"><Icon name="project" /></span>
              <span><strong>{sp.name}</strong><span className="sub">{sp.description}</span></span>
              <Icon name="chevron-right" className="chev sm" />
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

export function NewDialog({ open, onClose, onBrowse, onWizard, onOpened }: { open: boolean; onClose: () => void; onBrowse?: () => void; onWizard?: () => void; onOpened?: () => void }) {
  const load = useDesign(s => s.load)
  const openProject = useDesign(s => s.openProject)
  const opened = () => { onClose(); onOpened?.() }
  return (
    <Dialog open={open} onClose={onClose} title="Start something new"
      footer={<p className="hint start">What you have open now is already saved on this device.</p>}>
      {onWizard && (
        <button type="button" className="row-btn" onClick={onWizard}>
          <span className="glyph"><Icon name="plus" /></span>
          <span><strong>New piece, step by step</strong><span className="sub">Size, type, then only the questions that apply (dividers, shelves, drawers, doors, base), with suggested combinations. Saved to the Catalog.</span></span>
          <Icon name="chevron-right" className="chev sm" />
        </button>
      )}
      <button type="button" className="row-btn" onClick={() => { const p = newProject(); void saveProject(p); openProject(p); opened() }}>
        <span className="glyph"><Icon name="project" /></span>
        <span><strong>Project with several pieces</strong><span className="sub">A kitchen, a bedroom or a room: place pieces, then get one parts list and one set of sheets.</span></span>
        <Icon name="chevron-right" className="chev sm" />
      </button>
      <BuiltInProjects onOpened={opened} />
      {open && <StartFrom onPick={d => { load(d); opened() }} onBrowse={onBrowse} />}
    </Dialog>
  )
}

export function AddPieceDialog({ open, onClose, onBrowse }: { open: boolean; onClose: () => void; onBrowse?: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Add a piece to the project">
      {open && <AddPieceList onDone={onClose} onBrowse={onBrowse} />}
    </Dialog>
  )
}

export function LibraryDialog({ open, onClose, onOpened }: { open: boolean; onClose: () => void; onOpened?: () => void }) {
  const load = useDesign(s => s.load)
  const openProject = useDesign(s => s.openProject)
  const currentId = useDesign(s => (s.project ? s.project.id : s.design.id))
  const opened = () => { onClose(); onOpened?.() }
  const [rows, setRows] = useState<StoredDesign[] | null>(null)
  const [cleanMsg, setCleanMsg] = useState<string | null>(null)
  const cleanUp = async () => {
    const st = useDesign.getState()
    const keep = imageIdsOf([st.design, ...(st.project?.items.map(i => i.design) ?? []), { materials: (st.project?.runParts ?? []).map(r => r.material) }])
    try {
      const ids = await unusedImageIds(keep)
      if (!ids.length) { setCleanMsg('No unused pictures on this device.'); return }
      if (!(await askConfirm(`Delete ${ids.length} picture${ids.length === 1 ? '' : 's'} that no saved piece, project or template uses? This cannot be undone.`, { confirmLabel: 'Delete pictures', danger: true }))) return
      await deleteImages(ids)
      setCleanMsg(`${ids.length} unused picture${ids.length === 1 ? '' : 's'} deleted.`)
    } catch { setCleanMsg('Pictures could not be read from this browser.') }
  }
  const [projects, setProjects] = useState<StoredProject[]>([])
  const [error, setError] = useState<string | null>(null)
  const refresh = () => {
    listDesigns().then(setRows).catch(() => setError('Saved pieces could not be read from this browser.'))
    listProjects().then(setProjects).catch(() => setProjects([]))
  }
  useEffect(() => { if (open) refresh() }, [open])

  const importFile = async (f: File) => {
    try {
      const parsed: unknown = JSON.parse(await f.text())
      const isProject = !!parsed && typeof parsed === 'object' && 'items' in parsed
      const errs = isProject ? validateProject(parsed) : validateDesign(parsed)
      if (errs.length) { setError(`That file is not a valid ${isProject ? 'project' : 'design'}: ${errs.slice(0, 3).join('; ')}.`); return }
      // Pictures carried in the file go to this device (ADR-048); a bad one is reported, the file still opens.
      const { data, problems } = await takePictures(parsed)
      const done = () => { if (problems.length) { setError(`Opened, but ${problems.slice(0, 3).join(' ')}`); refresh() } else opened() }
      if (isProject) {
        const p = { ...(data as Project), id: newId(), updatedAt: new Date().toISOString() }
        await saveProject(p)
        openProject(p); done(); return
      }
      const copy = { ...(data as Design), id: newId(), updatedAt: new Date().toISOString() }
      await saveDesign(copy)
      load(copy); done()
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
          if (!(await askConfirm(kind === 'project' ? `Delete project “${r.name}”? This cannot be undone.` : `Delete “${r.name}”? This cannot be undone.`, { confirmLabel: 'Delete', danger: true }))) return
          if (kind === 'project') await deleteProject(r.id); else await deleteDesign(r.id)
          refresh()
        }}><Icon name="trash" className="sm" /><span className="lbl">Delete</span></button>
    </>
  )

  return (
    <Dialog open={open} onClose={onClose} title="Saved on this device"
      footer={<>
        <button type="button" className="btn outline" onClick={() => void cleanUp()}><Icon name="trash" />Clean up unused pictures</button>
        <label className="btn outline file-btn"><Icon name="upload" />Import a design or project file
          <input type="file" accept="application/json,.json" onChange={e => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = '' }} />
        </label>
      </>}>
      {cleanMsg && <p className="alert info" role="status"><Icon name="info" className="sm" /><span>{cleanMsg}</span></p>}
      {error && <p className="alert error" role="alert"><Icon name="alert-circle" className="sm" /><span>{error}</span></p>}
      <BuiltInProjects onOpened={opened} />
      {projects.length > 0 && (
        <>
          <h3 className="list-head">Projects</h3>
          <ul className="library">
            {projects.map(r => (
              <li key={r.id} className={r.id === currentId ? 'current' : ''}>
                <button type="button" className="row-btn" aria-current={r.id === currentId ? 'true' : undefined} onClick={() => { openProject(r.project); opened() }}>
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
              <button type="button" className="row-btn" aria-current={r.id === currentId ? 'true' : undefined} onClick={() => { load(r.design, { fromStorage: true }); opened() }}>
                <span className="glyph"><Icon name={templateGlyph(r.design.product.kind)} /></span>
                <span><strong>{r.name}</strong><span className="sub">{({ desk: 'Desk', corner: 'Corner unit', cabinet: 'Cabinet', panel: 'Front panel', frame: 'Frame', panels: 'Loose panels' } as const)[r.design.product.kind]}, edited {when(r.updatedAt)}</span></span>
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
  const remove = useDesign(s => s.removeMaterial)
  const [why, setWhy] = useState<{ id: string; text: string } | null>(null)
  // The user's decor list (ADR-049): the decor choice appears only once a list has been imported.
  const [decors, setDecors] = useState<Decor[]>([])
  const [decorMsg, setDecorMsg] = useState<{ ok: boolean; text: string } | null>(null)
  useEffect(() => { if (open) listDecors().then(setDecors).catch(() => setDecors([])) }, [open])
  const importDecors = async (f: File) => {
    let text: string
    try { text = await f.text() } catch { setDecorMsg({ ok: false, text: `${f.name} could not be read.` }); return }
    const r = parseDecorList(text, f.name)
    if (!r.decors.length) { setDecorMsg({ ok: false, text: `No decors imported. ${r.problems.slice(0, 4).join(' ')}` }); return }
    try { await replaceDecors(r.decors) } catch { setDecorMsg({ ok: false, text: 'The decor list could not be saved on this device.' }); return }
    setDecors(r.decors)
    setDecorMsg({ ok: r.problems.length === 0, text: `${r.decors.length} decor${r.decors.length === 1 ? '' : 's'} imported from ${f.name}.${r.problems.length ? ` ${r.problems.length} row${r.problems.length === 1 ? '' : 's'} skipped: ${r.problems.slice(0, 4).join(' ')}` : ''}` })
  }
  const decorOptions = [{ value: '', label: 'Not from the list' }, ...decors.map(d => ({ value: d.id, label: `${d.makerText} ${d.code} ${d.name}, ${d.thickness} mm` }))]
  const decorOf = (m: Material) => decors.find(d => m.decor && d.code === m.decor.code && d.list === m.decor.list && d.thickness === m.thickness)?.id ?? ''
  return (
    <Dialog open={open} onClose={onClose} title="Materials in this piece"
      footer={<>
        <p className="hint start">Changing a thickness rebuilds every part made from that board. Colours and pictures only change how the board looks on screen.</p>
        <button type="button" className="btn outline" onClick={() => add({ id: newId(), name: 'New board', thickness: 18, grain: false, color: '#d8d4cc' })}><Icon name="plus" />Add a material</button>
      </>}>
      <MmField label="Saw cut (kerf)" value={kerf} min={0} max={20} step={1} onChange={setKerf} hint="Material lost in every cut. Sheet length runs along the grain." />
      <div className="decor-list">
        <p className="hint">{decors.length ? `Decor list: ${decors[0].list}, ${decors.length} decor${decors.length === 1 ? '' : 's'}. Choose one on any board below.` : `Decor list: none. Import your own CSV with the columns ${DECOR_COLUMNS} (whole mm, #rrggbb) to choose decors on the boards.`}</p>
        <div className="mat-picture-row">
          <label className="btn sm outline file-btn"><Icon name="upload" className="sm" />Import decor list (CSV)
            <input type="file" accept=".csv,text/csv,text/plain" aria-label="Import decor list (CSV)" onChange={e => { const f = e.target.files?.[0]; if (f) void importDecors(f); e.target.value = '' }} />
          </label>
          {decors.length > 0 && <button type="button" className="btn sm ghost" onClick={async () => {
            if (!(await askConfirm('Remove the decor list from this device? Boards keep their names, colours and labels.', { confirmLabel: 'Remove list', danger: true }))) return
            await clearDecors(); setDecors([]); setDecorMsg(null)
          }}>Remove decor list</button>}
        </div>
        {decorMsg && <p className={`alert ${decorMsg.ok ? 'info' : 'error'}`} role={decorMsg.ok ? 'status' : 'alert'}><Icon name={decorMsg.ok ? 'info' : 'alert-circle'} className="sm" /><span>{decorMsg.text}</span></p>}
      </div>
      <ul className="materials">
        {materials.map((m: Material) => (
          <li key={m.id}>
            <input type="color" aria-label={`${m.name} colour`} value={m.color} onChange={e => update(m.id, { color: e.target.value })} />
            <input className="mat-name" aria-label="Name" defaultValue={m.name} key={m.name} onBlur={e => e.target.value.trim() && update(m.id, { name: e.target.value.trim() })} />
            <MmField label="Thickness" value={m.thickness} min={1} max={60} step={1} onChange={v => update(m.id, { thickness: v })} />
            <Toggle label="Has grain" checked={m.grain} onChange={v => update(m.id, { grain: v })} />
            <div className="sheet-fields">
              <Select label="Manufacturer" value={m.maker ?? ''} options={[{ value: '', label: 'Not set' }, ...MAKERS]}
                onChange={v => update(m.id, { maker: (v || undefined) as MaterialMaker | undefined })} />
              <Select label="Type" value={m.kind ?? ''} options={[{ value: '', label: 'Not set' }, ...KINDS]}
                onChange={v => update(m.id, { kind: (v || undefined) as MaterialKind | undefined })} />
              {decors.length > 0 && <Select label="Decor from your list" value={decorOf(m)} options={decorOptions}
                onChange={v => { const d = decors.find(x => x.id === v); update(m.id, d ? decorPatch(d) : { decor: undefined }) }} />}
            </div>
            <div className="sheet-fields">
              <MmField label="Sheet length" value={sheetOf(m).length} min={300} max={6000} onChange={v => update(m.id, { sheet: { ...sheetOf(m), length: v } })} />
              <MmField label="Sheet width" value={sheetOf(m).width} min={300} max={3000} onChange={v => update(m.id, { sheet: { ...sheetOf(m), width: v } })} />
              <MmField label="Trim each edge" value={sheetOf(m).trim} min={0} max={50} step={1} onChange={v => update(m.id, { sheet: { ...sheetOf(m), trim: v } })} />
              <MmField label="Sheets in stock" unit="" value={sheetOf(m).count ?? 0} min={0} max={999} step={1} hint="0 = buy as needed"
                onChange={v => update(m.id, { sheet: { ...sheetOf(m), count: v === 0 ? null : v } })} />
            </div>
            <MaterialPicture m={m} />
            <div className="mat-actions">
              <button type="button" className="btn sm outline" onClick={() => { const r = remove(m.id); setWhy(r ? { id: m.id, text: r } : null) }}>
                <Icon name="trash" className="sm" />Remove board</button>
              {why?.id === m.id && <p className="alert error" role="alert"><Icon name="alert-circle" className="sm" /><span>{why.text}</span></p>}
            </div>
          </li>
        ))}
      </ul>
    </Dialog>
  )
}

/**
 * ADR-048: any picture from this device as the board's look. It is scaled down and kept on this device only; the
 * plain colour becomes the picture's average colour and is shown wherever the picture cannot be.
 */
function MaterialPicture({ m }: { m: Material }) {
  const update = useDesign(s => s.updateMaterial)
  const urls = useImageUrls(m.image?.id ?? '')
  const url = m.image ? urls.get(m.image.id) : undefined
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const pick = async (file: File | undefined) => {
    if (!file) return
    setBusy(true); setProblem(null)
    const r = await importImage(file)
    setBusy(false)
    if (!r.ok) { setProblem(`${r.problem} The board keeps its ${m.image ? 'current picture' : 'plain colour'}.`); return }
    update(m.id, { color: r.color, image: { ...r.image, turn: m.image?.turn } })
  }
  const img = m.image
  return (
    <div className="mat-picture">
      <div className="mat-picture-row">
        {img && url && url !== 'missing' && <img className="mat-thumb" src={url} alt={`Picture of ${m.name}`} />}
        <label className={`btn sm outline file-btn${busy ? ' disabled' : ''}`}>
          <Icon name="upload" className="sm" />{busy ? 'Preparing picture…' : img ? 'Replace picture' : 'Add a picture'}
          <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} aria-label={`${img ? 'Replace' : 'Add a'} picture for ${m.name}`}
            onChange={e => { void pick(e.target.files?.[0]); e.target.value = '' }} />
        </label>
        {img && <button type="button" className="btn sm ghost" onClick={() => update(m.id, { image: undefined })}>Remove picture</button>}
        {img && <span className="hint">{img.name}</span>}
      </div>
      {img && url === 'missing' && <p className="alert error" role="alert"><Icon name="alert-circle" className="sm" />
        <span>The picture {img.name} is not on this device. The plain colour is shown; add the picture again to see it.</span></p>}
      {problem && <p className="alert error" role="alert"><Icon name="alert-circle" className="sm" /><span>{problem}</span></p>}
      {img && <div className="sheet-fields">
        <MmField label="One picture covers, along the grain" value={img.tileLength} min={1} max={MAX_TILE} onChange={v => update(m.id, { image: { ...img, tileLength: v } })} />
        <MmField label="One picture covers, across" value={img.tileWidth} min={1} max={MAX_TILE} onChange={v => update(m.id, { image: { ...img, tileWidth: v } })} />
        <Toggle label="Turn picture 90°" checked={!!img.turn} onChange={v => update(m.id, { image: { ...img, turn: v } })} />
      </div>}
    </div>
  )
}
