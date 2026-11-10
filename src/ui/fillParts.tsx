// The parts Fill a wall (ADR-103/104) and Fill the room (ADR-173) share: a size field, the problems under a step, a
// mix card's warnings, the result's problems, the save error and the footer (cleanup audit 2026-11-09, item 5).
import { useId, type ReactNode } from 'react';
import { t } from '../core/i18n';
import type { Diagnostic } from '../core/types';
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
export function MixWarnings({ warnings }: { warnings: { message: string }[] }) {
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

/** Why the chosen mix could not be saved. */
export function SaveError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="alert error" role="alert">
      <Icon name="alert-circle" className="sm" />
      <span>{message}</span>
    </p>
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
