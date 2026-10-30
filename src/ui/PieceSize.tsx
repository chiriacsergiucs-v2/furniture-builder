import { useMemo, type ReactNode } from 'react';
import { t, tr } from '../core/i18n';
import { sizeFields, type SizeField } from '../core/pieceSize';
import type { Product } from '../core/types';
import { SIZE_LOCKED_HINT } from '../core/sizeLock';
import { MmField } from './controls';

/**
 * Width, height (ADR-148) and depth of the whole piece, shown where the whole piece is selected (ADR-106): the Compose panel, the
 * project's Selected piece card and the quick-count card. Nothing for a piece without them (a bed, loose panels).
 */
export function PieceSize({
  product,
  onChange,
  className,
  locked = false,
  lockedHint,
  bind,
}: {
  product: Product;
  onChange: (key: SizeField['key'], value: number) => void;
  className?: string;
  /** The piece's size is locked (ADR-122): the fields are off and say why. */
  locked?: boolean;
  /** Why the fields are off, instead of the size-lock text (a value set's duplicate, ADR-164). */
  lockedHint?: string;
  /** In a project (ADR-163): the ƒ button for a field and, when bound, what it follows (the field is then off). */
  bind?: (key: SizeField['key']) => { button: ReactNode; hint?: string };
}) {
  const fields = useMemo(() => sizeFields(product), [product]);
  if (!fields.length) return null;
  return (
    <div
      className={`piece-size ${fields.length === 3 ? 'dims3' : fields.length === 2 ? 'dims2' : ''} ${className ?? ''}`}
      role="group"
      aria-label={t('Size of the whole piece')}
    >
      {fields.map((f) => {
        const b = bind?.(f.key);
        return (
          <MmField
            key={f.key}
            label={tr(f.label)}
            value={f.value}
            min={f.min}
            max={f.max}
            onChange={(v) => onChange(f.key, v)}
            disabled={locked || !!b?.hint}
            hint={b?.hint}
            trailing={b?.button}
          />
        );
      })}
      {locked && (
        <p className="hint size-lock-hint" role="note">
          {lockedHint ?? tr(SIZE_LOCKED_HINT)}
        </p>
      )}
    </div>
  );
}
