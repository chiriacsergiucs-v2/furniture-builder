import { isSizeLocked, SIZE_LOCKED_HINT } from '../core/sizeLock';
import { useMemo, useState } from 'react';
import {
  bayLayoutOf,
  changeKind,
  fr,
  makeBays,
  MAX_BAYS,
  MAX_LOOSE,
  newId,
  setDrawerCount,
  findInProduct,
  findSpace,
  productRoots,
  insideDoors,
  parentOf,
  pedestalRoot,
  splitSpace,
  unsplit,
  usesPedestal,
} from '../core/design';
import { t, tr } from '../core/i18n';
import { materialLabel } from '../core/materials';
import type { Selection } from '../core/selectPath';
import type {
  CabinetParams,
  CornerParams,
  DeskParams,
  DeskSupport,
  FrontStyle,
  Handle,
  LoosePanel,
  Material,
  PanelLie,
  PanelSetParams,
  Space,
  SpaceKind,
  SplitSize,
} from '../core/types';
import { useDesign } from '../store/designStore';
import {
  Counter,
  Group,
  GuidanceTip,
  InfoTip,
  MmField,
  revealGroup,
  Section,
  Segmented,
  Select,
  Steps,
  Toggle,
  type Step,
} from './controls';
import { Icon } from './icons';
import { CountStepper } from './CountStepper';
import { PieceSize } from './PieceSize';
import { askConfirm } from './Confirm';
import { useUi } from './shell/uiStore';
import { tNode } from './i18n';
import {
  ApplianceEditor,
  ChecksGroup,
  PartBoardsGroup,
  FrameEditor,
  FrontEditor,
  LayoutPicker,
  PanelEditor,
  PieceInfo,
} from './Editors';

const KIND_LABEL: Record<SpaceKind, string> = {
  empty: t('Empty'),
  shelves: t('Shelves'),
  drawers: t('Drawers'),
  hanging: t('Hanging'),
  split: t('Divided'),
};

/**
 * The piece editor (ADR-079). Compose edits the selected space (contents, doors, divide); `configure` edits the
 * whole piece (size, construction, boards, drawers), whatever is selected, and is shown in Settings (ADR-080),
 * where the dialog title is the h2 and the editor its h3 (ADR-116).
 */
export function Inspector({ mode }: { mode: 'compose' | 'configure' }) {
  const design = useDesign((s) => s.design);
  const selectedId = useDesign((s) => s.selectedId);
  const prod = design.product;
  const found = selectedId ? findInProduct(prod, selectedId) : undefined;
  if (mode === 'compose')
    return found ? (
      <SpaceEditor
        space={found.space}
        root={found.root}
        rootLabel={found.label}
        wholeLabel={WHOLE[prod.kind]}
      />
    ) : (
      <ComposeStart />
    );
  const editor =
    prod.kind === 'desk' ? (
      <DeskEditor p={prod.params} deskId={prod.id} materials={design.materials} />
    ) : prod.kind === 'corner' ? (
      <CornerEditor p={prod.params} materials={design.materials} />
    ) : prod.kind === 'panel' ? (
      <PanelEditor p={prod.params} materials={design.materials} />
    ) : prod.kind === 'frame' ? (
      <FrameEditor p={prod.params} materials={design.materials} />
    ) : prod.kind === 'panels' ? (
      <PanelSetEditor p={prod.params} materials={design.materials} />
    ) : (
      <CabinetEditor p={prod.params} materials={design.materials} />
    );
  return (
    <>
      <SizeLockNote />
      {editor}
    </>
  );
}

/**
 * A project piece open in the editor with its size locked (ADR-122): says so, and why the last size edit was refused.
 */
function SizeLockNote() {
  const locked = useDesign((s) => {
    const id = s.editingItemId ?? s.drillItemId;
    return isSizeLocked(s.project?.items.find((i) => i.id === id));
  });
  const notice = useDesign((s) => s.notice);
  if (!locked) return null;
  return (
    <p className="alert info size-lock-note" role="status">
      {tr(SIZE_LOCKED_HINT)}.{' '}
      {notice ?? t('Edits that change its width, height or depth are refused.')}
    </p>
  );
}

/**
 * Inside a project piece, edited without leaving the project editor (ADR-088): the selected space's own panel, or for
 * the whole piece where to tap and its quick counts.
 */
export function InsideEditor() {
  const design = useDesign((s) => s.design);
  const selectedId = useDesign((s) => s.selectedId);
  const prod = design.product;
  const found = typeof selectedId === 'string' ? findInProduct(prod, selectedId) : undefined;
  if (found)
    return (
      <SpaceEditor
        space={found.space}
        root={found.root}
        rootLabel={found.label}
        wholeLabel={WHOLE[prod.kind]}
      />
    );
  return (
    <>
      <p className="hint">
        {t('Selected: {name}.', { name: WHOLE[prod.kind] })}{' '}
        <InfoTip label={t('About picking a space')} align="start">
          {t('Tap the piece again to pick a space inside it; each tap goes one level smaller.')}
        </InfoTip>
      </p>
      <CountStepper />
    </>
  );
}

/** Compose with nothing selected: where to tap, or a way into each space tree. */
function ComposeStart() {
  const prod = useDesign((s) => s.design.product);
  const select = useDesign((s) => s.select);
  const whole = useDesign((s) => s.selectedId === null);
  const resize = useDesign((s) => s.resizePiece);
  // A project piece drilled into with its size locked (ADR-122): its size fields are off.
  const sizeLocked = useDesign((s) =>
    isSizeLocked(s.project?.items.find((i) => i.id === (s.editingItemId ?? s.drillItemId))),
  );
  const setSettingsOpen = useUi((s) => s.setSettingsOpen);
  const roots = productRoots(prod);
  return (
    <div className="inspector compose-start">
      <header className="insp-head">
        <div className="info-row">
          <h2>{t('Compose')}</h2>
          {roots.length > 0 && (
            <InfoTip label={t('About compose')} align="start">
              {t(
                'Tap the drawing: the first tap selects the whole piece, each further tap at the same spot one space smaller. Fill a space with shelves, drawers or hanging, add doors, or divide it.',
              )}
            </InfoTip>
          )}
        </div>
        {whole && (
          <p className="selected-whole">{t('Selected: {name}', { name: WHOLE[prod.kind] })}</p>
        )}
        {!roots.length && (
          <p className="hint">
            {t('This piece has no spaces to fill. Its sizes and boards are under Settings.')}
          </p>
        )}
      </header>
      {whole && <PieceSize product={prod} onChange={resize} locked={sizeLocked} />}
      {roots.map((r) => (
        <button key={r.root.id} type="button" className="row-btn" onClick={() => select(r.root.id)}>
          <span className="glyph">
            <Icon name="grid" />
          </span>
          <span>
            <strong>{t('Edit the {name}', { name: tr(r.label).toLowerCase() })}</strong>
            <span className="sub">{insideSummary([r.root])}</span>
          </span>
          <Icon name="chevron-right" className="chev sm" />
        </button>
      ))}
      {!roots.length && (
        <button type="button" className="btn outline" onClick={() => setSettingsOpen(true)}>
          <Icon name="sliders" className="sm" />
          {t('Open Settings')}
        </button>
      )}
    </div>
  );
}

/** One line naming what is selected in the piece, for the phone sheet's peek row (ADR-079). */
export function selectionLabel(prod: Parameters<typeof findInProduct>[0], id: Selection) {
  if (id === null) return WHOLE[prod.kind];
  const found = id ? findInProduct(prod, id) : undefined;
  if (!found) return null;
  return found.space.id === found.root.id
    ? tr(found.label)
    : found.space.kind === 'split'
      ? t('Divided space')
      : KIND_LABEL[found.space.kind];
}

const WHOLE = {
  cabinet: t('Whole cabinet'),
  desk: t('Whole desk'),
  corner: t('Whole corner unit'),
  panel: t('Whole panel'),
  frame: t('Whole frame'),
  panels: t('Whole panel set'),
};

function matOptions(materials: Material[], filter?: (m: Material) => boolean) {
  return materials
    .filter(filter ?? (() => true))
    .map((m) => ({ value: m.id, label: materialLabel(m) }));
}
const matName = (materials: Material[], id: string) =>
  tr(materials.find((m) => m.id === id)?.name ?? '—');

/** One line about what a space tree holds, for the steps rail: "4 drawers", "2 shelves, 1 door", "Empty". */
function insideSummary(roots: Space[]): string {
  let drawers = 0,
    shelves = 0,
    hanging = 0,
    doors = 0,
    empty = 0;
  const walk = (s: Space) => {
    if (s.front) doors += s.front.count;
    if (s.kind === 'split') s.children.forEach(walk);
    else if (s.kind === 'drawers') drawers += s.count;
    else if (s.kind === 'shelves') {
      if (s.count) shelves += s.count;
      else empty++;
    } else if (s.kind === 'hanging') hanging++;
    else empty++;
  };
  roots.forEach(walk);
  const parts: string[] = [];
  if (drawers) parts.push(t('{n|# drawer|# drawers}', { n: drawers }));
  if (shelves) parts.push(t('{n|# shelf|# shelves}', { n: shelves }));
  if (hanging) parts.push(t('hanging'));
  if (doors) parts.push(t('{n|# door|# doors}', { n: doors }));
  if (!parts.length) return t('Empty');
  if (empty) parts.push(t('empty space'));
  return parts.join(', ');
}

const FRONT_LABEL: Record<FrontStyle, string> = {
  overlay: t('Overlay'),
  half: t('Half overlay'),
  inset: t('Inset'),
};

/**
 * Steps rail above a whole-piece editor: a map of the stages (size → inside → build → boards → cut) with the state
 * of each. Nothing is gated; each entry jumps to its section, so the frequent paths stay as short as before.
 */
function EditorRail({ steps, inside }: { steps: Step[]; inside?: () => void }) {
  const diags = useDesign((s) => s.model.diagnostics);
  const setTab = useDesign((s) => s.setTab);
  const setMode = useUi((s) => s.setMode);
  const setSettingsOpen = useUi((s) => s.setSettingsOpen);
  const errors = diags.filter((d) => d.severity === 'error').length;
  const warnings = diags.length - errors;
  const cut: Step = {
    id: 'cut',
    label: t('Cut'),
    done: !errors,
    meta: errors
      ? t('{n|# problem|# problems}', { n: errors })
      : warnings
        ? t('{n} to check', { n: warnings })
        : t('Ready'),
    tone: errors ? 'error' : warnings ? 'warn' : 'ok',
  };
  const go = (id: string) => {
    if (id === 'size')
      document.querySelector('.settings-body .inspector')?.scrollIntoView({ block: 'start' });
    else if (id === 'inside') {
      // The spaces are edited in Compose, on the drawing: Settings steps aside.
      setSettingsOpen(false);
      setMode('compose');
      inside?.();
    } else if (id === 'cut') {
      setTab(errors || warnings ? 'checks' : 'parts');
      setSettingsOpen(false);
      setMode('build');
    } else revealGroup(`g-${id}`);
  };
  return (
    <div className="rail">
      <Steps label={t('Stages of this piece')} steps={[...steps, cut]} onSelect={go} />
    </div>
  );
}

function Crumbs({
  root,
  id,
  rootLabel,
  wholeLabel,
}: {
  root: Space;
  id: string;
  rootLabel: string;
  wholeLabel: string;
}) {
  const select = useDesign((s) => s.select);
  const chain: Space[] = [];
  let cur: Space | undefined = findSpace(root, id);
  while (cur) {
    chain.unshift(cur);
    cur = parentOf(root, cur.id);
  }
  return (
    <nav className="crumbs" aria-label={t('Where this space sits')}>
      <button type="button" onClick={() => select(null)}>
        {wholeLabel}
      </button>
      {chain.map((s, i) => (
        <span key={s.id}>
          <span aria-hidden="true" className="sep">
            /
          </span>
          {i === chain.length - 1 ? (
            <span aria-current="true">{i === 0 ? rootLabel : KIND_LABEL[s.kind]}</span>
          ) : (
            <button type="button" onClick={() => select(s.id)}>
              {i === 0 ? rootLabel : KIND_LABEL[s.kind]}
            </button>
          )}
        </span>
      ))}
    </nav>
  );
}

function SpaceEditor({
  space,
  root,
  rootLabel,
  wholeLabel,
}: {
  space: Space;
  root: Space;
  rootLabel: string;
  wholeLabel: string;
}) {
  const update = useDesign((s) => s.updateSpace);
  const select = useDesign((s) => s.select);
  const opening = useDesign((s) => s.model.spaces.find((o) => o.nodeId === space.id));
  const allDiags = useDesign((s) => s.model.diagnostics);
  const diags = useMemo(() => allDiags.filter((d) => d.nodeId === space.id), [allDiags, space.id]);
  const set = (fn: (s: Space) => Space) => update(space.id, fn);
  const parent = parentOf(root, space.id);
  // Doors and handles go on the outside only: a space inside other doors gets none (N109).
  const behindDoors = insideDoors(root, space.id);

  // The same order rule as the project panel (ADR-160): no card frames, Divide right under the title, Layouts folded.
  return (
    <div className="inspector space-editor">
      <Crumbs root={root} id={space.id} rootLabel={rootLabel} wholeLabel={wholeLabel} />
      <header className="insp-head">
        <h2>{space.kind === 'split' ? t('Divided space') : `${KIND_LABEL[space.kind]}`}</h2>
        {opening && (
          <p className="measure">
            {tNode('{w} wide × {h} high × {d} deep inside', {
              w: <span>{opening.box.w}</span>,
              h: <span>{opening.box.h}</span>,
              d: <span>{opening.box.d}</span>,
            })}
          </p>
        )}
      </header>

      {diags.length > 0 && (
        <ul className="inline-diags">
          {diags.map((d, i) => (
            <li key={i} className={`alert ${d.severity}`}>
              <Icon
                name={d.severity === 'error' ? 'alert-circle' : 'alert-triangle'}
                className="sm"
              />
              <span>{tr(d.message)}</span>
            </li>
          ))}
        </ul>
      )}

      {space.kind !== 'split' && (
        <Section title={t('Divide this space')}>
          <div className="split-actions">
            <button
              type="button"
              className="btn outline"
              onClick={() => set((s) => splitSpace(s, 'x', 2))}
            >
              {t('Side by side')}
            </button>
            <button
              type="button"
              className="btn outline"
              onClick={() => set((s) => splitSpace(s, 'y', 2))}
            >
              {t('Stacked')}
            </button>
          </div>
        </Section>
      )}
      {space.kind === 'split' ? (
        <Section title={t('Division')}>
          <SplitEditor space={space} onChange={set} onSelect={select} />
        </Section>
      ) : (
        <Section title={t('Contents')}>
          <Segmented<SpaceKind>
            label={t('What goes here')}
            value={space.kind}
            options={(['empty', 'shelves', 'drawers', 'hanging'] as const).map((k) => ({
              value: k,
              label: KIND_LABEL[k],
            }))}
            onChange={(k) => set((s) => changeKind(s, k))}
          />
          {space.kind === 'shelves' && (
            <Counter
              label={t('Shelves')}
              value={space.count}
              min={0}
              max={12}
              onChange={(v) => set((s) => ({ ...s, count: v }) as Space)}
            />
          )}
          {space.kind === 'shelves' && space.count > 0 && (
            <Toggle
              label={t('Adjustable, on shelf pins')}
              checked={!!space.adjustable}
              onChange={(v) => set((s) => ({ ...s, adjustable: v }) as Space)}
            />
          )}
          {space.kind === 'drawers' && (
            <Counter
              label={t('Drawers')}
              value={space.count}
              min={1}
              max={10}
              onChange={(v) => set((s) => setDrawerCount(s, v))}
            />
          )}
          {space.kind === 'drawers' && space.count > 1 && (
            <DrawerHeights space={space} onChange={set} />
          )}
          {space.kind === 'drawers' && !space.front && (
            <Toggle
              label={t('Top drawer is a fixed front (sink false front)')}
              checked={!!space.fixedTop}
              onChange={(v) =>
                set((s) => (s.kind === 'drawers' ? { ...s, fixedTop: v || undefined } : s))
              }
            />
          )}
          {space.kind === 'drawers' && (
            <Toggle
              label={t('Top drawer cut around a sink trap')}
              checked={!!space.uCut}
              onChange={(v) =>
                set((s) =>
                  s.kind === 'drawers' ? { ...s, uCut: v ? { width: 250, depth: 200 } : null } : s,
                )
              }
            />
          )}
          {space.kind === 'drawers' && space.uCut && (
            <div className="dims2">
              <MmField
                label={t('Notch width')}
                value={space.uCut.width}
                min={50}
                max={1000}
                onChange={(v) =>
                  set((s) =>
                    s.kind === 'drawers' && s.uCut ? { ...s, uCut: { ...s.uCut, width: v } } : s,
                  )
                }
              />
              <MmField
                label={t('Notch depth')}
                value={space.uCut.depth}
                min={50}
                max={800}
                onChange={(v) =>
                  set((s) =>
                    s.kind === 'drawers' && s.uCut ? { ...s, uCut: { ...s.uCut, depth: v } } : s,
                  )
                }
                hint={t('Measure your trap and pipes')}
              />
            </div>
          )}
          {space.kind === 'hanging' && (
            <MmField
              label={t('Rail below top')}
              value={space.railDrop}
              min={0}
              max={500}
              step={10}
              onChange={(v) => set((s) => ({ ...s, railDrop: v }) as Space)}
            />
          )}
          {space.kind === 'empty' && <ApplianceEditor space={space} onChange={set} />}
        </Section>
      )}

      <Section
        title={t('Doors and handles')}
        info={
          space.kind === 'drawers' &&
          space.front && (
            <InfoTip label={t('About drawers behind doors')} align="start">
              {t('Drawers behind doors are built as internal drawers without their own fronts.')}
            </InfoTip>
          )
        }
      >
        {behindDoors && !space.front && !space.handle ? (
          <p className="hint">
            {t(
              'This space is inside the doors of the space around it. Doors and handles go on the outside only.',
            )}
          </p>
        ) : (
          <>
            {behindDoors && (
              <p className="hint">
                {t('This space is inside other doors. Set its front and handles to None.')}
              </p>
            )}
            <FrontEditor space={space} onChange={set} />
            {space.front || space.handle || (space.kind === 'drawers' && !behindDoors) ? (
              <HandleEditor space={space} onChange={set} />
            ) : (
              <p className="hint">{t('Handles appear once there are doors or drawers.')}</p>
            )}
          </>
        )}
      </Section>

      <Group title={t('Layouts')} defaultOpen={false}>
        <LayoutPicker space={space} onChange={set} />
      </Group>
      {parent && (
        <button type="button" className="link" onClick={() => select(parent.id)}>
          {t('Select the divided space around this one')}
        </button>
      )}
    </div>
  );
}

const BAR_SPACINGS = [96, 128, 160, 192, 224, 256, 320];

function HandleEditor({
  space,
  onChange,
}: {
  space: Space;
  onChange: (fn: (s: Space) => Space) => void;
}) {
  const h = space.handle;
  const kind = h?.kind ?? 'none';
  const setH = (patch: Partial<Handle> | null) =>
    onChange((s) => ({
      ...s,
      handle: patch === null ? null : ({ kind: 'bar', ...(s.handle ?? {}), ...patch } as Handle),
    }));
  return (
    <>
      <Segmented<'none' | Handle['kind']>
        label={space.front ? t('Handles on the doors') : t('Handles on the drawers')}
        value={kind}
        options={[
          { value: 'none', label: t('None') },
          { value: 'bar', label: t('Bar') },
          { value: 'knob', label: t('Knob') },
          { value: 'push', label: t('Push to open') },
        ]}
        onChange={(v) => setH(v === 'none' ? null : { kind: v })}
      />
      {h && h.kind !== 'push' && (
        <div className="dims2">
          {h.kind === 'bar' && (
            <Select
              label={t('Hole centres')}
              value={String(h.holeSpacing ?? 128)}
              options={BAR_SPACINGS.map((v) => ({
                value: String(v),
                label: t('{n} mm', { n: v }),
              }))}
              onChange={(v) => setH({ holeSpacing: Number(v) })}
            />
          )}
          <Select<'top' | 'centre' | 'bottom'>
            label={t('Position')}
            value={h.position ?? (space.front ? 'centre' : 'top')}
            options={[
              { value: 'top', label: t('Near the top') },
              { value: 'centre', label: t('Middle') },
              { value: 'bottom', label: t('Near the bottom') },
            ]}
            onChange={(v) => setH({ position: v })}
          />
        </div>
      )}
    </>
  );
}

function DrawerHeights({
  space,
  onChange,
}: {
  space: Extract<Space, { kind: 'drawers' }>;
  onChange: (fn: (s: Space) => Space) => void;
}) {
  const panels = useDesign((s) => s.model.panels);
  const fronts = useMemo(
    () =>
      panels
        .filter((p) => p.nodeId === space.id && p.role === 'drawer-front')
        .sort((a, b) => b.box.y - a.box.y),
    [panels, space.id],
  );
  const custom = !!space.heights;
  const heights = space.heights ?? Array.from({ length: space.count }, () => fr());
  const setH = (i: number, z: SplitSize) =>
    onChange((s) =>
      s.kind === 'drawers' ? { ...s, heights: heights.map((h, j) => (j === i ? z : h)) } : s,
    );
  return (
    <>
      <Segmented<'equal' | 'custom'>
        label={t('Drawer heights')}
        info={
          custom && (
            <InfoTip label={t('About drawer heights')} align="start">
              {t(
                'Top to bottom. Heights are front heights; a share splits whatever the fixed drawers leave.',
              )}
            </InfoTip>
          )
        }
        value={custom ? 'custom' : 'equal'}
        options={[
          { value: 'equal', label: t('Equal') },
          { value: 'custom', label: t('Choose') },
        ]}
        onChange={(v) =>
          onChange((s) => {
            if (s.kind !== 'drawers') return s;
            if (v === 'equal') {
              const { heights: _drop, ...rest } = s;
              void _drop;
              return rest;
            }
            return { ...s, heights: Array.from({ length: s.count }, () => fr()) };
          })
        }
      />
      {custom && (
        <ul className="parts-sizes">
          {heights.map((z, i) => (
            <li key={i}>
              <span className="part-name static">{t('Drawer {n}', { n: i + 1 })}</span>
              <select
                aria-label={t('Drawer {n} sizing', { n: i + 1 })}
                value={z.mode}
                onChange={(e) =>
                  setH(
                    i,
                    e.target.value === 'mm'
                      ? { mode: 'mm', value: fronts[i]?.box.h ?? 150 }
                      : { mode: 'fr', value: 1 },
                  )
                }
              >
                <option value="fr">{t('Share')}</option>
                <option value="mm">{t('Fixed')}</option>
              </select>
              <input
                aria-label={
                  z.mode === 'mm'
                    ? t('Drawer {n} front height in mm', { n: i + 1 })
                    : t('Drawer {n} share', { n: i + 1 })
                }
                inputMode={z.mode === 'mm' ? 'numeric' : 'decimal'}
                defaultValue={z.value}
                key={`${i}-${z.mode}-${z.value}`}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (z.mode === 'mm' ? Number.isInteger(v) && v > 0 : v > 0 && v < 1000)
                    setH(i, { mode: z.mode, value: v } as SplitSize);
                }}
              />
              <span className="result">
                {fronts[i] ? t('{n} mm', { n: fronts[i].box.h }) : '—'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function SplitEditor({
  space,
  onChange,
  onSelect,
}: {
  space: Extract<Space, { kind: 'split' }>;
  onChange: (fn: (s: Space) => Space) => void;
  onSelect: (id: string) => void;
}) {
  const openings = useDesign((s) => s.model.spaces);
  const setSize = (i: number, size: SplitSize) =>
    onChange((s) =>
      s.kind === 'split' ? { ...s, sizes: s.sizes.map((z, j) => (j === i ? size : z)) } : s,
    );
  const n = space.children.length;
  const setCount = (k: number) =>
    onChange((s) => {
      if (s.kind !== 'split') return s;
      if (k > s.children.length) {
        const extra = splitSpace(
          { id: 'tmp', kind: 'shelves', count: 2 },
          s.axis,
          k - s.children.length + 1,
        );
        const add = extra.kind === 'split' ? extra.children.slice(1) : [];
        return {
          ...s,
          children: [...s.children, ...add],
          sizes: [...s.sizes, ...add.map(() => ({ mode: 'fr', value: 1 }) as SplitSize)],
        };
      }
      return { ...s, children: s.children.slice(0, k), sizes: s.sizes.slice(0, k) };
    });
  const across = space.axis === 'x';
  const middle = (i: number) => (n > 3 ? t('Middle {n}', { n: i }) : t('Middle'));
  const names = across
    ? (i: number) =>
        n === 2
          ? [t('Left'), t('Right')][i]
          : i === 0
            ? t('Left')
            : i === n - 1
              ? t('Right')
              : middle(i)
    : (i: number) =>
        n === 2
          ? [t('Top'), t('Bottom')][i]
          : i === 0
            ? t('Top')
            : i === n - 1
              ? t('Bottom')
              : middle(i);
  return (
    <>
      <Segmented<'x' | 'y'>
        label={t('Direction')}
        value={space.axis}
        options={[
          { value: 'x', label: t('Side by side') },
          { value: 'y', label: t('Stacked') },
        ]}
        onChange={(a) => onChange((s) => (s.kind === 'split' ? { ...s, axis: a } : s))}
      />
      <Counter label={t('Parts@@split')} value={n} min={2} max={8} onChange={setCount} />
      <div className="field">
        <span className="field-label">
          {across ? t('Width of each part') : t('Height of each part')}
        </span>
        <ul className="parts-sizes">
          {space.children.map((c, i) => {
            const z = space.sizes[i];
            const actual = openings.find((o) => o.nodeId === c.id)?.box;
            return (
              <li key={c.id}>
                <button type="button" className="part-name" onClick={() => onSelect(c.id)}>
                  {names(i)}
                </button>
                <select
                  aria-label={t('{name} sizing', { name: names(i) })}
                  value={z.mode}
                  onChange={(e) =>
                    setSize(
                      i,
                      e.target.value === 'mm'
                        ? {
                            mode: 'mm',
                            value: actual ? (space.axis === 'x' ? actual.w : actual.h) : 300,
                          }
                        : { mode: 'fr', value: 1 },
                    )
                  }
                >
                  <option value="fr">{t('Share')}</option>
                  <option value="mm">{t('Fixed')}</option>
                </select>
                {z.mode === 'mm' ? (
                  <input
                    aria-label={
                      across
                        ? t('{name} width in mm', { name: names(i) })
                        : t('{name} height in mm', { name: names(i) })
                    }
                    inputMode="numeric"
                    defaultValue={z.value}
                    key={`${c.id}-${z.value}`}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isInteger(v) && v > 0) setSize(i, { mode: 'mm', value: v });
                    }}
                  />
                ) : (
                  <input
                    aria-label={t('{name} share', { name: names(i) })}
                    inputMode="decimal"
                    defaultValue={z.value}
                    key={`${c.id}-${z.value}`}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v > 0 && v < 1000) setSize(i, { mode: 'fr', value: v });
                    }}
                  />
                )}
                <span className="result">
                  {actual ? t('{n} mm', { n: space.axis === 'x' ? actual.w : actual.h }) : '—'}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <button type="button" className="danger-link" onClick={() => onChange(unsplit)}>
        {t('Remove dividers')}
      </button>
    </>
  );
}

function CabinetEditor({ p, materials }: { p: CabinetParams; materials: Material[] }) {
  const set = useDesign((s) => s.updateCabinet);
  const select = useDesign((s) => s.select);
  const panelMats = matOptions(materials, (m) => m.thickness >= 12);
  const thinMats = matOptions(materials);
  const inside = insideSummary([p.interior]);
  const steps: Step[] = [
    { id: 'size', label: t('Size'), meta: `${p.width}×${p.height}×${p.depth}`, done: true },
    {
      id: 'inside',
      label: t('Inside'),
      meta: inside,
      done: inside !== t('Empty'),
      tone: inside === t('Empty') ? 'warn' : undefined,
    },
    { id: 'build', label: t('Build'), meta: FRONT_LABEL[p.frontStyle ?? 'overlay'], done: true },
    { id: 'materials', label: t('Boards'), meta: matName(materials, p.bodyMaterialId), done: true },
  ];
  return (
    <div className="inspector">
      <EditorRail steps={steps} inside={() => select(p.interior.id)} />
      <header className="insp-head">
        <div className="info-row">
          <h3>{t('Whole cabinet')}</h3>
          <InfoTip label={t('About the whole cabinet')} align="start">
            {t('Sizes, construction and boards. Fill or divide the spaces under Compose.')}
          </InfoTip>
        </div>
      </header>
      <PieceInfo />
      <div className="dims3">
        <MmField
          label={t('Width')}
          value={p.width}
          min={100}
          max={4000}
          onChange={(v) => set({ width: v })}
        />
        <MmField
          label={t('Height')}
          value={p.height}
          min={100}
          max={3000}
          onChange={(v) => set({ height: v })}
        />
        <MmField
          label={t('Depth')}
          value={p.depth}
          min={100}
          max={1200}
          onChange={(v) => set({ depth: v })}
        />
      </div>
      <button type="button" className="link" onClick={() => select(p.interior.id)}>
        {t('Edit the interior')}
      </button>
      <BaysGroup interior={p.interior} onChange={(interior) => set({ interior })} />
      <Segmented<'floor' | 'wall'>
        label={t('Stands on')}
        value={p.mount ?? 'floor'}
        options={[
          { value: 'floor', label: t('The floor') },
          { value: 'wall', label: t('Wall brackets') },
        ]}
        onChange={(v) =>
          set(v === 'wall' ? { mount: v, mountHeight: p.mountHeight ?? 1450 } : { mount: v })
        }
      />
      {p.mount === 'wall' && (
        <MmField
          label={t('Underside above the floor')}
          value={p.mountHeight ?? 1450}
          min={0}
          max={2500}
          onChange={(v) => set({ mountHeight: v })}
          hint={t('Position only; brackets and a rail are added to the hardware list.')}
        />
      )}
      <Group title={t('Construction')} id="g-build">
        <Segmented
          label={t('Top@@panel')}
          value={p.top}
          options={[
            { value: 'over', label: t('On the sides') },
            { value: 'between', label: t('Between sides') },
          ]}
          onChange={(v) => set({ top: v })}
        />
        <Segmented<'panel' | 'rails'>
          label={t('Top made of')}
          value={p.topKind ?? 'panel'}
          options={[
            { value: 'panel', label: t('A full panel') },
            { value: 'rails', label: t('Two rails') },
          ]}
          onChange={(v) => set({ topKind: v })}
        />
        {p.topKind !== 'rails' && (
          <Segmented<1 | 2>
            label={t('Top layers')}
            value={p.topLayers ?? 1}
            options={[
              { value: 1, label: t('Single') },
              {
                value: 2,
                label: t('Doubled'),
                title: t('Two panels glued, the second under the top'),
              },
            ]}
            onChange={(v) => set({ topLayers: v })}
          />
        )}
        {p.topKind === 'rails' && (
          <MmField
            label={t('Rail depth')}
            value={p.railDepth ?? 100}
            min={30}
            max={300}
            step={5}
            onChange={(v) => set({ railDepth: v })}
            hint={t('Under a worktop or a sink.')}
          />
        )}
        <Segmented<'between' | 'under' | 'none'>
          label={t('Bottom')}
          value={p.bottom ?? 'between'}
          options={[
            { value: 'between', label: t('Between sides') },
            { value: 'under', label: t('Under the sides') },
            { value: 'none', label: t('None') },
          ]}
          onChange={(v) => set({ bottom: v })}
        />
        <Segmented
          label={t('Back@@panel')}
          value={p.back}
          options={[
            { value: 'applied', label: t('Nailed on') },
            { value: 'inset', label: t('Set in') },
            { value: 'none', label: t('None') },
          ]}
          onChange={(v) => set({ back: v })}
        />
        {p.back === 'inset' && (
          <MmField
            label={t('Back set in from rear')}
            value={p.backInset}
            min={0}
            max={100}
            step={1}
            onChange={(v) => set({ backInset: v })}
          />
        )}
        {p.mount !== 'wall' && (
          <MmField
            label={t('Plinth height')}
            value={p.plinthHeight}
            min={0}
            max={250}
            onChange={(v) => set({ plinthHeight: v })}
            hint={t('0 for no plinth')}
          />
        )}
        {p.mount !== 'wall' && p.plinthHeight > 0 && (
          <MmField
            label={t('Plinth set back')}
            value={p.plinthSetback}
            min={0}
            max={200}
            step={5}
            onChange={(v) => set({ plinthSetback: v })}
          />
        )}
        <Segmented<FrontStyle>
          label={t('Doors and drawer fronts')}
          value={p.frontStyle ?? 'overlay'}
          options={[
            { value: 'overlay', label: t('Overlay') },
            { value: 'half', label: t('Half overlay') },
            { value: 'inset', label: t('Inset') },
          ]}
          onChange={(v) => set({ frontStyle: v })}
        />
        <MmField
          label={
            (p.frontStyle ?? 'overlay') === 'inset'
              ? t('Gap around fronts')
              : t('Gap between fronts')
          }
          value={p.frontGap}
          min={0}
          max={10}
          step={1}
          onChange={(v) => set({ frontGap: v })}
        />
        <MmField
          label={t('Shelf set back')}
          value={p.shelfSetback}
          min={0}
          max={100}
          step={5}
          onChange={(v) => set({ shelfSetback: v })}
        />
        <div className="dims2">
          <MmField
            label={t('Adjustable shelf gap, each side')}
            value={p.shelfClearance ?? 1}
            min={0}
            max={5}
            step={1}
            onChange={(v) => set({ shelfClearance: v })}
          />
          <MmField
            label={t('Pin rows from edges')}
            value={p.pinRowSetback ?? 37}
            min={20}
            max={100}
            step={1}
            onChange={(v) => set({ pinRowSetback: v })}
          />
        </div>
      </Group>
      <Group title={t('Materials')} id="g-materials">
        <Select
          label={t('Body')}
          value={p.bodyMaterialId}
          options={panelMats}
          onChange={(v) => set({ bodyMaterialId: v })}
        />
        <Select
          label={t('Fronts')}
          value={p.frontMaterialId}
          options={panelMats}
          onChange={(v) => set({ frontMaterialId: v })}
        />
        <Select
          label={t('Back@@panel')}
          value={p.backMaterialId}
          options={thinMats}
          onChange={(v) => set({ backMaterialId: v })}
        />
      </Group>
      <DrawerSettingsGroup
        value={p.drawers}
        materials={materials}
        onChange={(d) => set({ drawers: d })}
      />
      <PartBoardsGroup />
      <ChecksGroup />
    </div>
  );
}

function DrawerSettingsGroup({
  value: d,
  materials,
  onChange,
}: {
  value: CabinetParams['drawers'];
  materials: Material[];
  onChange: (v: CabinetParams['drawers']) => void;
}) {
  return (
    <Group title={t('Drawers and runners')} defaultOpen={false} id="g-drawers">
      <MmField
        label={t('Runner clearance each side')}
        value={d.sideClearance}
        min={0}
        max={40}
        step={1}
        onChange={(v) => onChange({ ...d, sideClearance: v })}
        hint={t("Check your runner's datasheet; 12.5–13 mm is common for side-mount runners.")}
      />
      <MmField
        label={t('Height clearance')}
        value={d.verticalClearance}
        min={0}
        max={100}
        step={1}
        onChange={(v) => onChange({ ...d, verticalClearance: v })}
      />
      <MmField
        label={t('Space behind runner')}
        value={d.rearClearance}
        min={0}
        max={100}
        step={1}
        onChange={(v) => onChange({ ...d, rearClearance: v })}
      />
      <Select
        label={t('Drawer box')}
        value={d.boxMaterialId}
        options={matOptions(materials, (m) => m.thickness >= 10)}
        onChange={(v) => onChange({ ...d, boxMaterialId: v })}
      />
      <Select
        label={t('Drawer bottom')}
        value={d.bottomMaterialId}
        options={matOptions(materials)}
        onChange={(v) => onChange({ ...d, bottomMaterialId: v })}
      />
      <div className="field">
        <div className="label-row">
          <label htmlFor="runner-lengths">{t('Runner lengths you can buy')}</label>
          <InfoTip label={t('About runner lengths')} align="start">
            {t('The longest one that fits the depth is chosen.')}
          </InfoTip>
        </div>
        <input
          id="runner-lengths"
          defaultValue={d.runnerLengths.join(', ')}
          key={d.runnerLengths.join(',')}
          onBlur={(e) => {
            const v = e.target.value
              .split(/[,\s]+/)
              .map(Number)
              .filter((n) => Number.isInteger(n) && n > 0);
            if (v.length) onChange({ ...d, runnerLengths: [...new Set(v)].sort((a, b) => a - b) });
          }}
        />
      </div>
    </Group>
  );
}

function CornerEditor({ p, materials }: { p: CornerParams; materials: Material[] }) {
  const set = useDesign((s) => s.updateCorner);
  const select = useDesign((s) => s.select);
  const panelMats = matOptions(materials, (m) => m.thickness >= 12);
  const blind = p.variant === 'blind',
    diagonal = p.variant === 'diagonal';
  const inside = insideSummary(blind || diagonal ? [p.interior] : [p.interior, p.wingInterior]);
  const steps: Step[] = [
    { id: 'size', label: t('Size'), meta: `${p.width}×${p.height}×${p.depth}`, done: true },
    {
      id: 'inside',
      label: t('Inside'),
      meta: inside,
      done: inside !== t('Empty'),
      tone: inside === t('Empty') ? 'warn' : undefined,
    },
    {
      id: 'build',
      label: t('Build'),
      meta: blind ? t('Blind corner') : diagonal ? t('Diagonal') : t('L-shaped'),
      done: true,
    },
    { id: 'materials', label: t('Boards'), meta: matName(materials, p.bodyMaterialId), done: true },
  ];
  return (
    <div className="inspector">
      <EditorRail steps={steps} inside={() => select(p.interior.id)} />
      <header className="insp-head">
        <div className="info-row">
          <h3>{t('Corner unit')}</h3>
          <InfoTip label={t('About the corner unit')} align="start">
            {blind
              ? t('A blind section the neighbouring cabinet covers, joined to a normal cabinet.')
              : diagonal
                ? t(
                    'Five-sided: the same width along both walls, a return at each end and the door across the diagonal at 45°. Bottom, top and shelves are cut to a template.',
                  )
                : t(
                    'Two wings open to each other at the corner, with a folding door pair. The front view shows the back-wall wing.',
                  )}
          </InfoTip>
        </div>
      </header>
      <PieceInfo />
      <Segmented<CornerParams['variant']>
        label={t('Type')}
        value={p.variant}
        options={[
          { value: 'blind', label: t('Blind corner') },
          { value: 'l-shape', label: t('L-shaped') },
          { value: 'diagonal', label: t('Diagonal') },
        ]}
        onChange={(v) =>
          set(
            v === 'diagonal' && p.interior.kind !== 'shelves'
              ? {
                  variant: v,
                  interior: {
                    id: p.interior.id,
                    kind: 'shelves',
                    count: 1,
                    front: { kind: 'doors', count: 1 },
                  },
                }
              : { variant: v },
          )
        }
      />
      <Segmented<'left' | 'right'>
        label={t('Corner on the')}
        value={p.side}
        options={[
          { value: 'left', label: t('Left') },
          { value: 'right', label: t('Right') },
        ]}
        onChange={(v) => set({ side: v })}
      />
      <div className="dims3">
        <MmField
          label={blind ? t('Width') : diagonal ? t('Along each wall') : t('Back wing')}
          value={p.width}
          min={300}
          max={3000}
          onChange={(v) => set({ width: v })}
        />
        <MmField
          label={t('Height')}
          value={p.height}
          min={300}
          max={2500}
          onChange={(v) => set({ height: v })}
        />
        <MmField
          label={t('Depth')}
          value={p.depth}
          min={200}
          max={900}
          onChange={(v) => set({ depth: v })}
        />
      </div>
      {diagonal ? null : blind ? (
        <MmField
          label={t('Blind section')}
          value={p.blindWidth}
          min={100}
          max={1500}
          onChange={(v) => set({ blindWidth: v })}
          hint={t("About the neighbour's depth + 50 mm ({n}) keeps doors and handles clear.", {
            n: p.depth + 50,
          })}
        />
      ) : (
        <MmField
          label={t('Side wing (incl. corner)')}
          value={p.wingWidth}
          min={300}
          max={3000}
          onChange={(v) => set({ wingWidth: v })}
        />
      )}
      <div className="field">
        <span className="field-label">{t('Inside')}</span>
        <div className="split-actions">
          <button type="button" className="btn outline" onClick={() => select(p.interior.id)}>
            {blind
              ? t('Edit usable section')
              : diagonal
                ? t('Edit shelves and doors')
                : t('Edit back-wall wing')}
          </button>
          {!blind && !diagonal && (
            <button type="button" className="btn outline" onClick={() => select(p.wingInterior.id)}>
              {t('Edit side-wall wing')}
            </button>
          )}
        </div>
      </div>
      <Group title={t('Construction')} id="g-build">
        <Segmented
          label={t('Top@@panel')}
          value={p.top}
          options={[
            { value: 'over', label: t('On the sides') },
            { value: 'between', label: t('Between sides') },
          ]}
          onChange={(v) => set({ top: v })}
        />
        <Segmented<1 | 2>
          label={t('Top layers')}
          value={p.topLayers ?? 1}
          options={[
            { value: 1, label: t('Single') },
            {
              value: 2,
              label: t('Doubled'),
              title: t('Two panels glued, the second under the top'),
            },
          ]}
          onChange={(v) => set({ topLayers: v })}
        />
        <Segmented
          label={t('Back@@panel')}
          value={p.back}
          options={[
            { value: 'applied', label: t('Nailed on') },
            { value: 'inset', label: t('Set in') },
            { value: 'none', label: t('None') },
          ]}
          onChange={(v) => set({ back: v })}
        />
        <MmField
          label={t('Plinth height')}
          value={p.plinthHeight}
          min={0}
          max={250}
          onChange={(v) => set({ plinthHeight: v })}
          hint={t('0 for no plinth')}
        />
        <MmField
          label={t('Gap between fronts')}
          value={p.frontGap}
          min={0}
          max={10}
          step={1}
          onChange={(v) => set({ frontGap: v })}
        />
      </Group>
      <Group title={t('Materials')} id="g-materials">
        <Select
          label={t('Body')}
          value={p.bodyMaterialId}
          options={panelMats}
          onChange={(v) => set({ bodyMaterialId: v })}
        />
        <Select
          label={t('Fronts')}
          value={p.frontMaterialId}
          options={panelMats}
          onChange={(v) => set({ frontMaterialId: v })}
        />
        <Select
          label={t('Back@@panel')}
          value={p.backMaterialId}
          options={matOptions(materials)}
          onChange={(v) => set({ backMaterialId: v })}
        />
      </Group>
      <PartBoardsGroup />
      <ChecksGroup />
    </div>
  );
}

/** Panel set (ADR-041): a list of cut sizes. No assembly, so no inside and no construction choices. */
function PanelSetEditor({ p, materials }: { p: PanelSetParams; materials: Material[] }) {
  const set = useDesign((s) => s.updatePanelSet);
  const count = p.panels.reduce((n, lp) => n + lp.quantity, 0);
  const steps: Step[] = [
    {
      id: 'size',
      label: t('Panels'),
      meta: t('{n|# part|# parts}', { n: count }),
      done: count > 0,
      tone: count ? undefined : 'error',
    },
  ];
  const change = (id: string, patch: Partial<LoosePanel>) =>
    set({ panels: p.panels.map((lp) => (lp.id === id ? { ...lp, ...patch } : lp)) });
  const add = () =>
    set({
      panels: [
        ...p.panels,
        {
          id: newId(),
          name: `Panel ${p.panels.length + 1}`,
          length: 600,
          width: 300,
          materialId: p.panels.at(-1)?.materialId ?? materials[0].id,
          quantity: 1,
        },
      ],
    });
  return (
    <div className="inspector">
      <EditorRail steps={steps} />
      <header className="insp-head">
        <div className="info-row">
          <h3>{t('Loose panels')}</h3>
          <InfoTip label={t('About loose panels')} align="start">
            {t(
              'Parts known by their cut sizes. They go to the cut list and sheets. Parts with a known place are built where they sit; the rest lie in a pile beside them.',
            )}
          </InfoTip>
        </div>
        {p.note && <p className="hint">{p.note}</p>}
      </header>
      {p.panels.map((lp) => (
        <Group
          key={lp.id}
          title={`${lp.name || t('Panel')} — ${lp.length} × ${lp.width}${lp.quantity > 1 ? ` ×${lp.quantity}` : ''}`}
          defaultOpen={false}
        >
          <div className="field">
            <label htmlFor={`name-${lp.id}`}>{t('Name')}</label>
            <input
              id={`name-${lp.id}`}
              className="mat-name"
              defaultValue={lp.name}
              key={lp.name}
              maxLength={200}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== lp.name) change(lp.id, { name: v });
              }}
            />
          </div>
          <div className="dims3">
            <MmField
              label={t('Length')}
              value={lp.length}
              min={1}
              max={5000}
              step={1}
              onChange={(v) => change(lp.id, { length: v })}
            />
            <MmField
              label={t('Width')}
              value={lp.width}
              min={1}
              max={3000}
              step={1}
              onChange={(v) => change(lp.id, { width: v })}
            />
            <Counter
              label={t('Quantity')}
              value={lp.quantity}
              min={1}
              max={MAX_LOOSE}
              onChange={(v) => change(lp.id, { quantity: v })}
            />
          </div>
          <Select
            label={t('Board')}
            value={lp.materialId}
            options={matOptions(materials)}
            onChange={(v) => change(lp.id, { materialId: v })}
          />
          <Toggle
            label={t('Placed in the assembly')}
            checked={!!lp.place}
            onChange={(on) =>
              change(
                lp.id,
                on
                  ? { place: { x: 0, y: 0, z: 0, lie: 'flat-x' }, quantity: 1 }
                  : { place: undefined },
              )
            }
          />
          {lp.place && (
            <>
              <Select
                label={t('Lies')}
                value={lp.place.lie}
                options={LIE_OPTIONS}
                onChange={(v) => change(lp.id, { place: { ...lp.place!, lie: v } })}
              />
              <div className="dims3">
                <MmField
                  label={t('x (from left)')}
                  value={lp.place.x}
                  min={0}
                  max={20000}
                  step={1}
                  onChange={(v) => change(lp.id, { place: { ...lp.place!, x: v } })}
                />
                <MmField
                  label={t('y (from floor)')}
                  value={lp.place.y}
                  min={0}
                  max={20000}
                  step={1}
                  onChange={(v) => change(lp.id, { place: { ...lp.place!, y: v } })}
                />
                <MmField
                  label={t('z (from back)')}
                  value={lp.place.z}
                  min={0}
                  max={20000}
                  step={1}
                  onChange={(v) => change(lp.id, { place: { ...lp.place!, z: v } })}
                />
              </div>
            </>
          )}
          <button
            type="button"
            className="btn outline"
            disabled={p.panels.length < 2}
            onClick={() =>
              set({
                panels: p.panels.filter((x) => x.id !== lp.id),
                joints: (p.joints ?? []).filter((j) => j.a !== lp.id && j.b !== lp.id),
              })
            }
          >
            {t('Remove panel')}
          </button>
        </Group>
      ))}
      <button
        type="button"
        className="btn outline"
        disabled={p.panels.length >= MAX_LOOSE}
        onClick={add}
      >
        {t('Add panel')}
      </button>
      <JointsEditor p={p} />
    </div>
  );
}

const LIE_OPTIONS: { value: PanelLie; label: string }[] = [
  { value: 'flat-x', label: t('Flat, length left to right') },
  { value: 'flat-z', label: t('Flat, length front to back') },
  { value: 'edge-x', label: t('On edge, length left to right') },
  { value: 'edge-z', label: t('On edge, length front to back') },
  { value: 'up-x', label: t('Upright, facing the front') },
  { value: 'up-z', label: t('Upright, facing the side') },
];

/** Screwed joints between placed panels (ADR-041 amendment); screws are the user's choice. */
function JointsEditor({ p }: { p: PanelSetParams }) {
  const set = useDesign((s) => s.updatePanelSet);
  const placed = p.panels.filter((lp) => lp.place);
  const [a, setA] = useState(''),
    [b, setB] = useState('');
  const name = (id: string) => p.panels.find((lp) => lp.id === id)?.name ?? id;
  const joints = p.joints ?? [];
  if (placed.length < 2 && !joints.length) return null;
  const opts = placed.map((lp) => ({ value: lp.id, label: lp.name }));
  return (
    <Section
      title={t('Screwed joints')}
      info={
        <GuidanceTip topic={t('screwed joints')}>
          {t('Screw type, length and count are your choice for the board (guidance only).')}
        </GuidanceTip>
      }
    >
      {joints.length ? (
        <ul className="plain-list">
          {joints.map((j, i) => (
            <li key={`${j.a}-${j.b}-${i}`}>
              {name(j.a)} — {name(j.b)}{' '}
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => set({ joints: joints.filter((_, k) => k !== i) })}
              >
                {t('Remove')}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">{t('No joints yet.')}</p>
      )}
      <div className="dims2">
        <Select
          label={t('Panel')}
          value={a || opts[0]?.value || ''}
          options={opts}
          onChange={setA}
        />
        <Select
          label={t('Screwed to')}
          value={b || opts[1]?.value || ''}
          options={opts}
          onChange={setB}
        />
      </div>
      <button
        type="button"
        className="btn outline"
        disabled={opts.length < 2 || (a || opts[0]?.value) === (b || opts[1]?.value)}
        onClick={() =>
          set({
            joints: [...joints, { a: a || opts[0].value, b: b || opts[1].value, kind: 'screwed' }],
          })
        }
      >
        {t('Add screwed joint')}
      </button>
    </Section>
  );
}

const SUPPORT_LABEL: Record<DeskSupport, string> = {
  gables: t('On panels'),
  'pedestal-left': t('Unit left'),
  'pedestal-right': t('Unit right'),
  'two-pedestals': t('Two units'),
};

function DeskEditor({
  p,
  deskId,
  materials,
}: {
  p: DeskParams;
  deskId: string;
  materials: Material[];
}) {
  const select = useDesign((s) => s.select);
  const set = useDesign((s) => s.updateDesk);
  const panelMats = matOptions(materials, (m) => m.thickness >= 12);
  const ped = p.support !== 'gables';
  const sides = (['left', 'right'] as const).filter((sd) => usesPedestal(p, sd));
  const steps: Step[] = [
    { id: 'size', label: t('Size'), meta: `${p.width}×${p.height}×${p.depth}`, done: true },
    {
      id: 'inside',
      label: t('Units'),
      meta: ped
        ? insideSummary(sides.map((sd) => pedestalRoot(p, sd, deskId)))
        : t('No drawer units'),
      done: true,
      disabled: !ped,
    },
    { id: 'build', label: t('Build'), meta: SUPPORT_LABEL[p.support], done: true },
    { id: 'materials', label: t('Boards'), meta: matName(materials, p.topMaterialId), done: true },
  ];
  return (
    <div className="inspector">
      <EditorRail
        steps={steps}
        inside={() => {
          if (sides[0]) select(pedestalRoot(p, sides[0], deskId).id);
        }}
      />
      <header className="insp-head">
        <h3>{t('Desk')}</h3>
      </header>
      <PieceInfo />
      <div className="dims3">
        <MmField
          label={t('Width')}
          value={p.width}
          min={400}
          max={3000}
          onChange={(v) => set({ width: v })}
        />
        <MmField
          label={t('Height')}
          value={p.height}
          min={400}
          max={1200}
          onChange={(v) => set({ height: v })}
        />
        <MmField
          label={t('Depth')}
          value={p.depth}
          min={300}
          max={1200}
          onChange={(v) => set({ depth: v })}
        />
      </div>
      <Segmented<DeskSupport>
        label={t('Supports')}
        value={p.support}
        onChange={(v) => set({ support: v })}
        options={[
          { value: 'gables', label: t('Panels') },
          { value: 'pedestal-left', label: t('Drawers left') },
          { value: 'pedestal-right', label: t('Drawers right') },
          { value: 'two-pedestals', label: t('Both') },
        ]}
      />
      {ped && (
        <div className="dims2">
          <MmField
            label={t('Drawer unit width')}
            value={p.pedestal.width}
            min={250}
            max={900}
            onChange={(v) => set({ pedestal: { ...p.pedestal, width: v } })}
          />
        </div>
      )}
      {ped && (
        <div className="field">
          <div className="label-row">
            <span className="field-label">{t('Inside the drawer units')}</span>
            <InfoTip label={t('About the drawer units')} align="start">
              {t('Or tap a drawer unit in the front view. Each unit is laid out on its own.')}
            </InfoTip>
          </div>
          <div className="split-actions">
            {sides.map((sd) => (
              <button
                key={sd}
                type="button"
                className="btn outline"
                onClick={() => select(pedestalRoot(p, sd, deskId).id)}
              >
                {sd === 'left' ? t('Edit left unit') : t('Edit right unit')}
              </button>
            ))}
          </div>
        </div>
      )}
      <Group title={t('Construction')} id="g-build">
        <MmField
          label={t('Top overhang at the front')}
          value={p.frontOverhang}
          min={0}
          max={300}
          step={5}
          onChange={(v) => set({ frontOverhang: v })}
        />
        <Toggle
          label={t('Modesty panel at the back')}
          checked={p.modesty.enabled}
          onChange={(v) => set({ modesty: { ...p.modesty, enabled: v } })}
        />
        {p.modesty.enabled && (
          <div className="dims2">
            <MmField
              label={t('Panel height')}
              value={p.modesty.height}
              min={50}
              max={800}
              onChange={(v) => set({ modesty: { ...p.modesty, height: v } })}
            />
            <MmField
              label={t('Set in from rear')}
              value={p.modesty.setback}
              min={0}
              max={400}
              onChange={(v) => set({ modesty: { ...p.modesty, setback: v } })}
            />
          </div>
        )}
      </Group>
      <Group title={t('Materials')} id="g-materials">
        <Select
          label={t('Worktop')}
          value={p.topMaterialId}
          options={panelMats}
          onChange={(v) => set({ topMaterialId: v })}
        />
        <Select
          label={t('Supports')}
          value={p.bodyMaterialId}
          options={panelMats}
          onChange={(v) => set({ bodyMaterialId: v })}
        />
        {ped && (
          <Select
            label={t('Drawer fronts')}
            value={p.frontMaterialId}
            options={panelMats}
            onChange={(v) => set({ frontMaterialId: v })}
          />
        )}
      </Group>
      {ped && (
        <DrawerSettingsGroup
          value={p.drawers}
          materials={materials}
          onChange={(d) => set({ drawers: d })}
        />
      )}
      <PartBoardsGroup />
      <ChecksGroup />
    </div>
  );
}

/** Quick layout for the whole inside: bays side by side, the same shelves and doors in each (core `makeBays`). */
function BaysGroup({ interior, onChange }: { interior: Space; onChange: (s: Space) => void }) {
  const layout = bayLayoutOf(interior);
  const cur = layout ?? { bays: 1, shelves: 0, doors: 0 as const };
  const apply = async (patch: Partial<typeof cur>) => {
    if (
      !layout &&
      !(await askConfirm(t('The inside has its own layout. Replace it with equal bays?'), {
        confirmLabel: t('Replace'),
      }))
    )
      return;
    onChange(makeBays({ ...cur, ...patch }, interior));
  };
  return (
    <Group title={t('Bays and shelves')} id="g-bays">
      {!layout && (
        <p className="hint">
          {t('The inside is laid out space by space. Changing these replaces it with equal bays.')}
        </p>
      )}
      <Counter
        label={t('Bays (divided by uprights)')}
        info={
          layout &&
          layout.bays > 1 && (
            <InfoTip label={t('About bays')} align="start">
              {t('Tap a bay in the front view to give it its own width, shelves or drawers.')}
            </InfoTip>
          )
        }
        value={cur.bays}
        min={1}
        max={MAX_BAYS}
        onChange={(v) => apply({ bays: v })}
      />
      <Counter
        label={t('Shelves in each bay')}
        value={cur.shelves}
        min={0}
        max={12}
        onChange={(v) => apply({ shelves: v })}
      />
      <Segmented<0 | 1 | 2>
        label={t('Doors on each bay')}
        value={cur.doors}
        options={[
          { value: 0, label: t('None') },
          { value: 1, label: t('One') },
          { value: 2, label: t('Pair') },
        ]}
        onChange={(v) => apply({ doors: v })}
      />
    </Group>
  );
}
