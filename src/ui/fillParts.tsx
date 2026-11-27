// The parts Fill a wall (ADR-103/104) and Fill the room (ADR-173) share: a size field, the problems under a step, a
// mix card's frame and warnings, the Refine fields, the result's problems, the save error and the footer (cleanup
// audit 2026-11-09, item 5; reuse health check M5, G-570).
import { useId, type ReactNode } from 'react';
import { t } from '@furniture-builder/i18n';
import { snapshotSvg, svgDataUrl } from '../core/snapshot';
import type { Diagnostic, FurnitureModel, Material } from '../core/types';
import type { TallPosition, WallRow } from '../core/wallfill';
import { Segmented } from './controls';
import { Icon } from './icons';

export function Field({
  label,
  value,
  onChange,
  hint,
  unit = t('mm'),
  placeholder,
  problem,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  unit?: string;
  placeholder?: string;
  /** Ids of the problems that name this field (ADR-193): marks it invalid and points to them. */
  problem?: string;
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
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="unit">{unit}</span>
      </div>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

/** The problems with the answers, under the fields of the step (ADR-193). */
export function Problems({
  list,
  idOf,
}: {
  list: { message: string }[];
  idOf: (i: number) => string;
}) {
  if (!list.length) return null;
  return (
    <div className="wf-problems">
      {list.map((p, i) => (
        <p key={i} id={idOf(i)} className="alert error" role="alert">
          <Icon name="alert-circle" className="sm" />
          <span>{p.message}</span>
        </p>
      ))}
    </div>
  );
}

/** A mix card's first three warnings, then how many more the project has. */
function MixWarnings({ warnings }: { warnings: { message: string }[] }) {
  if (!warnings.length) return null;
  return (
    <ul className="wf-warnings">
      {warnings.slice(0, 3).map((w, i) => (
        <li key={i} className="alert warning">
          <Icon name="alert-triangle" className="sm" />
          <span>{w.message}</span>
        </li>
      ))}
      {warnings.length > 3 && (
        <li className="hint">{t('…and {n} more in the project.', { n: warnings.length - 3 })}</li>
      )}
    </ul>
  );
}

/** The suggestions' own problems (nothing fits, a wall too short), each with its severity. */
export function ResultProblems({
  problems,
}: {
  problems: Pick<Diagnostic, 'severity' | 'message'>[];
}) {
  return (
    <>
      {problems.map((p, i) => (
        <p key={i} className={`alert ${p.severity}`} role="status">
          <Icon name={p.severity === 'error' ? 'alert-circle' : 'info'} className="sm" />
          <span>{p.message}</span>
        </p>
      ))}
    </>
  );
}

/** Back, Cancel and the step's primary action, which is the form's submit so Enter does it (ADR-193). */
export function FillFooter({
  backDisabled,
  onBack,
  onClose,
  submit,
}: {
  backDisabled: boolean;
  onBack: () => void;
  onClose: () => void;
  submit: ReactNode;
}) {
  return (
    <div className="wizard-footer">
      <button type="button" className="btn" disabled={backDisabled} onClick={onBack}>
        {t('Back')}
      </button>
      <span className="wz-spacer" />
      <button type="button" className="btn ghost" onClick={onClose}>
        {t('Cancel')}
      </button>
      <button type="submit" className="btn primary">
        {submit}
      </button>
    </div>
  );
}

/** A form string as a number; empty = absent for `opt`. The core reports what is wrong with a bad value. */
export const num = (s: string) => Number(s.trim());
export const opt = (s: string) => (s.trim() === '' ? undefined : num(s));

/** A mix's picture for its card. */
export const mixPicture = (m: { model: { model: FurnitureModel; materials: Material[] } }) =>
  svgDataUrl(snapshotSvg(m.model.model, m.model.materials, 220, true));

/** A suggestion card: the picture, the fill's own lines, the warnings and the use button. */
export function MixCardFrame({
  src,
  alt,
  warnings,
  label,
  onUse,
  children,
}: {
  src: string;
  alt: string;
  warnings: { message: string }[];
  label: string;
  onUse: () => void;
  children: ReactNode;
}) {
  return (
    <li className="wz-card wf-card">
      <img src={src} alt={alt} width={180} height={110} />
      {children}
      <MixWarnings warnings={warnings} />
      <button type="button" className="btn sm primary" onClick={onUse}>
        {label}
      </button>
    </li>
  );
}

/** The Refine answers both fills ask, kept as typed. */
interface RefineAnswers {
  minWidth: string;
  maxWidth: string;
  baseHeight: string;
  tallCount: string;
  tallPosition: TallPosition | 'auto';
  shelves: string;
  drawers: string;
  door: string;
  wallRow: WallRow;
  wallHeight: string;
  tallHeight: string;
  wallDepth: string;
}
type RefineText = Exclude<keyof RefineAnswers, 'tallPosition' | 'wallRow'>;

/**
 * The Refine fields both fills share, in their order. Fill a wall adds its own fields where it shows them: `afterBase`
 * after Base height, `beforeWall` before Wall cabinet height.
 */
export function RefineFields({
  form,
  set,
  problem,
  afterBase,
  beforeWall,
}: {
  form: RefineAnswers;
  set: (k: RefineText) => (v: string) => void;
  problem: (k: RefineText) => string | undefined;
  afterBase?: ReactNode;
  beforeWall?: ReactNode;
}) {
  const count = (k: 'tallCount' | 'shelves' | 'drawers' | 'door', label: string) => (
    <Field
      label={label}
      value={form[k]}
      onChange={set(k)}
      problem={problem(k)}
      unit=""
      placeholder={t('any')}
    />
  );
  return (
    <div className="wf-grid">
      <Field
        label={t('Min piece width')}
        value={form.minWidth}
        onChange={set('minWidth')}
        problem={problem('minWidth')}
      />
      <Field
        label={t('Max piece width')}
        value={form.maxWidth}
        onChange={set('maxWidth')}
        problem={problem('maxWidth')}
      />
      <Field
        label={t('Base height')}
        value={form.baseHeight}
        onChange={set('baseHeight')}
        problem={problem('baseHeight')}
      />
      {afterBase}
      {count('tallCount', t('Tall cabinets'))}
      {count('shelves', t('At least, open shelf bases'))}
      {count('drawers', t('At least, drawer bases'))}
      {count('door', t('At least, door bases'))}
      {beforeWall}
      <Field
        label={t('Wall cabinet height')}
        value={form.wallHeight}
        onChange={set('wallHeight')}
        problem={problem('wallHeight')}
        hint={t('Wall cabinet tops sit at the wall height.')}
      />
      <Field
        label={t('Tall cabinet height')}
        value={form.tallHeight}
        onChange={set('tallHeight')}
        problem={problem('tallHeight')}
      />
      <Field
        label={t('Wall cabinet depth')}
        value={form.wallDepth}
        onChange={set('wallDepth')}
        problem={problem('wallDepth')}
      />
    </div>
  );
}

/** Whether wall cabinets are added and where tall cabinets stand: the two choices both fills share. */
export function RowAndTallChoices({
  form,
  onChange,
}: {
  form: Pick<RefineAnswers, 'wallRow' | 'tallPosition'>;
  onChange: (patch: Partial<Pick<RefineAnswers, 'wallRow' | 'tallPosition'>>) => void;
}) {
  return (
    <>
      <Segmented
        label={t('Wall cabinets')}
        value={form.wallRow}
        onChange={(v) => onChange({ wallRow: v })}
        options={[
          { value: 'any', label: t('Any') },
          { value: 'always', label: t('Always') },
          { value: 'never', label: t('Never') },
        ]}
      />
      <Segmented
        label={t('Tall cabinets stand')}
        value={form.tallPosition}
        onChange={(v) => onChange({ tallPosition: v })}
        options={[
          { value: 'auto', label: t('Auto') },
          { value: 'left', label: t('Left') },
          { value: 'right', label: t('Right') },
          { value: 'ends', label: t('Both ends') },
          { value: 'centre', label: t('Centre') },
        ]}
      />
    </>
  );
}
