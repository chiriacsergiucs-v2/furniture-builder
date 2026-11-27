import { useEffect, useRef } from 'react';
import { t, tr } from '@furniture-builder/i18n';
import { catalogFamilies } from '../../core/catalog';
import { useDesign } from '../../store/designStore';
import { useMediaQuery } from '../../store/useMediaQuery';
import { setTheme, useTheme } from '../../store/useTheme';
import { MODE_LABEL, MODES, useUi } from '../../store/uiStore';
import { cancelTemplateEdit, saveTemplateEdit } from '../../store/templatesStore';
import { AccountButton } from '../Account';
import { rovingKeys, rovingTab } from '../controls';
import { Icon } from '../icons';
import { useCheckCounts } from './checkCounts';
import { EstimateChip } from './EstimateChip';
import { MoreMenu } from './MoreMenu';
import { SaveStatus } from './SaveStatus';
import type { Page } from './usePage';

const CATALOG_ITEMS = catalogFamilies.reduce((n, f) => n + f.variants.length, 0);
const PLACES: { page: Page; label: string; icon: 'folder' | 'catalog' | 'front' }[] = [
  { page: 'projects', label: t('Projects'), icon: 'folder' },
  { page: 'catalog', label: t('Catalog'), icon: 'catalog' },
  { page: 'editor', label: t('Editor'), icon: 'front' },
];

/** "3 problems", "to check" or nothing: what the Build & Preview badge says. */
const buildMetaOf = (errors: number, warnings: number) =>
  errors ? t('{n|problem|problems}', { n: errors }) : warnings ? t('to check') : '';

/**
 * The Compose · Build & Preview switch: its own row under the bar on a phone (hidden there, ADR-241); inside the top
 * bar on desktop (ADR-297).
 */
function ModeSwitch({ phone }: { phone: boolean }) {
  const mode = useUi((s) => s.mode);
  const setMode = useUi((s) => s.setMode);
  const { errors, warnings } = useCheckCounts();
  const buildMeta = buildMetaOf(errors, warnings);
  return (
    <div
      className={phone ? 'segmented' : 'segmented mode-switch'}
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
  );
}

/** The name of the open piece or project, typed in place. */
function NameField() {
  const inProject = useDesign((s) => !!s.project && !s.editingItemId);
  const projectId = useDesign((s) => s.project?.id);
  const projectName = useDesign((s) => s.project?.name ?? '');
  const designId = useDesign((s) => s.design.id);
  const designName = useDesign((s) => s.design.name);
  const rename = useDesign((s) => s.rename);
  return (
    <input
      className="name"
      aria-label={inProject ? t('Name of this project') : t('Name of this piece')}
      // Shown in the user's language; the stored built-in name is kept unless the user types another (ADR-265).
      defaultValue={tr(inProject ? projectName : designName)}
      key={inProject ? `p-${projectId}-${projectName}` : `${designId}-${designName}`}
      onBlur={(e) => {
        const v = e.target.value.trim();
        if (!v) return;
        if (inProject) {
          if (v !== projectName && v !== tr(projectName))
            useDesign.getState().updateProject((p) => ({ ...p, name: v }));
        } else if (v !== designName && v !== tr(designName)) rename(v);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

/** Where the editor is: a template being edited, a project piece (with the way back) or the piece or project name. */
function EditorPath({ setPage }: { setPage: (p: Page) => void }) {
  const templateEdit = useDesign((s) => s.templateEdit);
  const editingItemId = useDesign((s) => s.editingItemId);
  const hasProject = useDesign((s) => !!s.project);
  const projectName = useDesign((s) => s.project?.name ?? '');
  const editingName = useDesign(
    (s) => s.project?.items.find((i) => i.id === s.editingItemId)?.design.name,
  );
  return (
    <div
      className={
        templateEdit ? 'path template' : editingItemId && hasProject ? 'path piece' : 'path'
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
              templateEdit.template.family.variants.find((v) => v.id === templateEdit.variantId)
                ?.name ?? '',
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
                  text: t('Not saved to the template; your draft waits on the Catalog page.'),
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
      ) : editingItemId && hasProject ? (
        <>
          <button
            type="button"
            className="crumb back"
            aria-label={t('Back to project {name}', { name: projectName })}
            title={
              editingName
                ? t('Changes to {name} stay in this project', { name: editingName })
                : t('Changes to this piece stay in this project')
            }
            onClick={() => useDesign.getState().backToProject()}
          >
            <Icon name="chevron-left" className="sm" />
            {projectName}
          </button>
          <span className="sep" aria-hidden="true">
            ›
          </span>
          <NameField />
        </>
      ) : (
        <NameField />
      )}
    </div>
  );
}

/** Undo, Redo, Settings and Material in the editor's bar. */
function EditorTools() {
  const inProject = useDesign((s) => !!s.project && !s.editingItemId);
  // The project view undoes project changes (ADR-051); the piece editor undoes piece edits.
  const canUndo = useDesign((s) =>
    s.project && !s.editingItemId ? s.projectPast.length > 0 : s.past.length > 0,
  );
  const canRedo = useDesign((s) =>
    s.project && !s.editingItemId ? s.projectFuture.length > 0 : s.future.length > 0,
  );
  // The step each would undo or redo, named (ADR-123).
  const undoName = useDesign((s) => s.projectPastNames[s.projectPastNames.length - 1]);
  const redoName = useDesign((s) => s.projectFutureNames[0]);
  const setSettingsOpen = useUi((s) => s.setSettingsOpen);
  const setMaterialOpen = useUi((s) => s.setMaterialOpen);
  const undo = () => {
    const st = useDesign.getState();
    if (st.project && !st.editingItemId) st.undoProject();
    else st.undo();
  };
  const redo = () => {
    const st = useDesign.getState();
    if (st.project && !st.editingItemId) st.redoProject();
    else st.redo();
  };
  return (
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
        title={inProject ? t('Project settings') : t('Size, construction, boards and drawers')}
      >
        <Icon name="sliders" />
      </button>
      <button
        type="button"
        className="btn icon"
        onClick={() => setMaterialOpen(true)}
        aria-label={t('Material')}
        title={t('Material: put a board on parts of this item, a group or the whole project')}
      >
        <Icon name="swatch" />
      </button>
    </>
  );
}

function ThemeButton() {
  const theme = useTheme();
  return (
    <button
      type="button"
      className="btn icon theme"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label={theme === 'dark' ? t('Switch to the light theme') : t('Switch to the dark theme')}
      title={theme === 'dark' ? t('Light theme') : t('Dark theme')}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}

/**
 * The app's top bar and, on a phone in the editor, the mode row under it (moved out of App, G-500). The drawing on
 * phones is sized to the space left between the bars; both bars report their heights.
 */
export function AppBar({
  page,
  setPage,
  designOpen,
  onNew,
}: {
  page: Page;
  setPage: (p: Page) => void;
  designOpen: boolean;
  onNew: () => void;
}) {
  const mode = useUi((s) => s.mode);
  const setMode = useUi((s) => s.setMode);
  const phone = useMediaQuery('(max-width: 760px)');
  const { errors, warnings } = useCheckCounts();
  const buildMeta = buildMetaOf(errors, warnings);
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
  return (
    <>
      <header className="bar" ref={barRef}>
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
              <span>{t('Cut List')}</span>
              {(errors || warnings) > 0 && (
                <span className={`badge ${errors ? 'error' : 'warning'}`} aria-label={buildMeta}>
                  {errors || warnings}
                </span>
              )}
            </a>
          )}
        </nav>
        {page === 'editor' && <EditorPath setPage={setPage} />}
        <SaveStatus shown={page === 'editor'} />
        {page === 'editor' && !phone && <ModeSwitch phone={phone} />}
        {page === 'editor' && !phone && <EstimateChip />}
        <div className="bar-tools">
          {page === 'editor' && <EditorTools />}
          <AccountButton />
          <ThemeButton />
          <MoreMenu
            onNew={onNew}
            onOpened={() => setPage('editor')}
            onInfo={() => setPage('info')}
            onOptimizer={() => setPage('optimizer')}
            // Gaps is reached from Information, so it marks Information as the current place (G-535).
            current={
              page === 'optimizer'
                ? 'optimizer'
                : page === 'info' || page === 'gaps'
                  ? 'info'
                  : undefined
            }
          />
        </div>
      </header>
      {page === 'editor' && phone && (
        <div className="modes" ref={modesRef}>
          <ModeSwitch phone={phone} />
        </div>
      )}
    </>
  );
}
