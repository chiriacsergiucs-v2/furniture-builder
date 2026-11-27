/**
 * Pieces the room drawings (RoomDrawings.tsx) share with the project editor (Project.tsx): in their own module so
 * neither file imports the other in a cycle (G-485).
 */
import { useMemo, type KeyboardEvent } from 'react';
import { t, tr } from '@furniture-builder/i18n';
import { boxCentre } from '../core/geometry';
import { pieceBoxToRoom, rotationOf, type PlacedPiece, type Project } from '../core/project';
import { connectionSeams } from '../core/connections';
import { selectionBox } from '../core/selectPath';
import type { WallFinish } from '../core/room';
import { useDesign } from '../store/designStore';
import { turnedFootprint, type TurnGesture } from '../shared/planDrag';
import { InfoTip } from './controls';

/** No wall backgrounds: a stable empty list for the hooks that read them. */
export const NO_WALLS: WallFinish[] = [];

/**
 * The round turn handle on a stem from the selected piece's front (ADR-169): dragging it turns the piece about its
 * centre to any whole degree (snapping to quarter turns, Shift steps by 15°), with the turned outline and the angle
 * shown while dragging. A 44 px touch target around a small visible knob.
 */
export function TurnHandle({
  pc,
  fs,
  turn,
  onPress,
  onMove,
  onRelease,
  onCancel,
}: {
  pc: PlacedPiece;
  fs: number;
  turn: TurnGesture | null;
  onPress: (e: React.PointerEvent<SVGGElement>) => void;
  onMove: (e: React.PointerEvent<SVGGElement>) => void;
  onRelease: (e: React.PointerEvent<SVGGElement>) => void;
  onCancel: () => void;
}) {
  const b = pc.bounds;
  const { x: cx, z: cz } = boxCentre(b);
  const [fx1, fz1, fx2, fz2] = pc.front;
  const mx = (fx1 + fx2) / 2,
    mz = (fz1 + fz2) / 2;
  const len = Math.hypot(mx - cx, mz - cz) || 1;
  const ux = (mx - cx) / len,
    uz = (mz - cz) / len;
  const stem = fs * 2.8;
  const hx = mx + ux * stem,
    hz = mz + uz * stem;
  const current = rotationOf(pc.item);
  const ghost =
    turn && !turn.cancelled ? turnedFootprint(pc.footprint, cx, cz, turn.angle - current) : null;
  return (
    <g className={`turn-handle ${turn ? 'turning' : ''}`}>
      {ghost && <polygon className="turn-ghost" points={ghost.map((p) => p.join(',')).join(' ')} />}
      <line className="turn-stem" x1={mx} y1={mz} x2={hx} y2={hz} />
      <g
        role="slider"
        tabIndex={-1}
        aria-label={t('Turn {name}', { name: tr(pc.item.design.name) })}
        aria-valuenow={turn?.angle ?? current}
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuetext={t('{deg}°', { deg: turn?.angle ?? current })}
        onPointerDown={onPress}
        onPointerMove={onMove}
        onPointerUp={onRelease}
        onPointerCancel={onCancel}
      >
        <title>
          {t(
            'Drag to turn to any degree; Shift steps by 15°. Pieces at an angle do not join runs or snap side by side.',
          )}
        </title>
        {/* About 44 px round the knob on a phone (fs is about a 40th of the drawing's width). */}
        <circle className="turn-hit" cx={hx} cy={hz} r={fs * 3.4} />
        <circle className="turn-knob" cx={hx} cy={hz} r={fs * 1.1} />
      </g>
      {turn && !turn.cancelled && (
        <text className="turn-label" x={hx + fs * 1.6} y={hz - fs * 1.6} fontSize={fs * 1.2}>
          {t('{deg}°', { deg: turn.angle })}
        </text>
      )}
    </g>
  );
}

/**
 * A short tick across the seam of every connection that still holds (ADR-168), on the plan. A broken one has its
 * warning in the checks instead. The seams come from `connectionSeams` (ADR-179).
 */
export function ConnectionTicks({
  project,
  pieces,
  fs,
}: {
  project: Project;
  pieces: PlacedPiece[];
  fs: number;
}) {
  const seams = useMemo(() => connectionSeams(project, pieces), [project, pieces]);
  if (!seams.length) return null;
  const half = fs * 0.6;
  return (
    <g
      className="plan-connections"
      role="img"
      aria-label={t('Connection ticks')}
      aria-hidden="true"
    >
      {seams.map((s) => {
        // Across the seam at its middle: a seam along z (x1 === x2) gets a tick along x, and the other way round.
        const xm = (s.x1 + s.x2) / 2,
          zm = (s.z1 + s.z2) / 2;
        return s.x1 === s.x2 ? (
          <line key={s.id} x1={xm - half} y1={zm} x2={xm + half} y2={zm} />
        ) : (
          <line key={s.id} x1={xm} y1={zm - half} x2={xm} y2={zm + half} />
        );
      })}
    </g>
  );
}

/**
 * The same tick in the room front view (ADR-179): across every seam seen from the front (pieces side by side along
 * x), at the middle of the height both pieces stand over. Seams along z face the viewer edge-on and show nothing.
 */
export function FrontConnectionTicks({
  project,
  pieces,
  fs,
}: {
  project: Project;
  pieces: PlacedPiece[];
  fs: number;
}) {
  const seams = useMemo(
    () => connectionSeams(project, pieces).filter((s) => s.x1 === s.x2),
    [project, pieces],
  );
  if (!seams.length) return null;
  const half = fs * 0.6;
  return (
    <g
      className="plan-connections front-connections"
      role="img"
      aria-label={t('Connection ticks')}
      aria-hidden="true"
    >
      {seams.map((s) => {
        const ym = -(s.y1 + s.y2) / 2;
        return <line key={s.id} x1={s.x1 - half} y1={ym} x2={s.x1 + half} y2={ym} />;
      })}
    </g>
  );
}

export const onKey = (f: () => void) => (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    f();
  }
};

/**
 * The space selected inside the project piece drilled into (ADR-088), placed in the room; nothing while the whole
 * piece is selected (the piece itself is marked then). Outlined on the plan and the room front view (G-071).
 */
export function useSpaceInRoom() {
  const project = useDesign((s) => s.project);
  const model = useDesign((s) => s.model);
  const sel = useDesign((s) => s.selectedId);
  const id = useDesign((s) =>
    s.project && !s.editingItemId && s.drillItemId === s.selectedItemId ? s.drillItemId : null,
  );
  return useMemo(() => {
    const item = id ? project?.items.find((i) => i.id === id) : undefined;
    const box = item && typeof sel === 'string' ? selectionBox(model, sel) : undefined;
    return item && box ? pieceBoxToRoom(item, model, box) : undefined;
  }, [project, model, sel, id]);
}

/** What Select does (ADR-211, G-148), beside each of the three Select toggles; the views add the drag box. */
export function SelectTip({ box = false }: { box?: boolean }) {
  return (
    <InfoTip label={t('About Select')}>
      {t(
        'With Select on, each tap adds or removes a piece; with a mouse, Shift, Ctrl or Cmd-click does the same.',
      )}
      {box && t(' A drag on empty space selects every piece it touches.')}
    </InfoTip>
  );
}
