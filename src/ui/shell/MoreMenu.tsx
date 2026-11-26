import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { exportFusionPython } from '../../core/fusion';
import { pictureHolders } from '../../core/project';
import { imageIdsOf } from '../../core/surface';
import { deleteImages, unusedImageIds } from '../../store/libraryStore';
import { withPictures } from '../../persist/images';
import { withModels } from '../../persist/models';
import { useDesign } from '../../store/designStore';
import { askConfirm } from '../Confirm';
import { ReviewPackDialog } from '../ReviewPack';
import { RoomFillDialog } from '../RoomFill';
import { Icon } from '../icons';
import { CopyCodeDialog } from '../ShareCode';
import { download, downloadFrontSvg, fileName } from './files';
import { importFile } from './importFile';
import { backendConfigured, useAccount } from '../../store/accountStore';
import { useAssistant } from '../../store/assistantStore';
import { useUi } from '../../store/uiStore';
import { useCanvasEditor } from '../../store/useCanvasEditor';
import { useCatalogFinder } from '../../store/useCatalogFinder';
import { LanguageMenu } from './LanguageMenu';
import { AppearanceDialog } from '../Appearance';
import { t } from '@furniture-builder/i18n';

const FILE_FAILED = () =>
  t('The file could not be made: pictures or 3D models could not be read from this browser.');

/**
 * The ⋯ More menu in the app bar (ADR-078): starting something new, every file in and out of the app (Files, with
 * the clean-up of unused pictures since G-059), and Information and guides. The Gaps page (ADR-101) is reached from
 * the Information page. Nothing here sits in the top or bottom bar itself. Escape and a click outside close it.
 */
export function MoreMenu({
  onNew,
  onOpened,
  onInfo,
  onOptimizer,
  current,
}: {
  onNew: () => void;
  onOpened: () => void;
  onInfo: () => void;
  /** Opens the standalone cut list optimizer page. */
  onOptimizer: () => void;
  /** The page the menu leads to that is open now (audit F-29): the menu and its item are marked as current. */
  current?: 'info' | 'optimizer' | 'gaps';
}) {
  const [canvasEditor, setCanvasEditor] = useCanvasEditor();
  const [catalogFinder, setCatalogFinder] = useCatalogFinder();
  const ref = useRef<HTMLDetailsElement>(null);
  const design = useDesign((s) => s.design);
  const model = useDesign((s) => s.model);
  const project = useDesign((s) => s.project);
  const editingItemId = useDesign((s) => s.editingItemId);
  const inProject = !!project && !editingItemId;
  const blocked = model.diagnostics.some((d) => d.severity === 'error');
  const blockedWhy = blocked ? t('Fix the problems listed under Checks first') : undefined;
  const setNotice = useUi((s) => s.setNotice);
  const signedIn = useAccount((s) => !!s.user);
  const [pack, setPack] = useState(false);
  const [appearance, setAppearance] = useState(false);
  const [roomFill, setRoomFill] = useState(false);
  // With focusButton, focus goes to the More button: closing hides the entry that had it, and a dialog that opens
  // next restores focus there (audit F-02).
  const close = (focusButton?: boolean) => {
    ref.current?.removeAttribute('open');
    if (focusButton) ref.current?.querySelector('summary')?.focus();
  };
  const [codeOpen, setCodeOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!ref.current?.open) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
        ref.current.querySelector('summary')?.focus();
        return;
      }
      // Arrow keys, Home and End move through the entries (audit F-02); the menu stays a disclosure.
      // Only from inside the menu: the listener is on the window now (G-374), and Safari does not focus the summary.
      const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
      if (!ref.current.contains(e.target as Node)) return;
      if (!keys.includes(e.key) || e.altKey || e.ctrlKey || e.metaKey) return;
      const items = Array.from(
        ref.current.querySelectorAll<HTMLElement>(
          '.menu-items button:not(:disabled), .menu-items input[type="file"]',
        ),
      );
      if (!items.length) return;
      const at = items.indexOf(document.activeElement as HTMLElement);
      let next: number;
      if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = items.length - 1;
      else if (e.key === 'ArrowDown') next = at < 0 ? 0 : (at + 1) % items.length;
      else next = at < 0 ? items.length - 1 : (at - 1 + items.length) % items.length;
      e.preventDefault();
      items[next].focus();
    };
    const onClick = (e: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) close();
    };
    // On the window, gated on the menu being open: Safari does not focus <summary> on click, so a keydown may never
    // pass through the menu element (G-374).
    window.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
    };
  }, []);

  // Pictures no saved piece, project or template uses (ADR-048), after the user confirms.
  const cleanUp = async () => {
    const st = useDesign.getState();
    const keep = imageIdsOf([st.design, ...(st.project ? pictureHolders(st.project) : [])]);
    try {
      const ids = await unusedImageIds(keep);
      if (!ids.length) {
        setNotice({ ok: true, text: t('No unused pictures on this device.') });
        return;
      }
      if (
        !(await askConfirm(
          t(
            'Delete {n|# picture|# pictures} that no saved piece, project or template uses? This cannot be undone.',
            { n: ids.length },
          ),
          { confirmLabel: t('Delete pictures'), danger: true },
        ))
      )
        return;
      await deleteImages(ids);
      setNotice({
        ok: true,
        text: t('{n|# unused picture|# unused pictures} deleted.', { n: ids.length }),
      });
    } catch {
      setNotice({ ok: false, text: t('Pictures could not be read from this browser.') });
    }
  };

  const run = (fn: () => void | Promise<void>) => () => {
    // Closing hides the entry that had focus, so focus goes to the More button first; a dialog that opens next
    // then restores focus there when it closes (audit F-02).
    close(true);
    void fn();
  };

  return (
    <>
      <details className="menu more" ref={ref}>
        <summary
          aria-label={t('More')}
          aria-current={current ? 'page' : undefined}
          title={t('New and files')}
        >
          <Icon name="more" />
        </summary>
        <div className="menu-items">
          <button type="button" onClick={run(onNew)}>
            <Icon name="plus" />
            {t('New…')} <small>{t('piece or project')}</small>
          </button>
          {/* Fill the room (ADR-173), beside New… and outside Files (ADR-248): mixes for every wall of this project's room, added to the project. */}
          {inProject && project.room && (
            <button type="button" onClick={run(() => setRoomFill(true))}>
              <Icon name="project" />
              {t('Fill the room…')} <small>{t('every wall of this room at once')}</small>
            </button>
          )}
          {/* The standalone cut list optimizer: typed sizes and one board, no design needed. */}
          <button
            type="button"
            aria-current={current === 'optimizer' ? 'page' : undefined}
            onClick={run(onOptimizer)}
          >
            <Icon name="grid" />
            {t('Cut list optimizer')} <small>{t('type sizes, see how many sheets')}</small>
          </button>
          <p className="menu-head" id="menu-files">
            {t('Files')}
          </p>
          <div role="group" aria-labelledby="menu-files">
            {inProject ? (
              <button
                type="button"
                onClick={run(async () => {
                  // A file that cannot be made is said (ADR-263), never a silent nothing.
                  try {
                    download(
                      `${fileName(project.name)}-project.json`,
                      JSON.stringify(
                        await withPictures(await withModels(project), pictureHolders(project)),
                        null,
                        2,
                      ),
                      'application/json',
                    );
                  } catch {
                    setNotice({ ok: false, text: FILE_FAILED() });
                  }
                })}
              >
                <Icon name="download" />
                {t('Project file')} <small>{t('to open on another device')}</small>
              </button>
            ) : null}
            {/* The review pack (ADR-121): summary, parts, drawings and the project file in one .zip. */}
            {inProject && (
              <button type="button" onClick={run(() => setPack(true))}>
                <Icon name="upload" />
                {t('Hand to a professional…')} <small>{t('one .zip to check the plan')}</small>
              </button>
            )}
            {inProject ? null : (
              <>
                <button
                  type="button"
                  onClick={run(async () => {
                    try {
                      download(
                        `${fileName(design.name)}.json`,
                        JSON.stringify(await withPictures(design, [design]), null, 2),
                        'application/json',
                      );
                    } catch {
                      setNotice({ ok: false, text: FILE_FAILED() });
                    }
                  })}
                >
                  <Icon name="download" />
                  {t('Design file')} <small>{t('to open on another device')}</small>
                </button>
                {/* Exports are blocked while the piece has an error, with the reason (ADR-008, ADR-260). */}
                <button
                  type="button"
                  disabled={blocked}
                  title={blockedWhy}
                  onClick={run(async () => {
                    if (!(await downloadFrontSvg(design)))
                      setNotice({ ok: false, text: t('Open the piece in the editor first.') });
                  })}
                >
                  <Icon name="front" />
                  {t('Front view drawing')} <small>{blockedWhy ?? 'SVG'}</small>
                </button>
                <button
                  type="button"
                  disabled={blocked}
                  title={blockedWhy}
                  onClick={run(() =>
                    download(
                      `${fileName(design.name)}-fusion.py`,
                      exportFusionPython(design, model),
                      'text/x-python',
                    ),
                  )}
                >
                  <Icon name="cube" />
                  {t('Fusion 360 script')}{' '}
                  <small>{blockedWhy ?? t('not yet tested in Fusion')}</small>
                </button>
              </>
            )}
            {/* A server link for the open piece, once signed in (ADR-138); codes stay beside it (G-257). */}
            {signedIn && !inProject && (
              <button
                type="button"
                onClick={run(() =>
                  useAccount.getState().set({
                    shareFor: { table: 'designs', id: design.id, name: design.name },
                  }),
                )}
              >
                <Icon name="link" />
                {t('Share link')} <small>{t('anyone with the link can open a copy')}</small>
              </button>
            )}
            <button type="button" onClick={run(() => setCodeOpen(true))}>
              <Icon name="copy" />
              {t('Copy code')} <small>{t('a code or link to open on another device')}</small>
            </button>
            <label className="menu-file">
              <Icon name="upload" />
              {t('Import a file')} <small>{t('design, project or project template')}</small>
              <input
                type="file"
                accept="application/json,.json"
                aria-label={t('Import a file')}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  close();
                  if (!f) return;
                  void importFile(f).then((r) => {
                    setNotice(r.message ?? null);
                    if (r.opened) onOpened();
                  });
                }}
              />
            </label>
            <button type="button" onClick={run(cleanUp)}>
              <Icon name="trash" />
              {t('Clean up unused pictures')} <small>{t('no piece or project uses them')}</small>
            </button>
            <button type="button" onClick={run(() => useUi.getState().setSavedDataOpen(true))}>
              <Icon name="hdd" />
              {t('Saved data and backup')} <small>{t('keep, back up and restore')}</small>
            </button>
          </div>
          {backendConfigured() && (
            <>
              <span className="menu-sep" aria-hidden="true" />
              <button type="button" onClick={run(() => useAssistant.getState().setOpen(true))}>
                <Icon name="pencil" />
                {t('Assistant')} <small>{t('ask for a change in your own words')}</small>
              </button>
            </>
          )}
          <span className="menu-sep" aria-hidden="true" />
          {/* The canvas editor on phones, a preview behind a device flag (ADR-283). */}
          <button
            type="button"
            aria-pressed={canvasEditor}
            onClick={run(() => setCanvasEditor(!canvasEditor))}
          >
            <Icon name="sliders" />
            {t('Canvas editor (preview)')}{' '}
            <small>
              {canvasEditor ? t('on: edit on the drawing') : t('off: the editor sheet')}
            </small>
          </button>
          {/* The catalog finder, a preview behind a device flag (ADR-291). */}
          <button
            type="button"
            aria-pressed={catalogFinder}
            onClick={run(() => setCatalogFinder(!catalogFinder))}
          >
            <Icon name="search" />
            {t('Catalog finder (preview)')}{' '}
            <small>
              {catalogFinder ? t('on: search and filters') : t('off: the grouped catalog')}
            </small>
          </button>
          <span className="menu-sep" aria-hidden="true" />
          <button type="button" onClick={run(() => setAppearance(true))}>
            <Icon name="sliders" />
            {t('Appearance')} <small>{t('font size, gaps, paddings')}</small>
          </button>
          <LanguageMenu />
          <span className="menu-sep" aria-hidden="true" />
          <button
            type="button"
            aria-current={current === 'info' ? 'page' : undefined}
            onClick={run(onInfo)}
          >
            <Icon name="info" />
            {t('Information and guides')} <small>{t('every feature, by domain')}</small>
          </button>
        </div>
      </details>
      {/* Out of the app bar, whose styles are for its own buttons. */}
      {appearance &&
        createPortal(<AppearanceDialog open onClose={() => setAppearance(false)} />, document.body)}
      {pack &&
        createPortal(<ReviewPackDialog open onClose={() => setPack(false)} />, document.body)}
      {roomFill &&
        createPortal(
          <RoomFillDialog open addTo onClose={() => setRoomFill(false)} onOpened={onOpened} />,
          document.body,
        )}
      {codeOpen &&
        createPortal(<CopyCodeDialog onClose={() => setCodeOpen(false)} />, document.body)}
    </>
  );
}
