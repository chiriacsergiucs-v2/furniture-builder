import { useEffect } from 'react';
import { t } from '@furniture-builder/i18n';
import { useDesign } from '../../store/designStore';
import { askConfirm } from '../Confirm';
import { askRemove } from '../Project';
import { editorShortcutAllowed } from '../editorShortcuts';
import { upOneLevel } from '../upLevel';
import type { Page } from './usePage';

/** The project view undoes project changes (ADR-051); the piece editor undoes piece edits. Read at the key press. */
function undoRedo(redo: boolean) {
  const st = useDesign.getState();
  const inProject = !!st.project && !st.editingItemId;
  if (inProject) {
    if (redo) st.redoProject();
    else st.undoProject();
  } else if (redo) st.redo();
  else st.undo();
}

/** The editor's keyboard shortcuts: undo and redo, Delete, duplicate, select all and Esc (moved out of App, G-500). */
export function useEditorShortcuts(page: Page) {
  // The listener is added again when the undo target changes, as when App held it, so its order among the window's
  // keydown listeners stays as it was.
  const inProject = useDesign((s) => !!s.project && !s.editingItemId);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!editorShortcutAllowed(e, page)) return;
      const target = e.target as HTMLElement;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undoRedo(e.shiftKey);
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
          !target.closest('dialog, [contenteditable="true"]') &&
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
          !target.closest('dialog, [contenteditable="true"]') &&
          !document.querySelector('dialog[open]')
        ) {
          e.preventDefault();
          const n = st.selectedItemIds.length;
          void askConfirm(t('Delete these {n} pieces from this project?', { n }), {
            confirmLabel: t('Delete'),
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
        undoRedo(true);
      }
      // Esc in an open dialog closes the dialog only, not the selection too (ADR-160); Esc that cancels a drag or a
      // turn on the plan (ADR-065, ADR-169) is taken there first and leaves the selection alone.
      // Esc goes up one level (ADR-203, ADR-249, ADR-270); the canvas editor's ↑ does the same (ADR-283).
      if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('dialog[open]'))
        upOneLevel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [page, inProject]);
}
