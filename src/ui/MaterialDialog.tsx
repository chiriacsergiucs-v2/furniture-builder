import { useEffect, useMemo, useState } from 'react';
import { boardChoices } from '../core/boards';
import { buildModel } from '../core/build';
import {
  itemRoles,
  materialTargets,
  type FinishScope,
  type MaterialRole,
  type MaterialScope,
} from '../core/finish';
import { t, tr } from '../core/i18n';
import type { Decor } from '../core/materials';
import { materialKey, runOf } from '../core/project';
import type { Design, Material } from '../core/types';
import { listDecors } from '../persist/db';
import { useDesign } from '../store/designStore';
import { InfoTip, Select } from './controls';
import { Dialog } from './Dialogs';
import { StyleSuggestions } from './History';
import { useUi } from './shell/uiStore';

const ROLE_LABEL: Record<MaterialRole, () => string> = {
  front: () => t('Fronts@@role'),
  body: () => t('Carcass@@role'),
  top: () => t('Top@@role'),
  bottom: () => t('Bottom@@role'),
  side: () => t('Sides'),
  shelf: () => t('Shelves@@role'),
  divider: () => t('Dividers@@role'),
  back: () => t('Back@@role'),
  'drawer-box': () => t('Drawer boxes'),
  'drawer-bottom': () => t('Drawer bottoms'),
  worktop: () => t('Worktop@@role'),
};
const ROLE_ORDER: MaterialRole[] = [
  'front',
  'body',
  'top',
  'bottom',
  'side',
  'shelf',
  'divider',
  'back',
  'drawer-box',
  'drawer-bottom',
  'worktop',
];

/** Parts of a piece for the Part select: "Shelf (2)" when a label repeats. */
function partRows(d: Design) {
  const model = buildModel(d);
  const mats = new Map(d.materials.map((m) => [m.id, m]));
  const seen = new Map<string, number>();
  return model.panels.map((p) => {
    const n = (seen.get(p.label) ?? 0) + 1;
    seen.set(p.label, n);
    const m = mats.get(p.materialId);
    const name = n > 1 ? `${tr(p.label)} (${n})` : tr(p.label);
    return {
      id: p.id,
      label: m ? `${name} — ${tr(m.name)}, ${m.thickness} mm` : name,
      materialId: p.materialId,
    };
  });
}

/**
 * One Material control (ADR-163), opened from the header bar everywhere: a board on one part, the item, the group
 * (the selected items, else the item's run) or the whole project, on any combination of part roles.
 */
export function MaterialDialog() {
  const open = useUi((s) => s.materialOpen);
  const setOpen = useUi((s) => s.setMaterialOpen);
  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title={t('Material')}
      info={
        <InfoTip label={t('About the material')} align="start">
          {t(
            'Pick the parts, the board and how far it reaches. Every piece stays its own copy; change it again any time.',
          )}
        </InfoTip>
      }
    >
      {open && <MaterialFields />}
    </Dialog>
  );
}

function MaterialFields() {
  const project = useDesign((s) => s.project);
  const editingItemId = useDesign((s) => s.editingItemId);
  const selectedItemId = useDesign((s) => s.selectedItemId);
  const selectedIds = useDesign((s) => s.selectedItemIds);
  const design = useDesign((s) => s.design);
  const highlight = useDesign((s) => s.highlight);
  const apply = useDesign((s) => s.applyMaterial);
  const clearPart = useDesign((s) => s.clearPartBoard);
  const inProject = !!project && !editingItemId;
  const itemId = inProject ? selectedItemId : null;
  const item = inProject ? project.items.find((i) => i.id === itemId) : null;
  // The piece whose parts and roles are shown: the selected project item, else the open piece.
  const target: Design | null = inProject ? (item?.design ?? null) : design;

  const [scope, setScope] = useState<MaterialScope>('item');
  const [roles, setRoles] = useState<MaterialRole[]>([]);
  // The part selected in the parts list or 3D view is preset when the dialog opens (project ids carry the item id).
  const [partId, setPartId] = useState(() => {
    const h = highlight[0] ?? '';
    return itemId && h.startsWith(`${itemId}:`) ? h.slice(itemId.length + 1) : h;
  });
  const [boardKey, setBoardKey] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [decors, setDecors] = useState<Decor[]>([]);
  useEffect(() => {
    listDecors()
      .then(setDecors)
      .catch(() => setDecors([]));
  }, []);

  const run = useMemo(
    () => (inProject && itemId ? runOf(project, itemId) : null),
    [inProject, project, itemId],
  );
  const groupOk = inProject && (selectedIds.length > 1 || (run?.length ?? 0) > 1);
  const targets: Design[] = useMemo(() => {
    if (!inProject) return target ? [target] : [];
    if (scope === 'project') return project.items.map((i) => i.design);
    if (scope === 'group' && itemId)
      return (materialTargets(project, itemId, 'group', selectedIds) ?? []).map((i) => i.design);
    return target ? [target] : [];
  }, [inProject, project, scope, itemId, selectedIds, target]);
  const available = useMemo(() => {
    const set = new Set<MaterialRole>();
    for (const d of targets) for (const r of itemRoles(d)) set.add(r);
    return ROLE_ORDER.filter((r) => set.has(r));
  }, [targets]);
  const parts = useMemo(() => (target ? partRows(target) : []), [target]);
  const part = parts.find((p) => p.id === partId) ?? parts[0];
  // Part boards whose part the piece no longer builds (ADR-151): kept and warned about until cleared here.
  const lost = useMemo(
    () => Object.keys(target?.partMaterials ?? {}).filter((id) => !parts.some((p) => p.id === id)),
    [target, parts],
  );
  const current = part ? target?.materials.find((m) => m.id === part.materialId) : undefined;
  const choices = useMemo(
    () => boardChoices(inProject ? project : null, target, decors, current),
    [inProject, project, target, decors, current],
  );
  const chosenKey =
    boardKey && choices.some((c) => c.key === boardKey)
      ? boardKey
      : current && choices.some((c) => c.key === materialKey(current))
        ? materialKey(current)
        : (choices[0]?.key ?? '');
  const chosen = choices.find((c) => c.key === chosenKey);
  const needsItem = scope !== 'project' && inProject && !item;
  const canApply =
    !!chosen && !needsItem && (scope === 'part' ? !!part : roles.length > 0) && targets.length > 0;

  const go = () => {
    if (!chosen) return;
    const id = inProject ? (itemId ?? project.items[0]?.id ?? null) : null;
    const r = apply(id, roles, chosen.board, scope, scope === 'part' ? part?.id : undefined);
    setMsg(
      scope === 'part'
        ? r.applied.length
          ? t('{part}: board set.', { part: part ? tr(part.label.split(' — ')[0]) : '' })
          : t('No item is selected.')
        : r.applied.length
          ? `${t('Applied to {n|# item|# items}', { n: r.applied.length })}${r.skipped.length ? t(', {n} skipped: {list}', { n: r.skipped.length, list: r.skipped.join('; ') }) : ''}.`
          : t('Nothing changed: {why}.', { why: r.skipped.join('; ') || t('no piece reached') }),
    );
  };
  const toggleRole = (r: MaterialRole) =>
    setRoles((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]));
  const scopes: { value: MaterialScope; label: string; disabled?: boolean; title?: string }[] = [
    { value: 'part', label: t('Part@@scope') },
    { value: 'item', label: t('Item@@scope') },
    ...(inProject
      ? [
          {
            value: 'group' as const,
            label: t('Group@@scope'),
            disabled: !groupOk,
            title: groupOk
              ? t('Group: the selected items, or the run this item stands in')
              : t('Not in a run; select two or more items for a group'),
          },
          { value: 'project' as const, label: t('Whole project') },
        ]
      : []),
  ];
  const styleScope: FinishScope =
    scope === 'project'
      ? 'project'
      : scope === 'group' && selectedIds.length > 1
        ? 'selection'
        : scope === 'group'
          ? 'run'
          : 'piece';
  return (
    <div className="material-fields">
      <div className="field">
        <span className="field-label" id="material-scope">
          {t('Apply to')}
        </span>
        <div className="segmented" role="radiogroup" aria-labelledby="material-scope">
          {scopes.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={scope === s.value}
              className={scope === s.value ? 'on' : ''}
              disabled={s.disabled}
              title={s.title}
              onClick={() => {
                setScope(s.value);
                setMsg(null);
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      {needsItem && <p className="hint">{t('No item is selected.')}</p>}
      {scope === 'part' ? (
        <Select
          label={t('Part@@scope')}
          value={part?.id ?? ''}
          options={parts.map((p) => ({ value: p.id, label: p.label }))}
          onChange={(v) => {
            setPartId(v);
            setBoardKey('');
            setMsg(null);
          }}
          info={
            <InfoTip label={t('About the part')} align="start">
              {t('The part is shown with the board it uses now.')}
            </InfoTip>
          }
        />
      ) : null}
      {scope === 'part' &&
        lost.map((id) => (
          <p key={id} className="alert warning">
            <span>
              {t('{id} no longer exists; its board is not used.', { id })}{' '}
              <button
                type="button"
                className="btn outline sm"
                onClick={() => clearPart(inProject ? itemId : null, id)}
              >
                {t('Clear')}
              </button>
            </span>
          </p>
        ))}
      {scope !== 'part' && (
        <div className="field">
          <span className="field-label" id="material-parts">
            {t('Parts@@material')}
          </span>
          <div className="segmented multi" role="group" aria-labelledby="material-parts">
            {available.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={roles.includes(r)}
                className={roles.includes(r) ? 'on' : ''}
                onClick={() => {
                  toggleRole(r);
                  setMsg(null);
                }}
              >
                {ROLE_LABEL[r]()}
              </button>
            ))}
          </div>
          {!roles.length && <p className="hint">{t('Pick at least one part.')}</p>}
        </div>
      )}
      <Select
        label={t('Board')}
        value={chosenKey}
        options={choices.map((c) => ({ value: c.key, label: c.label }))}
        onChange={(v) => {
          setBoardKey(v);
          setMsg(null);
        }}
      />
      <button type="button" className="btn primary" onClick={go} disabled={!canApply}>
        {t('Apply material')}
      </button>
      {msg && (
        <p className="hint" role="status">
          {msg}
        </p>
      )}
      {inProject && item && <StyleSuggestions itemId={item.id} scope={styleScope} />}
    </div>
  );
}

export type { Material };
