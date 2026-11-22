import { parentOf } from '../core/selectPath';
import { useDesign } from '../store/designStore';
import { useUi } from '../store/uiStore';

/**
 * Up one level, the same steps as Esc (ADR-203, ADR-249, ADR-270): an entered space is left first; inside a drilled
 * project piece the selection goes up a space; in a project the piece is let go; in the piece editor a space → the
 * one around it → the whole piece → nothing. Esc and the canvas editor's ↑ share it (ADR-283).
 */
export function upOneLevel() {
  const st = useDesign.getState();
  if (useUi.getState().enteredId) {
    useUi.getState().exitEntered();
    return;
  }
  if (st.project && !st.editingItemId && st.drillItemId && st.selectedId !== null)
    st.select(parentOf(st.model, st.selectedId));
  else if (st.project && !st.editingItemId) st.selectItem(null);
  else st.select(parentOf(st.model, st.selectedId));
}
