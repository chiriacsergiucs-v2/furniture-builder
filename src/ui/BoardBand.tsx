import { useId, useState, type KeyboardEvent } from 'react';
import {
  BAND_KINDS,
  BAND_MAX_ALLOWANCE,
  BAND_MAX_CODE,
  BAND_MAX_WIDTH,
  bandText,
  COMMON_BAND_THICKNESS,
  parseTenths,
  tenthsText,
} from '../core/materials';
import { t, tr } from '../core/i18n';
import type { EdgeBand, EdgeBandKind, Material } from '../core/types';
import { useDesign } from '../store/designStore';
import { Segmented, Select, Toggle } from './controls';
import { BandProduct } from './SellerLinks';

/**
 * ADR-077: the edge band on a board, named by the user from the supplier's datasheet. Nothing is filled in: the
 * common thicknesses are choices only. A separate band for doors and drawer fronts when switched on.
 */
export function BoardBand({ m }: { m: Material }) {
  const update = useDesign((s) => s.updateMaterial);
  const [front, setFront] = useState(!!m.frontBand);
  const [had, setHad] = useState(!!m.frontBand);
  // Undo, redo or a reload changed the front band: the switch follows it.
  if (had !== !!m.frontBand) {
    setHad(!!m.frontBand);
    setFront(!!m.frontBand);
  }
  return (
    <div
      className="mat-band"
      role="group"
      aria-label={t('Edge band for {name}', { name: tr(m.name) })}
    >
      <BandFields
        title={t('Edge band')}
        value={m.band}
        onChange={(band) => update(m.id, { band })}
        empty={t(
          "Not named: the shopping list puts this board's banding under To choose before buying.",
        )}
      />
      <BandProduct m={m} />
      <Toggle
        label={t('Fronts banded differently')}
        checked={front}
        onChange={(v) => {
          setFront(v);
          if (!v && m.frontBand) update(m.id, { frontBand: undefined });
        }}
      />
      {front && (
        <BandFields
          title={t('Front edge band')}
          value={m.frontBand}
          onChange={(frontBand) => update(m.id, { frontBand })}
          empty={t(
            "Doors and drawer fronts of this board use the board's band until this one is complete.",
          )}
        />
      )}
      {front && <BandProduct m={m} front />}
    </div>
  );
}

interface Draft {
  kind: EdgeBandKind | '';
  thickness: string;
  width: string;
  code: string;
  allowance: string;
}

/** Compares bands by value, whatever order their fields were saved in. */
const canon = (b: EdgeBand | undefined) =>
  b ? JSON.stringify([b.kind, b.thickness, b.width, b.code ?? '', b.allowance ?? 0]) : 'null';

const draftOf = (b: EdgeBand | undefined): Draft => ({
  kind: b?.kind ?? '',
  thickness: b ? tenthsText(b.thickness) : '',
  width: b ? String(b.width) : '',
  code: b?.code ?? '',
  allowance: b?.allowance ? String(b.allowance) : '',
});

const wholeIn = (s: string, lo: number, hi: number) => {
  const w = s.trim();
  if (!/^\d+$/.test(w)) return null;
  const v = Number(w);
  return v >= lo && v <= hi ? v : null;
};

const MISSING: Record<string, string> = {
  type: t('type'),
  thickness: t('thickness'),
  width: t('width'),
};

/** What the draft names, or why not yet. */
function parse(d: Draft): { band?: EdgeBand; missing: string[]; bad: Set<keyof Draft> } {
  const bad = new Set<keyof Draft>();
  const missing: string[] = [];
  const thickness = d.thickness.trim() ? parseTenths(d.thickness) : null;
  const width = d.width.trim() ? wholeIn(d.width, 1, BAND_MAX_WIDTH) : null;
  const allowance = d.allowance.trim() ? wholeIn(d.allowance, 0, BAND_MAX_ALLOWANCE) : 0;
  if (d.thickness.trim() && thickness === null) bad.add('thickness');
  if (d.width.trim() && width === null) bad.add('width');
  if (allowance === null) bad.add('allowance');
  if (!d.kind) missing.push('type');
  if (!d.thickness.trim()) missing.push('thickness');
  if (!d.width.trim()) missing.push('width');
  if (!d.kind || thickness === null || width === null || allowance === null)
    return { missing, bad };
  const code = d.code.trim().slice(0, BAND_MAX_CODE);
  return {
    band: {
      kind: d.kind,
      thickness,
      width,
      ...(code ? { code } : {}),
      ...(allowance ? { allowance } : {}),
    },
    missing,
    bad,
  };
}

function BandFields({
  title,
  value,
  onChange,
  empty,
}: {
  title: string;
  value: EdgeBand | undefined;
  onChange: (b: EdgeBand | undefined) => void;
  empty: string;
}) {
  const id = useId();
  const key = canon(value);
  const [draft, setDraft] = useState<Draft>(() => draftOf(value));
  const [seen, setSeen] = useState(key);
  // Changed from outside (undo, another board's decor): show it. Adjusting state during render, not in an effect.
  if (seen !== key) {
    setSeen(key);
    setDraft(draftOf(value));
  }
  const p = parse(draft);
  const commit = (d: Draft) => {
    const r = parse(d);
    if (!d.kind) {
      if (value) onChange(undefined);
      return;
    }
    if (r.band && canon(r.band) !== key) onChange(r.band);
  };
  const set = (patch: Partial<Draft>, now = false) => {
    const d = { ...draft, ...patch };
    setDraft(d);
    if (now) commit(d);
  };
  const blurCommit = () => commit(draft);
  // Enter leaves the field; the blur commits, once (committing here too made two undo steps).
  const onEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
  };
  const chosen = parseTenths(draft.thickness);
  const field = (
    k: 'thickness' | 'width' | 'code' | 'allowance',
    label: string,
    error: string,
    extra: { inputMode?: 'decimal' | 'numeric'; maxLength?: number; placeholder?: string } = {},
  ) => (
    <div className="field">
      <label htmlFor={`${id}-${k}`}>{label}</label>
      <input
        id={`${id}-${k}`}
        value={draft[k]}
        aria-invalid={p.bad.has(k)}
        aria-describedby={p.bad.has(k) ? `${id}-${k}-err` : undefined}
        onChange={(e) => set({ [k]: e.target.value })}
        onBlur={blurCommit}
        onKeyDown={onEnter}
        {...extra}
      />
      {p.bad.has(k) && (
        <p className="field-error" id={`${id}-${k}-err`}>
          {error}
        </p>
      )}
    </div>
  );
  return (
    <div className="band-fields">
      <p className="band-title">
        <strong>{title}</strong>{' '}
        <span className="hint">{p.band ? bandText(p.band) : draft.kind ? '' : empty}</span>
      </p>
      <Select
        label={t('Band type')}
        value={draft.kind}
        options={[
          { value: '', label: t('Not named') },
          ...BAND_KINDS.map((k) => ({ ...k, label: tr(k.label) })),
        ]}
        onChange={(v) => set({ kind: v as EdgeBandKind | '' }, true)}
      />
      {draft.kind && (
        <>
          <Segmented
            label={t('Band thickness, common supplier sizes')}
            value={chosen ?? -1}
            options={COMMON_BAND_THICKNESS.map((v) => ({
              value: v,
              label: t('{n} mm', { n: tenthsText(v) }),
            }))}
            onChange={(v) => set({ thickness: tenthsText(v) }, true)}
          />
          <div className="sheet-fields">
            {field(
              'width',
              t('Band width (mm)'),
              t('Whole mm from 1 to {max}.', { max: BAND_MAX_WIDTH }),
              {
                inputMode: 'numeric',
              },
            )}
            {field('thickness', t('Band thickness (mm)'), t('From 0.1 to 10 mm, one decimal.'), {
              inputMode: 'decimal',
              placeholder: t('e.g. 1.5'),
            })}
            {field('code', t('Band code (optional)'), '', { maxLength: BAND_MAX_CODE })}
            {field(
              'allowance',
              t('Trim allowance per edge (mm)'),
              t('Whole mm from 0 to {max}.', { max: BAND_MAX_ALLOWANCE }),
              { inputMode: 'numeric', placeholder: '0' },
            )}
          </div>
          {!p.band && p.missing.length > 0 && (
            <p className="hint">
              {t('Enter the band {list} to name it.', {
                list: p.missing.map((w) => MISSING[w]).join(t(' and ')),
              })}
            </p>
          )}
        </>
      )}
    </div>
  );
}
