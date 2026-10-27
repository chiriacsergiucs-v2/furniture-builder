import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Icon } from './icons';

/** Whole-millimetre input. Commits on blur or Enter so typing "1" on the way to "1200" never rebuilds a 1 mm cabinet. */
export function MmField({
  label,
  value,
  onChange,
  min = 0,
  max = 10000,
  step = 10,
  unit = 'mm',
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  hint?: string;
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
      <label htmlFor={id}>{label}</label>
      <div className={`mm ${valid ? '' : 'invalid'}`}>
        <button
          type="button"
          className="step"
          aria-label={`Decrease ${label}`}
          onClick={() => bump(-step)}
        >
          −
        </button>
        <input
          id={id}
          inputMode="numeric"
          value={text}
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
          aria-label={`Increase ${label}`}
          onClick={() => bump(step)}
        >
          +
        </button>
      </div>
      {!valid && (
        <p className="field-error" id={`${id}-err`}>
          Whole number from {min} to {max}.
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
}: {
  label: string;
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <div className="field">
      <span id={id} className="field-label">
        {label}
      </span>
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
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
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
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Counter({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="counter">
        <button
          type="button"
          aria-label={`Fewer ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
        >
          −
        </button>
        <output aria-live="polite">{value}</output>
        <button
          type="button"
          aria-label={`More ${label.toLowerCase()}`}
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
 * opens itself, and again whenever it changes (an error it holds is never left folded away, ADR-008, ADR-115).
 */
export function Group({
  title,
  children,
  defaultOpen = true,
  id,
  openOn,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  id?: string;
  openOn?: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (openOn && ref.current) ref.current.open = true;
  }, [openOn]);
  return (
    <details ref={ref} className="group" open={defaultOpen} id={id}>
      <summary>
        {title}
        <Icon name="chevron-down" className="chev" />
      </summary>
      <div className="group-body">{children}</div>
    </details>
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
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="section" aria-label={title}>
      <div className="card-title">
        <span>{title}</span>
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

/**
 * An info button whose text opens over the content (ADR-080): on hover or keyboard focus with a mouse, on tap with
 * touch. A tap outside, a second tap or Esc closes it. The text is in the page only while open.
 */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [shown]);
  return (
    <span
      className="info-tip"
      ref={ref}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(false)}
    >
      <button
        type="button"
        className="btn icon ghost sm info-btn"
        aria-label={label}
        aria-expanded={shown}
        aria-controls={shown ? id : undefined}
        onClick={() => setPinned((p) => !(p || hover))}
        // Keyboard focus only: a tap also focuses the button, and the tap itself toggles.
        onFocus={(e) => e.currentTarget.matches(':focus-visible') && setHover(true)}
        onBlur={() => setHover(false)}
      >
        <Icon name="info" className="sm" />
      </button>
      {shown && (
        <span id={id} role="note" className="info-pop">
          {children}
        </span>
      )}
    </span>
  );
}
