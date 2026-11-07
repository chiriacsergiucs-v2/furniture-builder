import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { t } from '../core/i18n';

/** The phone Compose sheet's three stops (ADR-211, G-027): the 56 px peek row, today's half sheet, the full screen. */
export type SheetStop = 'peek' | 'half' | 'full';
export const SHEET_STOPS: SheetStop[] = ['peek', 'half', 'full'];

const PEEK_PX = 56;
/** A move under this many pixels is a tap, not a drag (ADR-211). */
const TAP_PX = 8;

/** The height of each stop in pixels for this window: half is 40 % of the height (N82), full reaches the top bar. */
function stopHeights(side: HTMLElement): Record<SheetStop, number> {
  const vh = window.innerHeight;
  const style = getComputedStyle(side.ownerDocument.documentElement);
  const px = (name: string, fallback: number) => {
    const v = parseFloat(style.getPropertyValue(name));
    return Number.isFinite(v) && v > 0 ? v : fallback;
  };
  const full = Math.max(PEEK_PX, vh - px('--bar-h', 50) - px('--actions-h', 64));
  return { peek: PEEK_PX, half: Math.min(full, Math.round(vh * 0.4)), full };
}

function nearestStop(h: number, heights: Record<SheetStop, number>): SheetStop {
  let best: SheetStop = 'peek';
  for (const s of SHEET_STOPS) if (Math.abs(heights[s] - h) < Math.abs(heights[best] - h)) best = s;
  return best;
}

const STOP_TEXT = {
  peek: () => t('Collapsed'),
  half: () => t('Half'),
  full: () => t('Full screen'),
} as const;

/**
 * The grab handle on the peek row (ADR-211): it follows the finger and snaps to the nearest stop; a move under 8 px is
 * a tap, which toggles peek and half as the peek row does. Arrow keys step between the stops.
 */
export function SheetHandle({ stop, onStop }: { stop: SheetStop; onStop: (s: SheetStop) => void }) {
  const drag = useRef<{
    y: number;
    h: number;
    moved: boolean;
    side: HTMLElement;
    heights: Record<SheetStop, number>;
  } | null>(null);

  const sideOf = (el: HTMLElement) => el.closest<HTMLElement>('.side');
  const clearInline = (side: HTMLElement) => {
    side.style.removeProperty('height');
    side.style.removeProperty('max-height');
    side.classList.remove('sheet-dragging');
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const side = sideOf(e.currentTarget);
    if (!side) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = {
      y: e.clientY,
      h: side.getBoundingClientRect().height,
      moved: false,
      side,
      heights: stopHeights(side),
    };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dy = d.y - e.clientY;
    if (!d.moved && Math.abs(dy) < TAP_PX) return;
    d.moved = true;
    const h = Math.min(d.heights.full, Math.max(PEEK_PX, d.h + dy));
    d.side.classList.add('sheet-dragging');
    d.side.style.height = `${Math.round(h)}px`;
    d.side.style.maxHeight = `${Math.round(h)}px`;
  };
  const end = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (!d.moved) {
      clearInline(d.side);
      if (!cancelled) onStop(stop === 'peek' ? 'half' : 'peek');
      return;
    }
    const h = d.side.getBoundingClientRect().height;
    clearInline(d.side);
    onStop(nearestStop(h, d.heights));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = SHEET_STOPS.indexOf(stop);
    let next: number;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight')
      next = Math.min(SHEET_STOPS.length - 1, i + 1);
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') next = Math.max(0, i - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = SHEET_STOPS.length - 1;
    else return;
    e.preventDefault();
    if (next !== i) onStop(SHEET_STOPS[next]);
  };

  return (
    <div
      className="sheet-handle"
      role="slider"
      tabIndex={0}
      aria-label={t('Resize the sheet')}
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={SHEET_STOPS.length - 1}
      aria-valuenow={SHEET_STOPS.indexOf(stop)}
      aria-valuetext={STOP_TEXT[stop]()}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => end(e, false)}
      onPointerCancel={(e) => end(e, true)}
      onKeyDown={onKeyDown}
    >
      <span className="sheet-grip" aria-hidden="true" />
    </div>
  );
}
