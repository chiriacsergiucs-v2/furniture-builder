import { newId } from '../core/design';
import {
  applyFinish,
  applyMaterial,
  putPartBoard,
  putRoleBoards,
  putRunBoard,
  RUN_ROLES,
  type RunRole,
  roleName,
  type MaterialRole,
} from '../core/finish';
import { commonPanelCheck } from '../core/common';
import { sharedSideCheck } from '../core/shared';
import {
  connect,
  connectionCheck,
  connectWall,
  disconnect,
  disconnectWall,
  isConnected,
  wallAgainst,
  wallsOf,
} from '../core/connections';
import { applyStyle } from '../core/styles';
import { planRuns, requestKey, type Project, type WorktopJoint } from '../core/project';
import type { Design } from '../core/types';
import { t } from '../core/i18n';
import type { State, StoreHelpers } from './designState';

type RunActions = Pick<
  State,
  | 'applyStyle'
  | 'suggestRunParts'
  | 'removeRunPart'
  | 'setRunRequest'
  | 'removeRunRequest'
  | 'setRunHandle'
  | 'removeRunHandle'
  | 'setSink'
  | 'removeSink'
  | 'setHob'
  | 'removeHob'
  | 'setWorktopJoint'
  | 'setWorktopEdge'
  | 'setRunSettings'
  | 'applyMaterial'
  | 'setCommon'
  | 'setShared'
  | 'fillRoom'
  | 'setConnected'
  | 'setAgainstWall'
  | 'clearPartBoard'
  | 'applyFinish'
>;

/** The run, material and common-panel actions, split out of designStore.ts. */
export function runActions(h: StoreHelpers): RunActions {
  const { set, get, commit, commitApplied, commitProject } = h;
  return {
    applyStyle: (id, style, scope) => {
      const p = get().project;
      if (!p) return { applied: [], skipped: [] };
      const r = applyStyle(p, id, style, scope, get().selectedItemIds);
      return commitApplied(p, r, t('Apply style {name}', { name: style.name }), [
        'boardsLocked',
        'constructionLocked',
      ]);
    },
    suggestRunParts: () => {
      const p = get().project;
      if (!p) return;
      // Automatic refresh is on by default the first time; after that the user's choice is kept (ADR-061).
      const settings = { scribe: p.runSettings?.scribe ?? 0, auto: p.runSettings?.auto ?? true };
      const base = { ...p, runSettings: settings, runPartsRemoved: [] };
      // Suggest also plans the runs along the side walls (ADR-205).
      commitProject({ ...base, runParts: planRuns(base, { sides: true }).parts });
    },
    removeRunPart: (id) => {
      const p = get().project;
      const rp = p?.runParts?.find((r) => r.id === id);
      if (!p || !rp) return;
      // A part the user asked for (ADR-075) goes with its request; its key stays removed like any other.
      const asked = p.runRequests?.filter((r) => requestKey(r) !== rp.key);
      commitProject({
        ...p,
        runParts: (p.runParts ?? []).filter((r) => r.id !== id),
        runPartsRemoved: [...(p.runPartsRemoved ?? []), rp.key ?? rp.id],
        ...(asked ? { runRequests: asked } : {}),
      });
    },
    setRunRequest: (r) => {
      const p = get().project;
      if (!p) return;
      const key = requestKey(r);
      const settings = p.runSettings ?? { scribe: 0, auto: true };
      const next: Project = {
        ...p,
        runRequests: [...(p.runRequests ?? []).filter((x) => requestKey(x) !== key), r],
        runPartsRemoved: (p.runPartsRemoved ?? []).filter((k) => k !== key),
      };
      if (settings.auto) {
        commitProject({ ...next, runSettings: settings });
        return;
      }
      // Refresh off: only the asked-for parts are made now (and the worktops they replace go); the rest stay.
      const keys = new Set(next.runRequests!.map(requestKey));
      const wt = new Set(next.runRequests!.flatMap((x) => (x.kind === 'worktop' ? x.from : [])));
      const keep = (p.runParts ?? []).filter(
        (x) =>
          !keys.has(x.key ?? '') && !(x.kind === 'worktop' && x.from?.some((id) => wt.has(id))),
      );
      const made = planRuns(next).parts.filter((x) => keys.has(x.key ?? ''));
      commitProject({ ...next, runSettings: settings, runParts: [...keep, ...made] });
    },
    removeRunRequest: (key) => {
      const p = get().project;
      if (!p?.runRequests) return;
      commitProject({ ...p, runRequests: p.runRequests.filter((r) => requestKey(r) !== key) });
    },
    setRunHandle: (rh) => {
      const p = get().project;
      if (!p) return;
      const rest = (p.runHandles ?? []).filter((x) => x.id !== rh.id);
      commitProject({ ...p, runHandles: [...rest, rh] });
    },
    removeRunHandle: (id) => {
      const p = get().project;
      if (!p?.runHandles) return;
      const rest = p.runHandles.filter((x) => x.id !== id);
      commitProject({ ...p, runHandles: rest.length ? rest : undefined });
    },
    setSink: (sk) => {
      const p = get().project;
      if (!p) return;
      commitProject({ ...p, sinks: [...(p.sinks ?? []).filter((x) => x.id !== sk.id), sk] });
    },
    removeSink: (id) => {
      const p = get().project;
      if (!p?.sinks) return;
      const rest = p.sinks.filter((x) => x.id !== id);
      commitProject({ ...p, sinks: rest.length ? rest : undefined });
    },
    setHob: (hb) => {
      const p = get().project;
      if (!p) return;
      commitProject({ ...p, hobs: [...(p.hobs ?? []).filter((x) => x.id !== hb.id), hb] });
    },
    removeHob: (id) => {
      const p = get().project;
      if (!p?.hobs) return;
      const rest = p.hobs.filter((x) => x.id !== id);
      commitProject({ ...p, hobs: rest.length ? rest : undefined });
    },
    setWorktopJoint: (j) => {
      const p = get().project;
      if (!p) return;
      const same = (x: WorktopJoint) =>
        x.id === j.id || (x.a === j.a && x.b === j.b) || (x.a === j.b && x.b === j.a);
      commitProject({
        ...p,
        worktopJoints: [...(p.worktopJoints ?? []).filter((x) => !same(x)), j],
      });
    },
    setWorktopEdge: (e) => {
      const p = get().project;
      if (!p) return;
      const rest = (p.worktopEdges ?? []).filter((x) => x.key !== e.key);
      // Square without a size is the default: nothing to keep.
      const keep = e.kind !== 'square' || e.size !== undefined;
      const list = keep ? [...rest, e] : rest;
      commitProject({ ...p, worktopEdges: list.length ? list : undefined });
    },
    setRunSettings: (patch) => {
      const p = get().project;
      if (!p) return;
      commitProject({ ...p, runSettings: { scribe: 0, auto: false, ...p.runSettings, ...patch } });
    },
    applyMaterial: (id, allRoles, board, scope, panelId, band) => {
      const p = get().project;
      const roles = allRoles.filter((r): r is MaterialRole => !RUN_ROLES.includes(r as RunRole));
      if (!id || !p || get().editingItemId === id) {
        // The open piece: one part, or every role it has parts for.
        const d = get().design;
        if (scope === 'part') {
          if (!panelId) return { applied: [], skipped: [] };
          const why = commit(putPartBoard(d, panelId, board, band));
          return why ? { applied: [], skipped: [why] } : { applied: [panelId], skipped: [] };
        }
        const r = putRoleBoards(d, roles, board, band);
        const why = r.applied.length ? commit(r.design) : null;
        return {
          applied: r.applied.length && !why ? [d.name] : [],
          skipped: [...r.skipped.map(roleName), ...(why ? [why] : [])],
        };
      }
      if (scope === 'part') {
        const it = p.items.find((i) => i.id === id);
        if (!it || !panelId) return { applied: [], skipped: [] };
        // A run part (ADR-188): its own board copy.
        const rp = (p.runParts ?? []).find((x) => `run:${x.id}` === panelId);
        if (rp) {
          const why = commitProject(putRunBoard(p, [rp], board, band), t('Apply material'));
          return why ? { applied: [], skipped: [why] } : { applied: [rp.label], skipped: [] };
        }
        // Project part ids are `${item.id}:${panel.id}`; the piece stores the panel's own id.
        const own = panelId.startsWith(`${id}:`) ? panelId.slice(id.length + 1) : panelId;
        const why = commitProject(
          {
            ...p,
            items: p.items.map((i) =>
              i.id === id ? { ...i, design: putPartBoard(i.design, own, board, band) } : i,
            ),
          },
          t('Apply material'),
        );
        return why ? { applied: [], skipped: [why] } : { applied: [own], skipped: [] };
      }
      const r = applyMaterial(p, id, allRoles, board, scope, get().selectedItemIds, band);
      return commitApplied(p, r, t('Apply material'), ['boardsLocked']);
    },
    setCommon: (kind, on) => {
      const p = get().project;
      const ids = get().selectedItemIds.filter((id) => p?.items.some((i) => i.id === id));
      if (!p || ids.length < 2) return t('Select two or more items standing side by side.');
      const others = (p.common ?? []).filter(
        (c) => c.kind !== kind || !c.itemIds.some((x) => ids.includes(x)),
      );
      let common = others;
      if (on) {
        const plan = commonPanelCheck(p, ids, kind);
        if (plan.reason) return plan.reason;
        common = [...others, { id: newId(), kind, itemIds: plan.ids }];
      }
      const { common: _was, ...rest } = p;
      void _was;
      commitProject(
        common.length ? { ...rest, common } : rest,
        kind === 'top' ? t('Common top') : t('Common bottom'),
      );
      return '';
    },
    setShared: (on) => {
      const p = get().project;
      const ids = get().selectedItemIds.filter((id) => p?.items.some((i) => i.id === id));
      if (!p || ids.length < 2) return t('Select two or more items standing side by side.');
      const others = (p.sharedSides ?? []).filter((c) => !c.itemIds.some((x) => ids.includes(x)));
      let sharedSides = others;
      if (on) {
        const plan = sharedSideCheck(p, ids);
        if (plan.reason) return plan.reason;
        sharedSides = [...others, { id: newId(), itemIds: plan.ids }];
      }
      const { sharedSides: _was, ...rest } = p;
      void _was;
      commitProject(sharedSides.length ? { ...rest, sharedSides } : rest, t('Shared sides'));
      return '';
    },
    fillRoom: (mix) => {
      const p = get().project;
      if (!p || !mix.items.length) return [];
      commitProject({ ...p, items: [...p.items, ...mix.items] }, t('Fill the room'));
      const ids = mix.items.map((i) => i.id);
      get().selectItems(ids);
      return ids;
    },
    setConnected: (on) => {
      const p = get().project;
      const ids = get().selectedItemIds.filter((id) => p?.items.some((i) => i.id === id));
      if (!p || ids.length !== 2) return t('Select exactly two pieces standing side by side.');
      const [a, b] = ids;
      if (on) {
        // The kind the check finds: side by side, in the corner or stacked (ADR-207).
        const { reason, kind } = connectionCheck(p, a, b, get().projectModel?.pieces);
        if (reason) return reason;
        if (!isConnected(p, a, b)) commitProject(connect(p, a, b, kind), t('Connect'));
      } else if (isConnected(p, a, b)) commitProject(disconnect(p, a, b), t('Disconnect'));
      return '';
    },
    setAgainstWall: (id, on) => {
      const p = get().project;
      if (!p || !p.items.some((i) => i.id === id)) return t('No project is open.');
      if (!on) {
        const next = disconnectWall(p, id);
        if (next !== p) commitProject(next, t('Off the wall'));
        return '';
      }
      if (wallsOf(p, id).length) return '';
      const { wall, reason } = wallAgainst(p, id, get().projectModel?.pieces);
      if (wall === null) {
        if (reason) set({ notice: reason });
        return reason ?? '';
      }
      commitProject(connectWall(p, id, wall), t('Against the wall'));
      return '';
    },
    clearPartBoard: (id, panelId) => {
      const p = get().project;
      if (!id || !p || get().editingItemId === id) return get().setPartMaterial(panelId, null);
      const drop = (d: Design): Design => {
        const next = { ...d.partMaterials };
        delete next[panelId];
        const bands = { ...d.partBands };
        delete bands[panelId];
        return {
          ...d,
          partMaterials: Object.keys(next).length ? next : undefined,
          partBands: Object.keys(bands).length ? bands : undefined,
        };
      };
      commitProject(
        { ...p, items: p.items.map((i) => (i.id === id ? { ...i, design: drop(i.design) } : i)) },
        t('Clear part board'),
      );
    },
    applyFinish: (id, role, board, scope) => {
      const p = get().project;
      if (!p) return { applied: [], skipped: [] };
      const r = applyFinish(p, id, role, board, scope, get().selectedItemIds);
      return commitApplied(p, r, t('Apply finish'), ['boardsLocked']);
    },
  };
}
