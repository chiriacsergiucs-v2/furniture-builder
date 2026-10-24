import { useEffect, useState } from 'react';
import { newId } from '../../core/design';
import { newProject } from '../../core/project';
import { imageIdsOf } from '../../core/surface';
import {
  deleteDesign,
  deleteImages,
  deleteProject,
  listDesigns,
  listProjects,
  saveDesign,
  saveProject,
  unusedImageIds,
  type StoredDesign,
  type StoredProject,
} from '../../persist/db';
import { useDesign } from '../../store/designStore';
import { askConfirm, askText } from '../Confirm';
import { ProjectTemplateList } from '../ProjectTemplates';
import { Icon, type IconName } from '../icons';
import { templateGlyph } from '../Templates';
import { importFile } from './importFile';

const KIND_TEXT = {
  desk: 'Desk',
  corner: 'Corner unit',
  cabinet: 'Cabinet',
  panel: 'Front panel',
  frame: 'Frame',
  panels: 'Loose panels',
} as const;

/**
 * Projects (ADR-078): everything saved on this device in one place — the former Home page and Library dialog.
 * Create, open, duplicate, delete, import a file, clean up pictures; project templates too.
 */
export function ProjectsPage({
  onOpened,
  onNewPiece,
}: {
  onOpened: () => void;
  onNewPiece: () => void;
}) {
  const load = useDesign((s) => s.load);
  const openProject = useDesign((s) => s.openProject);
  const currentId = useDesign((s) => (s.project ? s.project.id : s.design.id));
  const [projects, setProjects] = useState<StoredProject[] | null>(null);
  const [pieces, setPieces] = useState<StoredDesign[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const refresh = () => {
    listProjects()
      .then(setProjects)
      .catch(() => {
        setProjects([]);
        setMsg({ ok: false, text: 'Saved work could not be read from this browser.' });
      });
    listDesigns()
      .then(setPieces)
      .catch(() => setMsg({ ok: false, text: 'Saved work could not be read from this browser.' }));
  };
  useEffect(refresh, []);

  const create = async () => {
    const name = await askText('Name of the new project', 'New project', 'Create project');
    if (name === null) return;
    const p = newProject(name.trim() || 'New project');
    void saveProject(p);
    openProject(p);
    onOpened();
  };
  const onImport = async (f: File) => {
    const r = await importFile(f);
    if (r.opened && !r.message) {
      onOpened();
      return;
    }
    setMsg(r.message ?? null);
    refresh();
  };
  const cleanUp = async () => {
    const st = useDesign.getState();
    const keep = imageIdsOf([
      st.design,
      ...(st.project?.items.map((i) => i.design) ?? []),
      { materials: (st.project?.runParts ?? []).map((r) => r.material) },
    ]);
    try {
      const ids = await unusedImageIds(keep);
      if (!ids.length) {
        setMsg({ ok: true, text: 'No unused pictures on this device.' });
        return;
      }
      if (
        !(await askConfirm(
          `Delete ${ids.length} picture${ids.length === 1 ? '' : 's'} that no saved piece, project or template uses? This cannot be undone.`,
          { confirmLabel: 'Delete pictures', danger: true },
        ))
      )
        return;
      await deleteImages(ids);
      setMsg({
        ok: true,
        text: `${ids.length} unused picture${ids.length === 1 ? '' : 's'} deleted.`,
      });
    } catch {
      setMsg({ ok: false, text: 'Pictures could not be read from this browser.' });
    }
  };
  const duplicate = async (r: StoredDesign | StoredProject, kind: 'piece' | 'project') => {
    const now = new Date().toISOString();
    const copy = { id: newId(), name: `${r.name} (copy)`, createdAt: now, updatedAt: now };
    if (kind === 'project') await saveProject({ ...(r as StoredProject).project, ...copy });
    else await saveDesign({ ...(r as StoredDesign).design, ...copy });
    refresh();
  };
  const remove = async (r: StoredDesign | StoredProject, kind: 'piece' | 'project') => {
    if (
      !(await askConfirm(
        kind === 'project'
          ? `Delete project “${r.name}”? This cannot be undone.`
          : `Delete “${r.name}”? This cannot be undone.`,
        { confirmLabel: 'Delete', danger: true },
      ))
    )
      return;
    if (kind === 'project') await deleteProject(r.id);
    else await deleteDesign(r.id);
    refresh();
  };
  const when = (iso: string) => new Date(iso).toLocaleDateString();
  const row = (
    r: StoredDesign | StoredProject,
    kind: 'piece' | 'project',
    glyph: IconName,
    sub: string,
    open: () => void,
  ) => (
    <li key={r.id} className={r.id === currentId ? 'current' : ''}>
      <button
        type="button"
        className="row-btn"
        aria-current={r.id === currentId ? 'true' : undefined}
        onClick={() => {
          open();
          onOpened();
        }}
      >
        <span className="glyph">
          <Icon name={glyph} />
        </span>
        <span>
          <strong>{r.name}</strong>
          <span className="sub">{sub}</span>
        </span>
        {r.id === currentId && <span className="chip">Open now</span>}
      </button>
      <button
        type="button"
        className="btn sm icon"
        onClick={() => void duplicate(r, kind)}
        aria-label={`Duplicate ${r.name}`}
        title="Duplicate"
      >
        <Icon name="copy" className="sm" />
      </button>
      <button
        type="button"
        className="btn sm icon danger"
        disabled={r.id === currentId}
        aria-label={`Delete ${r.name}`}
        title={r.id === currentId ? 'Open something else first' : 'Delete'}
        onClick={() => void remove(r, kind)}
      >
        <Icon name="trash" className="sm" />
      </button>
    </li>
  );

  return (
    <main className="home-page projects-page" aria-label="Projects">
      <header className="home-hero">
        <h1>Projects</h1>
        <p className="hint">
          Everything you design is saved on this device only. Start a project, a single piece, or
          open what you made before.
        </p>
        <div className="home-start">
          <button type="button" className="btn primary lg" onClick={() => void create()}>
            <Icon name="plus" />
            Create a new project
          </button>
          <button type="button" className="btn outline lg" onClick={onNewPiece}>
            <Icon name="cube" />
            New single piece
          </button>
        </div>
      </header>

      <section className="home-section" aria-labelledby="home-projects">
        <div className="home-section-head">
          <h2 id="home-projects">Choose a project</h2>
          <div className="split-actions">
            <label className="btn sm outline file-btn">
              <Icon name="upload" className="sm" />
              Import a file
              <input
                type="file"
                accept="application/json,.json"
                aria-label="Import a design, project or project template file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onImport(f);
                  e.target.value = '';
                }}
              />
            </label>
            <button type="button" className="btn sm ghost" onClick={() => void cleanUp()}>
              <Icon name="trash" className="sm" />
              Clean up unused pictures
            </button>
          </div>
        </div>
        {msg && (
          <p className={`alert ${msg.ok ? 'info' : 'error'}`} role={msg.ok ? 'status' : 'alert'}>
            <Icon name={msg.ok ? 'info' : 'alert-circle'} className="sm" />
            <span>{msg.text}</span>
          </p>
        )}
        {projects === null ? (
          <p className="loading">Loading…</p>
        ) : projects.length === 0 && pieces.length === 0 ? (
          <p className="empty center">
            <Icon name="folder" />
            No projects saved yet. Create a new project or a single piece, or import a file.
          </p>
        ) : (
          <>
            {projects.length > 0 && (
              <>
                <h3 className="list-head">Projects</h3>
                <ul className="library">
                  {projects.map((r) =>
                    row(
                      r,
                      'project',
                      'project',
                      `${r.project.items.length} ${r.project.items.length === 1 ? 'piece' : 'pieces'} · edited ${when(r.updatedAt)}`,
                      () => openProject(r.project),
                    ),
                  )}
                </ul>
              </>
            )}
            {pieces.length > 0 && (
              <>
                <h3 className="list-head">Single pieces</h3>
                <ul className="library">
                  {pieces.map((r) =>
                    row(
                      r,
                      'piece',
                      templateGlyph(r.design.product.kind),
                      `${KIND_TEXT[r.design.product.kind]} · edited ${when(r.updatedAt)}`,
                      () => load(r.design, { fromStorage: true }),
                    ),
                  )}
                </ul>
              </>
            )}
          </>
        )}
        <ProjectTemplateList onOpened={onOpened} />
      </section>
    </main>
  );
}
