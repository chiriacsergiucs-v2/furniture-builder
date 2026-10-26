import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  lastDesignId,
  lastProjectId,
  loadDesign,
  loadProject,
  rememberLast,
  rememberLastProject,
  saveDesign,
  saveProject,
} from '../persist/db';
import { useDesign } from '../store/designStore';
import type { Design } from '../core/types';
import { AddPieceDialog, NewDialog } from './Dialogs';
import { SettingsDialog } from './Settings';
import { WizardDialog } from './Wizard';
import { CatalogPage } from './Catalog';
import { ResearchPage } from './Research';
import { ConfirmHost } from './Confirm';
import { catalogFamilies } from '../core/catalog';
import { useTemplates } from '../store/templatesStore';
import { PlanView, ProjectPanel } from './Project';
import { useView } from './useView';
import { Elevation } from './Elevation';
import { Inspector, selectionLabel } from './Inspector';
import { Output } from './Output';
import { useProblem } from './problemStore';
import { PrintSheet } from './PrintSheet';
import { Icon } from './icons';
import { setTheme, useTheme } from './useTheme';
import { setLook, useLook } from './useLook';
import { RenderDialog } from './RenderDialog';
import { MoreMenu } from './shell/MoreMenu';
import { ProjectsPage } from './shell/ProjectsPage';
import { useMediaQuery } from './useMediaQuery';
import { MODE_LABEL, MODES, useUi } from './shell/uiStore';
import {
  bringDrawingForward,
  defaultView,
  shows3d,
  showsDrawing,
  showsSwitch,
  shownView,
  viewOptions,
  type StageView,
} from './viewChoice';

const Viewer3D = lazy(() => import('../viewer/Viewer3D'));

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

class ViewerBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <NoViewer /> : this.props.children;
  }
}
const NoViewer = () => (
  <div className="no-3d">
    <p className="empty center">
      <Icon name="cube" />
      3D preview is not available in this browser. The front view and parts list still work.
    </p>
  </div>
);

type SaveState = 'idle' | 'saving' | 'saved' | 'failed';
const SAVE_TEXT: Record<SaveState, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved on this device',
  failed: 'Not saved — browser storage unavailable',
};

type Page = 'projects' | 'editor' | 'catalog' | 'research';
const PAGES: Page[] = ['projects', 'editor', 'catalog', 'research'];
const pageFromHash = (): Page =>
  typeof location === 'undefined'
    ? 'projects'
    : (PAGES.find((p) => location.hash === `#${p}`) ?? 'projects');
/**
 * The three places (ADR-078), linkable: the bare address and #projects open Projects, #editor the editor, #catalog
 * the Catalog (ADR-032); #research the Feature Research & Catalog (ADR-043), reached from the ⋯ menu.
 */
function usePage(): [Page, (p: Page) => void] {
  const [page, setPage] = useState<Page>(pageFromHash);
  useEffect(() => {
    const on = () => setPage(pageFromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return [
    page,
    (p: Page) => {
      if (p === 'projects') history.replaceState(null, '', location.pathname + location.search);
      else location.hash = p;
      setPage(p);
      window.scrollTo({ top: 0 });
    },
  ];
}
const CATALOG_ITEMS = catalogFamilies.reduce((n, f) => n + f.variants.length, 0);
const PLACES: { page: Page; label: string; icon: 'folder' | 'catalog' | 'front' }[] = [
  { page: 'projects', label: 'Projects', icon: 'folder' },
  { page: 'catalog', label: 'Catalog', icon: 'catalog' },
  { page: 'editor', label: 'Editor', icon: 'front' },
];

export function App() {
  const [page, setPage] = usePage();
  const design = useDesign((s) => s.design);
  const dirtyAt = useDesign((s) => s.dirtyAt);
  const rename = useDesign((s) => s.rename);
  const showFronts = useDesign((s) => s.showFronts);
  const setShowFronts = useDesign((s) => s.setShowFronts);
  const exploded = useDesign((s) => s.exploded);
  const setExploded = useDesign((s) => s.setExploded);
  const undoPiece = useDesign((s) => s.undo),
    redoPiece = useDesign((s) => s.redo);
  const undoProject = useDesign((s) => s.undoProject),
    redoProject = useDesign((s) => s.redoProject);
  const canUndoPiece = useDesign((s) => s.past.length > 0),
    canRedoPiece = useDesign((s) => s.future.length > 0);
  const canUndoProject = useDesign((s) => s.projectPast.length > 0),
    canRedoProject = useDesign((s) => s.projectFuture.length > 0);
  const [dialog, setDialog] = useState<null | 'new' | 'add' | 'wizard' | 'render'>(null);
  const look = useLook();
  const openCatalog = () => {
    setDialog(null);
    setPage('catalog');
  };
  /** The piece reopened in the wizard, or null for a new one (ADR-046). */
  const [wizardFrom, setWizardFrom] = useState<Design | null>(null);
  const templateEdit = useDesign((s) => s.templateEdit);
  const project = useDesign((s) => s.project);
  const editingItemId = useDesign((s) => s.editingItemId);
  const projectDirtyAt = useDesign((s) => s.projectDirtyAt);
  const selectedId = useDesign((s) => s.selectedId);
  const selectedItemId = useDesign((s) => s.selectedItemId);
  const vd = useView();
  const inProject = !!project && !editingItemId;
  // The project view undoes project changes (ADR-051); the piece editor undoes piece edits.
  const undo = inProject ? undoProject : undoPiece,
    redo = inProject ? redoProject : redoPiece;
  const canUndo = inProject ? canUndoProject : canUndoPiece,
    canRedo = inProject ? canRedoProject : canRedoPiece;
  const editingName = project?.items.find((i) => i.id === editingItemId)?.design.name;
  const [save, setSave] = useState<SaveState>('idle');

  // Editor modes (ADR-079, ADR-080). Build & Preview shows 3D; Compose shows the drawing; Settings is a dialog.
  const mode = useUi((s) => s.mode);
  const setMode = useUi((s) => s.setMode);
  const printing = useUi((s) => s.printing);
  const setPrinting = useUi((s) => s.setPrinting);
  const notice = useUi((s) => s.notice);
  const setNotice = useUi((s) => s.setNotice);
  const setSettingsOpen = useUi((s) => s.setSettingsOpen);
  const phone = useMediaQuery('(max-width: 760px)');
  const wide = useMediaQuery('(min-width: 1500px)');
  const [has3d] = useState(webglAvailable);
  // The View switch (ADR-081): Front/Plan · 3D · Both. A mode, or crossing 1500 px, starts from its default view.
  const [view, setView] = useState<StageView>(() => defaultView(mode, wide, has3d));
  const viewKey = `${mode}|${wide}`;
  const [lastViewKey, setLastViewKey] = useState(viewKey);
  const [sheetOpen, setSheetOpen] = useState(false);
  if (viewKey !== lastViewKey) {
    setLastViewKey(viewKey);
    setView(defaultView(mode, wide, has3d));
  }
  // On a phone Compose is the drawing only, so the canvas is not mounted there (ADR-014).
  const shown = shownView(view, mode, phone);
  const mount3d = has3d && shows3d(shown);

  // A piece waiting to be placed (ADR-056) or a room being drawn (ADR-059) is done on the plan, in Compose.
  const tapMode = useDesign((s) =>
    s.placingItemId ? `place:${s.placingItemId}` : s.drawingRoom ? 'draw' : '',
  );
  // Choosing a space or a piece while configuring means composing it; on a phone the sheet opens on it.
  const selKey = inProject ? selectedItemId : selectedId;
  const [lastTap, setLastTap] = useState(tapMode);
  const [lastSel, setLastSel] = useState(selKey);
  if (tapMode !== lastTap) {
    setLastTap(tapMode);
    // Placing a piece or drawing the room needs the plan: on a phone the sheet steps aside.
    if (tapMode) {
      setView(bringDrawingForward);
      setSheetOpen(false);
    }
  }
  if (selKey !== lastSel) {
    setLastSel(selKey);
    if (selKey && !tapMode) setSheetOpen(true);
  }
  // A project check tapped under Checks (ADR-071) is shown on the plan: the drawing comes forward, the sheet steps aside.
  const problemTap = useProblem((s) => s.tapped);
  const [lastProblemTap, setLastProblemTap] = useState(problemTap);
  if (problemTap !== lastProblemTap) {
    setLastProblemTap(problemTap);
    if (inProject) {
      setView(bringDrawingForward);
      setSheetOpen(false);
    }
  }
  const seenProblemTap = useRef(problemTap);
  useEffect(() => {
    if (problemTap === seenProblemTap.current) return;
    seenProblemTap.current = problemTap;
    // On a phone Build & Preview shows 3D only: the plan is in Compose.
    if (window.matchMedia?.('(max-width: 760px)').matches && useUi.getState().mode === 'build')
      useUi.getState().setMode('compose');
  }, [problemTap]);
  useEffect(() => {
    if (tapMode) useUi.getState().setMode('compose');
  }, [tapMode]);

  const theme = useTheme();
  // The drawing on phones is sized to the space left between the bars; both bars report their heights.
  const barRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const modesRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const root = document.documentElement.style;
    const ro = new ResizeObserver(() => {
      const bar = barRef.current,
        nav = navRef.current,
        modes = modesRef.current;
      if (bar) root.setProperty('--bar-h', `${bar.offsetHeight}px`);
      root.setProperty('--modes-h', `${modes?.offsetHeight ?? 0}px`);
      root.setProperty(
        '--actions-h',
        nav && getComputedStyle(nav).position === 'fixed' ? `${nav.offsetHeight}px` : '0px',
      );
    });
    for (const el of [barRef.current, navRef.current, modesRef.current]) if (el) ro.observe(el);
    return () => ro.disconnect();
  }, [page]);
  // Render the print sheet, open the print dialog, then remove it again (ADR-020).
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done, { once: true });
    // Wait for fonts: the Romanian glyphs (ș, ț, ă) load on first use, i.e. only when the print sheet appears.
    const glyphs = ['400', '500', '600'].map((w) =>
      document.fonts.load(`${w} 1em Barlow`, 'șțăîâȘȚĂÎÂ'),
    );
    const t = setTimeout(() => {
      void Promise.all(glyphs)
        .then(() => document.fonts.ready)
        .then(() => window.print());
    }, 50);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', done);
    };
  }, [printing, setPrinting]);

  // Reopen the last piece on this device. Until that has settled nothing is autosaved, so the placeholder piece shown
  // during start-up never lands in the library or replaces the remembered piece.
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const done = () => setStarted(true);
    const pid = lastProjectId();
    if (pid) {
      loadProject(pid)
        .then((p) => {
          if (p) useDesign.getState().openProject(p);
        })
        .catch(() => {})
        .finally(done);
      return;
    }
    const id = lastDesignId();
    if (id)
      loadDesign(id)
        .then((d) => {
          if (d) useDesign.getState().load(d, { fromStorage: true });
        })
        .catch(() => {})
        .finally(done);
    // Nothing to reopen: the start-up placeholder is saved only once it is edited, so a fresh device lists nothing.
    else {
      useDesign.setState({ pristine: true });
      done();
    }
  }, []);

  // Autosave shortly after each change; also save a freshly opened template so it appears in the library.
  useEffect(() => {
    if (!started) return;
    // Pieces inside a project are saved with the project, never into the library; template edits go to the template.
    if (useDesign.getState().project || useDesign.getState().templateEdit) return;
    rememberLast(design.id);
    // Opened from storage and untouched: nothing to write (an old file is upgraded only when edited).
    if (useDesign.getState().pristine) return;
    const t = setTimeout(
      () => {
        setSave('saving');
        saveDesign(design)
          .then(() => setSave('saved'))
          .catch(() => setSave('failed'));
      },
      dirtyAt ? 400 : 0,
    );
    return () => clearTimeout(t);
  }, [design, dirtyAt, started]);

  // Projects autosave too, and are reopened next time.
  useEffect(() => {
    if (!started) return;
    rememberLastProject(project?.id ?? null);
    if (!project || !projectDirtyAt) return;
    const t = setTimeout(() => {
      setSave('saving');
      saveProject(project)
        .then(() => setSave('saved'))
        .catch(() => setSave('failed'));
    }, 400);
    return () => clearTimeout(t);
  }, [project, projectDirtyAt, started]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      // Ctrl/Cmd+D duplicates the piece selected in a project (ADR-069).
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        const st = useDesign.getState();
        const busy = st.placingItemId || st.drawingRoom;
        if (
          !e.repeat &&
          page === 'editor' &&
          st.project &&
          !st.editingItemId &&
          st.selectedItemId &&
          !busy
        ) {
          e.preventDefault();
          st.duplicateItem(st.selectedItemId);
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
      if (e.key === 'Escape') {
        const st = useDesign.getState();
        if (st.project && !st.editingItemId) st.selectItem(null);
        else st.select(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, page]);

  const errors = vd.diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = vd.diagnostics.length - errors;
  const buildMeta = errors
    ? `${errors} ${errors === 1 ? 'problem' : 'problems'}`
    : warnings
      ? `${warnings} to check`
      : '';
  const selectedItem = project?.items.find((i) => i.id === selectedItemId);
  const selectedModel = project?.models?.find((m) => m.id === selectedItemId);
  const peek = inProject
    ? selectedItem || selectedModel
      ? `Selected: ${selectedItem?.design.name ?? selectedModel?.name}`
      : `${project!.name}: ${project!.items.length} ${project!.items.length === 1 ? 'piece' : 'pieces'}`
    : (() => {
        const l = selectionLabel(design.product, selectedId);
        return l ? `Selected: ${l}` : 'Tap a space to edit it';
      })();

  const nameField = (
    <input
      className="name"
      aria-label={inProject ? 'Name of this project' : 'Name of this piece'}
      defaultValue={inProject ? project!.name : design.name}
      key={inProject ? `p-${project!.id}-${project!.name}` : `${design.id}-${design.name}`}
      onBlur={(e) => {
        const v = e.target.value.trim();
        if (!v) return;
        if (inProject) {
          if (v !== project!.name) useDesign.getState().updateProject((p) => ({ ...p, name: v }));
        } else if (v !== design.name) rename(v);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );

  return (
    <>
      <div className={`app page-${page}`}>
        <header className="bar" ref={barRef}>
          <div className="brand" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <line x1="3" y1="15.5" x2="21" y2="15.5" />
            </svg>
          </div>
          <nav className="pages places" aria-label="Places" ref={navRef}>
            {PLACES.map((p) => (
              <a
                key={p.page}
                href={p.page === 'projects' ? '#' : `#${p.page}`}
                aria-current={page === p.page ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  setPage(p.page);
                }}
              >
                <Icon name={p.icon} className="sm" />
                <span>{p.label}</span>
                {p.page === 'catalog' && <span className="count">{CATALOG_ITEMS}</span>}
              </a>
            ))}
          </nav>
          {page === 'editor' && (
            <div className="path">
              {templateEdit ? (
                <>
                  <span className="crumb family" title="Template">
                    {templateEdit.template.family.name}
                  </span>
                  <span className="sep family" aria-hidden="true">
                    ›
                  </span>
                  <span className="crumb here">
                    {
                      templateEdit.template.family.variants.find(
                        (v) => v.id === templateEdit.variantId,
                      )?.name
                    }
                  </span>
                  <button
                    type="button"
                    className="btn sm primary"
                    aria-label="Save to template"
                    title="Saved to the template on this device"
                    onClick={() => {
                      const t = useDesign.getState().finishTemplateEdit(true);
                      if (t) void useTemplates.getState().save(t);
                      setPage('catalog');
                    }}
                  >
                    Save<span className="lbl-long"> to template</span>
                  </button>
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => {
                      useDesign.getState().finishTemplateEdit(false);
                      setPage('catalog');
                    }}
                  >
                    Cancel
                  </button>
                </>
              ) : editingItemId && project ? (
                <>
                  <button
                    type="button"
                    className="crumb back"
                    aria-label={`Back to project ${project.name}`}
                    title={`Changes to ${editingName ?? 'this piece'} stay in this project`}
                    onClick={() => useDesign.getState().backToProject()}
                  >
                    <Icon name="chevron-left" className="sm" />
                    {project.name}
                  </button>
                  <span className="sep" aria-hidden="true">
                    ›
                  </span>
                  {nameField}
                </>
              ) : (
                nameField
              )}
            </div>
          )}
          {page === 'editor' && (
            <span className={`status ${save}`} role="status" title={SAVE_TEXT[save] || undefined}>
              {save !== 'idle' && (
                <>
                  <span className="dot" aria-hidden="true" />
                  <span className="txt">{SAVE_TEXT[save]}</span>
                </>
              )}
            </span>
          )}
          <div className="bar-tools">
            {page === 'editor' && (
              <>
                <button
                  type="button"
                  className="btn icon"
                  onClick={undo}
                  disabled={!canUndo}
                  aria-label="Undo"
                  title="Undo (Ctrl+Z)"
                >
                  <Icon name="undo" />
                </button>
                <button
                  type="button"
                  className="btn icon"
                  onClick={redo}
                  disabled={!canRedo}
                  aria-label="Redo"
                  title="Redo (Ctrl+Shift+Z)"
                >
                  <Icon name="redo" />
                </button>
                <button
                  type="button"
                  className="btn icon"
                  onClick={() => setSettingsOpen(true)}
                  aria-label="Settings"
                  title={inProject ? 'Project settings' : 'Size, construction, boards and drawers'}
                >
                  <Icon name="sliders" />
                </button>
              </>
            )}
            <button
              type="button"
              className="btn icon theme"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={
                theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'
              }
              title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>
            <MoreMenu
              onNew={() => setDialog('new')}
              onOpened={() => setPage('editor')}
              onResearch={() => setPage('research')}
            />
          </div>
        </header>
        {page === 'editor' && (
          <div className="modes" ref={modesRef}>
            <div className="segmented" role="radiogroup" aria-label="Editor mode">
              {MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  className={mode === m ? 'on' : ''}
                  onClick={() => setMode(m)}
                >
                  {MODE_LABEL[m]}
                  {m === 'build' && buildMeta && (
                    <span className={`badge ${errors ? 'error' : 'warning'}`}>
                      {errors || warnings}
                      <span className="badge-words"> {buildMeta.replace(/^\d+ /, '')}</span>
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
        {notice && (
          <p
            className={`alert notice ${notice.ok ? 'info' : 'error'}`}
            role={notice.ok ? 'status' : 'alert'}
          >
            <Icon name={notice.ok ? 'info' : 'alert-circle'} className="sm" />
            <span>{notice.text}</span>
            <button
              type="button"
              className="btn icon ghost sm"
              aria-label="Dismiss"
              onClick={() => setNotice(null)}
            >
              <Icon name="x" className="sm" />
            </button>
          </p>
        )}

        {page === 'projects' && (
          <ProjectsPage onOpened={() => setPage('editor')} onNewPiece={() => setDialog('new')} />
        )}
        {page === 'catalog' && (
          <CatalogPage
            onDone={() => setPage('editor')}
            onNewPiece={() => {
              setWizardFrom(null);
              setDialog('wizard');
            }}
          />
        )}
        {page === 'research' && <ResearchPage onDone={() => setPage('editor')} />}
        <main
          className={`work mode-${mode} ${sheetOpen ? 'sheet-open' : ''}`}
          hidden={page !== 'editor'}
        >
          <aside className="side" aria-label="Compose">
            <button
              type="button"
              className="sheet-peek"
              aria-expanded={sheetOpen}
              onClick={() => setSheetOpen((o) => !o)}
            >
              <span>{peek}</span>
              <Icon name={sheetOpen ? 'chevron-down' : 'chevron-up'} className="sm" />
            </button>
            <div className="side-body">
              {inProject ? (
                <ProjectPanel mode="compose" onAdd={() => setDialog('add')} />
              ) : (
                <Inspector mode="compose" />
              )}
            </div>
          </aside>
          <section className={`stage ${shown === 'both' ? 'both' : ''}`} aria-label="Drawing">
            <div className="stage-tools">
              {showsSwitch(mode, phone) && (
                <div className="segmented small" role="radiogroup" aria-label="View">
                  {viewOptions(inProject, has3d).map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      role="radio"
                      aria-checked={shown === o.id}
                      className={shown === o.id ? 'on' : ''}
                      disabled={o.disabled}
                      title={o.reason}
                      onClick={() => setView(o.id)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
              <label className="toggle small">
                <input
                  type="checkbox"
                  checked={showFronts}
                  onChange={(e) => setShowFronts(e.target.checked)}
                />
                <span>Doors and fronts</span>
              </label>
              {shows3d(shown) && (
                <label className="toggle small">
                  <input
                    type="checkbox"
                    checked={exploded}
                    onChange={(e) => setExploded(e.target.checked)}
                  />
                  <span>Exploded 3D</span>
                </label>
              )}
              {shows3d(shown) && (
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => window.dispatchEvent(new Event('fb:fit'))}
                >
                  <Icon name="refresh" className="sm" />
                  Reset view
                </button>
              )}
              {mount3d && (
                <div className="segmented small" role="radiogroup" aria-label="Look">
                  {(['simple', 'realistic'] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      role="radio"
                      aria-checked={look === l}
                      className={look === l ? 'on' : ''}
                      onClick={() => setLook(l)}
                    >
                      {l === 'simple' ? 'Simple' : 'Realistic'}
                    </button>
                  ))}
                </div>
              )}
              {mount3d && (
                <button
                  type="button"
                  className="btn sm"
                  title="Render a photo-quality picture. Best on a laptop; a phone may be slow."
                  onClick={() => setDialog('render')}
                >
                  <Icon name="camera" className="sm" />
                  Render
                </button>
              )}
            </div>
            <div className={`views ${shown === 'both' ? 'both' : ''}`}>
              <div className={`view front ${showsDrawing(shown) ? 'active' : ''}`}>
                {inProject ? <PlanView /> : <Elevation />}
              </div>
              <div className={`view three ${shows3d(shown) ? 'active' : ''}`}>
                {mount3d ? (
                  <ViewerBoundary>
                    <Suspense
                      fallback={
                        <div className="no-3d">
                          <p className="loading">Loading 3D…</p>
                        </div>
                      }
                    >
                      <Viewer3D />
                    </Suspense>
                  </ViewerBoundary>
                ) : has3d ? null : (
                  <NoViewer />
                )}
              </div>
            </div>
            {/* Phones: the 3D view's quick-count card docks here, under the view (G-066). */}
            {phone && <div id="count-dock" className="count-dock-slot" />}
          </section>
          <Output />
        </main>

        {/* Closing one dialog to open another fires its close event after the switch: it may only clear itself. */}
        <NewDialog
          open={dialog === 'new'}
          onClose={() => setDialog((d) => (d === 'new' ? null : d))}
          onBrowse={openCatalog}
          onWizard={() => {
            setWizardFrom(null);
            setDialog('wizard');
          }}
          onOpened={() => setPage('editor')}
        />
        <WizardDialog
          open={dialog === 'wizard'}
          from={wizardFrom}
          onClose={() => setDialog((d) => (d === 'wizard' ? null : d))}
          onCreated={() => {
            setDialog(null);
            setPage('editor');
          }}
        />
        <SettingsDialog
          onWizard={() => {
            setWizardFrom(design);
            setDialog('wizard');
          }}
        />
        <RenderDialog
          open={dialog === 'render'}
          onClose={() => setDialog((d) => (d === 'render' ? null : d))}
          name={inProject ? project!.name : design.name}
        />
        <AddPieceDialog
          open={dialog === 'add'}
          onClose={() => setDialog(null)}
          onBrowse={openCatalog}
        />
      </div>
      <ConfirmHost />
      {printing && <PrintSheet />}
    </>
  );
}
