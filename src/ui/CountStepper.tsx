import { forwardRef, useMemo, useState, type CSSProperties } from 'react';
import { countRows, countSubject, type CountKey } from '../core/counts';
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

// Short visible labels for the compact card over the drawing (ADR-112); accessible names keep the full words.
const SHORT: Partial<Record<CountKey, string>> = {
  vdiv: 'V. dividers',
  hdiv: 'H. dividers',
  sliding: 'Sliding',
};

/**
 * The counts that apply to the selected space or piece, each as − N + (ADR-084). Nothing when none apply.
 * `foldable` (over 3D) adds a "Quick counts" button that folds the card to one row on a phone (G-058). `compact`
 * (over the drawing) is one short row per count with no heading (ADR-112); the 3D card has no heading either (N120).
 * Width and Depth are never in the card: they stay in the side panel and the bottom sheet (ADR-112, replacing
 * ADR-106 for the card).
 */
export const CountStepper = forwardRef<
  HTMLDivElement,
  { style?: CSSProperties; className?: string; foldable?: boolean; compact?: boolean }
>(function CountStepper({ style, className, foldable, compact }, ref) {
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
  // Names what the card acts on, the same thing the outline is drawn round (ADR-087, G-069). Only in the editor
  // panel: the cards over the drawing and 3D show only the counts (user 2026-10-27, N120).
  const title = foldable ? '' : selectionLabel(product, selectedId);
  return (
    <div
      ref={ref}
      className={`count-stepper ${compact ? 'compact' : ''} ${foldable ? 'foldable' : ''} ${foldable && folded ? 'folded' : ''} ${className ?? ''}`}
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
      {title && !compact && <span className="cs-title">{title}</span>}
      {rows.map((r) => (
        <div key={r.key} className="cs-row">
          <span className="cs-label">{(compact && SHORT[r.key]) || r.label}</span>
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

type Box = { left: number; top: number; width: number; height: number };
const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));

/**
 * Where the compact card goes inside a `frameW` × `frameH` view (ADR-112): the corner that covers least of `avoid`
 * (the selected part first, then its size labels and the view's own buttons), the one farthest from the selected part
 * on a tie. All boxes are in the view's coordinates; the card never changes the view's size.
 */
export function cardCorner(
  frameW: number,
  frameH: number,
  cardW: number,
  cardH: number,
  avoid: Box[],
  gap = 6,
): { left: number; top: number } {
  const xs = [gap, Math.max(gap, frameW - cardW - gap)];
  const ys = [gap, Math.max(gap, frameH - cardH - gap)];
  const sel = avoid[0];
  const cx = sel ? sel.left + sel.width / 2 : frameW / 2;
  const cy = sel ? sel.top + sel.height / 2 : frameH / 2;
  let best = { left: xs[1], top: ys[0] },
    bestCover = Infinity,
    bestDist = -1;
  for (const top of ys)
    for (const left of xs) {
      const c = { left, top, width: cardW, height: cardH };
      const cover = avoid.reduce((n, b) => n + overlap(c, b), 0);
      const dist = Math.hypot(left + cardW / 2 - cx, top + cardH / 2 - cy);
      if (cover < bestCover - 1 || (Math.abs(cover - bestCover) <= 1 && dist > bestDist)) {
        best = { left, top };
        bestCover = cover;
        bestDist = dist;
      }
    }
  return best;
}

/** `el`'s screen box relative to `frame`'s, grown by `grow` px on each side. */
export function boxIn(frame: DOMRect, el: Element | null | undefined, grow = 0): Box[] {
  if (!el) return [];
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) return [];
  return [
    {
      left: r.left - frame.left - grow,
      top: r.top - frame.top - grow,
      width: r.width + 2 * grow,
      height: r.height + 2 * grow,
    },
  ];
}
