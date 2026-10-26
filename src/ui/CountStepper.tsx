import { forwardRef, useMemo, useState, type CSSProperties } from 'react';
import { countRows, countSubject } from '../core/counts';
import { useDesign } from '../store/designStore';
import { Icon } from './icons';
import { selectionLabel } from './Inspector';

// Folded or open over 3D on a phone (G-058), kept on this device only (localStorage, ADR-002). Open until folded.
const FOLD_KEY = 'fb:counts3d';
function storedFolded() {
  try {
    return localStorage.getItem(FOLD_KEY) === 'folded';
  } catch {
    return false;
  }
}

/**
 * The counts that apply to the selected space or piece, each as − N + (ADR-084). Nothing when none apply.
 * `foldable` (over 3D) adds a "Quick counts" button that folds the card to one row on a phone (G-058).
 */
export const CountStepper = forwardRef<
  HTMLDivElement,
  { style?: CSSProperties; className?: string; foldable?: boolean }
>(function CountStepper({ style, className, foldable }, ref) {
  const [folded, setFolded] = useState(storedFolded);
  const toggle = () => {
    const next = !folded;
    setFolded(next);
    try {
      localStorage.setItem(FOLD_KEY, next ? 'folded' : 'open');
    } catch {
      /* private mode: the choice lasts for this page only */
    }
  };
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
      className={`count-stepper ${foldable ? 'foldable' : ''} ${foldable && folded ? 'folded' : ''} ${className ?? ''}`}
      role="group"
      aria-label="Quick counts"
      style={style}
      // Taps here must not reach the drawing or the 3D canvas underneath (they would change the selection).
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {foldable && (
        <button type="button" className="cs-fold" aria-expanded={!folded} onClick={toggle}>
          Quick counts
          <Icon name={folded ? 'chevron-down' : 'chevron-up'} className="sm" />
        </button>
      )}
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
