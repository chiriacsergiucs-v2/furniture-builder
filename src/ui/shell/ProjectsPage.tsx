import { useEffect, useMemo, useRef, useState } from 'react';
import { newId } from '../../core/design';
import { newProject } from '../../core/project';
import {
  deleteDesign,
  deleteProject,
  listDesigns,
  listProjects,
  saveDesign,
  saveProject,
  type StoredDesign,
  type StoredProject,
} from '../../persist/db';
import { useDesign } from '../../store/designStore';
import { askConfirm, askText } from '../Confirm';
import { ProjectTemplateList } from '../ProjectTemplates';
import { InfoTip } from '../controls';
import { Icon, type IconName } from '../icons';
import { templateGlyph } from '../Templates';
import { importFile } from './importFile';
import { OpenFromCode, useOpenLink } from '../ShareCode';
import { catalogFamilies } from '../../core/catalog';
import { newerCount, newerText, templateStatus } from '../../core/templateRevision';
import { useLocalTemplates } from '../Catalog';
import { updatedText } from '../TemplateRevision';
import { useUi } from './uiStore';
import { DeviceOnlyNotice } from '../SavedData';
import { AccountBadge, AccountRowActions, InYourAccount } from '../Account';
import { useAccount } from '../../store/accountStore';
import { useMediaQuery } from '../useMediaQuery';

/** Where a saved row's three buttons fold into one menu (ADR-120). */
const NARROW = '(max-width: 520px)';

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
  // Accounts (ADR-137, ADR-142): another account's copies are hidden here, never removed.
  const hidden = useAccount((s) => s.hidden);
  const configured = useAccount((s) => s.configured);
  const signedIn = useAccount((s) => !!s.user);
  const setAccountDialog = useAccount((s) => s.setDialog);
  const lastSync = useAccount((s) => s.sync?.lastSyncAt);
  const [pieces, setPieces] = useState<StoredDesign[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Saved designs and projects say when a piece's template has a newer revision (ADR-096, "Library too").
  // Worked out once per list (not per render); nothing until this device's templates are read.
  const locals = useLocalTemplates();
  const notices = useMemo(() => {
    const out = new Map<string, string>();
    if (!locals) return out;
    for (const r of pieces) {
      const s = templateStatus({ design: r.design }, catalogFamilies, locals);
      if (s.kind === 'newer') out.set(r.id, ` · ${updatedText(s)}`);
    }
    for (const r of projects ?? []) {
      const n = newerCount(r.project.items, catalogFamilies, locals);
      if (n) out.set(r.id, ` · ${newerText(n)}`);
    }
    return out;
  }, [pieces, projects, locals]);
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
  // Read on arrival; settings changed from this list are saved by the autosave, so read again once the dialog closes.
  const settingsOpen = useUi((s) => s.settingsOpen);
  const setSettingsOpen = useUi((s) => s.setSettingsOpen);
  const narrow = useMediaQuery(NARROW);
  // Read again when Settings close, and after a sync that may bring or change items (ADR-137).
  useEffect(() => {
    if (!settingsOpen) refresh();
  }, [settingsOpen, lastSync]);

  const create = async () => {
    const name = await askText('Name of the new project', 'New project', 'Create project');
    if (name === null) return;
    const p = newProject(name.trim() || 'New project');
    void saveProject(p);
    openProject(p);
    onOpened();
  };
  // A link with a design code (ADR-124) opens here, after asking.
  useOpenLink(onOpened, setMsg);
  const onImport = async (f: File) => {
    const r = await importFile(f);
    if (r.opened && !r.message) {
      onOpened();
      return;
    }
    setMsg(r.message ?? null);
    refresh();
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
  ) => {
    // Settings edit the open copy (ADR-080): this row becomes the one open now, and autosave writes it back.
    const settings = () => {
      if (r.id !== currentId) open();
      setSettingsOpen(true);
    };
    return (
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
          {kind === 'piece' && <AccountBadge table="designs" id={r.id} />}
        </button>
        {kind === 'piece' && <AccountRowActions table="designs" id={r.id} name={r.name} />}
        {/* A small phone folds the three buttons into one ⋯ menu, so the name keeps its line (ADR-120). */}
        {narrow ? (
          <RowMenu
            name={r.name}
            isOpen={r.id === currentId}
            onSettings={settings}
            onDuplicate={() => void duplicate(r, kind)}
            onDelete={() => void remove(r, kind)}
          />
        ) : (
          <>
            <button
              type="button"
              className="btn sm icon"
              aria-label={`Settings for ${r.name}`}
              title="Settings"
              onClick={settings}
            >
              <Icon name="sliders" className="sm" />
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
          </>
        )}
      </li>
    );
  };

  return (
    <main className="home-page projects-page" aria-label="Projects">
      <DeviceOnlyNotice
        signIn={configured && !signedIn ? () => setAccountDialog('sign-in') : undefined}
      />
      <header className="home-hero">
        <div className="info-row">
          <h1>Projects</h1>
          <InfoTip label="About projects" align="start">
            Everything you design is saved on this device only. Start a project, a single piece, or
            open what you made before.
          </InfoTip>
        </div>
        <div className="home-start">
          <button type="button" className="btn primary lg" onClick={() => void create()}>
            <Icon name="plus" />
            Create a new project
          </button>
          <button type="button" className="btn outline lg" onClick={onNewPiece}>
            <Icon name="cube" />
            New single piece
          </button>
          {/* Beside New (ADR-120); "Fill a wall" is in the New dialog only. */}
          <label className="btn outline lg file-btn">
            <Icon name="upload" />
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
          <OpenFromCode onOpened={onOpened} onMessage={setMsg} />
        </div>
      </header>

      <section className="home-section" aria-labelledby="home-projects">
        <div className="home-section-head">
          <h2 id="home-projects">Choose a project</h2>
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
                {/* No "Projects" label here: the page title says it (ADR-116). */}
                <ul className="library" aria-label="Projects">
                  {projects.map((r) =>
                    row(
                      r,
                      'project',
                      'project',
                      `${r.project.items.length} ${r.project.items.length === 1 ? 'piece' : 'pieces'} · edited ${when(r.updatedAt)}${notices.get(r.id) ?? ''}`,
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
                  {pieces
                    .filter((r) => !hidden.has(`designs:${r.id}`))
                    .map((r) =>
                      row(
                        r,
                        'piece',
                        templateGlyph(r.design.product.kind),
                        `${KIND_TEXT[r.design.product.kind]} · edited ${when(r.updatedAt)}${notices.get(r.id) ?? ''}`,
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
      <InYourAccount onOpened={onOpened} />
    </main>
  );
}

/**
 * A saved row's Settings, Duplicate and Delete in one ⋯ menu on a small phone (ADR-120). Escape and a tap outside
 * close it, as in the More menu.
 */
function RowMenu({
  name,
  isOpen,
  onSettings,
  onDuplicate,
  onDelete,
}: {
  name: string;
  isOpen: boolean;
  onSettings: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = () => ref.current?.removeAttribute('open');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && ref.current?.open) {
        ref.current.removeAttribute('open');
        ref.current.querySelector('summary')?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node))
        ref.current.removeAttribute('open');
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, []);
  const run = (fn: () => void) => {
    close();
    fn();
  };
  return (
    <details className="menu row-menu" ref={ref}>
      <summary className="btn sm icon" aria-label={`Actions for ${name}`} title="Actions">
        <Icon name="more" className="sm" />
      </summary>
      <div className="menu-items">
        <button type="button" onClick={() => run(onSettings)}>
          <Icon name="sliders" />
          Settings
        </button>
        <button type="button" onClick={() => run(onDuplicate)}>
          <Icon name="copy" />
          Duplicate
        </button>
        <button type="button" disabled={isOpen} onClick={() => run(onDelete)}>
          <Icon name="trash" />
          Delete
          {isOpen && <small>open something else first</small>}
        </button>
      </div>
    </details>
  );
}
