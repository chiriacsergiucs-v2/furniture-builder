/**
 * Fill a wall (ADR-103): width, depth and height of a wall, then suggested mixes of tall and base cabinets that fill
 * it exactly, each drawn like a catalog card. Refine narrows the mixes; "Use this mix" saves and opens a project.
 * The mixes are worked out in `src/core/wallfill.ts`; this file only collects the answers and shows the result.
 */
import { useId, useMemo, useState } from 'react';
import { t } from '../core/i18n';
import { snapshotSvg } from '../core/snapshot';
import {
  BASE_HEIGHT,
  WALL_HEIGHT,
  MIXES_FIRST,
  WALL_DEFAULTS,
  suggestMixes,
  type Mix,
  type TallPosition,
  type WallRow,
  type WallInput,
} from '../core/wallfill';
import { saveProject } from '../persist/db';
import { useDesign } from '../store/designStore';
import { Segmented, Steps } from './controls';
import { Dialog } from './Dialogs';
import { Icon } from './icons';

type StepId = 'wall' | 'mixes' | 'refine';
const STEPS: { id: StepId; label: string }[] = [
  { id: 'wall', label: t('Wall') },
  { id: 'mixes', label: t('Suggestions') },
  { id: 'refine', label: t('Refine') },
];

/** What the user typed, kept as text so a wrong entry shows as a problem instead of vanishing (ADR-008). */
interface Form {
  width: string;
  depth: string;
  height: string;
  tallDepth: string;
  minWidth: string;
  maxWidth: string;
  baseHeight: string;
  pieces: string;
  tallCount: string;
  tallPosition: TallPosition | 'auto';
  shelves: string;
  drawers: string;
  door: string;
  equalFronts: string;
  wallRow: WallRow;
  wallHeight: string;
}

const START: Form = {
  width: '3000',
  depth: '560',
  height: '2400',
  tallDepth: '',
  minWidth: String(WALL_DEFAULTS.minWidth),
  maxWidth: String(WALL_DEFAULTS.maxWidth),
  baseHeight: String(BASE_HEIGHT),
  pieces: '',
  tallCount: '',
  tallPosition: 'auto',
  shelves: '',
  drawers: '',
  door: '',
  equalFronts: '',
  wallRow: 'always',
  wallHeight: String(WALL_HEIGHT),
};

/** Empty = any (absent); anything else goes to the core as a number, which reports what is wrong with it. */
const num = (s: string) => Number(s.trim());
const opt = (s: string) => (s.trim() === '' ? undefined : num(s));

function toInput(f: Form): WallInput {
  return {
    width: num(f.width),
    depth: num(f.depth),
    height: num(f.height),
    tallDepth: opt(f.tallDepth),
    minWidth: opt(f.minWidth),
    maxWidth: opt(f.maxWidth),
    baseHeight: opt(f.baseHeight),
    pieces: opt(f.pieces),
    tallCount: opt(f.tallCount),
    tallPosition: f.tallPosition === 'auto' ? undefined : f.tallPosition,
    atLeast: { shelves: opt(f.shelves), drawers: opt(f.drawers), door: opt(f.door) },
    equalFronts: opt(f.equalFronts),
    wallRow: f.wallRow,
    wallHeight: opt(f.wallHeight),
  };
}

function Field({
  label,
  value,
  onChange,
  hint,
  unit = t('mm'),
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  unit?: string;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="mm wz-int">
        <input
          id={id}
          inputMode="numeric"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="unit">{unit}</span>
      </div>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

const picture = (m: Mix) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(snapshotSvg(m.model.model, m.model.materials, 220))}`;

function MixCard({ m, onUse }: { m: Mix; onUse: () => void }) {
  const src = useMemo(() => picture(m), [m]);
  return (
    <li className="wz-card wf-card">
      <img
        src={src}
        alt={
          m.wallWidths
            ? t('Mix: wall {wall} mm, {widths} mm', { wall: m.wallWidths, widths: m.widths })
            : t('Mix: {widths} mm', { widths: m.widths })
        }
        width={180}
        height={110}
      />
      {m.wallWidths && (
        <span className="wz-card-label num wf-wall">{t('Wall: {w} mm', { w: m.wallWidths })}</span>
      )}
      <span className="wz-card-label num">
        <strong>{m.widths}</strong> {t('mm')}
      </span>
      <span className="wz-card-label">{m.summary}</span>
      {m.warnings.length > 0 && (
        <ul className="wf-warnings">
          {m.warnings.slice(0, 3).map((w, i) => (
            <li key={i} className="alert warning">
              <Icon name="alert-triangle" className="sm" />
              <span>{w.message}</span>
            </li>
          ))}
          {m.warnings.length > 3 && (
            <li className="hint">
              {t('…and {n} more in the project.', { n: m.warnings.length - 3 })}
            </li>
          )}
        </ul>
      )}
      <button type="button" className="btn sm primary" onClick={onUse}>
        {t('Use this mix')}
      </button>
    </li>
  );
}

export function WallFillDialog({
  open,
  onClose,
  onOpened,
}: {
  open: boolean;
  onClose: () => void;
  onOpened: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={t('Fill a wall')} wide>
      {open && <WallFill onClose={onClose} onOpened={onOpened} />}
    </Dialog>
  );
}

function WallFill({ onClose, onOpened }: { onClose: () => void; onOpened: () => void }) {
  const openProject = useDesign((s) => s.openProject);
  const [form, setForm] = useState<Form>(START);
  // The answers the cards were made from: set by "Show suggestions" and "Suggest again".
  const [applied, setApplied] = useState<Form>(START);
  const [step, setStep] = useState<StepId>('wall');
  const [saveError, setSaveError] = useState<string | null>(null);
  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const result = useMemo(() => suggestMixes(toInput(applied)), [applied]);
  const go = (s: StepId) => {
    setStep(s);
    document.querySelector('.dialog[open] .dialog-body')?.scrollTo({ top: 0 });
  };
  const suggest = () => {
    setApplied(form);
    go('mixes');
  };
  const use = async (m: Mix) => {
    try {
      await saveProject(m.project);
      openProject(m.project);
      onClose();
      onOpened();
    } catch {
      setSaveError(t('The project could not be saved in this browser’s storage.'));
    }
  };
  return (
    <div className="wizard wall-fill">
      <Steps
        label={t('Fill a wall steps')}
        current={step}
        onSelect={(id) => (id === 'mixes' ? suggest() : go(id as StepId))}
        steps={STEPS.map((s) => ({ ...s, done: s.id === 'wall' && step !== 'wall' }))}
      />
      {step === 'wall' && (
        <section aria-label={t('Wall')}>
          <h3>{t('Wall')}</h3>
          <p className="hint">
            {t(
              'The space to fill, in mm. Pieces taller than the height are still suggested, with a warning.',
            )}
          </p>
          <div className="wf-grid">
            <Field label={t('Width')} value={form.width} onChange={set('width')} />
            <Field label={t('Depth')} value={form.depth} onChange={set('depth')} />
            <Field label={t('Height')} value={form.height} onChange={set('height')} />
            <Field
              label={t('Tall cabinet depth')}
              value={form.tallDepth}
              onChange={set('tallDepth')}
              placeholder={t('same as depth')}
            />
          </div>
        </section>
      )}
      {step === 'refine' && (
        <section aria-label={t('Refine')}>
          <h3>{t('Refine')}</h3>
          <p className="hint">
            {t(
              'Leave a field empty for any. The width range is your choice; shelves wider than the shelf-span guidance get a centre divider.',
            )}
          </p>
          <div className="wf-grid">
            <Field label={t('Min piece width')} value={form.minWidth} onChange={set('minWidth')} />
            <Field label={t('Max piece width')} value={form.maxWidth} onChange={set('maxWidth')} />
            <Field label={t('Base height')} value={form.baseHeight} onChange={set('baseHeight')} />
            <Field
              label={t('Number of pieces')}
              value={form.pieces}
              onChange={set('pieces')}
              unit=""
              placeholder={t('any')}
            />
            <Field
              label={t('Tall cabinets')}
              value={form.tallCount}
              onChange={set('tallCount')}
              unit=""
              placeholder={t('any')}
            />
            <Field
              label={t('At least, open shelf bases')}
              value={form.shelves}
              onChange={set('shelves')}
              unit=""
              placeholder={t('any')}
            />
            <Field
              label={t('At least, drawer bases')}
              value={form.drawers}
              onChange={set('drawers')}
              unit=""
              placeholder={t('any')}
            />
            <Field
              label={t('At least, door bases')}
              value={form.door}
              onChange={set('door')}
              unit=""
              placeholder={t('any')}
            />
            <Field
              label={t('Equal fronts')}
              value={form.equalFronts}
              onChange={set('equalFronts')}
              unit=""
              placeholder={t('off')}
              hint={t('Every door the same width; insides left empty to configure later.')}
            />
            <Field
              label={t('Wall cabinet height')}
              value={form.wallHeight}
              onChange={set('wallHeight')}
              hint={t('Wall cabinet tops sit at the wall height.')}
            />
          </div>
          <Segmented
            label={t('Wall cabinets')}
            value={form.wallRow}
            onChange={(v) => setForm((f) => ({ ...f, wallRow: v }))}
            options={[
              { value: 'any', label: t('Any') },
              { value: 'always', label: t('Always') },
              { value: 'never', label: t('Never') },
            ]}
          />
          <Segmented
            label={t('Tall cabinets stand')}
            value={form.tallPosition}
            onChange={(v) => setForm((f) => ({ ...f, tallPosition: v }))}
            options={[
              { value: 'auto', label: t('Auto') },
              { value: 'left', label: t('Left') },
              { value: 'right', label: t('Right') },
              { value: 'ends', label: t('Both ends') },
              { value: 'centre', label: t('Centre') },
            ]}
          />
        </section>
      )}
      {step === 'mixes' && (
        <section className="wz-suggest" aria-label={t('Suggested mixes')}>
          <div className="card-title">
            <span>{t('Suggested mixes')}</span>
            <span className="hint">
              {t('{width} mm wall · best {n}, checked by the model', {
                width: applied.width,
                n: MIXES_FIRST,
              })}
            </span>
          </div>
          {result.problems.map((p, i) => (
            <p key={i} className={`alert ${p.severity}`} role="status">
              <Icon name={p.severity === 'error' ? 'alert-circle' : 'info'} className="sm" />
              <span>{p.message}</span>
            </p>
          ))}
          {result.mixes.length > 0 && (
            <ul className="wz-cards wf-cards">
              {result.mixes.map((m) => (
                <MixCard key={m.key} m={m} onUse={() => void use(m)} />
              ))}
            </ul>
          )}
          {saveError && (
            <p className="alert error" role="alert">
              <Icon name="alert-circle" className="sm" />
              <span>{saveError}</span>
            </p>
          )}
        </section>
      )}
      <div className="wizard-footer">
        <button
          type="button"
          className="btn"
          disabled={step === 'wall'}
          onClick={() => go(step === 'refine' ? 'mixes' : 'wall')}
        >
          {t('Back')}
        </button>
        <span className="wz-spacer" />
        <button type="button" className="btn ghost" onClick={onClose}>
          {t('Cancel')}
        </button>
        {step === 'wall' && (
          <button type="button" className="btn primary" onClick={suggest}>
            {t('Show suggestions')}
          </button>
        )}
        {step === 'mixes' && (
          <button type="button" className="btn primary" onClick={() => go('refine')}>
            {t('Refine')}
          </button>
        )}
        {step === 'refine' && (
          <button type="button" className="btn primary" onClick={suggest}>
            {t('Suggest again')}
          </button>
        )}
      </div>
    </div>
  );
}
