import { useMemo } from 'react';
import { sizeFields, type SizeField } from '../core/pieceSize';
import type { Product } from '../core/types';
import { MmField } from './controls';

/**
 * Width and depth of the whole piece, shown where the whole piece is selected (ADR-106): the Compose panel, the
 * project's Selected piece card and the quick-count card. Nothing for a piece without them (a bed, loose panels).
 */
export function PieceSize({
  product,
  onChange,
  className,
}: {
  product: Product;
  onChange: (key: SizeField['key'], value: number) => void;
  className?: string;
}) {
  const fields = useMemo(() => sizeFields(product), [product]);
  if (!fields.length) return null;
  return (
    <div
      className={`piece-size ${fields.length === 2 ? 'dims2' : ''} ${className ?? ''}`}
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
        />
      ))}
    </div>
  );
}
