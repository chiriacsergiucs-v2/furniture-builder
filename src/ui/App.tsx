import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { cutlist } from '../core/cutlist'
import { cutlistCsvRo } from '../core/ro'
import { exportFusionPython } from '../core/fusion'
import { lastDesignId, loadDesign, rememberLast, saveDesign } from '../persist/db'
import { useDesign } from '../store/designStore'
import { LibraryDialog, MaterialsDialog, NewDialog } from './Dialogs'
import { Elevation } from './Elevation'
import { Inspector } from './Inspector'
import { Output } from './Output'
import { PrintSheet } from './PrintSheet'

const Viewer3D = lazy(() => import('../viewer/Viewer3D'))

function webglAvailable() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')) } catch { return false }
}

class ViewerBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <NoViewer /> : this.props.children }
}
const NoViewer = () => <div className="no-3d"><p>3D preview is not available in this browser. The front view and parts list still work.</p></div>

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const fileName = (s: string) => s.trim().replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-').toLowerCase() || 'design'

type SaveState = 'idle' | 'saving' | 'saved' | 'failed'

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

export function App() {
  const design = useDesign(s => s.design)
  const model = useDesign(s => s.model)
  const dirtyAt = useDesign(s => s.dirtyAt)
  const rename = useDesign(s => s.rename)
  const showFronts = useDesign(s => s.showFronts)
  const setShowFronts = useDesign(s => s.setShowFronts)
  const undo = useDesign(s => s.undo), redo = useDesign(s => s.redo)
  const canUndo = useDesign(s => s.past.length > 0), canRedo = useDesign(s => s.future.length > 0)
  const [dialog, setDialog] = useState<null | 'new' | 'library' | 'materials'>(null)
  const [save, setSave] = useState<SaveState>('idle')
  const [view, setView] = useState<'front' | '3d'>('front')
  const [has3d] = useState(webglAvailable)
  const [printing, setPrinting] = useState(false)
  const menuRef = useRef<HTMLDetailsElement>(null)
  // Render the print sheet, open the print dialog, then remove it again (ADR-0020).
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
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    style.textContent = SVG_STYLE
    clone.prepend(style)
    download(`${fileName(design.name)}-front.svg`, new XMLSerializer().serializeToString(clone), 'image/svg+xml')
  }
  const wide = useMediaQuery('(min-width: 1500px)')
  // Mount the 3D canvas only when it is on screen, so it measures its real size.
  const mount3d = has3d && (wide || view === '3d')

  // Reopen the last piece on this device.
  useEffect(() => {
    const id = lastDesignId()
    if (id) loadDesign(id).then(d => { if (d) useDesign.getState().load(d, { fromStorage: true }) }).catch(() => {})
  }, [])

  // Autosave shortly after each change; also save a freshly opened template so it appears in the library.
  useEffect(() => {
    rememberLast(design.id)
    // Opened from storage and untouched: nothing to write (an old file is upgraded only when edited).
    if (useDesign.getState().pristine) return
    const t = setTimeout(() => {
      setSave('saving')
      saveDesign(design).then(() => setSave('saved')).catch(() => setSave('failed'))
    }, dirtyAt ? 400 : 0)
    return () => clearTimeout(t)
  }, [design, dirtyAt])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select')) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo() }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo() }
      if (e.key === 'Escape') useDesign.getState().select(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  const errors = model.diagnostics.filter(d => d.severity === 'error').length

  return (
    <>
    <div className="app">
      <header className="bar">
        <div className="brand" aria-hidden="true">
          <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="3" y1="15.5" x2="21" y2="15.5" /></svg>
        </div>
        <input className="name" aria-label="Name of this piece" defaultValue={design.name} key={design.id}
          onBlur={e => { const v = e.target.value.trim(); if (v && v !== design.name) rename(v) }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
        <span className={`save ${save}`} role="status">{save === 'saving' ? 'Saving…' : save === 'saved' ? 'Saved on this device' : save === 'failed' ? 'Not saved — browser storage unavailable' : ''}</span>
        <nav className="actions">
          <button type="button" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">Undo</button>
          <button type="button" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">Redo</button>
          <span className="divider" aria-hidden="true" />
          <button type="button" onClick={() => setDialog('new')}>New</button>
          <button type="button" onClick={() => setDialog('library')}>Saved</button>
          <button type="button" onClick={() => setDialog('materials')}>Materials</button>
          <span className="divider" aria-hidden="true" />
          <button type="button" className="primary" disabled={errors > 0} title={errors ? 'Fix the problems listed under Checks first' : 'Download the parts list as CSV'}
            onClick={() => download(`${fileName(design.name)}-parts.csv`, cutlistCsvRo(cutlist(model, design.materials)), 'text/csv;charset=utf-8')}>Parts CSV</button>
          <button type="button" disabled={errors > 0} title={errors ? 'Fix the problems listed under Checks first' : 'Print the cutting sheet (Romanian, A4) or save it as PDF'} onClick={() => setPrinting(true)}>Print</button>
          <details className="menu" ref={menuRef}>
            <summary>Export</summary>
            <div className="menu-items" onClick={() => menuRef.current?.removeAttribute('open')}>
              <button type="button" onClick={downloadSvg}>Front view drawing (SVG)</button>
              <button type="button" onClick={() => download(`${fileName(design.name)}-fusion.py`, exportFusionPython(design, model), 'text/x-python')}>
                Fusion 360 script <small>not yet tested in Fusion</small>
              </button>
              <button type="button" onClick={() => download(`${fileName(design.name)}.json`, JSON.stringify(design, null, 2), 'application/json')}>Design file (to open on another device)</button>
            </div>
          </details>
        </nav>
      </header>

      <main className="work">
        <aside className="side">
          <Inspector />
        </aside>
        <section className="stage" aria-label="Drawing">
          <div className="stage-tools">
            <div className="segmented small" role="radiogroup" aria-label="View">
              <button type="button" role="radio" aria-checked={view === 'front'} className={view === 'front' ? 'on' : ''} onClick={() => setView('front')}>Front</button>
              <button type="button" role="radio" aria-checked={view === '3d'} className={view === '3d' ? 'on' : ''} onClick={() => setView('3d')}>3D</button>
            </div>
            <label className="toggle small"><input type="checkbox" checked={showFronts} onChange={e => setShowFronts(e.target.checked)} /><span>Doors and fronts</span></label>
            {view === '3d' && <button type="button" className="mini" onClick={() => window.dispatchEvent(new Event('fb:fit'))}>Reset view</button>}
          </div>
          <div className="views">
            <div className={`view front ${view === 'front' ? 'active' : ''}`}><Elevation /></div>
            <div className={`view three ${view === '3d' ? 'active' : ''}`}>
              {mount3d ? (
                <ViewerBoundary>
                  <Suspense fallback={<div className="no-3d"><p>Loading 3D…</p></div>}>
                    <Viewer3D />
                  </Suspense>
                </ViewerBoundary>
              ) : has3d ? null : <NoViewer />}
            </div>
          </div>
        </section>
        <Output />
      </main>


      <NewDialog open={dialog === 'new'} onClose={() => setDialog(null)} />
      <LibraryDialog open={dialog === 'library'} onClose={() => setDialog(null)} />
      <MaterialsDialog open={dialog === 'materials'} onClose={() => setDialog(null)} />
    </div>
    {printing && <PrintSheet />}
    </>
  )
}
