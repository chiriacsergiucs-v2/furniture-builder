import { useId, useState, type ReactNode } from 'react'

/** Whole-millimetre input. Commits on blur or Enter so typing "1" on the way to "1200" never rebuilds a 1 mm cabinet. */
export function MmField({ label, value, onChange, min = 0, max = 10000, step = 10, unit = 'mm', hint }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; unit?: string; hint?: string
}) {
  const id = useId()
  const [text, setText] = useState(String(value))
  const [seen, setSeen] = useState(value)
  // Value changed from outside (undo, preset, stepper): show it. Adjusting state during render, not in an effect.
  if (seen !== value) { setSeen(value); setText(String(value)) }
  const parsed = Number(text)
  const valid = text.trim() !== '' && Number.isInteger(parsed) && parsed >= min && parsed <= max
  const commit = () => { if (valid && parsed !== value) onChange(parsed); else if (!valid) setText(String(value)) }
  const bump = (d: number) => onChange(Math.min(max, Math.max(min, value + d)))
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={`mm ${valid ? '' : 'invalid'}`}>
        <button type="button" className="step" aria-label={`Decrease ${label}`} onClick={() => bump(-step)}>−</button>
        <input id={id} inputMode="numeric" value={text} aria-invalid={!valid}
          onChange={e => setText(e.target.value.replace(/[^\d-]/g, ''))}
          onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') { commit(); (e.target as HTMLInputElement).blur() } if (e.key === 'Escape') setText(String(value)) }} />
        <span className="unit">{unit}</span>
        <button type="button" className="step" aria-label={`Increase ${label}`} onClick={() => bump(step)}>+</button>
      </div>
      {!valid && <p className="field-error">Whole number from {min} to {max}.</p>}
      {valid && hint && <p className="hint">{hint}</p>}
    </div>
  )
}

export function Segmented<T extends string | number>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: ReactNode; title?: string }[]; onChange: (v: T) => void
}) {
  const id = useId()
  return (
    <div className="field">
      <span id={id} className="field-label">{label}</span>
      <div className="segmented" role="radiogroup" aria-labelledby={id}>
        {options.map(o => (
          <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} title={o.title}
            className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
        ))}
      </div>
    </div>
  )
}

export function Select<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void
}) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={e => onChange(e.target.value as T)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

export function Counter({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="counter">
        <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
        <output aria-live="polite">{value}</output>
        <button type="button" aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
      </div>
    </div>
  )
}

export function Group({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group" open={defaultOpen}>
      <summary>{title}</summary>
      <div className="group-body">{children}</div>
    </details>
  )
}
