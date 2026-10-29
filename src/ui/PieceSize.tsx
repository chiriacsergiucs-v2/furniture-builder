import { useMemo } from 'react';
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
}: {
  product: Product;
  onChange: (key: SizeField['key'], value: number) => void;
  className?: string;
  /** The piece's size is locked (ADR-122): the fields are off and say why. */
  locked?: boolean;
}) {
  const fields = useMemo(() => sizeFields(product), [product]);
  if (!fields.length) return null;
  return (
    <div
      className={`piece-size ${fields.length === 3 ? 'dims3' : fields.length === 2 ? 'dims2' : ''} ${className ?? ''}`}
      role="group"
      aria-label="Size of the whole piece"
    >
      {fields.map((f) => (
        <MmField
          key={f.key}
          label={f.label}
          value={f.value}
          min={f.min}
          max={f.max}
          onChange={(v) => onChange(f.key, v)}
          disabled={locked}
        />
      ))}
      {locked && (
        <p className="hint size-lock-hint" role="note">
          {SIZE_LOCKED_HINT}
        </p>
      )}
    </div>
  );
}
