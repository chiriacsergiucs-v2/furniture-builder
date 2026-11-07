import { useId, useState } from 'react';
import { t } from '../core/i18n';

/** A split or drawer size draft stays visible until valid or explicitly cancelled (ADR-199). */
export function SizeShareField({
  label,
  value,
  mode,
  onChange,
  disabled = false,
  title,
}: {
  label: string;
  value: number;
  mode: 'mm' | 'fr';
  onChange: (value: number) => void;
  disabled?: boolean;
  title?: string;
}) {
  const id = useId();
  const [text, setText] = useState(String(value));
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setText(String(value));
  }
  const v = Number(text);
  const valid =
    text.trim() !== '' &&
    Number.isFinite(v) &&
    (mode === 'mm' ? Number.isInteger(v) && v > 0 : v > 0 && v < 1000);
  return (
    <>
      <input
        aria-label={label}
        value={text}
        inputMode={mode === 'mm' ? 'numeric' : 'decimal'}
        disabled={disabled}
        title={title}
        aria-invalid={!valid}
        aria-describedby={!valid ? `${id}-err` : undefined}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (valid && v !== value) {
            onChange(v);
            setText(String(value));
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            setText(String(value));
          }
        }}
      />
      {!valid && (
        <p className="field-error size-share-error" id={`${id}-err`}>
          {mode === 'mm'
            ? t('Enter a positive whole number of millimetres.')
            : t('Enter a finite share greater than 0 and less than 1000.')}
        </p>
      )}
    </>
  );
}
