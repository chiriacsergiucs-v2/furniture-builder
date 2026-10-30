import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { t } from '../core/i18n';
import { Icon } from './icons';

/** Whole-millimetre input. Commits on blur or Enter so typing "1" on the way to "1200" never rebuilds a 1 mm cabinet. */
export function MmField({
  label,
  value,
  onChange,
  min = 0,
  max = 10000,
  step = 10,
  unit = t('mm'),
  hint,
  info,
  disabled = false,
  trailing,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  hint?: string;
  /** An `InfoTip` shown beside the label (ADR-113). */
  info?: ReactNode;
  /** Shown but not changeable (a size-locked piece, ADR-122). */
  disabled?: boolean;
  /** A control after the field, inside its box (the ƒ bind button, ADR-166). */
  trailing?: ReactNode;
}) {
  const id = useId();
  const [text, setText] = useState(String(value));
  const [seen, setSeen] = useState(value);
  // Value changed from outside (undo, preset, stepper): show it. Adjusting state during render, not in an effect.
  if (seen !== value) {
    setSeen(value);
    setText(String(value));
  }
  const parsed = Number(text);
  const valid = text.trim() !== '' && Number.isInteger(parsed) && parsed >= min && parsed <= max;
  const commit = () => {
    if (valid && parsed !== value) onChange(parsed);
    else if (!valid) setText(String(value));
  };
  const bump = (d: number) => onChange(Math.min(max, Math.max(min, value + d)));
  return (
    <div className="field">
      {withInfo(<label htmlFor={id}>{label}</label>, info)}
      <div className={`mm ${valid ? '' : 'invalid'} ${trailing ? 'with-trailing' : ''}`}>
        <button
          type="button"
          className="step"
          aria-label={t('Decrease {label}', { label })}
          disabled={disabled}
          onClick={() => bump(-step)}
        >
          −
        </button>
        <input
          id={id}
          inputMode="numeric"
          value={text}
          disabled={disabled}
          aria-invalid={!valid}
          aria-describedby={!valid ? `${id}-err` : undefined}
          onChange={(e) => setText(e.target.value.replace(/[^\d-]/g, ''))}
          onBlur={commit}
          onKeyDown={(e) => {
            // Enter leaves the field; the blur commits, once (committing here too made two undo steps).
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') setText(String(value));
          }}
        />
        <span className="unit">{unit}</span>
        <button
          type="button"
          className="step"
          aria-label={t('Increase {label}', { label })}
          disabled={disabled}
          onClick={() => bump(step)}
        >
          +
        </button>
        {trailing}
      </div>
      {!valid && (
        <p className="field-error" id={`${id}-err`}>
          {t('Whole number from {min} to {max}.', { min, max })}
        </p>
      )}
      {valid && hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  info,
}: {
  label: string;
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  info?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="field">
      {withInfo(
        <span id={id} className="field-label">
          {label}
        </span>,
        info,
      )}
      <div className="segmented" role="radiogroup" aria-labelledby={id}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            title={o.title}
            className={o.value === value ? 'on' : ''}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  info,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  info?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="field">
      {withInfo(<label htmlFor={id}>{label}</label>, info)}
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  info,
  name,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  info?: ReactNode;
  /** The accessible name when the visible label is shortened (ADR-112). */
  name?: string;
  disabled?: boolean;
}) {
  return withInfo(
    <label className="toggle">
      <input
        type="checkbox"
        aria-label={name}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>,
    info,
  );
}

export function Counter({
  label,
  value,
  min,
  max,
  onChange,
  info,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  info?: ReactNode;
}) {
  return (
    <div className="field">
      {withInfo(<span className="field-label">{label}</span>, info)}
      <div className="counter">
        <button
          type="button"
          aria-label={t('Fewer {label}', { label: label.toLowerCase() })}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
        >
          −
        </button>
        <output aria-live="polite">{value}</output>
        <button
          type="button"
          aria-label={t('More {label}', { label: label.toLowerCase() })}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}

/**
 * Collapsible section. `id` lets the steps rail open and scroll to it. `openOn`: while it is non-empty the group
 * opens itself, and again whenever it changes (an error it holds is never left folded away, ADR-008, ADR-117).
 */
export function Group({
  title,
  children,
  defaultOpen = true,
  id,
  info,
  openOn,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  id?: string;
  /** An `InfoTip` on the title row (ADR-113); it sits beside the summary, never inside it. */
  info?: ReactNode;
  openOn?: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (openOn && ref.current) ref.current.open = true;
  }, [openOn]);
  const group = (
    <details ref={ref} className="group" open={defaultOpen} id={id}>
      <summary>
        {title}
        <Icon name="chevron-down" className="chev" />
      </summary>
      <div className="group-body">{children}</div>
    </details>
  );
  if (!info) return group;
  return (
    <div className="group-wrap">
      {group}
      {info}
    </div>
  );
}

/** Opens a Group by id and scrolls it into view (used by the steps rail). */
export function revealGroup(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el instanceof HTMLDetailsElement) el.open = true;
  el.scrollIntoView({
    block: 'start',
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });
}

/** A titled block inside the inspector: keeps related controls together. */
export function Section({
  title,
  children,
  aside,
  info,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
  /** An `InfoTip` right after the title (ADR-113). */
  info?: ReactNode;
}) {
  return (
    <section className="section" aria-label={title}>
      <div className="card-title">
        {info ? (
          <span className="info-row">
            <span>{title}</span>
            {info}
          </span>
        ) : (
          <span>{title}</span>
        )}
        {aside}
      </div>
      {children}
    </section>
  );
}

/* Steps rail — wizard-ready (docs/ui-design.md). An ordered list of stages with a number, a label and a one-line
   status. Here it is a section map; a guided flow sets `current` and adds Back / Next in a `.wizard-footer`. */
export interface Step {
  id: string;
  label: string;
  meta?: string;
  tone?: 'ok' | 'warn' | 'error';
  done?: boolean;
  disabled?: boolean;
}

export function Steps({
  steps,
  current,
  onSelect,
  label,
}: {
  steps: Step[];
  current?: string;
  onSelect: (id: string) => void;
  label: string;
}) {
  return (
    <ol className="steps" aria-label={label}>
      {steps.map((s, i) => (
        <li key={s.id} className={`${s.tone ?? ''} ${s.done ? 'done' : ''}`}>
          <button
            type="button"
            aria-current={s.id === current ? 'step' : undefined}
            disabled={s.disabled}
            title={s.meta}
            onClick={() => onSelect(s.id)}
          >
            <span className="n" aria-hidden="true">
              {i + 1}
            </span>
            <span className="lbl">{s.label}</span>
            {s.meta && <span className="meta">{s.meta}</span>}
          </button>
        </li>
      ))}
    </ol>
  );
}

/** A label or title with its info button right after it (ADR-113); just the label when there is none. */
function withInfo(label: ReactNode, info: ReactNode) {
  if (!info) return label;
  return (
    <div className="label-row">
      {label}
      {info}
    </div>
  );
}

/** Space kept between an open popover and the screen edge. */
const POP_MARGIN = 16;

/**
 * An info button whose text opens over the content (ADR-080): on hover or keyboard focus with a mouse, on tap with
 * touch. A tap outside, a second tap or Esc closes it. The text is in the page only while open.
 *
 * ADR-113: `align="start"` opens it from the button's left edge (for a button beside a heading on the left); either
 * way it is moved back inside the screen if it would run off an edge. Esc closes only the popover, never the dialog
 * or the selection under it, and focus stays on (or returns to) the button.
 */
export function InfoTip({
  label,
  children,
  align = 'end',
}: {
  label: string;
  children: ReactNode;
  align?: 'start' | 'end';
}) {
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLSpanElement>(null);
  const quietFocus = useRef(false);
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  const shown = pinned || hover;
  useEffect(() => {
    if (!shown) return;
    const close = () => {
      setPinned(false);
      setHover(false);
    };
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    // Capture phase: runs before a dialog's or the editor's own Esc handling, which then never sees this key.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      close();
      const at = document.activeElement;
      if (!at || at === document.body || ref.current?.contains(at)) {
        quietFocus.current = true;
        btn.current?.focus();
        quietFocus.current = false;
      }
    };
    // A modal dialog's own close request on Esc while the popover is open: the dialog stays open.
    const onCancel = (e: Event) => e.preventDefault();
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('cancel', onCancel, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('cancel', onCancel, true);
    };
  }, [shown]);
  useLayoutEffect(() => {
    const el = pop.current;
    if (!shown || !el) return;
    el.style.translate = '';
    const r = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth || window.innerWidth;
    let dx = 0;
    if (r.right > vw - POP_MARGIN) dx = vw - POP_MARGIN - r.right;
    if (r.left + dx < POP_MARGIN) dx = POP_MARGIN - r.left;
    if (dx) el.style.translate = `${Math.round(dx)}px 0`;
  }, [shown]);
  return (
    <span
      className={`info-tip ${shown ? 'open' : ''}`}
      ref={ref}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(false)}
    >
      <button
        ref={btn}
        type="button"
        className="btn icon ghost sm info-btn"
        aria-label={label}
        aria-expanded={shown}
        aria-controls={shown ? id : undefined}
        onClick={() => setPinned((p) => !(p || hover))}
        // Keyboard focus only: a tap also focuses the button, and the tap itself toggles.
        onFocus={(e) => {
          if (!quietFocus.current && e.currentTarget.matches(':focus-visible')) setHover(true);
        }}
        onBlur={() => setHover(false)}
      >
        <Icon name="info" className="sm" />
      </button>
      {shown && (
        <span id={id} ref={pop} role="note" className={`info-pop ${align}`}>
          {children}
        </span>
      )}
    </span>
  );
}

/**
 * ADR-010 guidance behind an info button (ADR-113): named "Guidance: <topic>", and its text starts with "Guidance", so
 * it stays labelled as guidance, one tap away.
 */
export function GuidanceTip({
  topic,
  children,
  align = 'start',
}: {
  topic: string;
  children: ReactNode;
  align?: 'start' | 'end';
}) {
  return (
    <InfoTip label={t('Guidance: {topic}', { topic })} align={align}>
      <span className="info-lead">{t('Guidance')}</span>
      {children}
    </InfoTip>
  );
}
