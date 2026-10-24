import { useEffect, useState } from 'react'
import { newProject } from '../core/project'
import { listDesigns, listProjects, saveProject, type StoredDesign, type StoredProject } from '../persist/db'
import { useDesign } from '../store/designStore'
import { askText } from './Confirm'
import { BuiltInProjects } from './Dialogs'
import { Icon } from './icons'
import { templateGlyph } from './Templates'

/**
 * The welcome page the app starts on (backlog N38): create a new project, or pick one saved on this device.
 * Everything listed opens in the editor; nothing here changes what is stored.
 */
export function HomePage({ onOpened, onNewPiece, onLibrary }: { onOpened: () => void; onNewPiece: () => void; onLibrary: () => void }) {
  const load = useDesign(s => s.load)
  const openProject = useDesign(s => s.openProject)
  const currentId = useDesign(s => (s.project ? s.project.id : s.design.id))
  const [projects, setProjects] = useState<StoredProject[] | null>(null)
  const [pieces, setPieces] = useState<StoredDesign[]>([])
  const [error, setError] = useState(false)
  useEffect(() => {
    listProjects().then(setProjects).catch(() => { setProjects([]); setError(true) })
    listDesigns().then(setPieces).catch(() => setError(true))
  }, [])

  const create = async () => {
    const name = await askText('Name of the new project', 'New project', 'Create project')
    if (name === null) return
    const p = newProject(name.trim() || 'New project')
    void saveProject(p); openProject(p); onOpened()
  }
  const when = (iso: string) => new Date(iso).toLocaleDateString()
  const openNow = (id: string) => id === currentId ? <span className="chip">Open now</span> : <Icon name="chevron-right" className="chev sm" />

  return (
    <main className="home-page" aria-label="Home">
      <header className="home-hero">
        <h1>Welcome to Furniture Builder</h1>
        <p className="hint">Design furniture in millimetres and get the parts list, cutting sheets and drawings. Everything is saved on this device only.</p>
        <div className="home-start">
          <button type="button" className="btn primary lg" onClick={() => void create()}><Icon name="plus" />Create a new project</button>
          <button type="button" className="btn outline lg" onClick={onNewPiece}><Icon name="cube" />New single piece</button>
        </div>
      </header>

      <section className="home-section" aria-labelledby="home-projects">
        <div className="home-section-head">
          <h2 id="home-projects">Choose a project</h2>
          <button type="button" className="btn sm" onClick={onLibrary}><Icon name="folder" className="sm" />Library: duplicate, delete, import</button>
        </div>
        {error && <p className="alert error" role="alert"><Icon name="alert-circle" className="sm" /><span>Saved work could not be read from this browser.</span></p>}
        {projects === null ? <p className="loading">Loading…</p> : projects.length === 0 && pieces.length === 0 ? (
          <p className="empty center"><Icon name="folder" />No projects saved yet. Create a new project, or open one built in the app below.</p>
        ) : <>
          {projects.length > 0 && <>
            <h3 className="list-head">Projects</h3>
            <ul className="home-list">
              {projects.map(r => (
                <li key={r.id}>
                  <button type="button" className="row-btn" aria-current={r.id === currentId ? 'true' : undefined} onClick={() => { openProject(r.project); onOpened() }}>
                    <span className="glyph"><Icon name="project" /></span>
                    <span><strong>{r.name}</strong><span className="sub">{r.project.items.length} {r.project.items.length === 1 ? 'piece' : 'pieces'} · edited {when(r.updatedAt)}</span></span>
                    {openNow(r.id)}
                  </button>
                </li>
              ))}
            </ul>
          </>}
          {pieces.length > 0 && <>
            <h3 className="list-head">Single pieces</h3>
            <ul className="home-list">
              {pieces.map(r => (
                <li key={r.id}>
                  <button type="button" className="row-btn" aria-current={r.id === currentId ? 'true' : undefined} onClick={() => { load(r.design, { fromStorage: true }); onOpened() }}>
                    <span className="glyph"><Icon name={templateGlyph(r.design.product.kind)} /></span>
                    <span><strong>{r.name}</strong><span className="sub">Edited {when(r.updatedAt)}</span></span>
                    {openNow(r.id)}
                  </button>
                </li>
              ))}
            </ul>
          </>}
        </>}
        <BuiltInProjects onOpened={onOpened} />
      </section>
    </main>
  )
}
