import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { exportFusionPython } from '../../core/fusion';
import { pictureHolders } from '../../core/project';
import { imageIdsOf } from '../../core/surface';
import { deleteImages, unusedImageIds } from '../../persist/db';
import { withPictures } from '../../persist/images';
import { withModels } from '../../persist/models';
import { useDesign } from '../../store/designStore';
import { askConfirm } from '../Confirm';
import { ReviewPackDialog } from '../ReviewPack';
import { Icon } from '../icons';
import { CopyCodeDialog } from '../ShareCode';
import { download, downloadFrontSvg, fileName } from './files';
import { importFile } from './importFile';
import { useAccount } from '../../store/accountStore';
import { useUi } from './uiStore';
import { LanguageMenu } from './LanguageMenu';
import { t } from '../../core/i18n';

/**
 * The ⋯ More menu in the app bar (ADR-078): starting something new, every file in and out of the app (Files, with
 * the clean-up of unused pictures since G-059), Feature Research and Gaps (ADR-101). Nothing here sits in the top or bottom bar itself. Escape and a click outside close it.
 */
export function MoreMenu({
  onNew,
  onOpened,
  onResearch,
  onGaps,
  onInfo,
}: {
  onNew: () => void;
  onOpened: () => void;
  onResearch: () => void;
  onGaps: () => void;
  onInfo: () => void;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const design = useDesign((s) => s.design);
  const model = useDesign((s) => s.model);
  const project = useDesign((s) => s.project);
  const editingItemId = useDesign((s) => s.editingItemId);
  const inProject = !!project && !editingItemId;
  const setNotice = useUi((s) => s.setNotice);
  const signedIn = useAccount((s) => !!s.user);
  const [pack, setPack] = useState(false);
  const close = () => ref.current?.removeAttribute('open');
  const [codeOpen, setCodeOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && ref.current?.open) {
        close();
        ref.current?.querySelector('summary')?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) close();
    };
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
    close();
    void fn();
  };

  return (
    <>
      <details className="menu more" ref={ref}>
        <summary aria-label={t('More')} title={t('New, files and Feature Research')}>
          <Icon name="more" />
        </summary>
        <div className="menu-items">
          <button type="button" onClick={run(onNew)}>
            <Icon name="plus" />
            {t('New…')} <small>{t('piece or project')}</small>
          </button>
          <p className="menu-head" id="menu-files">
            {t('Files')}
          </p>
          <div role="group" aria-labelledby="menu-files">
            {inProject ? (
              <button
                type="button"
                onClick={run(async () =>
                  download(
                    `${fileName(project.name)}-project.json`,
                    JSON.stringify(
                      await withPictures(await withModels(project), pictureHolders(project)),
                      null,
                      2,
                    ),
                    'application/json',
                  ),
                )}
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
                  onClick={run(async () =>
                    download(
                      `${fileName(design.name)}.json`,
                      JSON.stringify(await withPictures(design, [design]), null, 2),
                      'application/json',
                    ),
                  )}
                >
                  <Icon name="download" />
                  {t('Design file')} <small>{t('to open on another device')}</small>
                </button>
                <button
                  type="button"
                  onClick={run(() => {
                    if (!downloadFrontSvg(design))
                      setNotice({ ok: false, text: t('Open the piece in the editor first.') });
                  })}
                >
                  <Icon name="front" />
                  {t('Front view drawing')} <small>SVG</small>
                </button>
                <button
                  type="button"
                  onClick={run(() =>
                    download(
                      `${fileName(design.name)}-fusion.py`,
                      exportFusionPython(design, model),
                      'text/x-python',
                    ),
                  )}
                >
                  <Icon name="cube" />
                  {t('Fusion 360 script')} <small>{t('not yet tested in Fusion')}</small>
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
          <span className="menu-sep" aria-hidden="true" />
          <LanguageMenu />
          <span className="menu-sep" aria-hidden="true" />
          <button type="button" onClick={run(onInfo)}>
            <Icon name="info" />
            {t('Information and guides')} <small>{t('every feature, by domain')}</small>
          </button>
          <button type="button" onClick={run(onResearch)}>
            <Icon name="search" />
            {t('Feature Research')} <small>{t('papers and decisions')}</small>
          </button>
          <button type="button" onClick={run(onGaps)}>
            <Icon name="alert-triangle" />
            {t('Gaps')} <small>{t('what is not built yet')}</small>
          </button>
        </div>
      </details>
      {/* Out of the app bar, whose styles are for its own buttons. */}
      {pack &&
        createPortal(<ReviewPackDialog open onClose={() => setPack(false)} />, document.body)}
      {codeOpen &&
        createPortal(<CopyCodeDialog onClose={() => setCodeOpen(false)} />, document.body)}
    </>
  );
}
