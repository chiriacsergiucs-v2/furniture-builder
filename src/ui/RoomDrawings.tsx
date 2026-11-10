// The project's plan and room front view (ADR-022, ADR-056, ADR-059, ADR-065): moved out of Project.tsx unchanged (cleanup audit 2026-11-09, item 13).
import { lockedAxes } from '../core/sizeLock';
import { t, tr } from '../core/i18n';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import { boxIn, cardCorner, CountStepper } from './CountStepper';
import {
  DRAG_STEP,
  isLocked,
  LOCKED_HINT,
  moveBlocked,
  rotationOf,
  type PlacedPiece,
  type ProjectItem,
  type Project,
  type ProjectModel,
  isTurnLocked,
} from '../core/project';
import { dropTarget, SNAP_RANGE } from '../core/snap';
import { dragHeight, heightDraggable, heightLabel, snapWallHeight } from '../core/height';
import { groupOf, itemsAt, itemsInBox, itemsInFrontBox, nextUnder } from '../core/selection';
import { inSelection } from '../core/selectPath';
import type { Box } from '../core/types';
import { useDesign } from '../store/designStore';
import { InfoTip, Toggle } from './controls';
import { pictureRect } from '../core/wallPicture';
import { pictureKey, useWallPictureUrls } from '../store/wallPictures';
import {
  arrowMove,
  bracketTurn,
  cancelPress,
  DRAG_THRESHOLD_PX,
  cancelTurn,
  moveTurn,
  pressTurn,
  releaseTurn,
  type TurnGesture,
  movePointer,
  pressPiece,
  releasePointer,
  type DragGesture,
  type PointerAt,
} from '../shared/planDrag';
import { useSnap } from '../store/useSnap';
import { newPieceTarget, registerPlanHit } from './pieceDrag';
import { usePieceList } from '../store/pieceListStore';
import {
  doorSwing,
  featureBox,
  roomFrontView,
  wallEnds,
  wallFinish,
  wallLength,
  type Room,
} from '../core/room';
import { Dim, DimV, outlinePoints } from './Elevation';
import { frontEdge } from '../core/geometry';
import { FrontModels, PlanModels } from './Models3D';
import { PlanKitchenMarks } from './RunRequests';
import { ZoneOverlay, ZoneToolbar } from './Clearances';
import { useClearances } from '../store/clearances';
import { useMediaQuery } from '../store/useMediaQuery';
import { ViewOptions } from './ViewOptions';
import { inOptions } from './viewChoice';
import { ProblemOutline } from './ProblemBanner';
import { type FocusedProblem } from '../store/focusedProblem';
import { setRooms } from '../core/setRoom';
import {
  FloorFill,
  PlanPictureLayer,
  useBoardFills,
  usePlanPictureRect,
  WallBands,
} from './RoomSurfaces';
import { roomToPicture } from '../core/planPicture';

import {
  ConnectionTicks,
  DRAWER_BOX,
  FrontConnectionTicks,
  FRONTS,
  NO_WALLS,
  onKey,
  SelectTip,
  TurnHandle,
  useSpaceInRoom,
} from './Project';

/** Screen point → room mm on the plan (x along the back wall, z away from it). */
function roomPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
  const m = svg.getScreenCTM();
  if (!m) return null;
  const pt = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
  return { x: Math.round(pt.x), z: Math.round(pt.y) };
}

export function RoomPlan({
  pm,
  problem,
  fronts,
}: {
  pm: ProjectModel;
  problem?: FocusedProblem | null;
  /** "Doors and fronts" sits in this row instead of the stage toolbar (ADR-109). */
  fronts?: boolean;
}) {
  const phone = useMediaQuery('(max-width: 760px)');
  const showFronts = useDesign((s) => s.showFronts);
  const setShowFronts = useDesign((s) => s.setShowFronts);
  const space = useSpaceInRoom();
  const selectedId = useDesign((s) => s.selectedItemId);
  // Several selected pieces (ADR-097): Shift/Ctrl/Cmd-click or Select on a phone; a box on empty plan.
  const selectedIds = useDesign((s) => s.selectedItemIds);
  const multi = useDesign((s) => s.multiSelect);
  const setMulti = useDesign((s) => s.setMultiSelect);
  const toggleItem = useDesign((s) => s.toggleItem);
  const selectItems = useDesign((s) => s.selectItems);
  const moveSelectionBy = useDesign((s) => s.moveSelectionBy);
  /** The selection box being drawn on empty plan (room mm), or null. */
  const [box, setBoxState] = useState<{
    pointerId: number;
    a: { x: number; z: number };
    b: { x: number; z: number };
    add: boolean;
  } | null>(null);
  const boxRef = useRef<typeof box>(null);
  const setBox = (v: typeof box) => {
    boxRef.current = v;
    setBoxState(v);
  };
  /** A pointer gesture just ended on a piece: the click that follows it is not a second selection. */
  const justTapped = useRef(false);
  /** Where the last tap on a piece was (room mm): a tap on the same spot over stacked pieces goes to the next one. */
  const lastTap = useRef<{ x: number; z: number } | null>(null);
  /** The placed footprints the project model holds, for hit tests without building anything again. */
  const footprints = useMemo(
    () => new Map(pm.pieces.map((pc) => [pc.item.id, pc.bounds])),
    [pm.pieces],
  );
  const select = useDesign((s) => s.selectItem);
  const tapItem = useDesign((s) => s.tapItem);
  const placingId = useDesign((s) => s.placingItemId);
  const placeAt = useDesign((s) => s.placeAt);
  const [hover, setHover] = useState<{ x: number; z: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const placing = pm.pieces.find((pc) => pc.item.id === placingId);
  const room = useDesign((s) => s.project?.room);
  const drawing = useDesign((s) => s.drawingRoom);
  const addCorner = useDesign((s) => s.addRoomCorner);
  const scaling = useDesign((s) => s.scalingPlan);
  const addScalePoint = useDesign((s) => s.addScalePoint);
  const planPicture = useDesign((s) => s.project?.planPicture);
  const pictureRect = usePlanPictureRect(planPicture);
  const board = useBoardFills(pm.pieces);
  const tapping = !!placing || !!drawing || !!scaling;
  const moveItemBy = useDesign((s) => s.moveItemBy);
  // Shared with the 3D view (ADR-205): one Clearances switch shows the zones in both.
  const [showZones, setShowZones] = useClearances();
  const turnItem = useDesign((s) => s.turnItem);
  const setRotation = useDesign((s) => s.setRotation);
  /** Why the last move did nothing (a locked piece, ADR-095). */
  const notice = useDesign((s) => s.notice);
  /** The press or drag in progress (ADR-065); the ref keeps pointer handlers in step between renders. */
  const [pressed, setDragState] = useState<DragGesture | null>(null);
  // Tap modes (placing a new piece, drawing the room) turn dragging off (ADR-056, ADR-059).
  const drag = tapping ? null : pressed;
  const dragRef = useRef<DragGesture | null>(null);
  // Snapping (ADR-070): the Snap toggle, and Alt held while dragging to place freely.
  const project = useDesign((s) => s.project);
  const [snapOn, setSnapOn] = useSnap();
  const [alt, setAlt] = useState(false);
  const setDrag = (g: DragGesture | null, altKey = false) => {
    // Alt is read when a press starts and forgotten when it ends, so a missed keyup never carries over.
    if (!dragRef.current || !g) setAlt(altKey);
    dragRef.current = g;
    setDragState(g);
  };
  const dragging = !!drag;
  /** The turn handle being dragged (ADR-169); the ref keeps pointer handlers in step between renders. */
  const [turn, setTurnState] = useState<TurnGesture | null>(null);
  const turnRef = useRef<TurnGesture | null>(null);
  const setTurn = (g: TurnGesture | null) => {
    turnRef.current = g;
    setTurnState(g);
  };
  const turning = !!turn;
  useEffect(() => {
    if (!dragging && !turning) return;
    const onEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        // The click that follows the release must not select or open the piece (ADR-169, G-018).
        if (cancelPress(dragRef.current ?? turnRef.current)) {
          justTapped.current = true;
          window.setTimeout(() => (justTapped.current = false), 400);
        }
        setDrag(null);
        // A cancelled turn stays until the pointer is released, so the release stays the handle's own.
        setTurn(cancelTurn(turnRef.current));
      }
    };
    const onAlt = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Alt') {
        e.preventDefault();
        setAlt(e.type === 'keydown');
      }
    };
    // In the capture phase, so the app's own Esc (clear the selection, ADR-160) sees it taken first.
    window.addEventListener('keydown', onEsc, true);
    window.addEventListener('keydown', onAlt);
    window.addEventListener('keyup', onAlt);
    return () => {
      window.removeEventListener('keydown', onEsc, true);
      window.removeEventListener('keydown', onAlt);
      window.removeEventListener('keyup', onAlt);
    };
  }, [dragging, turning]);
  // Chrome ignores `touch-action` on SVG shapes, so a touch drag on a piece would start a page scroll and cancel the
  // pointer. While a piece is pressed, touchmove is prevented (non-passive) so the drag keeps the pointer.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onMove = (e: TouchEvent) => {
      if (dragRef.current || boxRef.current || turnRef.current) e.preventDefault();
    };
    svg.addEventListener('touchmove', onMove, { passive: false });
    return () => svg.removeEventListener('touchmove', onMove);
  }, []);
  /** Screen point → room mm on the plan (x along the back wall, z away from it). */
  const toRoom = (e: { clientX: number; clientY: number }) =>
    svgRef.current ? roomPoint(svgRef.current, e.clientX, e.clientY) : null;
  const at = (e: { pointerId: number; clientX: number; clientY: number }): PointerAt => ({
    pointerId: e.pointerId,
    sx: e.clientX,
    sy: e.clientY,
    room: toRoom(e),
  });
  const dragged = drag?.dragging ? pm.pieces.find((pc) => pc.item.id === drag.id) : undefined;
  // Dragging a piece of a selection of several moves them all (ADR-097).
  const group =
    dragged && selectedIds.length > 1 && selectedIds.includes(dragged.item.id) ? selectedIds : null;
  // Snapping uses the moved piece; the other selected pieces move with it, so they are not its neighbours.
  const others = useMemo(
    () =>
      group ? pm.pieces.filter((pc) => !group.includes(pc.item.id) || pc === dragged) : pm.pieces,
    [group, pm.pieces, dragged],
  );
  // A locked piece, or one carrying one, does not follow the pointer (ADR-095): no outline, the hint instead.
  const lockedDrag = useMemo(
    () =>
      dragged && project
        ? isLocked(dragged.item)
          ? LOCKED_HINT
          : moveBlocked(project, group ?? [dragged.item.id])
        : null,
    [dragged, project, group],
  );
  // A catalog item dragged from the piece list (ADR-094): its outline follows the pointer over the plan, snapped
  // the same way (with the Snap toggle, read by `newPieceTarget`).
  const newDrag = usePieceList((s) => s.drag);
  const target =
    dragged && drag && project && !lockedDrag
      ? dropTarget(project, others, drag.id, drag.dx, drag.dz, snapOn && !alt)
      : newDrag
        ? newPieceTarget(newDrag)
        : null;
  useEffect(() => {
    registerPlanHit((cx, cy) => {
      const svg = svgRef.current;
      const r = svg?.getBoundingClientRect();
      if (!svg || !r || !r.width || cx < r.left || cx > r.right || cy < r.top || cy > r.bottom)
        return null;
      // Only the plan's figure, not a sheet, banner or bar drawn over it.
      const hit = document.elementFromPoint(cx, cy);
      if (hit && !(svg.parentElement ?? svg).contains(hit)) return null;
      return roomPoint(svg, cx, cy);
    });
    return () => registerPlanHit(null);
  }, []);
  // The value sets' room copies are framed too (ADR-167).
  const pts = [
    ...(room?.outline ?? []),
    ...(drawing ?? []),
    ...(project ? setRooms(project).flatMap((sr) => sr.room.outline) : []),
    // The plan picture is framed too while it is shown (ADR-208).
    ...(pictureRect && !planPicture?.hidden
      ? ([
          [pictureRect.x, pictureRect.z],
          [pictureRect.x + pictureRect.w, pictureRect.z + pictureRect.d],
        ] as [number, number][])
      : []),
  ];
  // With Clearances on, the view also frames the zones (chair or service space beyond the pieces); models always.
  const framed = [
    ...(showZones
      ? pm.zones.flatMap((z) => (z.tipUp ? [z.box, z.tipUp.strip] : [z.box]))
      : pm.pieces.map((p) => p.bounds)),
    ...pm.models.map((m) => m.box),
  ];
  const xs = [...framed.flatMap((b) => [b.x, b.x + b.w]), ...pts.map((p) => p[0])],
    zs = [...framed.flatMap((b) => [b.z, b.z + b.d]), ...pts.map((p) => p[1])];
  const x0 = Math.min(0, ...xs),
    x1 = Math.max(1000, ...xs),
    z0 = Math.min(0, ...zs),
    z1 = Math.max(1000, ...zs);
  const span = Math.max(x1 - x0, z1 - z0, 1000);
  const pad = span * 0.1,
    fs = span / 40,
    dfs = span / 32;
  const sel =
    pm.pieces.find((p) => p.item.id === selectedId)?.bounds ??
    pm.models.find((m) => m.item.id === selectedId)?.box;
  /** The one selected, unlocked piece whose turn handle is shown (ADR-169). */
  const turnPc =
    !tapping && selectedIds.length === 1
      ? pm.pieces.find(
          (x) => x.item.id === selectedIds[0] && !isLocked(x.item) && !isTurnLocked(x.item),
        )
      : undefined;
  return (
    <figure
      className="plan with-tools"
      aria-label={t('Room plan, seen from above. Select a piece.')}
    >
      <div className="plan-tools">
        {fronts && (
          <Toggle
            label={t('Fronts')}
            name={t('Doors and fronts')}
            checked={showFronts}
            onChange={setShowFronts}
          />
        )}
        {/* Phones: taps add and remove pieces, and a drag on empty plan draws a selection box (ADR-097). */}
        <Toggle label={t('Select')} checked={multi} onChange={setMulti} />
        <SelectTip box />
        {/* Checkboxes like Fronts and Clear.: one toggle style in the row (ADR-120). On a phone Snap and the
            clearances sit behind Options; Fronts and Select stay in the row (ADR-144, G-269). */}
        <ViewOptions menu={inOptions('snap', phone)}>
          <Toggle label={t('Snap')} checked={snapOn} onChange={setSnapOn} />
          <ZoneToolbar on={showZones} onChange={setShowZones} />
        </ViewOptions>
      </div>
      <InfoTip label={t('About the plan')}>
        <span className="info-lead">
          {snapOn
            ? t('Snaps within {range} mm to walls and neighbours; hold Alt to place freely.', {
                range: SNAP_RANGE,
              })
            : t('Pieces go exactly where dropped.')}
        </span>
        {t(
          "Seen from above. The yellow edge is each piece's front; dashed pieces hang on the wall; red dashes show where a selected piece's doors or drawers cannot open. Drag a piece, or use the arrow keys on it, to move it; Esc cancels a drag. R turns the focused piece about its centre. Shift- or Ctrl-click adds pieces to the selection (Select on a phone); drag on empty plan to draw a box; tap a spot again to reach a piece under another; Ctrl+A selects all. Drag the round handle in front of the selected piece to turn it to any degree ([ and ] turn by 1°). A grouped piece selects its group first, then itself. With Snap on, a dropped piece joins a wall, an inside corner or a neighbour’s side within {range} mm; arrow keys never snap.",
          { range: SNAP_RANGE },
        )}
      </InfoTip>
      {/* Live snap feedback while a piece is dragged; over the plan, so it takes no room (ADR-080). */}
      {target ? (
        <span className="plan-drag-note" role="status">
          {target.snap
            ? t('Snaps: {list}', { list: [target.snap.label, ...target.snap.notes].join(' · ') })
            : (target.hint ?? (snapOn ? t('Alt held: placing freely.') : t('Snap is off.')))}
          {/* Neighbours the family rule refused, named even when the piece snaps elsewhere (ADR-100). */}
          {target.refused
            .filter((r) => r !== target.hint)
            .map((r) => (
              <span key={r} className="snap-refused">
                {` · ${r}`}
              </span>
            ))}
        </span>
      ) : lockedDrag ? (
        <span className="plan-drag-note locked" role="status">
          {lockedDrag}
        </span>
      ) : (
        notice &&
        !dragging && (
          <span className="plan-drag-note locked" role="status">
            {notice}
          </span>
        )
      )}
      <svg
        ref={svgRef}
        viewBox={`${x0 - pad * 1.2} ${z0 - pad * 1.6} ${x1 - x0 + pad * 2.4} ${z1 - z0 + pad * 2.8}`}
        className={tapping ? 'placing' : multi ? 'selecting' : undefined}
        onPointerMove={(e) => {
          if (tapping) setHover(toRoom(e));
          const bx = boxRef.current;
          if (bx && e.pointerId === bx.pointerId) {
            const p = toRoom(e);
            if (p) setBox({ ...bx, b: p });
          }
        }}
        onPointerLeave={() => setHover(null)}
        onPointerDown={(e) => {
          // A second finger (or any other pointer) while a piece is pressed cancels the drag.
          if (dragRef.current && e.pointerId !== dragRef.current.pointerId) setDrag(null);
          if (boxRef.current && e.pointerId !== boxRef.current.pointerId) setBox(null);
          // A press on empty plan starts a selection box (ADR-097): with a mouse or pen, or with Select on.
          const onPiece = (e.target as Element).closest?.('.plan-piece, .plan-model');
          if (tapping || onPiece || dragRef.current || boxRef.current) return;
          if (e.pointerType === 'touch' && !multi) return;
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          const p = toRoom(e);
          if (!p) return;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          setBox({ pointerId: e.pointerId, a: p, b: p, add: e.shiftKey || e.ctrlKey || e.metaKey });
        }}
        onPointerUp={(e) => {
          const bx = boxRef.current;
          if (!bx || e.pointerId !== bx.pointerId || !project) return;
          setBox(null);
          // A press without a drag is not a box.
          if (Math.abs(bx.a.x - bx.b.x) < 1 && Math.abs(bx.a.z - bx.b.z) < 1) return;
          const hit = itemsInBox(project, bx.a, bx.b, footprints);
          selectItems(bx.add ? [...selectedIds, ...hit] : hit);
        }}
        onPointerCancel={() => setBox(null)}
        onClick={
          tapping
            ? (e) => {
                const p = toRoom(e);
                if (!p) return;
                e.stopPropagation();
                if (scaling) {
                  if (planPicture) addScalePoint(roomToPicture(planPicture, p.x, p.z));
                  return;
                }
                if (drawing) {
                  addCorner(p.x, p.z);
                  return;
                }
                setHover(null);
                placeAt(p.x, p.z);
              }
            : undefined
        }
      >
        {board.defs}
        {planPicture && (
          <PlanPictureLayer pp={planPicture} rect={pictureRect} taps={scaling} fs={fs} />
        )}
        {project && <SetTags project={project} pm={pm} fs={fs} />}
        {room ? (
          <>
            <RoomOutline room={room} fs={fs} traced={!!pictureRect && !planPicture?.hidden} />
            {/* A value set's room copy at its origin (ADR-167). */}
            {project &&
              setRooms(project).map((sr) => (
                <g key={sr.set.id} className="set-room" aria-label={sr.set.name}>
                  <RoomOutline room={sr.room} fs={fs} />
                </g>
              ))}
          </>
        ) : (
          <>
            <line className="wall" x1={x0 - pad} y1={0} x2={x1 + pad} y2={0} />
            <text className="wall-label" x={x0} y={-pad * 0.5} fontSize={fs}>
              {t('Back wall')}
            </text>
          </>
        )}
        {drawing && drawing.length > 0 && (
          <>
            <polyline className="draw-line" points={drawing.map((p) => p.join(',')).join(' ')} />
            {drawing.map((p, i) => (
              <circle key={i} className="draw-corner" cx={p[0]} cy={p[1]} r={fs * 0.4} />
            ))}
            {hover && (
              <line
                className="draw-line next"
                x1={drawing[drawing.length - 1][0]}
                y1={drawing[drawing.length - 1][1]}
                x2={hover.x}
                y2={hover.z}
              />
            )}
          </>
        )}
        {pm.pieces.map((pc) => {
          const b = pc.bounds;
          const [fx1, fz1, fx2, fz2] = frontEdge(b, pc.item.rotationY);
          const on = selectedIds.includes(pc.item.id);
          // Pieces stacked on the same floor area (a wall run above a base run) get their names on separate lines.
          const stack = pm.pieces.filter(
            (q) =>
              q.bounds.x < b.x + b.w &&
              b.x < q.bounds.x + q.bounds.w &&
              q.bounds.z < b.z + b.d &&
              b.z < q.bounds.z + q.bounds.d,
          );
          const size = Math.min(fs, b.w / 7);
          const dy = (stack.indexOf(pc) - (stack.length - 1) / 2) * size * 1.3;
          const locked = isLocked(pc.item);
          return (
            <g
              key={pc.item.id}
              className={`plan-piece ${on ? 'on' : ''} ${b.y > 0 ? 'raised' : ''} ${locked ? 'locked' : ''}`}
              role="button"
              tabIndex={0}
              aria-pressed={on}
              aria-label={`${t('{name}, {w} by {d} mm', { name: tr(pc.item.design.name), w: b.w, d: b.d })}${locked ? t(', locked') : ''}`}
              onClick={
                tapping
                  ? undefined
                  : () => {
                      if (justTapped.current) {
                        justTapped.current = false;
                        return;
                      }
                      select(pc.item.id);
                    }
              }
              onKeyDown={(e) => {
                // R / Shift+R turn the focused piece about its centre (ADR-069).
                if (
                  !tapping &&
                  e.key.toLowerCase() === 'r' &&
                  !e.ctrlKey &&
                  !e.metaKey &&
                  !e.altKey
                ) {
                  e.preventDefault();
                  // Holding the key turns once, not once per auto-repeat (each turn is an undo step).
                  if (e.repeat) return;
                  select(pc.item.id);
                  turnItem(pc.item.id, e.shiftKey ? -1 : 1);
                  return;
                }
                // [ and ] turn the focused piece by 1°, with Shift by 15° (ADR-169).
                const deg = tapping ? null : bracketTurn(e.key, e.shiftKey);
                if (deg !== null && !e.ctrlKey && !e.metaKey && !e.altKey) {
                  e.preventDefault();
                  select(pc.item.id);
                  setRotation(pc.item.id, (((rotationOf(pc.item) + deg) % 360) + 360) % 360);
                  return;
                }
                const m = tapping ? null : arrowMove(e.key, e.shiftKey);
                if (!m) return onKey(() => select(pc.item.id))(e);
                e.preventDefault();
                // On a piece of a selection of several, the arrows move them all (ADR-097).
                if (selectedIds.length > 1 && selectedIds.includes(pc.item.id))
                  moveSelectionBy(m.dx, m.dz);
                else moveItemBy(pc.item.id, m.dx, m.dz);
              }}
              onPointerDown={
                tapping
                  ? undefined
                  : (e) => {
                      if (e.pointerType === 'mouse' && e.button !== 0) return;
                      // Another pointer already pressing: the plan's handler cancels that drag instead.
                      const cur = dragRef.current;
                      if (cur && cur.pointerId !== e.pointerId) return;
                      justTapped.current = false;
                      const g = pressPiece(null, pc.item.id, at(e));
                      if (!g) return;
                      e.currentTarget.setPointerCapture?.(e.pointerId);
                      setDrag(g, e.altKey);
                    }
              }
              onPointerMove={
                tapping
                  ? undefined
                  : (e) => {
                      const g = dragRef.current;
                      if (!g || g.id !== pc.item.id) return;
                      const next = movePointer(g, at(e));
                      if (next !== g) setDrag(next);
                      if (e.altKey !== alt) setAlt(e.altKey);
                    }
              }
              onPointerUp={(e) => {
                const g = dragRef.current;
                if (!g || g.id !== pc.item.id) return;
                const end = releasePointer(g, e.pointerId);
                if (!end) return;
                setDrag(null);
                // A tap mode that started during the press ends the drag without moving anything.
                if (tapping) return;
                justTapped.current = true;
                if (end.kind !== 'drop') {
                  // Shift/Ctrl/Cmd, or Select on: add the piece to the selection or take it out (ADR-097).
                  if (e.shiftKey || e.ctrlKey || e.metaKey || multi) return toggleItem(end.id);
                  // The same spot again over stacked pieces: the next one under the pointer (ADR-097).
                  const pt = toRoom(e);
                  const prev = lastTap.current;
                  lastTap.current = pt;
                  const near = (span / 100) ** 2;
                  const same =
                    !!pt && !!prev && (pt.x - prev.x) ** 2 + (pt.z - prev.z) ** 2 <= near;
                  const under = same && project ? itemsAt(project, pt!.x, pt!.z, footprints) : [];
                  if (
                    under.length > 1 &&
                    selectedIds.length === 1 &&
                    under.includes(selectedIds[0]) &&
                    !groupOf(project!, end.id)
                  )
                    return select(nextUnder(under, selectedIds[0]) ?? end.id);
                  // A tap selects the piece (its group first); a tap on the selected piece opens it (ADR-083).
                  return tapItem(end.id);
                }
                const snapping = snapOn && !e.altKey;
                // A piece of a selection of several: all move by the same whole mm (ADR-097).
                if (selectedIds.length > 1 && selectedIds.includes(end.id)) {
                  const t =
                    snapping && project
                      ? dropTarget(project, others, end.id, end.dx, end.dz, true)
                      : null;
                  // Alt moves the pieces without their connected neighbours (ADR-168).
                  const opts = { snapped: !!t?.snap, alone: e.altKey };
                  if (t?.snap)
                    moveSelectionBy(
                      t.position.x - pc.item.position.x,
                      t.position.z - pc.item.position.z,
                      undefined,
                      opts,
                    );
                  else moveSelectionBy(end.dx, end.dz, DRAG_STEP, opts);
                  return;
                }
                select(end.id);
                const t =
                  snapping && project
                    ? dropTarget(project, pm.pieces, end.id, end.dx, end.dz, true)
                    : null;
                // Snap off or Alt held: exactly the ADR-065 drop. Snapped: whole mm, one undo step. A snapped
                // drop connects the piece to a valid neighbour; Alt moves it without its connected ones (ADR-168).
                const opts = { snapped: !!t?.snap, alone: e.altKey };
                if (!t?.snap) moveItemBy(end.id, end.dx, end.dz, undefined, opts);
                else
                  moveItemBy(
                    end.id,
                    t.position.x - pc.item.position.x,
                    t.position.z - pc.item.position.z,
                    1,
                    opts,
                  );
              }}
              onPointerCancel={() => setDrag(null)}
            >
              {pc.item.angle ? (
                // A piece at an angle (ADR-121): its turned outline and front edge, from the core.
                <>
                  <polygon
                    points={pc.footprint.map((p) => p.join(',')).join(' ')}
                    style={
                      board.fillOf(pc.item.id) ? { fill: board.fillOf(pc.item.id) } : undefined
                    }
                  />
                  <line
                    className="front"
                    x1={pc.front[0]}
                    y1={pc.front[1]}
                    x2={pc.front[2]}
                    y2={pc.front[3]}
                  />
                </>
              ) : (
                <>
                  {/* The board of its highest panel, as a picture (ADR-208). */}
                  <rect
                    x={b.x}
                    y={b.z}
                    width={b.w}
                    height={b.d}
                    style={
                      board.fillOf(pc.item.id) ? { fill: board.fillOf(pc.item.id) } : undefined
                    }
                  />
                  <line className="front" x1={fx1} y1={fz1} x2={fx2} y2={fz2} />
                </>
              )}
              <text
                x={b.x + b.w / 2}
                y={b.z + b.d / 2 + dy}
                fontSize={size}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {pc.item.quantity > 1 ? `${pc.item.quantity}× ` : ''}
                {tr(pc.item.design.name)}
              </text>
              {/* The badge shows for any lock: place, turn or a size (ADR-095, ADR-171). */}
              {(locked || isTurnLocked(pc.item) || lockedAxes(pc.item).length > 0) && (
                <LockBadge x={b.x} y={b.z} size={size} />
              )}
            </g>
          );
        })}
        {box && (
          <rect
            className="select-box"
            x={Math.min(box.a.x, box.b.x)}
            y={Math.min(box.a.z, box.b.z)}
            width={Math.abs(box.b.x - box.a.x)}
            height={Math.abs(box.b.z - box.a.z)}
            aria-hidden="true"
          />
        )}
        {showZones && <ZoneOverlay zones={pm.zones} fs={fs} />}
        {/* Sink and hob cut-outs and worktop corner joints (ADR-205), from the core. */}
        {project && <PlanKitchenMarks project={project} pieces={pm.pieces} fs={fs} />}
        {project && <ConnectionTicks project={project} pieces={pm.pieces} fs={fs} />}
        <PlanModels pm={pm} fs={fs} tapping={tapping} />
        {pm.blocked
          .filter((c) => c.itemId === selectedId)
          .map((c, i) => (
            <rect
              key={i}
              className="blocked-clearance"
              x={c.box.x}
              y={c.box.z}
              width={c.box.w}
              height={c.box.d}
              transform={
                c.box.yaw ? `rotate(${-c.box.yaw.deg} ${c.box.yaw.cx} ${c.box.yaw.cz})` : undefined
              }
            >
              <title>{t('Needed to open; something is in the way')}</title>
            </rect>
          ))}
        {problem && !tapping && <ProblemOutline problem={problem} fs={fs} />}
        {target && (
          <g className={`drag-ghost ${target.snap ? 'snapped' : ''}`} aria-hidden="true">
            <rect x={target.box.x} y={target.box.z} width={target.box.w} height={target.box.d} />
            <text x={target.box.x} y={target.box.z - fs * 0.5} fontSize={fs}>
              {t('From left {x} · From back {z} mm', {
                x: target.position.x,
                z: target.position.z,
              })}
            </text>
            {target.snap && (
              <text
                className="snap-label"
                x={target.box.x}
                y={target.box.z + target.box.d + fs * 1.2}
                fontSize={fs}
              >
                {[target.snap.label, ...target.snap.notes].join(' · ')}
              </text>
            )}
          </g>
        )}
        {placing && hover && (
          <rect
            className="place-ghost"
            x={hover.x}
            y={hover.z}
            width={placing.bounds.w}
            height={placing.bounds.d}
          />
        )}
        <Dim x1={x0} x2={x1} y={z1 + pad * 0.7} fontSize={dfs} label={`${x1 - x0}`} />
        <DimV y1={z0} y2={z1} x={x0 - pad * 0.6} fontSize={dfs} label={`${z1 - z0}`} />
        {sel && (
          <>
            <Dim
              x1={sel.x}
              x2={sel.x + sel.w}
              y={sel.z + sel.d + pad * 0.3}
              fontSize={dfs * 0.85}
              label={`${sel.w}`}
              subtle
            />
            <DimV
              y1={sel.z}
              y2={sel.z + sel.d}
              x={sel.x + sel.w + pad * 0.3}
              fontSize={dfs * 0.85}
              label={`${sel.d}`}
              subtle
            />
          </>
        )}
        {space && (
          <rect
            className="el-selection"
            x={space.x}
            y={space.z}
            width={space.w}
            height={space.d}
            aria-label={t('Selected space inside the piece')}
          />
        )}
        {/* The turn handle of the one selected piece (ADR-169); last in the drawing, so nothing covers its knob. */}
        {turnPc && (
          <TurnHandle
            pc={turnPc}
            fs={fs}
            turn={turn?.id === turnPc.item.id ? turn : null}
            onPress={(e) => {
              if (e.pointerType === 'mouse' && e.button !== 0) return;
              if (dragRef.current || turnRef.current) return;
              e.stopPropagation();
              const b = turnPc.bounds;
              const g = pressTurn(
                turnPc.item.id,
                { x: b.x + b.w / 2, z: b.z + b.d / 2 },
                rotationOf(turnPc.item),
                at(e),
              );
              if (!g) return;
              e.currentTarget.setPointerCapture?.(e.pointerId);
              justTapped.current = false;
              setTurn(g);
            }}
            onMove={(e) => {
              const g = turnRef.current;
              if (!g) return;
              const next = moveTurn(g, at(e), e.shiftKey);
              if (next !== g) setTurn(next);
            }}
            onRelease={(e) => {
              const g = turnRef.current;
              if (!g || e.pointerId !== g.pointerId) return;
              e.stopPropagation();
              const deg = releaseTurn(g, e.pointerId);
              setTurn(null);
              justTapped.current = true;
              window.setTimeout(() => (justTapped.current = false), 400);
              if (deg !== null) setRotation(turnPc.item.id, deg);
            }}
            onCancel={() => setTurn(null)}
          />
        )}
      </svg>
    </figure>
  );
}

/** "Locked" in a corner of a piece on the plan or the front view (ADR-095); `x`, `y` is the piece's top-left corner. */
function LockBadge({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <text
      className="lock-badge"
      x={x + size * 0.4}
      y={y + size * 0.4}
      fontSize={size}
      dominantBaseline="hanging"
    >
      {t('Locked')}
    </text>
  );
}

/** A value set's name over its pieces on the plan (ADR-167). */
function SetTags({ project, pm, fs }: { project: Project; pm: ProjectModel; fs: number }) {
  const sets = project.variableSets ?? [];
  if (!sets.length) return null;
  const rooms = new Map(setRooms(project).map((sr) => [sr.set.id, sr.room]));
  return (
    <>
      {sets.map((set) => {
        const pcs = pm.pieces.filter((pc) => pc.item.set?.id === set.id);
        const room = rooms.get(set.id);
        if (!pcs.length && !room) return null;
        const x = room
          ? Math.min(...room.outline.map((p) => p[0]))
          : Math.min(...pcs.map((pc) => pc.bounds.x));
        const z = room
          ? Math.min(...room.outline.map((p) => p[1]))
          : Math.min(...pcs.map((pc) => pc.bounds.z));
        return (
          <text key={set.id} className="set-tag" x={x} y={z - fs * 0.6} fontSize={fs * 1.1}>
            {set.name}
          </text>
        );
      })}
    </>
  );
}

/** The room on the plan (ADR-058/0056): walls with their numbers, door swings, windows and obstacles. */
function RoomOutline({ room, fs, traced }: { room: Room; fs: number; traced?: boolean }) {
  const n = room.outline.length;
  return (
    <g className="room-outline">
      {/* Over a plan picture the floor lets it show through (ADR-208); a floor background fills it. */}
      <polygon
        className={`room-floor${traced ? ' traced' : ''}`}
        points={room.outline.map((p) => p.join(',')).join(' ')}
      />
      <FloorFill room={room} />
      <WallBands room={room} />
      {room.outline.map((_, i) => {
        const [a, b] = wallEnds(room, i);
        return (
          <g key={i}>
            <line className="wall" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
            <text
              className="wall-label"
              x={(a[0] + b[0]) / 2}
              y={(a[1] + b[1]) / 2}
              fontSize={fs * 0.8}
              textAnchor="middle"
              dominantBaseline="middle"
            >{`${t('Wall {n}', { n: i + 1 })} · ${wallLength(room, i)}`}</text>
          </g>
        );
      })}
      {room.features.map((f) => {
        const b = featureBox(room, f);
        if (!b || (f.wall !== null && f.wall >= n)) return null;
        if (f.kind === 'obstacle')
          return (
            <rect key={f.id} className="room-obstacle" x={b.x} y={b.z} width={b.w} height={b.d}>
              <title>{tr(f.label)}</title>
            </rect>
          );
        if (f.kind === 'window')
          return (
            <rect key={f.id} className="room-window" x={b.x} y={b.z} width={b.w} height={b.d}>
              <title>{tr(f.label)}</title>
            </rect>
          );
        if (f.kind === 'pipe' || f.kind === 'outlet')
          return (
            <g key={f.id} className={`room-${f.kind}`}>
              <rect x={b.x} y={b.z} width={b.w} height={b.d}>
                <title>
                  {t('{label}: keep backs, plinths and worktops clear', { label: tr(f.label) })}
                </title>
              </rect>
              <text
                x={b.x + b.w / 2}
                y={b.z + b.d}
                fontSize={fs * 0.6}
                textAnchor="middle"
                dominantBaseline="hanging"
              >
                {tr(f.label)}
              </text>
            </g>
          );
        const sw = doorSwing(room, f);
        return (
          <g key={f.id}>
            {/* The area the check keeps free (as deep as the door is wide), drawn faintly. */}
            <rect className="room-door" x={b.x} y={b.z} width={b.w} height={b.d}>
              <title>{t('{label}: keep free for the swing', { label: tr(f.label) })}</title>
            </rect>
            {sw && (
              <path
                className="room-door-swing"
                d={`M ${sw.hinge.join(' ')} L ${sw.closed.join(' ')} A ${sw.radius} ${sw.radius} 0 0 ${sw.sweep} ${sw.open.join(' ')} Z`}
              >
                <title>{t('{label}: door swing', { label: tr(f.label) })}</title>
              </path>
            )}
          </g>
        );
      })}
    </g>
  );
}

/** The whole room seen from the front (looking at the back wall), floor at the bottom. Tap a piece to select it. */
export function RoomFront({ pm, card }: { pm: ProjectModel; card?: boolean }) {
  const space = useSpaceInRoom();
  // A space selected inside a piece: outlined, everything outside it faded (ADR-087 design A, G-071).
  const fade = (b: Box) => (space && !inSelection(space, b) ? ' faded' : '');
  const selectedId = useDesign((s) => s.selectedItemId);
  const select = useDesign((s) => s.selectItem);
  const tapItem = useDesign((s) => s.tapItem);
  // Several selected pieces (ADR-159): Select on, or Shift/Ctrl/Cmd, adds or removes the whole piece.
  const selectedIds = useDesign((s) => s.selectedItemIds);
  const multi = useDesign((s) => s.multiSelect);
  const setMulti = useDesign((s) => s.setMultiSelect);
  const toggleItem = useDesign((s) => s.toggleItem);
  const selectItems = useDesign((s) => s.selectItems);
  /** The selection box being drawn on empty front view (room mm, y up from the floor), or null (ADR-211, G-308). */
  const [box, setBoxState] = useState<{
    pointerId: number;
    a: { x: number; y: number };
    b: { x: number; y: number };
    add: boolean;
  } | null>(null);
  const boxRef = useRef<typeof box>(null);
  const setBox = (v: typeof box) => {
    boxRef.current = v;
    setBoxState(v);
  };
  const svgRef = useRef<SVGSVGElement>(null);
  const toFront = (e: { clientX: number; clientY: number }) => {
    const m = svgRef.current?.getScreenCTM();
    if (!m) return null;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: Math.round(pt.x), y: Math.round(-pt.y) };
  };
  /** The placed front-view boxes the project model holds (pieces and 3D models), for the box without a rebuild. */
  const placedBoxes = useMemo(
    () =>
      new Map<string, Box>([
        ...pm.pieces.map((pc) => [pc.item.id, pc.bounds] as [string, Box]),
        ...pm.models.map((m) => [m.item.id, m.box] as [string, Box]),
      ]),
    [pm.pieces, pm.models],
  );
  // A tap on the selected piece opens it with the space under the tap selected (ADR-083). Seen from the front, a
  // piece turned a quarter shows its side, so it opens with the whole piece selected.
  const tapFront = (e: MouseEvent<SVGRectElement>, item: ProjectItem) => {
    // The click that ends a height drag does nothing more (ADR-205).
    if (lifted.current) {
      lifted.current = false;
      return;
    }
    if (multi || e.shiftKey || e.ctrlKey || e.metaKey) return toggleItem(item.id);
    const m = e.currentTarget.ownerSVGElement?.getScreenCTM();
    if (!m || item.rotationY % 180 !== 0) return tapItem(item.id);
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    tapItem(item.id, { x: Math.round(pt.x), y: Math.round(-pt.y), z: item.position.z });
  };
  const showFronts = useDesign((s) => s.showFronts);
  const project = useDesign((s) => s.project);
  const room = project?.room;
  const rv = useMemo(() => (room ? roomFrontView(room) : null), [room]);
  // Dragging a selected wall unit up or down (ADR-205): through `setWallHeight` (ADR-122), one undo step on release;
  // with Snap on (Alt not held) its underside or top snaps to the worktop and wall-unit lines within 60 mm.
  const setItemHeight = useDesign((s) => s.setItemHeight);
  const [snapOn] = useSnap();
  const [lift, setLift] = useState<{ id: string; height: number; hint: string | null } | null>(
    null,
  );
  const liftRef = useRef<{
    id: string;
    pointerId: number;
    sy: number;
    y0: number;
    start: number;
    dragging: boolean;
  } | null>(null);
  const lifted = useRef(false);
  const svgY = (e: { clientX: number; clientY: number }, el: SVGGraphicsElement) => {
    const m = el.ownerSVGElement?.getScreenCTM();
    return m ? new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()).y : null;
  };
  const pressLift = (e: React.PointerEvent<SVGRectElement>, pc: PlacedPiece) => {
    if (!project || e.button !== 0 || multi || e.shiftKey || e.ctrlKey || e.metaKey) return;
    if (!selectedIds.includes(pc.item.id) || pc.item.placement?.kind !== 'wall') return;
    if (!heightDraggable(project, pc.item.id)) return;
    const y0 = svgY(e, e.currentTarget);
    if (y0 === null) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    liftRef.current = {
      id: pc.item.id,
      pointerId: e.pointerId,
      sy: e.clientY,
      y0,
      start: pc.item.placement.height,
      dragging: false,
    };
  };
  const moveLift = (e: React.PointerEvent<SVGRectElement>) => {
    const g = liftRef.current;
    if (!g || e.pointerId !== g.pointerId || !project || !pm) return;
    g.dragging ||= Math.abs(e.clientY - g.sy) > DRAG_THRESHOLD_PX;
    if (!g.dragging) return;
    const y = svgY(e, e.currentTarget);
    if (y === null) return;
    // The view's y runs down; up is a higher hanging height.
    const free = dragHeight(g.start, g.y0 - y);
    const snapped =
      snapOn && !e.altKey
        ? snapWallHeight(project, pm.pieces, g.id, free)
        : { height: free, hint: null };
    setLift({ id: g.id, ...snapped });
  };
  const endLift = (e: React.PointerEvent<SVGRectElement>, commit: boolean) => {
    const g = liftRef.current;
    if (!g || e.pointerId !== g.pointerId) return;
    liftRef.current = null;
    const at = lift;
    setLift(null);
    if (!g.dragging) return;
    lifted.current = true;
    if (commit && at?.id === g.id && at.height !== g.start) setItemHeight(g.id, at.height);
  };
  // Back-wall backgrounds (ADR-145): floor to room height behind the pieces against them; a picture covers its
  // rectangle once, straightened when asked, its average colour around it, as in 3D (ADR-146).
  const wallUrls = useWallPictureUrls(room?.walls ?? NO_WALLS);
  const bgId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const backs = (rv?.walls ?? []).flatMap((w) => {
    const f = room && wallFinish(room, w.wall);
    if (!f) return [];
    const url = f.image ? wallUrls.get(pictureKey(f.image)) : undefined;
    const rect = room && f.image ? pictureRect(room, w.wall, f.image) : null;
    return [{ ...w, f, rect, url: url && url !== 'missing' ? url : undefined }];
  });
  const colors = useMemo(
    () =>
      new Map(
        pm.pieces.flatMap((pc) =>
          pc.item.design.materials.map((m) => [`${pc.item.id}:${m.id}`, m.color] as const),
        ),
      ),
    [pm.pieces],
  );
  const b = pm.extent;
  const x0 = Math.min(0, b.x, rv?.x0 ?? 0),
    x1 = Math.max(b.x + b.w, rv?.x1 ?? 0),
    top = Math.max(b.y + b.h, rv?.height ?? 0);
  const span = Math.max(x1 - x0, top, 1000);
  const pad = span * 0.1,
    dfs = span / 32;
  const Y = (y: number, h: number) => -(y + h);
  // Painted back to front so nearer panels cover the ones behind them.
  const parts = pm.pieces.flatMap((pc) =>
    pc.panels.filter((p) => !DRAWER_BOX.has(p.role)).map((p) => ({ p, pc })),
  );
  const structure = parts
    .filter(({ p }) => !FRONTS.has(p.role))
    .sort((a, c) => a.p.box.z + a.p.box.d - (c.p.box.z + c.p.box.d));
  const fronts = parts.filter(({ p }) => FRONTS.has(p.role));
  const sel =
    pm.pieces.find((p) => p.item.id === selectedId)?.bounds ??
    pm.models.find((m) => m.item.id === selectedId)?.box;
  // Quick counts show over the selected piece from the first tap (ADR-109), as over a single piece's drawing
  // (ADR-084): counts only, in the corner of the view farthest from the selected piece, its size labels and the ⓘ
  // button (ADR-112). Width and Depth stay in the side panel and the bottom sheet.
  const counts = useDesign(
    (s) =>
      !!card &&
      !s.editingItemId &&
      !!s.drillItemId &&
      s.drillItemId === s.selectedItemId &&
      s.selectedItemIds.length <= 1,
  );
  const figRef = useRef<HTMLElement>(null);
  const anchorRef = useRef<SVGRectElement>(null);
  const selDimsRef = useRef<SVGGElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [tick, setTick] = useState(0);
  useLayoutEffect(() => {
    const fig = figRef.current;
    if (!fig || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setTick((t) => t + 1));
    ro.observe(fig);
    return () => ro.disconnect();
  }, []);
  const at = counts
    ? (space ?? (pm.pieces.some((p) => p.item.id === selectedId) ? sel : null))
    : null;
  useLayoutEffect(() => {
    const fig = figRef.current,
      a = anchorRef.current,
      st = cardRef.current;
    if (!fig || !a || !st) return setPos(null);
    const f = fig.getBoundingClientRect();
    const next = cardCorner(f.width, f.height, st.offsetWidth, st.offsetHeight, [
      ...boxIn(f, a, 4),
      ...boxIn(f, selDimsRef.current, 2),
      ...boxIn(f, fig.querySelector(':scope > .info-tip'), 2),
    ]);
    setPos((p) => (p && p.left === next.left && p.top === next.top ? p : next));
  }, [at?.x, at?.y, at?.w, at?.h, tick, pm]);
  return (
    <figure
      className="plan with-tools"
      ref={figRef}
      aria-label={t('Room seen from the front. Select a piece.')}
    >
      <div className="plan-tools">
        {/* The plan's Select (ADR-097), shared: taps add and remove pieces (ADR-159). */}
        <Toggle label={t('Select')} checked={multi} onChange={setMulti} />
        <SelectTip box />
      </div>
      {lift && (
        <span className="plan-drag-note" role="status">
          {lift.hint ?? heightLabel(lift.height)}
        </span>
      )}
      <InfoTip label={t('About the front view')}>
        {t('Seen from the front. Sizes in mm: overall in yellow, the selected piece in green.')}{' '}
        {t('Drag up or down to change the height')}
        {rv &&
          ` ${t('The room height and the doors, windows and obstacles on the back wall are outlined.')}`}
      </InfoTip>
      <svg
        ref={svgRef}
        viewBox={`${x0 - pad * 1.2} ${-top - pad * 0.8} ${x1 - x0 + pad * 2.4} ${top + pad * 1.8}`}
        className={multi ? 'selecting' : undefined}
        // The plan's box rules (ADR-097) in the front view (ADR-211): a press on empty space with a mouse or pen, or
        // with Select on, draws a box; Shift/Ctrl/Cmd adds to the selection.
        onPointerMove={(e) => {
          const bx = boxRef.current;
          if (bx && e.pointerId === bx.pointerId) {
            const p = toFront(e);
            if (p) setBox({ ...bx, b: p });
          }
        }}
        onPointerDown={(e) => {
          if (boxRef.current && e.pointerId !== boxRef.current.pointerId) setBox(null);
          const onPiece = (e.target as Element).closest?.('.front-hit, .front-model');
          if (onPiece || boxRef.current) return;
          if (e.pointerType === 'touch' && !multi) return;
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          const p = toFront(e);
          if (!p) return;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          setBox({ pointerId: e.pointerId, a: p, b: p, add: e.shiftKey || e.ctrlKey || e.metaKey });
        }}
        onPointerUp={(e) => {
          const bx = boxRef.current;
          if (!bx || e.pointerId !== bx.pointerId || !project) return;
          setBox(null);
          // A press without a drag is not a box.
          if (Math.abs(bx.a.x - bx.b.x) < 1 && Math.abs(bx.a.y - bx.b.y) < 1) return;
          const hit = itemsInFrontBox(project, bx.a, bx.b, placedBoxes);
          selectItems(bx.add ? [...selectedIds, ...hit] : hit);
        }}
        onPointerCancel={() => setBox(null)}
      >
        <rect className="floor" x={x0 - pad} y={0} width={x1 - x0 + 2 * pad} height={pad * 0.15} />
        {backs.length > 0 && (
          <g className="room-wall-bg" aria-hidden="true">
            <defs>
              {backs.map((w) => (
                <clipPath key={w.wall} id={`${bgId}-wall-${w.wall}`}>
                  <rect x={w.x} y={-rv!.height} width={w.w} height={rv!.height} />
                </clipPath>
              ))}
            </defs>
            {backs.map((w) => (
              <g key={w.wall} clipPath={`url(#${bgId}-wall-${w.wall})`}>
                <rect
                  x={w.x}
                  y={-rv!.height}
                  width={w.w}
                  height={rv!.height}
                  style={{ fill: w.f.colour }}
                />
                {w.url && w.rect && (
                  <image
                    className="wall-picture"
                    href={w.url}
                    x={w.x + w.rect.x}
                    y={-(w.rect.y + w.rect.h)}
                    width={w.rect.w}
                    height={w.rect.h}
                    preserveAspectRatio="none"
                  />
                )}
              </g>
            ))}
          </g>
        )}
        {rv && (
          <g className="room-front">
            <line className="room-ceiling" x1={rv.x0} y1={-rv.height} x2={rv.x1} y2={-rv.height}>
              <title>{t('Room height {h}', { h: rv.height })}</title>
            </line>
            {rv.features.map((f) => (
              <rect
                key={f.id}
                className={`room-${f.kind}`}
                x={f.x}
                y={Y(f.y, f.h)}
                width={f.w}
                height={f.h}
              >
                <title>{t('{label} on the back wall', { label: tr(f.label) })}</title>
              </rect>
            ))}
          </g>
        )}
        {structure.map(({ p, pc }) => (
          <polygon
            key={p.id}
            className={`el-panel ${selectedIds.includes(pc.item.id) && !space ? 'hl' : ''}${fade(p.box)}`}
            points={outlinePoints(p)}
            style={{ fill: colors.get(`${pc.item.id}:${p.materialId}`) }}
          />
        ))}
        {showFronts &&
          fronts.map(({ p }) => (
            <polygon key={p.id} className={`el-front${fade(p.box)}`} points={outlinePoints(p)} />
          ))}
        {pm.pieces.map((pc) => (
          <rect
            key={pc.item.id}
            className="front-hit"
            x={pc.bounds.x}
            y={Y(pc.bounds.y, pc.bounds.h)}
            width={pc.bounds.w}
            height={pc.bounds.h}
            role="button"
            tabIndex={0}
            aria-pressed={selectedIds.includes(pc.item.id)}
            aria-label={t('{name}, {w} wide, {h} high', {
              name: tr(pc.item.design.name),
              w: pc.bounds.w,
              h: pc.bounds.h,
            })}
            onClick={(e) => tapFront(e, pc.item)}
            onKeyDown={onKey(() => select(pc.item.id))}
            onPointerDown={(e) => pressLift(e, pc)}
            onPointerMove={moveLift}
            onPointerUp={(e) => endLift(e, true)}
            onPointerCancel={(e) => endLift(e, false)}
          />
        ))}
        {lift &&
          (() => {
            const pc = pm.pieces.find((x) => x.item.id === lift.id);
            if (!pc) return null;
            const b = pc.bounds;
            return (
              <rect
                className="lift-ghost"
                x={b.x}
                y={Y(lift.height, b.h)}
                width={b.w}
                height={b.h}
                aria-hidden="true"
              />
            );
          })()}
        {pm.pieces
          .filter(
            (pc) => isLocked(pc.item) || isTurnLocked(pc.item) || lockedAxes(pc.item).length > 0,
          )
          .map((pc) => (
            <LockBadge
              key={`lock-${pc.item.id}`}
              x={pc.bounds.x}
              y={Y(pc.bounds.y, pc.bounds.h)}
              size={Math.min(span / 40, pc.bounds.w / 7)}
            />
          ))}
        {box && (
          <rect
            className="select-box"
            x={Math.min(box.a.x, box.b.x)}
            y={-Math.max(box.a.y, box.b.y)}
            width={Math.abs(box.b.x - box.a.x)}
            height={Math.abs(box.b.y - box.a.y)}
            aria-hidden="true"
          />
        )}
        {project && <FrontConnectionTicks project={project} pieces={pm.pieces} fs={span / 40} />}
        <FrontModels pm={pm} fs={span / 40} />
        <Dim x1={x0} x2={x1} y={pad * 0.6} fontSize={dfs} label={`${x1 - x0}`} />
        <DimV y1={0} y2={-top} x={x0 - pad * 0.6} fontSize={dfs} label={`${top}`} />
        {sel && (
          <g ref={selDimsRef}>
            <Dim
              x1={sel.x}
              x2={sel.x + sel.w}
              y={Y(sel.y, sel.h) - pad * 0.3}
              fontSize={dfs * 0.85}
              label={`${sel.w}`}
              subtle
            />
            <DimV
              y1={-sel.y}
              y2={Y(sel.y, sel.h)}
              x={sel.x + sel.w + pad * 0.3}
              fontSize={dfs * 0.85}
              label={`${sel.h}`}
              subtle
            />
          </g>
        )}
        {space && (
          <rect
            className="el-selection"
            x={space.x}
            y={-(space.y + space.h)}
            width={space.w}
            height={space.h}
            aria-label={t('Selected space inside the piece')}
          />
        )}
        {at && (
          <rect
            ref={anchorRef}
            x={at.x}
            y={-(at.y + at.h)}
            width={at.w}
            height={at.h}
            fill="none"
            pointerEvents="none"
          />
        )}
      </svg>
      {at && (
        <CountStepper
          ref={cardRef}
          className="floating"
          compact
          style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }}
        />
      )}
    </figure>
  );
}
