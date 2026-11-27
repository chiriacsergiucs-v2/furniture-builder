import { useEffect, useState } from 'react';
import { t } from '@furniture-builder/i18n';
import {
  lastDesignId,
  lastProjectId,
  loadDesign,
  loadProject,
  rememberLast,
  rememberLastProject,
  saveDesign,
  saveProject,
} from '../../store/libraryStore';
import { useDesign } from '../../store/designStore';
import { keepSessionVersion } from '../../store/versions';

type SaveState = 'idle' | 'saving' | 'saved' | 'failed';
const SAVE_TEXT: Record<SaveState, string> = {
  idle: '',
  saving: t('Saving…'),
  saved: t('Saved on this device'),
  failed: t('Not saved — browser storage unavailable'),
};

/**
 * Reopens the last piece or project, autosaves after each change and says how the save went (shown in the editor's
 * bar only). It stays mounted on every page, so saving never waits for the editor (moved out of App, G-500).
 */
export function SaveStatus({ shown }: { shown: boolean }) {
  const design = useDesign((s) => s.design);
  const dirtyAt = useDesign((s) => s.dirtyAt);
  const project = useDesign((s) => s.project);
  const projectDirtyAt = useDesign((s) => s.projectDirtyAt);
  const [save, setSave] = useState<SaveState>('idle');

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
      // The project as it was opened is kept as a version at its first change (ADR-123, G-155).
      void keepSessionVersion().catch(() => {});
      saveProject(project)
        .then(() => setSave('saved'))
        .catch(() => setSave('failed'));
    }, 400);
    return () => clearTimeout(t);
  }, [project, projectDirtyAt, started]);

  if (!shown) return null;
  return (
    <span className={`status ${save}`} role="status" title={SAVE_TEXT[save] || undefined}>
      {save !== 'idle' && (
        <>
          <span className="dot" aria-hidden="true" />
          <span className="txt">{SAVE_TEXT[save]}</span>
        </>
      )}
    </span>
  );
}
