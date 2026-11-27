import { lazy, Suspense, useEffect, useState } from 'react';
import { useDesign } from '../store/designStore';
import type { Design } from '../core/types';
import { t } from '@furniture-builder/i18n';
import { NewDialog } from './Dialogs';
import { SettingsDialog } from './Settings';
import { MaterialDialog } from './MaterialDialog';
import { WizardDialog } from './Wizard';
import { WallFillDialog } from './WallFill';
import { RoomFillDialog } from './RoomFill';
import { ConfirmHost } from './Confirm';
import { Icon } from './icons';
import { RenderDialog } from './RenderDialog';
import { ProjectsPage } from './shell/ProjectsPage';
import { useUi } from '../store/uiStore';
import { BackupReminder, SavedDataDialog, startChangeClock } from './SavedData';
import { startAutoBackup } from '../persist/backup';
import { purgeRecentlyDeleted } from '../persist/db';
import { AccountDialog } from './Account';
import { AssistantDialog } from './Assistant';
import { ShareLinkDialog, SharedItemDialog, useShareLink } from './Share';
import { initAccount } from '../store/accountActions';
import { AppBar } from './shell/AppBar';
import { EditorWork } from './shell/EditorWork';
import { PrintHost } from './shell/PrintHost';
import { useEditorShortcuts } from './shell/useEditorShortcuts';
import { usePage } from './shell/usePage';

// Pages opened on demand load on first use (ADR-222).
const CatalogPage = lazy(() => import('./CatalogPage').then((m) => ({ default: m.CatalogPage })));
const GapsPage = lazy(() => import('./Gaps').then((m) => ({ default: m.GapsPage })));
const InfoPage = lazy(() => import('./Info').then((m) => ({ default: m.InfoPage })));
const OptimizerPage = lazy(() => import('./Optimizer').then((m) => ({ default: m.OptimizerPage })));
const PageLoading = () => (
  <p className="loading" role="status">
    {t('Loading…')}
  </p>
);

/** The app-wide notice under the bar, with its Dismiss button. */
function Notice() {
  const notice = useUi((s) => s.notice);
  const setNotice = useUi((s) => s.setNotice);
  if (!notice) return null;
  return (
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
  );
}

/**
 * The shell (G-500): the bar, the page shown, the editor (kept mounted, hidden on the other pages), the dialogs and the
 * print sheet. Each part reads the store itself, so a change re-renders only the parts that show it; the shell itself
 * holds the page, the open dialog and the start-up work.
 */
export function App() {
  const [page, setPage] = usePage();
  const [dialog, setDialog] = useState<
    null | 'new' | 'wizard' | 'render' | 'wallfill' | 'roomfill'
  >(null);
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
  // The start-up placeholder, untouched, is not an open design: the Catalog's "Back to the editor" waits (ADR-120).
  const [placeholderId] = useState(() => useDesign.getState().design.id);
  const designOpen = useDesign((s) => !!s.project || s.design.id !== placeholderId || !s.pristine);
  const renderName = useDesign((s) =>
    s.project && !s.editingItemId ? s.project.name : s.design.name,
  );

  // After any save: ask the browser to keep data once, back up to the chosen folder, and keep the save times for the
  // backup reminder (ADR-133, ADR-141).
  useEffect(() => {
    const offs = [startAutoBackup(), startChangeClock()];
    return () => offs.forEach((off) => off());
  }, []);
  // The 30-day purge of Recently deleted runs once at start, and says how many it removed (ADR-305).
  useEffect(() => {
    purgeRecentlyDeleted()
      .then((n) => {
        if (n)
          useUi.getState().setNotice({
            ok: true,
            text: t(
              '{n|# item deleted more than 30 days ago was|# items deleted more than 30 days ago were} removed from Recently deleted.',
              { n },
            ),
          });
      })
      .catch(() => {});
  }, []);
  // A remembered account shows at once; the session is checked when the online part loads (ADR-134).
  useEffect(() => {
    void initAccount();
  }, []);
  // A share link opens its preview (ADR-138, ADR-143).
  useShareLink();
  useEditorShortcuts(page);

  return (
    <>
      <div className={`app page-${page}`}>
        <AppBar
          page={page}
          setPage={setPage}
          designOpen={designOpen}
          onNew={() => setDialog('new')}
        />
        <Notice />

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
          {page === 'optimizer' && (
            <OptimizerPage onDone={() => setPage('editor')} designOpen={designOpen} />
          )}
          {page === 'gaps' && <GapsPage onDone={() => setPage('editor')} designOpen={designOpen} />}
          {page === 'info' && (
            <InfoPage
              onDone={() => setPage('editor')}
              designOpen={designOpen}
              onGaps={() => setPage('gaps')}
            />
          )}
        </Suspense>
        <EditorWork
          active={page === 'editor'}
          onRender={() => setDialog('render')}
          onCatalog={openCatalog}
          onWizardToProject={() => openWizard(null, true)}
        />

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
        <SettingsDialog onWizard={() => openWizard(useDesign.getState().design)} />
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
          name={renderName}
        />
      </div>
      <ConfirmHost />
      <PrintHost />
    </>
  );
}
