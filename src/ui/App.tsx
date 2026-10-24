import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { cutlistCsvRo } from '../core/ro'
import { exportFusionPython } from '../core/fusion'
import { lastDesignId, lastProjectId, loadDesign, loadProject, rememberLast, rememberLastProject, saveDesign, saveProject } from '../persist/db'
import { useDesign } from '../store/designStore'
import { withPictures } from '../persist/images'
import type { Design } from '../core/types'
import { AddPieceDialog, LibraryDialog, MaterialsDialog, NewDialog } from './Dialogs'
import { WizardDialog } from './Wizard'
import { CatalogPage } from './Catalog'
import { HomePage } from './Home'
import { ResearchPage } from './Research'
import { useResearch } from '../store/researchStore'
import { ConfirmHost } from './Confirm'
import { catalogFamilies } from '../core/catalog'
import { useTemplates } from '../store/templatesStore'
import { PlanView, ProjectPanel } from './Project'
import { useView } from './useView'
import { Elevation } from './Elevation'
import { Inspector } from './Inspector'
import { Output } from './Output'
import { PrintSheet } from './PrintSheet'
import { Icon } from './icons'
import { setTheme, useTheme } from './useTheme'

const Viewer3D = lazy(() => import('../viewer/Viewer3D'))

function webglAvailable() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')) } catch { return false }
}

class ViewerBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <NoViewer /> : this.props.children }
}
const NoViewer = () => <div className="no-3d"><p className="empty center"><Icon name="cube" />3D preview is not available in this browser. The front view and parts list still work.</p></div>

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const fileName = (s: string) => s.trim().replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-').toLowerCase() || 'design'

type SaveState = 'idle' | 'saving' | 'saved' | 'failed'
const SAVE_TEXT: Record<SaveState, string> = { idle: '', saving: 'Saving…', saved: 'Saved on this device', failed: 'Not saved — browser storage unavailable' }

/** Self-contained styles for the exported SVG drawing (the app stylesheet does not travel with the file). */
const SVG_STYLE = `.floor{fill:#b9c0bb}.el-back{fill:#d9ddd9}.el-panel{stroke:#22272a;stroke-width:1.2;vector-effect:non-scaling-stroke}
.el-front{fill:none;stroke:#5a625e;stroke-dasharray:5 4;vector-effect:non-scaling-stroke}.el-handle{stroke:#22272a;stroke-width:3;stroke-linecap:round;vector-effect:non-scaling-stroke}
.el-knob{fill:#22272a}.dim line{stroke:#22272a;stroke-width:1;vector-effect:non-scaling-stroke}.dim rect{fill:#f2c230}.dim text{fill:#3a2e00;font-family:sans-serif;font-weight:600}
.dim.subtle{display:none}`

function useMediaQuery(q: string) {
  const [match, setMatch] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches)
  useEffect(() => {
    const m = matchMedia(q)
    const on = () => setMatch(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [q])
  return match
}

type Page = 'home' | 'editor' | 'catalog' | 'research'
const PAGES: Page[] = ['editor', 'catalog', 'research']
const pageFromHash = (): Page => (typeof location === 'undefined' ? 'home' : PAGES.find(p => location.hash === `#${p}`) ?? 'home')
/**
 * The top-level pages, linkable: the bare address opens the Home welcome page (N38), #editor the editor, #catalog the
 * Catalog (ADR-032), #research the Feature Research & Catalog (ADR-043).
 */
function usePage(): [Page, (p: Page) => void] {
  const [page, setPage] = useState<Page>(pageFromHash)
  useEffect(() => {
    const on = () => setPage(pageFromHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return [page, (p: Page) => {
    if (p === 'home') history.replaceState(null, '', location.pathname + location.search)
    else location.hash = p
    setPage(p)
    window.scrollTo({ top: 0 })
  }]
}
const CATALOG_ITEMS = catalogFamilies.reduce((n, f) => n + f.variants.length, 0)

export function App() {
  const [page, setPage] = usePage()
  const researchCount = useResearch(s => new Set(s.stored.flatMap(b => b.bundle.features.map(f => f.id))).size)
  const design = useDesign(s => s.design)
  const model = useDesign(s => s.model)
  const dirtyAt = useDesign(s => s.dirtyAt)
  const rename = useDesign(s => s.rename)
  const showFronts = useDesign(s => s.showFronts)
  const setShowFronts = useDesign(s => s.setShowFronts)
  const exploded = useDesign(s => s.exploded)
  const setExploded = useDesign(s => s.setExploded)
  const undoPiece = useDesign(s => s.undo), redoPiece = useDesign(s => s.redo)
  const undoProject = useDesign(s => s.undoProject), redoProject = useDesign(s => s.redoProject)
  const canUndoPiece = useDesign(s => s.past.length > 0), canRedoPiece = useDesign(s => s.future.length > 0)
  const canUndoProject = useDesign(s => s.projectPast.length > 0), canRedoProject = useDesign(s => s.projectFuture.length > 0)
  const [dialog, setDialog] = useState<null | 'new' | 'library' | 'materials' | 'add' | 'wizard'>(null)
  const openCatalog = () => { setDialog(null); setPage('catalog') }
  /** The piece reopened in the wizard, or null for a new one (ADR-046). */
  const [wizardFrom, setWizardFrom] = useState<Design | null>(null)
  const templateEdit = useDesign(s => s.templateEdit)
  const project = useDesign(s => s.project)
  const editingItemId = useDesign(s => s.editingItemId)
  const projectDirtyAt = useDesign(s => s.projectDirtyAt)
  const vd = useView()
  const inProject = !!project && !editingItemId
  // The project view undoes project changes (ADR-051); the piece editor undoes piece edits.
  const undo = inProject ? undoProject : undoPiece, redo = inProject ? redoProject : redoPiece
  const canUndo = inProject ? canUndoProject : canUndoPiece, canRedo = inProject ? canRedoProject : canRedoPiece
  const editingName = project?.items.find(i => i.id === editingItemId)?.design.name
  const [save, setSave] = useState<SaveState>('idle')
  const [view, setView] = useState<'front' | '3d'>('front')
  const [has3d] = useState(webglAvailable)
  const [printing, setPrinting] = useState(false)
  const theme = useTheme()
  const menuRef = useRef<HTMLDetailsElement>(null)
  // The sticky drawing on phones sits right under the top bar, whose height changes as its buttons wrap.
  const barRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const bar = barRef.current
    if (!bar || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--bar-h', `${bar.offsetHeight}px`))
    ro.observe(bar)
    return () => ro.disconnect()
  }, [])
  // Phones put the actions in a fixed bottom bar; the page keeps room for it (ADR-030).
  useEffect(() => {
    const bar = barRef.current?.querySelector('.actions') as HTMLElement | null
    if (!bar || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      const fixed = getComputedStyle(bar).position === 'fixed'
      document.documentElement.style.setProperty('--actions-h', fixed ? `${bar.offsetHeight}px` : '0px')
    })
    ro.observe(bar)
    return () => ro.disconnect()
  }, [])
  // The Export menu closes on Escape and on a click outside it (keyboard users need a way out).
  useEffect(() => {
    const close = () => menuRef.current?.removeAttribute('open')
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && menuRef.current?.open) { close(); menuRef.current?.querySelector('summary')?.focus() } }
    const onClick = (e: MouseEvent) => { if (menuRef.current?.open && !menuRef.current.contains(e.target as Node)) close() }
    window.addEventListener('keydown', onKey); document.addEventListener('click', onClick)
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('click', onClick) }
  }, [])
  // Render the print sheet, open the print dialog, then remove it again (ADR-020).
  useEffect(() => {
    if (!printing) return
    const done = () => setPrinting(false)
    window.addEventListener('afterprint', done, { once: true })
    // Wait for fonts: the Romanian glyphs (ș, ț, ă) load on first use, i.e. only when the print sheet appears.
    const glyphs = ['400', '500', '600'].map(w => document.fonts.load(`${w} 1em Barlow`, 'șțăîâȘȚĂÎÂ'))
    const t = setTimeout(() => { void Promise.all(glyphs).then(() => document.fonts.ready).then(() => window.print()) }, 50)
    return () => { clearTimeout(t); window.removeEventListener('afterprint', done) }
  }, [printing])
  const downloadSvg = () => {
    const svg = document.querySelector('.view.front .elevation svg')
    if (!svg) return
    const clone = svg.cloneNode(true) as SVGSVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.querySelectorAll('.el-space, .el-label, .el-selection').forEach(n => n.remove())
    // Pictures (ADR-048) live on this device only: the file gets the plain colours.
    clone.querySelectorAll('pattern').forEach(n => n.remove())
    clone.querySelectorAll<SVGElement>('[data-plain]').forEach(n => { n.style.fill = n.dataset.plain ?? '' })
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    style.textContent = SVG_STYLE
    clone.prepend(style)
    download(`${fileName(design.name)}-front.svg`, new XMLSerializer().serializeToString(clone), 'image/svg+xml')
  }
  const wide = useMediaQuery('(min-width: 1500px)')
  // Mount the 3D canvas only when it is on screen, so it measures its real size.
  const mount3d = has3d && (wide || view === '3d')

  // Reopen the last piece on this device. Until that has settled nothing is autosaved, so the placeholder piece shown
  // during start-up never lands in the library or replaces the remembered piece.
  const [started, setStarted] = useState(false)
  useEffect(() => {
    const done = () => setStarted(true)
    const pid = lastProjectId()
    if (pid) { loadProject(pid).then(p => { if (p) useDesign.getState().openProject(p) }).catch(() => {}).finally(done); return }
    const id = lastDesignId()
    if (id) loadDesign(id).then(d => { if (d) useDesign.getState().load(d, { fromStorage: true }) }).catch(() => {}).finally(done)
    // Nothing to reopen: the start-up placeholder is saved only once it is edited, so a fresh device lists nothing on Home.
    else { useDesign.setState({ pristine: true }); done() }
  }, [])

  // Autosave shortly after each change; also save a freshly opened template so it appears in the library.
  useEffect(() => {
    if (!started) return
    // Pieces inside a project are saved with the project, never into the library; template edits go to the template.
    if (useDesign.getState().project || useDesign.getState().templateEdit) return
    rememberLast(design.id)
    // Opened from storage and untouched: nothing to write (an old file is upgraded only when edited).
    if (useDesign.getState().pristine) return
    const t = setTimeout(() => {
      setSave('saving')
      saveDesign(design).then(() => setSave('saved')).catch(() => setSave('failed'))
    }, dirtyAt ? 400 : 0)
    return () => clearTimeout(t)
  }, [design, dirtyAt, started])

  // Projects autosave too, and are reopened next time.
  useEffect(() => {
    if (!started) return
    rememberLastProject(project?.id ?? null)
    if (!project || !projectDirtyAt) return
    const t = setTimeout(() => {
      setSave('saving')
      saveProject(project).then(() => setSave('saved')).catch(() => setSave('failed'))
    }, 400)
    return () => clearTimeout(t)
  }, [project, projectDirtyAt, started])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select')) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo() }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo() }
      if (e.key === 'Escape') { const st = useDesign.getState(); if (st.project && !st.editingItemId) st.selectItem(null); else st.select(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  const errors = vd.diagnostics.filter(d => d.severity === 'error').length
  const exportName = fileName(vd.title)
  const blockedTitle = errors ? 'Fix the problems listed under Checks first' : undefined

  return (
    <>
    <div className={`app ${page === 'home' ? 'on-home' : ''}`}>
      <header className="bar" ref={barRef}>
        <div className="brand" aria-hidden="true">
          <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="3" y1="15.5" x2="21" y2="15.5" /></svg>
        </div>
        <nav className="pages" aria-label="Pages">
          <a href="#" aria-current={page === 'home' ? 'page' : undefined} onClick={e => { e.preventDefault(); setPage('home') }}><Icon name="home" className="sm" />Home</a>
          <a href="#editor" aria-current={page === 'editor' ? 'page' : undefined} onClick={e => { e.preventDefault(); setPage('editor') }}><Icon name="front" className="sm" />Editor</a>
          <a href="#catalog" aria-current={page === 'catalog' ? 'page' : undefined} onClick={e => { e.preventDefault(); setPage('catalog') }}><Icon name="catalog" className="sm" />Catalog <span className="count">{CATALOG_ITEMS}</span></a>
          <a href="#research" aria-current={page === 'research' ? 'page' : undefined} onClick={e => { e.preventDefault(); setPage('research') }}><Icon name="search" className="sm" />Feature Research <span className="count">{researchCount}</span></a>
        </nav>
        <input className="name" aria-label={inProject ? 'Name of this project' : 'Name of this piece'} defaultValue={inProject ? project!.name : design.name} key={inProject ? `p-${project!.id}-${project!.name}` : design.id}
          onBlur={e => {
            const v = e.target.value.trim()
            if (!v) return
            if (inProject) { if (v !== project!.name) useDesign.getState().updateProject(p => ({ ...p, name: v })) }
            else if (v !== design.name) rename(v)
          }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
        <span className={`status ${save}`} role="status" title={SAVE_TEXT[save] || undefined}>
          {save !== 'idle' && <><span className="dot" aria-hidden="true" /><span className="txt">{SAVE_TEXT[save]}</span></>}
        </span>
        <button type="button" className="btn icon theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'} title={theme === 'dark' ? 'Light theme' : 'Dark theme'}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
        <nav className="actions" aria-label="Actions">
          <div className="cluster">
            <button type="button" className="btn icon" onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo (Ctrl+Z)"><Icon name="undo" /></button>
            <button type="button" className="btn icon" onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)"><Icon name="redo" /></button>
            <span className="divider" aria-hidden="true" />
          </div>
          <div className="cluster">
            <button type="button" className="btn" onClick={() => setDialog('new')} aria-label="New" title="Start a new piece or project"><Icon name="plus" /><span className="lbl">New</span></button>
            <button type="button" className="btn" onClick={() => setDialog('library')} aria-label="Library" title="Pieces and projects saved on this device"><Icon name="folder" /><span className="lbl">Library</span></button>
            {!inProject && <button type="button" className="btn" onClick={() => setDialog('materials')} aria-label="Materials" title="Boards, thicknesses and stock sheets"><Icon name="layers" /><span className="lbl">Materials</span></button>}
            <span className="divider" aria-hidden="true" />
          </div>
          <div className="cluster end">
            <details className="menu" ref={menuRef}>
              <summary aria-label="Export" title="Drawings, scripts and files"><Icon name="share" /><span className="lbl">Export</span><Icon name="chevron-down" className="sm" /></summary>
              <div className="menu-items" onClick={() => menuRef.current?.removeAttribute('open')}>
                {inProject ? (
                  <button type="button" onClick={async () => download(`${exportName}-project.json`, JSON.stringify(await withPictures(project!, [...project!.items.map(i => i.design), { materials: (project!.runParts ?? []).map(r => r.material) }]), null, 2), 'application/json')}><Icon name="download" />Project file <small>to open on another device</small></button>
                ) : <>
                  <button type="button" onClick={downloadSvg}><Icon name="front" />Front view drawing <small>SVG</small></button>
                  <button type="button" onClick={() => download(`${fileName(design.name)}-fusion.py`, exportFusionPython(design, model), 'text/x-python')}>
                    <Icon name="cube" />Fusion 360 script <small>not yet tested in Fusion</small>
                  </button>
                  <button type="button" onClick={async () => download(`${fileName(design.name)}.json`, JSON.stringify(await withPictures(design, [design]), null, 2), 'application/json')}><Icon name="download" />Design file <small>to open on another device</small></button>
                </>}
              </div>
            </details>
            <button type="button" className="btn outline" disabled={errors > 0} aria-label="Print" title={blockedTitle ?? 'Print the cutting sheet (Romanian, A4) or save it as PDF'} onClick={() => setPrinting(true)}><Icon name="printer" /><span className="lbl">Print</span></button>
            <button type="button" className="btn primary" disabled={errors > 0} title={blockedTitle ?? 'Download the parts list as CSV'}
              onClick={() => download(`${exportName}-parts.csv`, cutlistCsvRo(vd.rows), 'text/csv;charset=utf-8')}><Icon name="download" />Parts CSV</button>
          </div>
        </nav>
      </header>

      {templateEdit && (
        <div className="piece-banner" role="status">
          <span>Editing variant <strong>{templateEdit.template.family.variants.find(v => v.id === templateEdit.variantId)?.name}</strong> of template <strong>{templateEdit.template.family.name}</strong>. Saved to the template on this device.</span>
          <button type="button" className="btn sm primary" onClick={() => { const t = useDesign.getState().finishTemplateEdit(true); if (t) void useTemplates.getState().save(t); setPage('catalog') }}>Save to template</button>
          <button type="button" className="btn sm" onClick={() => { useDesign.getState().finishTemplateEdit(false); setPage('catalog') }}>Cancel</button>
        </div>
      )}
      {editingItemId && project && (
        <div className="piece-banner" role="status">
          <span>Editing <strong>{editingName}</strong> in project <strong>{project.name}</strong>. Changes stay in this project.</span>
          <button type="button" className="btn sm" onClick={() => useDesign.getState().backToProject()}>Back to project</button>
        </div>
      )}
      {page === 'home' && <HomePage onOpened={() => setPage('editor')} onNewPiece={() => setDialog('new')} onLibrary={() => setDialog('library')} />}
      {page === 'catalog' && <CatalogPage onDone={() => setPage('editor')} onNewPiece={() => { setWizardFrom(null); setDialog('wizard') }} />}
      {page === 'research' && <ResearchPage onDone={() => setPage('editor')} />}
      <main className={`work ${editingItemId || templateEdit ? 'with-banner' : ''}`} hidden={page !== 'editor'}>
        <aside className="side">
          {!inProject && !templateEdit && !editingItemId && design.wizard && (
            <div className="wz-reopen">
              <span className="hint">Made with the New-piece wizard.</span>
              <button type="button" className="btn sm" onClick={() => { setWizardFrom(design); setDialog('wizard') }}><Icon name="pencil" className="sm" />Open in wizard</button>
            </div>
          )}
          {inProject ? <ProjectPanel onAdd={() => setDialog('add')} /> : <Inspector />}
        </aside>
        <section className="stage" aria-label="Drawing">
          <div className="stage-tools">
            <div className="segmented small" role="radiogroup" aria-label="View">
              <button type="button" role="radio" aria-checked={view === 'front'} className={view === 'front' ? 'on' : ''} onClick={() => setView('front')}>{inProject ? 'Plan' : 'Front'}</button>
              <button type="button" role="radio" aria-checked={view === '3d'} className={view === '3d' ? 'on' : ''} onClick={() => setView('3d')}>3D</button>
            </div>
            <label className="toggle small"><input type="checkbox" checked={showFronts} onChange={e => setShowFronts(e.target.checked)} /><span>Doors and fronts</span></label>
            {(wide || view === '3d') && <label className="toggle small"><input type="checkbox" checked={exploded} onChange={e => setExploded(e.target.checked)} /><span>Exploded 3D</span></label>}
            {view === '3d' && <button type="button" className="btn sm" onClick={() => window.dispatchEvent(new Event('fb:fit'))}><Icon name="refresh" className="sm" />Reset view</button>}
          </div>
          <div className="views">
            <div className={`view front ${view === 'front' ? 'active' : ''}`}>{inProject ? <PlanView /> : <Elevation />}</div>
            <div className={`view three ${view === '3d' ? 'active' : ''}`}>
              {mount3d ? (
                <ViewerBoundary>
                  <Suspense fallback={<div className="no-3d"><p className="loading">Loading 3D…</p></div>}>
                    <Viewer3D />
                  </Suspense>
                </ViewerBoundary>
              ) : has3d ? null : <NoViewer />}
            </div>
          </div>
        </section>
        <Output />
      </main>

      {/* Closing one dialog to open another fires its close event after the switch: it may only clear itself. */}
      <NewDialog open={dialog === 'new'} onClose={() => setDialog(d => (d === 'new' ? null : d))} onBrowse={openCatalog} onWizard={() => { setWizardFrom(null); setDialog('wizard') }} onOpened={() => setPage('editor')} />
      <WizardDialog open={dialog === 'wizard'} from={wizardFrom} onClose={() => setDialog(d => (d === 'wizard' ? null : d))} onCreated={() => { setDialog(null); setPage('editor') }} />
      <LibraryDialog open={dialog === 'library'} onClose={() => setDialog(null)} onOpened={() => setPage('editor')} />
      <MaterialsDialog open={dialog === 'materials'} onClose={() => setDialog(null)} />
      <AddPieceDialog open={dialog === 'add'} onClose={() => setDialog(null)} onBrowse={openCatalog} />
    </div>
    <ConfirmHost />
    {printing && <PrintSheet />}
    </>
  )
}
