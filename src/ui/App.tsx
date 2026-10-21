import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { cutlist, cutlistCsv } from '../core/cutlist'
import { lastDesignId, loadDesign, rememberLast, saveDesign } from '../persist/db'
import { useDesign } from '../store/designStore'
import { LibraryDialog, MaterialsDialog, NewDialog } from './Dialogs'
import { Elevation } from './Elevation'
import { Inspector } from './Inspector'
import { Output } from './Output'

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
  const wide = useMediaQuery('(min-width: 1500px)')
  // Mount the 3D canvas only when it is on screen, so it measures its real size.
  const mount3d = has3d && (wide || view === '3d')

  // Reopen the last piece on this device.
  useEffect(() => {
    const id = lastDesignId()
    if (id) loadDesign(id).then(d => { if (d) useDesign.getState().load(d) }).catch(() => {})
  }, [])

  // Autosave shortly after each change; also save a freshly opened template so it appears in the library.
  useEffect(() => {
    rememberLast(design.id)
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
            onClick={() => download(`${fileName(design.name)}-parts.csv`, cutlistCsv(cutlist(model, design.materials)), 'text/csv')}>Parts CSV</button>
          <button type="button" onClick={() => download(`${fileName(design.name)}.json`, JSON.stringify(design, null, 2), 'application/json')}>Design file</button>
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
  )
}
