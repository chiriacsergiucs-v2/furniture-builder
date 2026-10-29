import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { t } from '../core/i18n';
import { isQuad, type Pt } from '../core/room';
import { DEFAULT_CORNERS, PHOTO_UNITS } from '../core/wallPicture';
import { Dialog } from './Dialogs';

const CORNERS = [
  {
    id: 'Bottom-left',
    label: t('Bottom-left corner of the wall'),
    title: t('Bottom-left corner of the wall: drag, or use the arrow keys'),
  },
  {
    id: 'Bottom-right',
    label: t('Bottom-right corner of the wall'),
    title: t('Bottom-right corner of the wall: drag, or use the arrow keys'),
  },
  {
    id: 'Top-right',
    label: t('Top-right corner of the wall'),
    title: t('Top-right corner of the wall: drag, or use the arrow keys'),
  },
  {
    id: 'Top-left',
    label: t('Top-left corner of the wall'),
    title: t('Top-left corner of the wall: drag, or use the arrow keys'),
  },
] as const;
/** Arrow keys move a handle this far (ten-thousandths of the photo); with Shift ten times as far. */
const KEY_STEP = 20;

/**
 * Straighten a wall photo taken at an angle (ADR-146): the whole photo, with four handles to drag onto the wall's
 * corners in it. Apply saves them; the part inside, straightened, then fills the wall picture's rectangle. Reset
 * removes the straightening. Handles also move with the arrow keys.
 */
export function StraightenPhoto({
  wallName,
  url,
  corners,
  onApply,
  onClose,
}: {
  wallName: string;
  url: string;
  corners: [Pt, Pt, Pt, Pt] | undefined;
  onApply: (c: [Pt, Pt, Pt, Pt] | undefined) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState<[Pt, Pt, Pt, Pt]>(corners ?? DEFAULT_CORNERS);
  // The photo's width ÷ height once loaded: the whole photo stays in view, at most 55 % of the screen high.
  const [aspect, setAspect] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const ok = isQuad(q);
  const put = (k: number, p: Pt) =>
    setQ((old) => old.map((c, j) => (j === k ? p : c)) as [Pt, Pt, Pt, Pt]);
  const clampUnit = (v: number) => Math.min(PHOTO_UNITS, Math.max(0, Math.round(v)));
  const drag = (k: number) => (e: PointerEvent<HTMLButtonElement>) => {
    const el = box.current;
    if (!el || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const move = (ev: globalThis.PointerEvent) => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      put(k, [
        clampUnit(((ev.clientX - r.left) / r.width) * PHOTO_UNITS),
        clampUnit(((ev.clientY - r.top) / r.height) * PHOTO_UNITS),
      ]);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };
  const nudge = (k: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? KEY_STEP * 10 : KEY_STEP;
    const d: Record<string, Pt> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const by = d[e.key];
    if (!by) return;
    e.preventDefault();
    put(k, [clampUnit(q[k][0] + by[0]), clampUnit(q[k][1] + by[1])]);
  };
  const pct = (v: number) => `${(v / PHOTO_UNITS) * 100}%`;
  return (
    <Dialog
      open
      wide
      onClose={onClose}
      title={t('Straighten the photo on {wall}', { wall: wallName })}
      footer={
        <>
          {corners && (
            <button type="button" className="btn outline" onClick={() => onApply(undefined)}>
              {t('Reset')}
            </button>
          )}
          <button type="button" className="btn ghost" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button type="button" className="btn primary" disabled={!ok} onClick={() => onApply(q)}>
            {t('Apply')}
          </button>
        </>
      }
    >
      <p className="hint">
        {t(
          'Drag the four handles onto the corners of the wall in the photo. The part inside is straightened to fill the wall picture.',
        )}
      </p>
      <div
        className="straighten-photo"
        ref={box}
        style={aspect ? { width: `min(100% - 44px, ${(55 * aspect).toFixed(2)}vh)` } : undefined}
      >
        <img
          src={url}
          alt={t('Photo on {wall}', { wall: wallName })}
          draggable={false}
          onLoad={(e) => {
            const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
            if (w > 0 && h > 0) setAspect(w / h);
          }}
        />
        <svg
          viewBox={`0 0 ${PHOTO_UNITS} ${PHOTO_UNITS}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polygon points={q.map((p) => p.join(',')).join(' ')} className={ok ? '' : 'bad'} />
        </svg>
        {q.map((p, k) => (
          <button
            key={CORNERS[k].id}
            type="button"
            className="model-handle straighten-handle"
            style={{ left: pct(p[0]), top: pct(p[1]) }}
            aria-label={CORNERS[k].label}
            title={CORNERS[k].title}
            onPointerDown={drag(k)}
            onKeyDown={nudge(k)}
          >
            {k + 1}
          </button>
        ))}
      </div>
      {!ok && (
        <p className="alert error" role="alert">
          {t("The corners cross or lie in a line. Put them on the wall's four corners in order.")}
        </p>
      )}
    </Dialog>
  );
}
