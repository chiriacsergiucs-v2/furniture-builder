import { useMemo, type ReactNode } from 'react';
import { t, tr } from '../core/i18n';
import { bedSizeFields, sizeFields, type SizeField } from '../core/pieceSize';
import type { Product } from '../core/types';
import { axesText, SIZE_LOCKED_HINT } from '../core/sizeLock';
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
  lockedKeys = [],
  lockedHint,
  bind,
}: {
  product: Product;
  onChange: (key: SizeField['key'], value: number) => void;
  className?: string;
  /** The piece's size is locked (ADR-122): the fields are off and say why. */
  locked?: boolean;
  /** Sizes locked one by one (ADR-171): those fields are off. */
  lockedKeys?: readonly SizeField['key'][];
  /** Why the fields are off, instead of the size-lock text (a value set's duplicate, ADR-167). */
  lockedHint?: string;
  /** In a project (ADR-166): the ƒ button for a field and, when bound, what it follows (the field is then off). */
  bind?: (key: SizeField['key']) => { button: ReactNode; hint?: string };
}) {
  // A bed shows its mattress size instead (ADR-211, G-126); it has no ƒ binding (variables follow the outside size).
  const bed = useMemo(() => bedSizeFields(product), [product]);
  const fields = useMemo(() => (bed.length ? bed : sizeFields(product)), [bed, product]);
  if (!fields.length) return null;
  const shownLocked = fields.filter((f) => lockedKeys.includes(f.key));
  return (
    <div
      className={`piece-size ${fields.length === 3 ? 'dims3' : fields.length === 2 ? 'dims2' : ''} ${className ?? ''}`}
      role="group"
      aria-label={t('Size of the whole piece')}
    >
      {fields.map((f) => {
        const b = bed.length ? undefined : bind?.(f.key);
        return (
          <MmField
            key={f.key}
            label={tr(f.label)}
            value={f.value}
            min={f.min}
            max={f.max}
            onChange={(v) => onChange(f.key, v)}
            disabled={locked || lockedKeys.includes(f.key) || !!b?.hint}
            hint={b?.hint}
            trailing={b?.button}
          />
        );
      })}
      {/* Only sizes this piece shows are named; a bed names its fields by their labels (ADR-253). */}
      {(locked || shownLocked.length > 0) && (
        <p className="hint size-lock-hint" role="note">
          {lockedHint ??
            (locked
              ? tr(SIZE_LOCKED_HINT)
              : t('{axes} locked — unlock to change', {
                  axes: bed.length
                    ? shownLocked.map((f) => tr(f.label)).join(', ')
                    : axesText(shownLocked.map((f) => f.key)),
                }))}
        </p>
      )}
    </div>
  );
}
