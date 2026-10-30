import { useMemo } from 'react';
import { catalogFamilies } from '../core/catalog';
import { applyLayout, layoutPresets } from '../core/catalog/presets';
import { DEFAULT_SLIDING_OVERLAP, DEFAULT_SLIDING_TRACK } from '../core/cabinet';
import { RULE_DEFAULTS } from '../core/rules';
import { t, tr } from '../core/i18n';
import { boardLabel } from '../core/boards';
import type {
  ApplianceNiche,
  FrameParams,
  Front,
  Material,
  PanelParams,
  RuleSettings,
  Space,
} from '../core/types';
import { useDesign } from '../store/designStore';
import {
  Counter,
  Group,
  GuidanceTip,
  InfoTip,
  MmField,
  Segmented,
  Select,
  Toggle,
} from './controls';
import { tNode } from './i18n';
import { Icon } from './icons';

const matOptions = (materials: Material[], filter?: (m: Material) => boolean) =>
  materials.filter(filter ?? (() => true)).map((m) => ({ value: m.id, label: boardLabel(m) }));

type FrontKind = 'none' | 'doors1' | 'doors2' | 'sliding' | 'flap';
const frontKind = (f: Front | null | undefined): FrontKind =>
  !f ? 'none' : f.kind === 'doors' ? (f.count === 1 ? 'doors1' : 'doors2') : f.kind;

/** Doors, sliding doors or a flap on a space (ADR-005, ADR-037). */
export function FrontEditor({
  space,
  onChange,
}: {
  space: Space;
  onChange: (fn: (s: Space) => Space) => void;
}) {
  const f = space.front;
  const set = (front: Front | null) => onChange((s) => ({ ...s, front }));
  return (
    <>
      <Segmented<FrontKind>
        label={t('Front')}
        value={frontKind(f)}
        options={[
          { value: 'none', label: t('None') },
          { value: 'doors1', label: t('Door') },
          { value: 'doors2', label: t('Pair') },
          { value: 'sliding', label: t('Sliding') },
          { value: 'flap', label: t('Flap') },
        ]}
        onChange={(k) =>
          set(
            k === 'none'
              ? null
              : k === 'doors1'
                ? { kind: 'doors', count: 1 }
                : k === 'doors2'
                  ? { kind: 'doors', count: 2 }
                  : k === 'sliding'
                    ? { kind: 'sliding', count: 2 }
                    : { kind: 'flap', count: 1, direction: 'up' },
          )
        }
      />
      {f?.kind === 'doors' && f.count === 1 && (
        <Segmented<'left' | 'right'>
          label={t('Hinges on')}
          value={f.hinge ?? 'left'}
          options={[
            { value: 'left', label: t('Left') },
            { value: 'right', label: t('Right') },
          ]}
          onChange={(v) => set({ ...f, hinge: v })}
        />
      )}
      {f?.kind === 'sliding' && (
        <>
          <Counter
            label={t('Sliding doors')}
            value={f.count}
            min={2}
            max={4}
            onChange={(v) => set({ ...f, count: v as 2 | 3 | 4 })}
            info={
              <GuidanceTip topic={t('sliding doors')}>
                {t(
                  "Doors run in two planes in front of the carcass. Check track, rollers and door sizes with the sliding system's datasheet.",
                )}
              </GuidanceTip>
            }
          />
          <div className="dims2">
            <MmField
              label={t('Overlap')}
              value={f.overlap ?? DEFAULT_SLIDING_OVERLAP}
              min={0}
              max={200}
              step={5}
              onChange={(v) => set({ ...f, overlap: v })}
            />
            <MmField
              label={t('Track depth')}
              value={f.track ?? DEFAULT_SLIDING_TRACK}
              min={20}
              max={300}
              step={5}
              onChange={(v) => set({ ...f, track: v })}
            />
          </div>
        </>
      )}
      {f?.kind === 'flap' && (
        <>
          <Segmented<'up' | 'down'>
            label={t('Opens')}
            value={f.direction}
            options={[
              { value: 'up', label: t('Lifts up') },
              { value: 'down', label: t('Drops down') },
            ]}
            onChange={(v) => set({ ...f, direction: v })}
          />
          <div className="field">
            <div className="label-row">
              <label htmlFor={`fit-${space.id}`}>{t('Fitting you chose')}</label>
              <GuidanceTip topic={t('flap fitting')}>
                {t('Choose it by front weight and height; a check stays until it is named.')}
              </GuidanceTip>
            </div>
            <input
              id={`fit-${space.id}`}
              defaultValue={f.fitting ?? ''}
              key={f.fitting ?? ''}
              placeholder={t('Maker and type, from its datasheet')}
              onBlur={(e) => {
                const v = e.target.value.trim();
                set(
                  v
                    ? { ...f, fitting: v.slice(0, 200) }
                    : { kind: 'flap', count: 1, direction: f.direction },
                );
              }}
            />
          </div>
        </>
      )}
    </>
  );
}

const APPLIANCES: ApplianceNiche['kind'][] = [
  'oven',
  'microwave',
  'fridge',
  'dishwasher',
  'hob',
  'other',
];
const APPLIANCE_LABEL: Record<ApplianceNiche['kind'], string> = {
  oven: t('Oven'),
  microwave: t('Microwave'),
  fridge: t('Fridge'),
  dishwasher: t('Dishwasher'),
  hob: t('Hob'),
  other: t('Other'),
};

/** Appliance niche on an empty space (ADR-036): every size typed from the appliance's installation drawing. */
export function ApplianceEditor({
  space,
  onChange,
}: {
  space: Extract<Space, { kind: 'empty' }>;
  onChange: (fn: (s: Space) => Space) => void;
}) {
  const a = space.appliance;
  const opening = useDesign((s) => s.model.spaces.find((o) => o.nodeId === space.id));
  const set = (next: ApplianceNiche | undefined) =>
    onChange((s) => {
      if (s.kind !== 'empty') return s;
      if (!next) {
        const { appliance: _drop, ...rest } = s;
        void _drop;
        return rest;
      }
      return { ...s, appliance: next };
    });
  return (
    <>
      <Toggle
        label={t('Niche for a built-in appliance')}
        checked={!!a}
        onChange={(v) =>
          set(
            v
              ? {
                  kind: 'oven',
                  w: opening?.box.w ?? 560,
                  h: Math.min(opening?.box.h ?? 590, 590),
                  d: Math.min(opening?.box.d ?? 550, 550),
                }
              : undefined,
          )
        }
      />
      {a && (
        <>
          <Select<ApplianceNiche['kind']>
            label={t('Appliance')}
            value={a.kind}
            options={APPLIANCES.map((k) => ({ value: k, label: APPLIANCE_LABEL[k] }))}
            onChange={(k) => set({ ...a, kind: k })}
            info={
              <GuidanceTip topic={t('appliance sizes')}>
                {t(
                  "Type every size from the appliance's installation drawing; Mobila has no appliance sizes of its own.",
                )}
              </GuidanceTip>
            }
          />
          <div className="dims3">
            <MmField
              label={t('Niche width')}
              value={a.w}
              min={1}
              max={3000}
              onChange={(v) => set({ ...a, w: v })}
            />
            <MmField
              label={t('Niche height')}
              value={a.h}
              min={1}
              max={3000}
              onChange={(v) => set({ ...a, h: v })}
            />
            <MmField
              label={t('Niche depth')}
              value={a.d}
              min={1}
              max={1200}
              onChange={(v) => set({ ...a, d: v })}
            />
          </div>
        </>
      )}
    </>
  );
}

/** "Apply layout…" from the catalog's interior variants (ADR-033): replaces this space's inside, one undo step. */
export function LayoutPicker({
  space,
  onChange,
}: {
  space: Space;
  onChange: (fn: (s: Space) => Space) => void;
}) {
  const presets = useMemo(() => layoutPresets(catalogFamilies), []);
  return (
    <div className="field">
      <div className="label-row">
        <label htmlFor={`preset-${space.id}`}>{t('Apply a layout from the catalog')}</label>
        <InfoTip label={t('About applying a layout')} align="start">
          {t('Replaces what is inside this space; the outer size stays. Undo brings it back.')}
        </InfoTip>
      </div>
      <select
        id={`preset-${space.id}`}
        value=""
        onChange={(e) => {
          const p = presets.find((x) => x.id === e.target.value);
          if (p) onChange((s) => applyLayout(s, p.space()));
        }}
      >
        <option value="">{t('Choose a layout…')}</option>
        {presets.map((p) => (
          <option key={p.id} value={p.id}>
            {tr(p.family)}: {tr(p.name)}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Where the piece came from (ADR-028) and the hardware still to choose (ADR-033). */
export function PieceInfo() {
  const catalog = useDesign((s) => s.design.catalog);
  const updateMeta = useDesign((s) => s.updateMeta);
  if (!catalog?.origin && !catalog?.hardwareToChoose) return null;
  const o = catalog.origin;
  return (
    <div className="piece-info">
      {o && (
        <p className="hint">
          <Icon name="catalog" className="sm" />{' '}
          {tNode('Based on {name} (catalog revision {revision})', {
            name: (
              <strong>
                {o.brand ? `${o.brand} ` : ''}
                {tr(o.productName)}
              </strong>
            ),
            revision: o.revision,
          })}
          {o.sourceUrl && (
            <>
              {' '}
              ·{' '}
              <a href={o.sourceUrl} target="_blank" rel="noopener noreferrer">
                {t('source')}
              </a>
            </>
          )}
        </p>
      )}
      {catalog.hardwareToChoose && (
        <p className="alert warning">
          <Icon name="alert-triangle" className="sm" />
          <span>
            {t('To choose from a datasheet: {list}.', { list: tr(catalog.hardwareToChoose) })}
          </span>
          <button
            type="button"
            className="btn sm"
            onClick={() => {
              const { hardwareToChoose: _drop, ...rest } = catalog;
              void _drop;
              updateMeta({ catalog: rest });
            }}
          >
            {t('Chosen')}
          </button>
        </p>
      )}
    </div>
  );
}

/** Guidance thresholds (ADR-035): typical defaults the user can change for this piece. */
export function ChecksGroup() {
  const rules = useDesign((s) => s.design.settings?.rules);
  const settings = useDesign((s) => s.design.settings);
  const updateMeta = useDesign((s) => s.updateMeta);
  const set = (patch: Partial<RuleSettings>) =>
    updateMeta({ settings: { ...settings, rules: { ...rules, ...patch } } });
  return (
    <Group
      title={t('Checks')}
      id="g-checks"
      defaultOpen={false}
      info={
        <GuidanceTip topic={t('checks')} align="end">
          {t(
            'Typical values that raise warnings, never errors. Confirm them for your boards and hardware.',
          )}
        </GuidanceTip>
      }
    >
      <div className="dims2">
        <MmField
          label={t('Longest shelf (18 mm board)')}
          value={rules?.shelfSpan ?? RULE_DEFAULTS.shelfSpan}
          min={200}
          max={2000}
          onChange={(v) => set({ shelfSpan: v })}
        />
        <MmField
          label={t('Widest single door')}
          value={rules?.doorMaxWidth ?? RULE_DEFAULTS.doorMaxWidth}
          min={200}
          max={1500}
          onChange={(v) => set({ doorMaxWidth: v })}
        />
        <MmField
          label={t('Depth for hangers')}
          value={rules?.hangerDepth ?? RULE_DEFAULTS.hangerDepth}
          min={200}
          max={1000}
          onChange={(v) => set({ hangerDepth: v })}
        />
        <MmField
          label={t('Room height (0 = not checked)')}
          value={rules?.roomHeight ?? 0}
          min={0}
          max={6000}
          onChange={(v) => set({ roomHeight: v || undefined })}
          hint={t('For the stand-up check when a tall piece is built lying down.')}
        />
      </div>
    </Group>
  );
}

const PURPOSE: Record<PanelParams['purpose'], string> = {
  dishwasher: t('Dishwasher front'),
  fridge: t('Fridge door'),
  cover: t('Cover panel'),
  filler: t('Filler'),
};

export function PanelEditor({ p, materials }: { p: PanelParams; materials: Material[] }) {
  const set = useDesign((s) => s.updatePanel);
  return (
    <div className="inspector">
      <header className="insp-head">
        <div className="info-row">
          <h3>{PURPOSE[p.purpose]}</h3>
          <InfoTip label={t('About this panel')} align="start">
            {t('A front with no carcass behind it.')}
          </InfoTip>
          <GuidanceTip topic={t('fitting the panel')}>
            {t(
              "Line it up with the neighbouring fronts; the fixing kit and its positions come from the appliance's installation drawing.",
            )}
          </GuidanceTip>
        </div>
      </header>
      <PieceInfo />
      <Select<PanelParams['purpose']>
        label={t('Used as')}
        value={p.purpose}
        options={(Object.keys(PURPOSE) as PanelParams['purpose'][]).map((k) => ({
          value: k,
          label: PURPOSE[k],
        }))}
        onChange={(v) => set({ purpose: v })}
      />
      <div className="dims2">
        <MmField
          label={t('Width')}
          value={p.width}
          min={20}
          max={3000}
          onChange={(v) => set({ width: v })}
        />
        <MmField
          label={t('Height')}
          value={p.height}
          min={50}
          max={3000}
          onChange={(v) => set({ height: v })}
        />
      </div>
      <Select
        label={t('Board')}
        value={p.materialId}
        options={matOptions(materials, (m) => m.stock !== 'solid')}
        onChange={(v) => set({ materialId: v })}
      />
      {(p.purpose === 'dishwasher' || p.purpose === 'fridge') && (
        <Segmented<'none' | 'bar' | 'knob'>
          label={t('Handle')}
          value={p.handle?.kind === 'bar' || p.handle?.kind === 'knob' ? p.handle.kind : 'none'}
          options={[
            { value: 'none', label: t('None') },
            { value: 'bar', label: t('Bar') },
            { value: 'knob', label: t('Knob') },
          ]}
          onChange={(v) =>
            set({ handle: v === 'none' ? null : { kind: v, holeSpacing: 128, position: 'top' } })
          }
        />
      )}
      <ChecksGroup />
    </div>
  );
}

/** Typical mattress sizes (EU, UK, US). Check the mattress you buy. */
const MATTRESSES: [number, number, string][] = [
  [900, 2000, t('EU single')],
  [1400, 2000, t('EU double')],
  [1600, 2000, t('EU queen')],
  [1800, 2000, t('EU king')],
  [900, 1900, t('UK single')],
  [1350, 1900, t('UK double')],
  [1500, 2000, t('UK king')],
  [965, 1905, t('US twin')],
  [1372, 1905, t('US full')],
  [1524, 2032, t('US queen')],
  [1930, 2032, t('US king')],
];

const FRAME_LABEL: Record<FrameParams['kind'], string> = {
  table: t('Table'),
  bench: t('Bench'),
  stool: t('Stool'),
  chair: t('Chair'),
  bed: t('Bed'),
};

/** Frames (ADR-038): legs, rails, stretchers, slats; beds by mattress size. */
export function FrameEditor({ p }: { p: FrameParams }) {
  const set = useDesign((s) => s.updateFrame);
  const b = p.bed;
  return (
    <div className="inspector">
      <header className="insp-head">
        <div className="info-row">
          <h3>{b && b.tierGap > 0 ? t('Bunk bed') : FRAME_LABEL[p.kind]}</h3>
          <InfoTip label={t('About this frame')} align="start">
            {t(
              'Legs, rails and slats are solid timber listed by length; tops and boards come from sheets.',
            )}
          </InfoTip>
        </div>
      </header>
      <PieceInfo />
      {b ? (
        <>
          <div className="dims2">
            <MmField
              label={t('Mattress width')}
              value={b.mattress.w}
              min={300}
              max={2200}
              onChange={(v) => set({ bed: { ...b, mattress: { ...b.mattress, w: v } } })}
            />
            <MmField
              label={t('Mattress length')}
              value={b.mattress.l}
              min={600}
              max={2300}
              onChange={(v) => set({ bed: { ...b, mattress: { ...b.mattress, l: v } } })}
            />
          </div>
          <Select
            label={t('Mattress size')}
            info={
              <GuidanceTip topic={t('mattress sizes')}>
                {t('Typical sizes; check the mattress you buy.')}
              </GuidanceTip>
            }
            value={`${b.mattress.w}x${b.mattress.l}`}
            onChange={(v) => {
              const [w, l] = v.split('x').map(Number);
              if (w && l) set({ bed: { ...b, mattress: { w, l } } });
            }}
            options={[
              {
                value: `${b.mattress.w}x${b.mattress.l}`,
                label: `${b.mattress.w} × ${b.mattress.l}`,
              },
              ...MATTRESSES.filter(([w, l]) => w !== b.mattress.w || l !== b.mattress.l).map(
                ([w, l, name]) => ({ value: `${w}x${l}`, label: `${name} ${w} × ${l}` }),
              ),
            ]}
          />
          <div className="dims2">
            <MmField
              label={t('Clearance each side')}
              value={b.clearance}
              min={0}
              max={50}
              step={1}
              onChange={(v) => set({ bed: { ...b, clearance: v } })}
            />
            <MmField
              label={t('Slats top above floor')}
              value={b.deckHeight}
              min={150}
              max={900}
              onChange={(v) => set({ bed: { ...b, deckHeight: v } })}
            />
            <MmField
              label={t('Side rail height')}
              value={b.railHeight}
              min={100}
              max={500}
              onChange={(v) => set({ bed: { ...b, railHeight: v } })}
            />
            <MmField
              label={t('Headboard height')}
              value={b.headboardHeight}
              min={200}
              max={2000}
              onChange={(v) => set({ bed: { ...b, headboardHeight: v } })}
            />
            <MmField
              label={t('Footboard height')}
              value={b.footboardHeight}
              min={0}
              max={2000}
              onChange={(v) => set({ bed: { ...b, footboardHeight: v } })}
              hint={t('0 = just above the rails')}
            />
            <MmField
              label={t('Side panel height')}
              value={b.sidePanelHeight}
              min={0}
              max={1500}
              onChange={(v) => set({ bed: { ...b, sidePanelHeight: v } })}
              hint={t('0 = none (daybed back)')}
            />
          </div>
        </>
      ) : (
        <>
          <div className="dims3">
            <MmField
              label={t('Width')}
              value={p.width}
              min={200}
              max={4000}
              onChange={(v) => set({ width: v })}
            />
            <MmField
              label={t('Height')}
              value={p.height}
              min={200}
              max={1500}
              onChange={(v) => set({ height: v })}
            />
            <MmField
              label={t('Depth')}
              value={p.depth}
              min={200}
              max={2000}
              onChange={(v) => set({ depth: v })}
            />
          </div>
          <Segmented<'panel' | 'slats'>
            label={p.kind === 'table' ? t('Top@@table') : t('Seat')}
            value={p.top}
            options={[
              { value: 'panel', label: t('One board') },
              { value: 'slats', label: t('Slats') },
            ]}
            onChange={(v) => set({ top: v })}
          />
          {(p.kind === 'chair' || p.kind === 'bench') && (
            <>
              <Toggle
                label={t('Back@@chair')}
                checked={!!p.back}
                onChange={(v) =>
                  set({
                    back: v
                      ? {
                          seatHeight: Math.min(460, p.height - 300),
                          style: 'slats',
                          count: 4,
                          railHeight: 60,
                          angleDeg: 8,
                        }
                      : null,
                  })
                }
              />
              {p.back && (
                <div className="dims2">
                  <MmField
                    label={t('Seat height')}
                    value={p.back.seatHeight}
                    min={200}
                    max={900}
                    onChange={(v) => set({ back: { ...p.back!, seatHeight: v } })}
                  />
                  <Select<'slats' | 'panel'>
                    label={t('Back of')}
                    value={p.back.style}
                    options={[
                      { value: 'slats', label: t('Slats') },
                      { value: 'panel', label: t('A panel') },
                    ]}
                    onChange={(v) => set({ back: { ...p.back!, style: v } })}
                  />
                  {p.back.style === 'slats' && (
                    <Counter
                      label={t('Back slats')}
                      value={p.back.count}
                      min={1}
                      max={12}
                      onChange={(v) => set({ back: { ...p.back!, count: v } })}
                    />
                  )}
                  {!p.recline && (
                    <MmField
                      label={t('Back rake')}
                      unit="°"
                      value={p.back.angleDeg ?? 0}
                      min={0}
                      max={25}
                      step={1}
                      onChange={(v) => set({ back: { ...p.back!, angleDeg: v } })}
                      hint={t('Leans back from upright; 8° is typical')}
                    />
                  )}
                </div>
              )}
              {p.back && p.recline && (
                <Segmented<number>
                  label={t('Reclining position shown')}
                  value={p.recline.at}
                  options={p.recline.positions.map((a, i) => ({ value: i, label: `${a}°` }))}
                  onChange={(v) => set({ recline: { ...p.recline!, at: v } })}
                />
              )}
              {p.back && (
                <Toggle
                  label={t('Reclining back (bought mechanism)')}
                  checked={!!p.recline}
                  onChange={(v) =>
                    set({
                      recline: v
                        ? {
                            positions: [100, 120, 150],
                            at: 0,
                            footrest: { length: 380, angles: [0, 45, 90] },
                          }
                        : null,
                    })
                  }
                />
              )}
              {p.recline && (
                <Toggle
                  label={t('Footrest')}
                  checked={!!p.recline.footrest}
                  onChange={(v) =>
                    set({
                      recline: {
                        ...p.recline!,
                        footrest: v
                          ? {
                              length: 380,
                              angles: p.recline!.positions.map((_, i, a) =>
                                Math.round((90 * i) / Math.max(1, a.length - 1)),
                              ),
                            }
                          : null,
                      },
                    })
                  }
                />
              )}
              {p.back && (
                <Toggle
                  label={t('Arm rests')}
                  checked={!!p.arms}
                  onChange={(v) =>
                    set({ arms: v ? { height: (p.back?.seatHeight ?? 450) + 220 } : null })
                  }
                />
              )}
              {p.arms && (
                <MmField
                  label={t('Arm rest top above floor')}
                  value={p.arms.height}
                  min={200}
                  max={1500}
                  onChange={(v) => set({ arms: { height: v } })}
                />
              )}
              {p.kind === 'bench' && !p.back && p.top === 'slats' && (
                <Toggle
                  label={t('Lifting backrest (bought prop)')}
                  checked={!!p.backrest}
                  onChange={(v) =>
                    set({
                      backrest: v
                        ? {
                            length: Math.min(650, Math.floor(p.width / 3)),
                            positions: [100, 120, 150],
                            at: 2,
                          }
                        : null,
                    })
                  }
                />
              )}
              {p.backrest && (
                <>
                  <MmField
                    label={t('Backrest length')}
                    value={p.backrest.length}
                    min={100}
                    max={2000}
                    onChange={(v) => set({ backrest: { ...p.backrest!, length: v } })}
                  />
                  <Segmented<number>
                    label={t('Backrest position shown')}
                    value={p.backrest.at}
                    options={p.backrest.positions.map((a, i) => ({ value: i, label: `${a}°` }))}
                    onChange={(v) => set({ backrest: { ...p.backrest!, at: v } })}
                  />
                </>
              )}
              {p.kind === 'chair' && (
                <Segmented<'legs' | 'bought'>
                  label={t('Stands on')}
                  value={p.base ?? 'legs'}
                  options={[
                    { value: 'legs', label: t('Legs') },
                    { value: 'bought', label: t('Bought base (gas lift)') },
                  ]}
                  onChange={(v) => set({ base: v })}
                />
              )}
            </>
          )}
          <Group title={t('Legs, rails and stretchers')} id="g-build">
            <div className="dims2">
              <MmField
                label={t('Leg width')}
                value={p.leg.w}
                min={15}
                max={200}
                step={5}
                onChange={(v) => set({ leg: { ...p.leg, w: v } })}
              />
              <MmField
                label={t('Leg depth')}
                value={p.leg.d}
                min={15}
                max={200}
                step={5}
                onChange={(v) => set({ leg: { ...p.leg, d: v } })}
              />
              <MmField
                label={t('Legs set in')}
                value={p.legInset}
                min={0}
                max={300}
                step={5}
                onChange={(v) => set({ legInset: v })}
              />
              <MmField
                label={t('Rail height')}
                value={p.apron.height}
                min={0}
                max={300}
                step={5}
                onChange={(v) => set({ apron: { ...p.apron, height: v } })}
                hint={t('0 = no rails')}
              />
              <MmField
                label={t('Rail thickness')}
                value={p.apron.thickness}
                min={10}
                max={60}
                step={1}
                onChange={(v) => set({ apron: { ...p.apron, thickness: v } })}
              />
            </div>
            <Segmented<FrameParams['stretchers']>
              label={t('Stretchers')}
              value={p.stretchers}
              options={[
                { value: 'none', label: t('None') },
                { value: 'box', label: t('All round') },
                { value: 'h', label: t('H') },
              ]}
              onChange={(v) => set({ stretchers: v })}
            />
            {p.stretchers !== 'none' && (
              <MmField
                label={t('Stretchers above floor')}
                value={p.stretcherHeight}
                min={50}
                max={800}
                onChange={(v) => set({ stretcherHeight: v })}
              />
            )}
            {p.kind === 'table' && (
              <Toggle
                label={t('Lower shelf')}
                checked={!!p.shelf}
                onChange={(v) => set({ shelf: v ? { height: 150 } : null })}
              />
            )}
            {p.shelf && (
              <MmField
                label={t('Shelf top above floor')}
                value={p.shelf.height}
                min={50}
                max={800}
                onChange={(v) => set({ shelf: { height: v } })}
              />
            )}
          </Group>
        </>
      )}
      <div className="dims3">
        <MmField
          label={t('Slat width')}
          value={p.slats.width}
          min={20}
          max={200}
          step={5}
          onChange={(v) => set({ slats: { ...p.slats, width: v } })}
        />
        <MmField
          label={t('Slat thickness')}
          value={p.slats.thickness}
          min={8}
          max={60}
          step={1}
          onChange={(v) => set({ slats: { ...p.slats, thickness: v } })}
        />
        <MmField
          label={t('Slat gap')}
          value={p.slats.gap}
          min={0}
          max={200}
          step={5}
          onChange={(v) => set({ slats: { ...p.slats, gap: v } })}
        />
      </div>
      <ChecksGroup />
    </div>
  );
}
