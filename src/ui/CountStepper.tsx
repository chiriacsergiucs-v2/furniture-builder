import { forwardRef, useMemo, type CSSProperties } from 'react';
import { countRows, countSubject } from '../core/counts';
import { useDesign } from '../store/designStore';
import { selectionLabel } from './Inspector';

/** The counts that apply to the selected space or piece, each as − N + (ADR-084). Nothing when none apply. */
export const CountStepper = forwardRef<
  HTMLDivElement,
  { style?: CSSProperties; className?: string }
>(function CountStepper({ style, className }, ref) {
  const product = useDesign((s) => s.design.product);
  const selectedId = useDesign((s) => s.selectedId);
  const step = useDesign((s) => s.stepCount);
  const rows = useMemo(() => {
    const id = countSubject(product, selectedId);
    return id ? countRows(product, id) : [];
  }, [product, selectedId]);
  if (!rows.length) return null;
  // Names what the card acts on, the same thing the outline is drawn round (ADR-087, G-069).
  const title = selectionLabel(product, selectedId);
  return (
    <div
      ref={ref}
      className={`count-stepper ${className ?? ''}`}
      role="group"
      aria-label="Quick counts"
      style={style}
      // Taps here must not reach the drawing or the 3D canvas underneath (they would change the selection).
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {title && <span className="cs-title">{title}</span>}
      {rows.map((r) => (
        <div key={r.key} className="cs-row">
          <span className="cs-label">{r.label}</span>
          <span className="cs-counter">
            <button
              type="button"
              aria-label={`Fewer ${r.label.toLowerCase()}`}
              disabled={r.value <= r.min}
              onClick={() => step(r.key, -1)}
            >
              −
            </button>
            <output aria-live="polite" aria-label={r.label}>
              {r.value}
            </output>
            <button
              type="button"
              aria-label={`More ${r.label.toLowerCase()}`}
              disabled={r.value >= r.max}
              onClick={() => step(r.key, 1)}
            >
              +
            </button>
          </span>
        </div>
      ))}
    </div>
  );
});
