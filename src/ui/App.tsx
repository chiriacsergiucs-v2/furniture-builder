import { parentOf } from '../core/selectPath';
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
} from '../store/libraryStore';
import { useDesign } from '../store/designStore';
import { keepSessionVersion } from '../store/versions';
import type { Design } from '../core/types';
import { t, t as tt, tr } from '../core/i18n';
import { formatMoney } from '../core/prices';
import { useEstimate } from './useEstimate';
import { NewDialog } from './Dialogs';
import { SettingsDialog } from './Settings';
import { MaterialDialog } from './MaterialDialog';
import { WizardDialog } from './Wizard';
import { WallFillDialog } from './WallFill';
import { RoomFillDialog } from './RoomFill';
import { PrintAssembly } from './Assembly';
import { askConfirm, ConfirmHost } from './Confirm';
import { catalogFamilies } from '../core/catalog';
import { cancelTemplateEdit, saveTemplateEdit } from '../store/templatesStore';
import { askRemove, PeekActions, PlanView, ProjectPanel } from './Project';
import { PieceList } from './PieceList';
import { usePieceList } from '../store/pieceListStore';
import { useView } from '../store/useView';
import { Elevation } from './Elevation';
import { Inspector, selectionLabel } from './Inspector';
import { Output } from './Output';
import { useProblem } from '../store/problemStore';
import { PrintSheet } from './PrintSheet';
import { PrintClient } from './PrintClient';
import { Icon } from './icons';
import { SheetHandle, type SheetStop } from './SheetHandle';
import { rovingKeys, rovingTab } from './controls';
import { setTheme, useTheme } from '../store/useTheme';
import { setLook, useLook } from '../store/useLook';
import { RenderDialog } from './RenderDialog';
import { MoreMenu } from './shell/MoreMenu';
import { SceneMenu } from './SceneMenu';
import { editorShortcutAllowed } from './editorShortcuts';
import { ProjectsPage } from './shell/ProjectsPage';
import { useMediaQuery } from '../store/useMediaQuery';
import { MODE_LABEL, MODES, takeKeepSheetClosed, useUi } from '../store/uiStore';
import { ViewOptions } from './ViewOptions';
import { BackupReminder, SavedDataDialog, startChangeClock } from './SavedData';
import { startAutoBackup } from '../persist/backup';
import { AccountButton, AccountDialog, SyncStatus } from './Account';
import { AssistantDialog } from './Assistant';
import { ShareLinkDialog, SharedItemDialog, useShareLink } from './Share';
import { initAccount } from '../store/accountActions';
import { useViewStore } from '../store/viewStore';
import { CountStepper } from './CountStepper';
import { MoveToButtons } from './MoveTo';
import {
  bringDrawingForward,
  inOptions,
  defaultView,
  shows3d,
  showsDrawing,
  viewOptions,
  type StageView,
} from './viewChoice';

const Viewer3D = lazy(() => import('../viewer/Viewer3D'));
// Pages opened on demand load on first use (ADR-222).
const CatalogPage = lazy(() => import('./CatalogPage').then((m) => ({ default: m.CatalogPage })));
const ResearchPage = lazy(() => import('./Research').then((m) => ({ default: m.ResearchPage })));
const GapsPage = lazy(() => import('./Gaps').then((m) => ({ default: m.GapsPage })));
const InfoPage = lazy(() => import('./Info').then((m) => ({ default: m.InfoPage })));
const PageLoading = () => (
  <p className="loading" role="status">
    {t('Loading…')}
  </p>
);
// What the 3D view draws from the ui (ADR-230: the viewer imports nothing from src/ui).
const countCard = (className: string) => <CountStepper className={className} foldable />;
const moveTo = (id: string | readonly string[], className: string) => (
  <MoveToButtons id={id} className={className} />
);

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
      {t('3D preview is not available in this browser. The front view and parts list still work.')}
    </p>
  </div>
);

/**
 * The running cost estimate (ADR-172): what the Shopping list shows, in the header (a phone: the mode row, amount
 * only). Tapping it opens Build & Preview › Shopping list.
 */
function EstimateChip({ compact = false }: { compact?: boolean }) {
  const { est, currency, priceState } = useEstimate();
  const setMode = useUi((s) => s.setMode);
  const setTab = useDesign((s) => s.setTab);
  const none =
    priceState !== 'ready' ||
    (!est.priced && !est.missing.length) ||
    (!est.priced && est.total === 0);
  const amount = t('{amount} {currency}', { amount: formatMoney(est.total), currency });
  const full = none
    ? t('No prices yet')
    : est.missing.length
      ? t('Estimate: {amount} · {n} missing', { amount, n: est.missing.length })
      : t('Estimate: {amount}', { amount });
  return (
    <button
      type="button"
      className={`estimate-chip ${none ? 'none' : est.missing.length ? 'partial' : ''}`}
      aria-label={`${full} — ${t('Open the Shopping list')}`}
      title={t('Open the Shopping list')}
      onClick={() => {
        setMode('build');
        setTab('shopping');
      }}
    >
      {compact && !none ? amount : full}
    </button>
  );
}

type SaveState = 'idle' | 'saving' | 'saved' | 'failed';
const SAVE_TEXT: Record<SaveState, string> = {
  idle: '',
  saving: t('Saving…'),
  saved: t('Saved on this device'),
  failed: t('Not saved — browser storage unavailable'),
};

type Page = 'projects' | 'editor' | 'catalog' | 'research' | 'gaps' | 'info';
const PAGES: Page[] = ['projects', 'editor', 'catalog', 'research', 'gaps', 'info'];
const pageFromHash = (): Page =>
  typeof location === 'undefined'
    ? 'projects'
    : (PAGES.find((p) => location.hash === `#${p}`) ?? 'projects');
/**
 * The three places (ADR-078), linkable: the bare address and #projects open Projects, #editor the editor, #catalog
 * the Catalog (ADR-032); #research the Feature Research & Catalog (ADR-043) and #gaps the gaps ledger (ADR-101),
 * both reached from the ⋯ menu, and #info Information and guides (ADR-158).
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
  { page: 'projects', label: t('Projects'), icon: 'folder' },
  { page: 'catalog', label: t('Catalog'), icon: 'catalog' },
  { page: 'editor', label: t('Editor'), icon: 'front' },
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
  // The step each would undo or redo, named (ADR-123).
  const undoName = useDesign((s) => s.projectPastNames[s.projectPastNames.length - 1]),
    redoName = useDesign((s) => s.projectFutureNames[0]);
  const [dialog, setDialog] = useState<
    null | 'new' | 'wizard' | 'render' | 'wallfill' | 'roomfill'
  >(null);
  const look = useLook();
  const openCatalog = () => {
    setDialog(null);
    setPage('catalog');
  };
  /** The piece reopened in the wizard, or null for a new one (ADR-046). */
  const [wizardFrom, setWizardFrom] = useState<Design | null>(null);
  /** The wizard was started from a project's Add a piece: its piece joins the project (ADR-107). */
  const [wizardToProject, setWizardToProject] = useState(false);
  const openWizard = (from: Design | null, toProject = false) => {
    setWizardFrom(from);
    setWizardToProject(toProject);
    setDialog('wizard');
  };
  const templateEdit = useDesign((s) => s.templateEdit);
  const project = useDesign((s) => s.project);
  const editingItemId = useDesign((s) => s.editingItemId);
  const projectDirtyAt = useDesign((s) => s.projectDirtyAt);
  const selectedId = useDesign((s) => s.selectedId);
  const drillItemId = useDesign((s) => s.drillItemId);
  const selectedItemId = useDesign((s) => s.selectedItemId);
  const vd = useView();
  const inProject = !!project && !editingItemId;
  // The start-up placeholder, untouched, is not an open design: the Catalog's "Back to the editor" waits (ADR-120).
  const [placeholderId] = useState(() => useDesign.getState().design.id);
  const pristine = useDesign((s) => s.pristine);
  const designOpen = !!project || design.id !== placeholderId || !pristine;
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
  const printMode = useUi((s) => s.printMode);
  const setPrinting = useUi((s) => s.setPrinting);
  const notice = useUi((s) => s.notice);
  const setNotice = useUi((s) => s.setNotice);
  const setSettingsOpen = useUi((s) => s.setSettingsOpen);
  const setMaterialOpen = useUi((s) => s.setMaterialOpen);
  const phone = useMediaQuery('(max-width: 760px)');
  // The phone's slot for the 3D view's quick-count card (G-070), handed to the viewer (ADR-230).
  const [countDock, setCountDock] = useState<HTMLDivElement | null>(null);
  // Seams and lit parts the 3D view draws (ADR-230), shown as data attributes for the find-it scripts.
  const seams = useViewStore((s) => s.seams);
  const lit = useViewStore((s) => s.lit);
  const requestFit = useViewStore((s) => s.requestFit);
  const wide = useMediaQuery('(min-width: 1500px)');
  const [has3d] = useState(webglAvailable);
  // The View switch (ADR-081, ADR-144): 2D · 3D · Both, the same in both modes. The choice stays when the mode
  // changes (G-266); only crossing 1500 px starts again from the default (G-268).
  const [view, setView] = useState<StageView>(() => defaultView(wide, has3d));
  const [lastWide, setLastWide] = useState(wide);
  // The phone Compose sheet's stop (ADR-211, G-027): peek, half (today's open sheet) or full.
  const [sheetStop, setSheetStop] = useState<SheetStop>('peek');
  const sheetOpen = sheetStop !== 'peek';
  // Edit this piece asks for the full sheet in the project (ADR-241).
  const sheetAsk = useUi((s) => s.sheetAsk);
  const [lastAsk, setLastAsk] = useState(sheetAsk);
  if (sheetAsk !== lastAsk) {
    setLastAsk(sheetAsk);
    if (sheetAsk) setSheetStop(sheetAsk.stop);
  }
  const setSheetOpen = (open: boolean) => setSheetStop(open ? 'half' : 'peek');
  if (wide !== lastWide) {
    setLastWide(wide);
    setView(defaultView(wide, has3d));
  }
  // 3D mounts only while 3D or Both is shown, in either mode, phone included (ADR-014, G-267).
  const shown = view;
  // A project's drawing has its own tool row (Snap, Select, Clearances): Doors and fronts joins it there (ADR-109).
  const frontsInPlan = inProject && mode === 'compose' && showsDrawing(shown);
  // Mounted only while the editor is the page shown (ADR-014): hidden on Projects or Catalog it kept rendering.
  const mount3d = has3d && shows3d(shown) && page === 'editor';

  // The piece list beside the plan (ADR-094): opened by Add a piece in Compose, only while the project is shown.
  const piecesOpen = usePieceList((s) => s.open);
  const setPiecesOpen = usePieceList((s) => s.setOpen);
  const piecesShown = piecesOpen && inProject && mode === 'compose' && page === 'editor';
  useEffect(() => {
    if (piecesOpen && !(inProject && mode === 'compose')) setPiecesOpen(false);
  }, [piecesOpen, inProject, mode, setPiecesOpen]);
  const openPieces = () => {
    setPiecesOpen(true);
    // Items are dropped on the plan: it comes forward, and on a phone the Compose sheet steps aside.
    setView(bringDrawingForward);
    setSheetOpen(false);
  };

  // A piece waiting to be placed (ADR-056) or a room being drawn (ADR-059) is done on the plan, in Compose.
  const tapMode = useDesign((s) =>
    s.placingItemId ? `place:${s.placingItemId}` : s.drawingRoom ? 'draw' : '',
  );
  // Choosing a piece or a space never opens the sheet past its peek row on a phone (user 2026-11-09): the drawing
  // stays in view so a further tap drills one level deeper (ADR-088); the peek row opens the editor.
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
    // Read so a one-time "keep closed" request does not linger; the sheet stays where it is either way.
    takeKeepSheetClosed();
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

  // After any save: ask the browser to keep data once, back up to the chosen folder, and keep the save times for the
  // backup reminder (ADR-133, ADR-141).
  useEffect(() => {
    const offs = [startAutoBackup(), startChangeClock()];
    return () => offs.forEach((off) => off());
  }, []);
  // A remembered account shows at once; the session is checked when the online part loads (ADR-134).
  useEffect(() => {
    void initAccount();
  }, []);
  // A share link opens its preview (ADR-138, ADR-143).
  useShareLink();

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
      // The project as it was opened is kept as a version at its first change (ADR-123, G-155).
      void keepSessionVersion().catch(() => {});
      saveProject(project)
        .then(() => setSave('saved'))
        .catch(() => setSave('failed'));
    }, 400);
    return () => clearTimeout(t);
  }, [project, projectDirtyAt, started]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!editorShortcutAllowed(e, page)) return;
      const t = e.target as HTMLElement;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      // Delete or Backspace asks to remove the one piece selected in a project (ADR-160); not inside a piece or a dialog.
      if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const st = useDesign.getState();
        const item = st.project?.items.find((i) => i.id === st.selectedItemId);
        if (
          page === 'editor' &&
          item &&
          st.selectedItemIds.length === 1 &&
          !st.editingItemId &&
          // A space inside the piece is picked (ADR-106): Delete is not for the whole piece then.
          typeof st.selectedId !== 'string' &&
          !t.closest('dialog, [contenteditable="true"]') &&
          !document.querySelector('dialog[open]')
        ) {
          e.preventDefault();
          void askRemove(item, st.removeItem);
        } else if (
          // Several pieces: the same question as the selection card's Delete (ADR-246).
          page === 'editor' &&
          st.project &&
          st.selectedItemIds.length > 1 &&
          !st.editingItemId &&
          !t.closest('dialog, [contenteditable="true"]') &&
          !document.querySelector('dialog[open]')
        ) {
          e.preventDefault();
          const n = st.selectedItemIds.length;
          void askConfirm(tt('Delete these {n} pieces from this project?', { n }), {
            confirmLabel: tt('Delete'),
            danger: true,
            cancelFirst: true,
          }).then((ok) => ok && useDesign.getState().deleteSelection());
        }
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
          // Several pieces are copied as a block, as the selection card does (ADR-246).
          if (st.selectedItemIds.length > 1) st.duplicateSelection();
          else st.duplicateItem(st.selectedItemId);
        }
      }
      // Ctrl/Cmd+A selects every piece of the open project (ADR-097).
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        const st = useDesign.getState();
        if (page === 'editor' && st.project && !st.editingItemId && !st.placingItemId) {
          e.preventDefault();
          st.selectAll();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
      // Esc in an open dialog closes the dialog only, not the selection too (ADR-160); Esc that cancels a drag or a
      // turn on the plan (ADR-065, ADR-169) is taken there first and leaves the selection alone.
      if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('dialog[open]')) {
        const st = useDesign.getState();
        if (st.project && !st.editingItemId) st.selectItem(null);
        // In the piece editor Esc goes up one level: a space → the one around it → the whole piece → nothing (ADR-203).
        else st.select(parentOf(st.model, st.selectedId));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, page]);

  const errors = vd.diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = vd.diagnostics.length - errors;
  const buildMeta = errors
    ? t('{n|problem|problems}', { n: errors })
    : warnings
      ? t('to check')
      : '';
  const selectedItem = project?.items.find((i) => i.id === selectedItemId);
  const selectedCount = useDesign((s) => s.selectedItemIds.length);
  const selectedModel = project?.models?.find((m) => m.id === selectedItemId);
  // Inside a project piece (ADR-088) the peek row names the level reached too: "Wardrobe › Hanging".
  const drillLevel =
    inProject && selectedItem && drillItemId === selectedItem.id && typeof selectedId === 'string'
      ? selectionLabel(design.product, selectedId)
      : null;
  const peek = inProject
    ? selectedCount > 1
      ? t('{n} pieces selected', { n: selectedCount })
      : selectedItem || selectedModel
        ? t('Selected: {name}', {
            name: drillLevel
              ? `${selectedItem!.design.name} › ${drillLevel}`
              : String(selectedItem?.design.name ?? selectedModel?.name),
          })
        : t('{name}: {n|# piece|# pieces}', { name: project!.name, n: project!.items.length })
    : (() => {
        const l = selectionLabel(design.product, selectedId);
        return l ? t('Selected: {name}', { name: l }) : t('Tap a space to edit it');
      })();

  const nameField = (
    <input
      className="name"
      aria-label={inProject ? t('Name of this project') : t('Name of this piece')}
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
          {/* The mark goes to Projects, like the Projects place (G-059); on a phone it also names the app. */}
          <a
            className="brand"
            href="#"
            title={t('Projects')}
            aria-label={t('Furniture Builder, go to Projects')}
            onClick={(e) => {
              e.preventDefault();
              setPage('projects');
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <line x1="3" y1="15.5" x2="21" y2="15.5" />
            </svg>
            <span className="brand-name">Furniture Builder</span>
          </a>
          <nav className="pages places" aria-label={t('Places')} ref={navRef}>
            {PLACES.map((p) => (
              <a
                key={p.page}
                href={p.page === 'projects' ? '#' : `#${p.page}`}
                aria-current={
                  page === p.page && !(phone && p.page === 'editor' && mode === 'build')
                    ? 'page'
                    : undefined
                }
                onClick={(e) => {
                  e.preventDefault();
                  setPage(p.page);
                  // A phone's Editor place is the drawing; the results are their own place (ADR-241).
                  if (phone && p.page === 'editor') setMode('compose');
                }}
              >
                <Icon name={p.icon} className="sm" />
                <span>{p.label}</span>
                {p.page === 'catalog' && <span className="count">{CATALOG_ITEMS}</span>}
              </a>
            ))}
            {/* Phones (ADR-241): the parts list, sheets, hardware, assembly, shopping and checks are one place, in
                place of the Compose · Build & Preview row. It needs an open piece or project. */}
            {phone && designOpen && (
              <a
                href="#editor"
                aria-current={page === 'editor' && mode === 'build' ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  setPage('editor');
                  setMode('build');
                  const st = useDesign.getState();
                  if (!st.resultsOpen) st.setTab(errors ? 'checks' : 'parts');
                }}
              >
                <Icon name="layers" className="sm" />
                <span>{t('Cut list')}</span>
                {(errors || warnings) > 0 && (
                  <span className={`badge ${errors ? 'error' : 'warning'}`} aria-label={buildMeta}>
                    {errors || warnings}
                  </span>
                )}
              </a>
            )}
          </nav>
          {page === 'editor' && (
            <div
              className={
                templateEdit ? 'path template' : editingItemId && project ? 'path piece' : 'path'
              }
            >
              {templateEdit ? (
                <>
                  <span className="crumb family" title={t('Template')}>
                    {tr(templateEdit.template.family.name)}
                  </span>
                  <span className="sep family" aria-hidden="true">
                    ›
                  </span>
                  <span className="crumb here">
                    {tr(
                      templateEdit.template.family.variants.find(
                        (v) => v.id === templateEdit.variantId,
                      )?.name ?? '',
                    )}
                  </span>
                  <button
                    type="button"
                    className="btn sm primary"
                    aria-label={t('Save to template')}
                    title={t('Saved to the template on this device')}
                    onClick={async () => {
                      // One save, one revision; a draft that cannot be stored waits on the Catalog page (ADR-195).
                      // A failed save says so (ADR-244); the draft still waits on the Catalog page.
                      if (!(await saveTemplateEdit()))
                        useUi.getState().setNotice({
                          ok: false,
                          text: t(
                            'Not saved to the template; your draft waits on the Catalog page.',
                          ),
                        });
                      setPage('catalog');
                    }}
                  >
                    {t('Save')}
                    <span className="lbl-long">{t(' to template')}</span>
                  </button>
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => {
                      cancelTemplateEdit();
                      setPage('catalog');
                    }}
                  >
                    {t('Cancel')}
                  </button>
                </>
              ) : editingItemId && project ? (
                <>
                  <button
                    type="button"
                    className="crumb back"
                    aria-label={t('Back to project {name}', { name: project.name })}
                    title={
                      editingName
                        ? t('Changes to {name} stay in this project', { name: editingName })
                        : t('Changes to this piece stay in this project')
                    }
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
          {page === 'editor' && !phone && <EstimateChip />}
          <SyncStatus />
          <div className="bar-tools">
            {page === 'editor' && (
              <>
                <button
                  type="button"
                  className="btn icon"
                  onClick={undo}
                  disabled={!canUndo}
                  aria-label={t('Undo')}
                  title={
                    inProject && undoName
                      ? t('Undo {step} (Ctrl+Z)', { step: tr(undoName) })
                      : t('Undo (Ctrl+Z)')
                  }
                >
                  <Icon name="undo" />
                </button>
                <button
                  type="button"
                  className="btn icon"
                  onClick={redo}
                  disabled={!canRedo}
                  aria-label={t('Redo')}
                  title={
                    inProject && redoName
                      ? t('Redo {step} (Ctrl+Shift+Z)', { step: tr(redoName) })
                      : t('Redo (Ctrl+Shift+Z)')
                  }
                >
                  <Icon name="redo" />
                </button>
                <button
                  type="button"
                  className="btn icon"
                  onClick={() => setSettingsOpen(true)}
                  aria-label={t('Settings')}
                  title={
                    inProject ? t('Project settings') : t('Size, construction, boards and drawers')
                  }
                >
                  <Icon name="sliders" />
                </button>
                <button
                  type="button"
                  className="btn icon"
                  onClick={() => setMaterialOpen(true)}
                  aria-label={t('Material')}
                  title={t(
                    'Material: put a board on parts of this item, a group or the whole project',
                  )}
                >
                  <Icon name="swatch" />
                </button>
              </>
            )}
            <AccountButton />
            <button
              type="button"
              className="btn icon theme"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={
                theme === 'dark' ? t('Switch to the light theme') : t('Switch to the dark theme')
              }
              title={theme === 'dark' ? t('Light theme') : t('Dark theme')}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>
            <MoreMenu
              onNew={() => setDialog('new')}
              onOpened={() => setPage('editor')}
              onResearch={() => setPage('research')}
              onGaps={() => setPage('gaps')}
              onInfo={() => setPage('info')}
            />
          </div>
        </header>
        {page === 'editor' && (
          <div className="modes" ref={modesRef}>
            <div
              className="segmented"
              role="radiogroup"
              aria-label={t('Editor mode')}
              onKeyDown={rovingKeys}
            >
              {MODES.map((m, i) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  tabIndex={rovingTab(mode === m, i, MODES.includes(mode))}
                  className={mode === m ? 'on' : ''}
                  onClick={() => setMode(m)}
                >
                  {MODE_LABEL[m]}
                  {m === 'build' && buildMeta && (
                    <span className={`badge ${errors ? 'error' : 'warning'}`}>
                      {errors || warnings}
                      <span className="badge-words"> {buildMeta}</span>
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
              aria-label={t('Dismiss')}
              onClick={() => setNotice(null)}
            >
              <Icon name="x" className="sm" />
            </button>
          </p>
        )}

        {page === 'projects' && (
          <ProjectsPage onOpened={() => setPage('editor')} onNewPiece={() => setDialog('new')} />
        )}
        <Suspense fallback={<PageLoading />}>
          {page === 'catalog' && (
            <CatalogPage
              onDone={() => setPage('editor')}
              designOpen={designOpen}
              onNewPiece={() => openWizard(null)}
            />
          )}
          {page === 'research' && (
            <ResearchPage onDone={() => setPage('editor')} designOpen={designOpen} />
          )}
          {page === 'gaps' && <GapsPage onDone={() => setPage('editor')} designOpen={designOpen} />}
          {page === 'info' && <InfoPage onDone={() => setPage('editor')} />}
        </Suspense>
        <main
          className={`work mode-${mode} ${sheetOpen ? 'sheet-open' : ''} ${sheetStop === 'full' ? 'sheet-full' : ''}`}
          hidden={page !== 'editor'}
        >
          <aside className="side" aria-label={t('Compose')}>
            <div className="sheet-peek-row">
              {phone && <SheetHandle stop={sheetStop} onStop={setSheetStop} />}
              <button
                type="button"
                className="sheet-peek"
                aria-expanded={sheetOpen}
                onClick={() => setSheetOpen(!sheetOpen)}
              >
                <span>{peek}</span>
                <Icon name={sheetOpen ? 'chevron-down' : 'chevron-up'} className="sm" />
              </button>
              {phone && inProject && <PeekActions onAdd={openPieces} />}
            </div>
            <div className="side-body">
              {inProject ? (
                <ProjectPanel mode="compose" onAdd={openPieces} />
              ) : (
                <Inspector mode="compose" />
              )}
            </div>
          </aside>
          <section
            className={`stage ${shown === 'both' ? 'both' : ''} ${piecesShown ? 'with-pieces' : ''}`}
            aria-label={t('Drawing')}
          >
            {piecesShown && (
              <PieceList
                onBrowse={() => {
                  setPiecesOpen(false);
                  openCatalog();
                }}
                onWizard={() => openWizard(null, true)}
              />
            )}
            <div className="stage-tools">
              <div
                className="segmented small"
                role="radiogroup"
                aria-label={t('View')}
                onKeyDown={rovingKeys}
              >
                {viewOptions(has3d).map((o, i, all) => (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={shown === o.id}
                    tabIndex={rovingTab(
                      shown === o.id,
                      i,
                      all.some((x) => x.id === shown),
                    )}
                    className={shown === o.id ? 'on' : ''}
                    disabled={o.disabled}
                    title={o.reason}
                    onClick={() => setView(o.id)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {/* Fronts stays in the row on a phone too (G-269); the other tools go behind Options there. */}
              {!frontsInPlan && (
                <label className="toggle small">
                  <input
                    type="checkbox"
                    aria-label={t('Doors and fronts')}
                    checked={showFronts}
                    onChange={(e) => setShowFronts(e.target.checked)}
                  />
                  <span className="fronts-long">{t('Doors and fronts')}</span>
                  <span className="fronts-short">{t('Fronts')}</span>
                </label>
              )}
              <ViewOptions menu={inOptions('exploded', phone)}>
                {shows3d(shown) && (
                  <label className="toggle small">
                    <input
                      type="checkbox"
                      checked={exploded}
                      onChange={(e) => setExploded(e.target.checked)}
                    />
                    <span>{t('Exploded 3D')}</span>
                  </label>
                )}
                {shows3d(shown) && (
                  <button type="button" className="btn sm" onClick={requestFit}>
                    <Icon name="refresh" className="sm" />
                    {t('Reset view')}
                  </button>
                )}
                {mount3d && (
                  <div
                    className="segmented small"
                    role="radiogroup"
                    aria-label={t('Look')}
                    onKeyDown={rovingKeys}
                  >
                    {(['simple', 'realistic'] as const).map((l, i) => (
                      <button
                        key={l}
                        type="button"
                        role="radio"
                        aria-checked={look === l}
                        tabIndex={rovingTab(look === l, i, true)}
                        className={look === l ? 'on' : ''}
                        onClick={() => setLook(l)}
                      >
                        {l === 'simple' ? t('Simple') : t('Realistic')}
                      </button>
                    ))}
                  </div>
                )}
                {mount3d && (
                  <button
                    type="button"
                    className="btn sm"
                    title={t(
                      'Render a photo-quality picture. Best on a laptop; a phone may be slow.',
                    )}
                    onClick={() => setDialog('render')}
                  >
                    <Icon name="camera" className="sm" />
                    {t('Render')}
                  </button>
                )}
                {mount3d && <SceneMenu name={inProject ? project!.name : design.name} />}
              </ViewOptions>
            </div>
            <div className={`views ${shown === 'both' ? 'both' : ''}`}>
              <div className={`view front ${showsDrawing(shown) ? 'active' : ''}`}>
                {inProject ? (
                  <PlanView fronts={frontsInPlan} card={!(phone && shows3d(shown))} />
                ) : (
                  <Elevation />
                )}
              </div>
              <div
                className={`view three ${shows3d(shown) ? 'active' : ''}`}
                data-seams={seams ?? undefined}
                data-lit={lit ?? undefined}
              >
                {mount3d ? (
                  <ViewerBoundary>
                    <Suspense
                      fallback={
                        <div className="no-3d">
                          <p className="loading">{t('Loading 3D…')}</p>
                        </div>
                      }
                    >
                      <Viewer3D countCard={countCard} moveTo={moveTo} countDock={countDock} />
                    </Suspense>
                  </ViewerBoundary>
                ) : has3d ? null : (
                  <NoViewer />
                )}
              </div>
            </div>
          </section>
          {/* Phones: the 3D view's quick-count card docks here, under the stage, which keeps its height (G-070). */}
          {phone && <div id="count-dock" ref={setCountDock} className="count-dock-slot" />}
          {/* Phones: the running estimate heads the Cut list place (ADR-241; was in the mode row). */}
          {phone && (
            <div className="cut-estimate">
              <EstimateChip compact />
            </div>
          )}
          <Output />
        </main>

        {/* Closing one dialog to open another fires its close event after the switch: it may only clear itself. */}
        <NewDialog
          open={dialog === 'new'}
          onClose={() => setDialog((d) => (d === 'new' ? null : d))}
          onBrowse={openCatalog}
          onWizard={() => openWizard(null)}
          onFillWall={() => setDialog('wallfill')}
          onFillRoom={() => setDialog('roomfill')}
          onOpened={() => setPage('editor')}
        />
        <WallFillDialog
          open={dialog === 'wallfill'}
          onClose={() => setDialog((d) => (d === 'wallfill' ? null : d))}
          onOpened={() => setPage('editor')}
        />
        <RoomFillDialog
          open={dialog === 'roomfill'}
          onClose={() => setDialog((d) => (d === 'roomfill' ? null : d))}
          onOpened={() => setPage('editor')}
        />
        <WizardDialog
          open={dialog === 'wizard'}
          from={wizardFrom}
          toProject={wizardToProject}
          onClose={() => setDialog((d) => (d === 'wizard' ? null : d))}
          onCreated={() => {
            setDialog(null);
            setPage('editor');
          }}
        />
        <SettingsDialog onWizard={() => openWizard(design)} />
        <MaterialDialog />
        <SavedDataDialog />
        <AccountDialog />
        <AssistantDialog />
        <ShareLinkDialog />
        <SharedItemDialog onOpened={() => setPage('editor')} />
        <BackupReminder />
        <RenderDialog
          open={dialog === 'render'}
          onClose={() => setDialog((d) => (d === 'render' ? null : d))}
          name={inProject ? project!.name : design.name}
        />
      </div>
      <ConfirmHost />
      {printing &&
        (printMode === 'assembly' ? (
          <PrintAssembly />
        ) : printMode === 'client' ? (
          <PrintClient />
        ) : (
          <PrintSheet />
        ))}
    </>
  );
}
