import { useEffect, useMemo, useState } from 'react';
import { boardChoices, projectBands } from '../core/boards';
import { bandKey } from '../core/cutlist';
import { buildModel } from '../core/build';
import {
  itemRoles,
  materialTargets,
  runPartsOf,
  runRoleOf,
  RUN_ROLES,
  type FinishScope,
  type MaterialRole,
  type MaterialScope,
  type RunRole,
} from '../core/finish';
import { t, tr } from '../core/i18n';
import { BAND_KINDS, bandProblems, bandText, parseTenths, type Decor } from '../core/materials';
import { bandFromOffer, bandOffers, loadSellerCatalogs, type SellerCatalog } from '../core/sellers';
import { materialKey, runOf } from '../core/project';
import type { Design, EdgeBand, EdgeBandKind, Material } from '../core/types';
import { listDecors } from '../persist/db';
import { useDesign } from '../store/designStore';
import { InfoTip, MmField, Select } from './controls';
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
const RUN_LABEL: Record<RunRole, () => string> = {
  'run-worktop': () => t('Run worktop'),
  'run-filler': () => t('Fillers and covers'),
  'run-plinth': () => t('Run plinth'),
  'run-trim': () => t('Trims@@role'),
};
const KEEP = '';
const OWN = 'own';
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
  const [roles, setRoles] = useState<(MaterialRole | RunRole)[]>([]);
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
  // Edge band (ADR-168): keep the board's, a band of the project, a seller's, or your own.
  const [bandChoice, setBandChoice] = useState(KEEP);
  const [own, setOwn] = useState<{
    kind: EdgeBandKind;
    thickness: string;
    width: number;
    code: string;
  }>({
    kind: 'abs',
    thickness: '',
    width: 22,
    code: '',
  });
  const [cats, setCats] = useState<SellerCatalog[]>([]);
  useEffect(() => {
    let live = true;
    loadSellerCatalogs()
      .then((c) => live && setCats(c))
      .catch(() => live && setCats([]));
    return () => {
      live = false;
    };
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
  // Run parts made from a reached item (ADR-168).
  const reachedRuns = useMemo(() => {
    if (!inProject) return [];
    const ids =
      scope === 'project'
        ? project.items.map((i) => i.id)
        : scope === 'group' && itemId
          ? (materialTargets(project, itemId, 'group', selectedIds) ?? []).map((i) => i.id)
          : itemId
            ? [itemId]
            : [];
    return runPartsOf(project, new Set(ids));
  }, [inProject, project, scope, itemId, selectedIds]);
  const available = useMemo(() => {
    const set = new Set<MaterialRole | RunRole>();
    for (const d of targets) for (const r of itemRoles(d)) set.add(r);
    for (const rp of reachedRuns) set.add(runRoleOf(rp));
    return [...ROLE_ORDER, ...RUN_ROLES].filter((r) => set.has(r));
  }, [targets, reachedRuns]);
  const parts = useMemo(() => {
    const own = target ? partRows(target) : [];
    if (!inProject || !itemId) return own;
    // The item's run parts follow its own parts in the Part list.
    const runs = runPartsOf(project, new Set([itemId])).map((rp) => ({
      id: `run:${rp.id}`,
      label: `${t('Run: {part}', { part: tr(rp.label) })} — ${tr(rp.material.name)}, ${rp.material.thickness} mm`,
      materialId: '',
      material: rp.material,
    }));
    return [...own, ...runs];
  }, [target, inProject, project, itemId]);
  const part = parts.find((p) => p.id === partId) ?? parts[0];
  // Part boards whose part the piece no longer builds (ADR-151): kept and warned about until cleared here.
  const lost = useMemo(
    () => Object.keys(target?.partMaterials ?? {}).filter((id) => !parts.some((p) => p.id === id)),
    [target, parts],
  );
  const current = part
    ? 'material' in part
      ? (part.material as Material)
      : target?.materials.find((m) => m.id === part.materialId)
    : undefined;
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
  const bands = useMemo(
    () => projectBands(inProject ? project : null, target),
    [inProject, project, target],
  );
  const sellerBands = useMemo(
    () =>
      chosen
        ? bandOffers(cats, chosen.board)
            .slice(0, 20)
            .flatMap((o) => {
              const b = bandFromOffer(o);
              return b ? [{ b, name: o.p.n }] : [];
            })
        : [],
    [cats, chosen],
  );
  const ownBand: EdgeBand | null = (() => {
    const th = parseTenths(own.thickness);
    if (th === null) return null;
    const b: EdgeBand = {
      kind: own.kind,
      thickness: th,
      width: own.width,
      ...(own.code.trim() ? { code: own.code.trim() } : {}),
    };
    return bandProblems(b).length ? null : b;
  })();
  const band: EdgeBand | undefined | null =
    bandChoice === KEEP
      ? undefined
      : bandChoice === OWN
        ? ownBand
        : bandChoice.startsWith('seller:')
          ? sellerBands[Number(bandChoice.slice(7))]?.b
          : bands.find((b) => `band:${bandKey(b)}` === bandChoice);
  const needsItem = scope !== 'project' && inProject && !item;
  const canApply =
    !!chosen &&
    band !== null &&
    !needsItem &&
    (scope === 'part' ? !!part : roles.length > 0) &&
    (targets.length > 0 || reachedRuns.length > 0);

  const go = () => {
    if (!chosen) return;
    const id = inProject ? (itemId ?? project.items[0]?.id ?? null) : null;
    const r = apply(
      id,
      roles,
      chosen.board,
      scope,
      scope === 'part' ? part?.id : undefined,
      band ?? undefined,
    );
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
  const toggleRole = (r: MaterialRole | RunRole) =>
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
                {r in RUN_LABEL ? RUN_LABEL[r as RunRole]() : ROLE_LABEL[r as MaterialRole]()}
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
      <Select
        label={t('Edge band')}
        value={bandChoice}
        options={[
          { value: KEEP, label: t("Keep the board's band") },
          ...bands.map((b) => ({ value: `band:${bandKey(b)}`, label: bandText(b) })),
          ...sellerBands.map((s, i) => ({
            value: `seller:${i}`,
            label: t('{band} (seller: {name})', { band: bandText(s.b), name: s.name }),
          })),
          { value: OWN, label: t('Your own band…') },
        ]}
        onChange={(v) => {
          setBandChoice(v);
          setMsg(null);
        }}
      />
      {bandChoice === OWN && (
        <div className="own-band" role="group" aria-label={t('Your own band')}>
          <Select<EdgeBandKind>
            label={t('Band type')}
            value={own.kind}
            options={BAND_KINDS.map((k) => ({ value: k.value, label: k.label }))}
            onChange={(v) => setOwn((o) => ({ ...o, kind: v }))}
          />
          <div className="field">
            <label htmlFor="own-band-th">{t('Band thickness (mm)')}</label>
            <input
              id="own-band-th"
              inputMode="decimal"
              value={own.thickness}
              placeholder="0.8"
              onChange={(e) => setOwn((o) => ({ ...o, thickness: e.target.value }))}
            />
          </div>
          <MmField
            label={t('Band width')}
            value={own.width}
            min={1}
            max={100}
            step={1}
            onChange={(v) => setOwn((o) => ({ ...o, width: v }))}
          />
          <div className="field">
            <label htmlFor="own-band-code">{t('Band code')}</label>
            <input
              id="own-band-code"
              value={own.code}
              onChange={(e) => setOwn((o) => ({ ...o, code: e.target.value }))}
            />
          </div>
          {!ownBand && (
            <p className="hint">
              {t('Give a thickness in tenths of a mm (for example 0.8) and a width.')}
            </p>
          )}
        </div>
      )}
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
