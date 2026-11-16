import { useEffect } from 'react';
import { findInProduct } from '../core/design';
import { useDesign } from './designStore';
import { useUi } from './uiStore';

/**
 * The divided space being edited from inside (ADR-270), or null. The context ends by itself when its space no longer
 * exists or another piece opens.
 */
export function useEntered(): string | null {
  const designId = useDesign((s) => s.design.id);
  const exists = useDesign((s) => {
    const id = useUi.getState().enteredId;
    return id ? !!findInProduct(s.design.product, id) : false;
  });
  const enteredId = useUi((s) => s.enteredId);
  const enteredDesignId = useUi((s) => s.enteredDesignId);
  const exit = useUi((s) => s.exitEntered);
  const valid = !!enteredId && enteredDesignId === designId && exists;
  useEffect(() => {
    if (enteredId && !valid) exit();
  }, [enteredId, valid, exit]);
  return valid ? enteredId : null;
}
