import { followProject, SETTING_LABEL } from '../core/projectSettings';
import { requestKey } from '../core/project';
import { t } from '../core/i18n';
import { addSet, removeSet, updateSet } from '../core/sets';
import {
  addDesignVariable,
  addVariable,
  deleteDesignVariable,
  deleteVariable,
  setBinding,
  setDesignBinding,
  updateDesignVariable,
  setRequestBinding,
  updateVariable,
} from '../core/variables';
import type { State, StoreHelpers } from './designState';

export type VariableActions = Pick<
  State,
  | 'addVariable'
  | 'updateVariable'
  | 'deleteVariable'
  | 'bindRequest'
  | 'bindTarget'
  | 'addDesignVariable'
  | 'updateDesignVariable'
  | 'deleteDesignVariable'
  | 'bindDesignTarget'
  | 'addVariableSet'
  | 'updateVariableSet'
  | 'removeVariableSet'
  | 'followProject'
>;

/** The project and piece variable actions (ADR-166, ADR-167, ADR-210), split out of designStore.ts. */
export function variableActions(h: StoreHelpers): VariableActions {
  const { get, commit, commitProject, projectAction } = h;
  return {
    addVariable: (name, expr) => {
      const p = get().project;
      if (!p) return '';
      const res = addVariable(p, name, expr);
      commitProject(res.project, t('Add variable {name}', { name: name.trim() }));
      return res.id;
    },
    updateVariable: (id, patch) =>
      projectAction((p) => updateVariable(p, id, patch), t('Change variable')),
    deleteVariable: (id) => projectAction((p) => deleteVariable(p, id), t('Delete variable')),
    bindRequest: (r, target, expr) => {
      const p = get().project;
      if (!p) return;
      const key = requestKey(r);
      // A suggested worktop is asked for first (ADR-075), with its binding (ADR-209).
      if (!p.runRequests?.some((x) => requestKey(x) === key)) {
        if (expr === null) return;
        get().setRunRequest({ ...r, bindings: [{ target, expr: expr.trim() }] });
        return;
      }
      commitProject(
        setRequestBinding(p, key, target, expr),
        expr === null ? t('Unbind') : t('Bind to variable'),
      );
    },
    bindTarget: (itemId, target, expr) => {
      const p = get().project;
      if (!p) return;
      commitProject(
        setBinding(p, itemId, target, expr),
        expr === null ? t('Unbind') : t('Bind to variable'),
      );
    },
    addDesignVariable: (name, expr) => {
      const res = addDesignVariable(get().design, name, expr);
      commit(res.design);
      return res.id;
    },
    updateDesignVariable: (id, patch) => {
      const d = get().design;
      const next = updateDesignVariable(d, id, patch);
      if (next !== d) commit(next);
    },
    deleteDesignVariable: (id) => {
      const d = get().design;
      const next = deleteDesignVariable(d, id);
      if (next !== d) commit(next);
    },
    bindDesignTarget: (target, expr) => commit(setDesignBinding(get().design, target, expr)),
    addVariableSet: () => {
      const p = get().project;
      if (!p) return '';
      const res = addSet(p);
      commitProject(res.project, t('Add value set'));
      return res.id;
    },
    updateVariableSet: (id, patch) =>
      projectAction((p) => updateSet(p, id, patch), t('Change value set')),
    removeVariableSet: (id) => projectAction((p) => removeSet(p, id), t('Remove value set')),
    followProject: (id, key) =>
      projectAction(
        (p) => followProject(p, id, key),
        t('Follow project {setting}', { setting: SETTING_LABEL[key].toLowerCase() }),
      ),
  };
}
