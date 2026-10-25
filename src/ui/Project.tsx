import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { projectBoards, roleBoard, type FinishRole, type FinishScope } from '../core/finish';
import { decorPatch, type Decor } from '../core/materials';
import { mergeCandidates } from '../core/merge';
import {
  dragPosition,
  leftNeighbour,
  materialKey,
  placementBases,
  planRuns,
  runOf,
  type Placement,
  type ProjectItem,
  type ProjectModel,
  type QuarterTurn,
} from '../core/project';
import type { Material, Panel } from '../core/types';
import { listDecors, listDesigns, loadDesign, type StoredDesign } from '../persist/db';
import { useDesign } from '../store/designStore';
import { Counter, MmField, Segmented, Select, Toggle } from './controls';
import {
  arrowMove,
  movePointer,
  pressPiece,
  releasePointer,
  type DragGesture,
  type PointerAt,
} from './planDrag';
import {
  DEFAULT_ROOM_HEIGHT,
  doorSwing,
  featureBox,
  outlineIssues,
  roomFrontView,
  setWallLength,
  shapeOutline,
  wallEnds,
  wallLength,
  type Room,
  type RoomFeature,
  type RoomShape,
  type ShapeSizes,
} from '../core/room';
import { newId } from '../core/design';
import { Dim, DimV, outlinePoints } from './Elevation';
import { Icon } from './icons';
import { templateGlyph } from './Templates';
import { StartFrom } from './Catalog';
import { askConfirm } from './Confirm';
import { SaveProjectTemplate } from './ProjectTemplates';
import {
  ProblemBanner,
  ProblemOutline,
  useFocusedProblem,
  type FocusedProblem,
} from './ProblemBanner';
import { useProblem } from './problemStore';

const FRONT_SIDE: Record<QuarterTurn, string> = {
  0: 'front faces you',
  90: 'front faces right',
  180: 'front faces the back wall',
  270: 'front faces left',
};

/** Left panel in the project view: the pieces, and the one selected (ADR-022). */
/**
 * The project editor for one editor mode (ADR-079). Compose: the pieces, where they stand and the room. Configure:
 * what applies to the whole project (run parts, saw cut, saving it as a template).
 */
export function ProjectPanel({
  onAdd,
  mode,
}: {
  onAdd: () => void;
  mode: 'compose' | 'configure';
}) {
  const project = useDesign((s) => s.project)!;
  const pm = useDesign((s) => s.projectModel);
  const selectedId = useDesign((s) => s.selectedItemId);
  const select = useDesign((s) => s.selectItem);
  const update = useDesign((s) => s.updateItem);
  const remove = useDesign((s) => s.removeItem);
  const edit = useDesign((s) => s.editItem);
  const updateProject = useDesign((s) => s.updateProject);
  const setGap = useDesign((s) => s.setGap);
  const [libMsg, setLibMsg] = useState<string | null>(null);
  const [moveRight, setMoveRight] = useState(true);
  const item = project.items.find((i) => i.id === selectedId);
  const left = useMemo(
    () => (selectedId ? leftNeighbour(project, selectedId) : null),
    [project, selectedId],
  );
  const piece = pm?.pieces.find((p) => p.item.id === selectedId);

  const updateFromLibrary = async () => {
    if (!item?.libraryId) return;
    const d = await loadDesign(item.libraryId).catch(() => undefined);
    if (!d) {
      setLibMsg('The saved piece this came from no longer exists.');
      return;
    }
    if (
      !(await askConfirm(
        `Replace “${item.design.name}” in this project with the current saved version? Position, turn and quantity stay.`,
        { confirmLabel: 'Replace' },
      ))
    )
      return;
    update(item.id, { design: structuredClone(d) });
    setLibMsg('Updated from the saved piece.');
  };

  if (mode === 'configure')
    return (
      <div className="inspector">
        <header className="insp-head">
          <h2>Project settings</h2>
          <p className="hint">These apply to every piece in {project.name}.</p>
        </header>
        <RunParts />
        <MmField
          label="Saw cut (kerf) for this project"
          value={project.cutting?.kerf ?? 4}
          min={0}
          max={20}
          step={1}
          onChange={(v) => updateProject((p) => ({ ...p, cutting: { kerf: v } }))}
        />
        <SaveProjectTemplate />
      </div>
    );

  return (
    <div className="inspector">
      <header className="insp-head">
        <h2>Project</h2>
        <p className="hint">
          Pieces are cut and bought together. Each piece is a copy; editing it here never changes
          your saved pieces.
        </p>
      </header>
      {item && (
        <section className="piece-edit section" aria-label={`Selected piece: ${item.design.name}`}>
          <div className="card-title">
            <span>Selected piece</span>
          </div>
          <h3>{item.design.name}</h3>
          <div className="split-actions">
            <button type="button" className="btn solid" onClick={() => edit(item.id)}>
              <Icon name="pencil" className="sm" />
              Edit this piece
            </button>
            {item.libraryId && (
              <button type="button" className="btn outline" onClick={updateFromLibrary}>
                Update from saved piece
              </button>
            )}
          </div>
          {libMsg && (
            <p className="hint" role="status">
              {libMsg}
            </p>
          )}
          <Counter
            label="How many"
            value={item.quantity}
            min={1}
            max={99}
            onChange={(v) => update(item.id, { quantity: v })}
          />
          {item.quantity > 1 && (
            <p className="hint">
              Copies are added to parts, sheets and hardware; one is shown in the room.
            </p>
          )}
          <Segmented<QuarterTurn>
            label="Turn"
            value={item.rotationY}
            options={[
              { value: 0, label: '0°' },
              { value: 90, label: '90°' },
              { value: 180, label: '180°' },
              { value: 270, label: '270°' },
            ]}
            onChange={(v) => update(item.id, { rotationY: v })}
          />
          <p className="hint">{FRONT_SIDE[item.rotationY]}</p>
          <PlacementFields item={item} />
          {item.placement?.kind === 'above' ? null : left ? (
            <>
              <MmField
                label={`Gap to ${left.item.design.name} on the left`}
                value={left.gap}
                min={0}
                max={5000}
                onChange={(v) => setGap(item.id, v, moveRight)}
              />
              <Toggle
                label="Move the pieces on its right too"
                checked={moveRight}
                onChange={setMoveRight}
              />
            </>
          ) : (
            <p className="hint">
              No piece on its left at this height; set “From left” to place it.
            </p>
          )}
          <FinishFields item={item} />
          <MergeFields item={item} />
          {piece && (
            <p className="hint">
              Takes {piece.bounds.w} × {piece.bounds.d} mm of floor, {piece.bounds.h} mm high.
            </p>
          )}
          <button
            type="button"
            className="danger-link"
            onClick={async () => {
              if (
                await askConfirm(`Remove “${item.design.name}” from this project?`, {
                  confirmLabel: 'Remove',
                  danger: true,
                })
              )
                remove(item.id);
            }}
          >
            Remove from project
          </button>
        </section>
      )}
      {project.items.length === 0 ? (
        <p className="empty center">
          <Icon name="project" />
          No pieces yet. Add a cabinet, a corner unit or a desk to start.
        </p>
      ) : (
        <ul className="pieces">
          {project.items.map((i) => {
            const b = pm?.pieces.find((p) => p.item.id === i.id)?.bounds;
            return (
              <li key={i.id}>
                <button
                  type="button"
                  className={`row-btn ${i.id === selectedId ? 'on' : ''}`}
                  aria-pressed={i.id === selectedId}
                  onClick={() => select(i.id)}
                >
                  <span>
                    <strong>
                      {i.quantity > 1 ? `${i.quantity} × ` : ''}
                      {i.design.name}
                    </strong>
                    {b && (
                      <span className="sub num">
                        {b.w} × {b.h} × {b.d} mm
                      </span>
                    )}
                  </span>
                  <Icon name="chevron-right" className="chev sm" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <button type="button" className="btn outline block" onClick={onAdd}>
        <Icon name="plus" />
        Add a piece
      </button>
      <RoomSection />
    </div>
  );
}

/** Finish scope (ADR-055): one board on the fronts or the carcass of this piece, its run or the whole project. */
function FinishFields({ item }: { item: ProjectItem }) {
  const project = useDesign((s) => s.project)!;
  const apply = useDesign((s) => s.applyFinish);
  const [role, setRole] = useState<FinishRole>('front');
  const [scope, setScope] = useState<FinishScope>('piece');
  const [boardKey, setBoardKey] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [decors, setDecors] = useState<Decor[]>([]);
  useEffect(() => {
    listDecors()
      .then(setDecors)
      .catch(() => setDecors([]));
  }, []);
  const boards = useMemo(() => projectBoards(project), [project]);
  const run = useMemo(() => runOf(project, item.id), [project, item.id]);
  const currentId = roleBoard(item.design, role);
  const current = item.design.materials.find((m) => m.id === currentId);
  const options = [
    ...boards.map((m) => ({ value: materialKey(m), label: `${m.name}, ${m.thickness} mm` })),
    ...decors.map((d) => ({
      value: `decor:${d.id}`,
      label: `${d.makerText} ${d.code} ${d.name}, ${d.thickness} mm (your list)`,
    })),
  ];
  const chosen = boardKey || (current ? materialKey(current) : (options[0]?.value ?? ''));
  const boardOf = (k: string): Material | null => {
    if (k.startsWith('decor:')) {
      const d = decors.find((x) => `decor:${x.id}` === k);
      return d
        ? ({
            id: 'decor',
            grain: current?.grain ?? false,
            ...(current?.sheet ? { sheet: current.sheet } : {}),
            ...decorPatch(d),
          } as Material)
        : null;
    }
    return boards.find((m) => materialKey(m) === k) ?? null;
  };
  const go = () => {
    const b = boardOf(chosen);
    if (!b) return;
    const r = apply(item.id, role, b, scope);
    setMsg(
      r.applied.length
        ? `Applied to ${r.applied.length} ${r.applied.length === 1 ? 'piece' : 'pieces'}${r.skipped.length ? `, ${r.skipped.length} skipped: ${r.skipped.join('; ')}` : ''}.`
        : `Nothing changed: ${r.skipped.join('; ') || 'no piece reached'}.`,
    );
  };
  return (
    <div className="finish-fields">
      <h4>Finish</h4>
      <Segmented<FinishRole>
        label="Parts"
        value={role}
        options={[
          { value: 'front', label: 'Fronts' },
          { value: 'body', label: 'Carcass' },
        ]}
        onChange={(v) => {
          setRole(v);
          setBoardKey('');
          setMsg(null);
        }}
      />
      {currentId === null ? (
        <p className="hint">
          This piece has no {role === 'front' ? 'fronts' : 'carcass'}; “Whole project” still reaches
          the others.
        </p>
      ) : null}
      <Select
        label="Board"
        value={chosen}
        options={options}
        onChange={(v) => {
          setBoardKey(v);
          setMsg(null);
        }}
      />
      <Segmented<FinishScope>
        label="Apply to"
        value={scope}
        onChange={(v) => {
          setScope(v);
          setMsg(null);
        }}
        options={[
          { value: 'piece', label: 'This piece' },
          ...(run && run.length > 1 ? [{ value: 'run' as const, label: 'This run' }] : []),
          { value: 'project', label: 'Whole project' },
        ]}
      />
      <button type="button" className="btn outline" onClick={go} disabled={!options.length}>
        Apply finish
      </button>
      {msg && (
        <p className="hint" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}

/** Merge the selected piece with a cabinet touching it on the left or right (ADR-047). */
function MergeFields({ item }: { item: ProjectItem }) {
  const project = useDesign((s) => s.project)!;
  const merge = useDesign((s) => s.mergeItems);
  const candidates = useMemo(() => mergeCandidates(project, item.id), [project, item.id]);
  return (
    <div className="merge-fields">
      <h4>Merge into one piece</h4>
      {candidates.length === 0 ? (
        <p className="hint">
          Nothing touches it on the left or right. Set the gap to 0 next to another cabinet to merge
          the two.
        </p>
      ) : (
        candidates.map((c) => (
          <div key={c.item.id}>
            <button
              type="button"
              className="btn outline"
              disabled={c.issues.length > 0}
              onClick={async () => {
                const [l, r] = c.side === 'right' ? [item, c.item] : [c.item, item];
                if (
                  !(await askConfirm(
                    `Merge “${l.design.name}” and “${r.design.name}” into one cabinet? The two sides that meet become one divider; each keeps its contents and fronts. Undo brings the two pieces back.`,
                    { confirmLabel: 'Merge' },
                  ))
                )
                  return;
                merge(item.id, c.item.id);
              }}
            >
              Merge with {c.item.design.name} on the {c.side}
            </button>
            {c.issues.length > 0 && (
              <ul className="hint" role="note">
                {c.issues.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            )}
          </div>
        ))
      )}
    </div>
  );
}

type PlacementKind = Placement['kind'] | 'free';

/** Where the selected piece sits: on the floor, on the wall, on or above another piece, or anywhere (ADR-031). */
function PlacementFields({ item }: { item: ProjectItem }) {
  const project = useDesign((s) => s.project)!;
  const update = useDesign((s) => s.updateItem);
  const bases = useMemo(() => placementBases(project, item.id), [project, item.id]);
  const pl = item.placement;
  const kind: PlacementKind = pl?.kind ?? 'free';
  const pos = item.position;
  const setPlacement = (next: PlacementKind) => {
    if (next === 'free') {
      update(item.id, { placement: undefined });
      return;
    }
    if (next === 'floor') update(item.id, { placement: { kind: 'floor' } });
    else if (next === 'wall')
      update(item.id, { placement: { kind: 'wall', height: pos.y > 0 ? pos.y : 1450 } });
    else if (bases.length)
      update(item.id, { placement: { kind: 'above', baseId: bases[0].id, gap: 0, offsetX: 0 } });
  };
  const xz = (
    <div className="dims2">
      <MmField
        label="From left"
        value={pos.x}
        min={-20000}
        max={20000}
        onChange={(v) => update(item.id, { position: { ...pos, x: v } })}
      />
      <MmField
        label="From back"
        value={pos.z}
        min={-20000}
        max={20000}
        onChange={(v) => update(item.id, { position: { ...pos, z: v } })}
      />
    </div>
  );
  return (
    <>
      <Segmented<PlacementKind>
        label="Placed"
        value={kind}
        onChange={setPlacement}
        options={[
          { value: 'floor', label: 'Floor', title: 'Stands on the floor' },
          { value: 'wall', label: 'Wall', title: 'Hung on the wall at a height' },
          ...(bases.length
            ? [
                {
                  value: 'above' as const,
                  label: 'On a piece',
                  title: 'Stands on, or hangs above, another piece and follows it',
                },
              ]
            : []),
          { value: 'free', label: 'Anywhere', title: 'Set all three distances yourself' },
        ]}
      />
      {kind === 'floor' && xz}
      {kind === 'wall' && pl?.kind === 'wall' && (
        <>
          {xz}
          <MmField
            label="Underside above the floor"
            value={pl.height}
            min={0}
            max={3000}
            onChange={(v) => update(item.id, { placement: { ...pl, height: v } })}
          />
        </>
      )}
      {kind === 'above' && pl?.kind === 'above' && (
        <>
          <Select
            label="On or above"
            value={pl.baseId}
            options={bases.map((b) => ({ value: b.id, label: b.design.name }))}
            onChange={(v) => update(item.id, { placement: { ...pl, baseId: v } })}
          />
          <div className="dims2">
            <MmField
              label="Gap above it"
              value={pl.gap}
              min={0}
              max={3000}
              onChange={(v) => update(item.id, { placement: { ...pl, gap: v } })}
              hint="0 = stands on it"
            />
            <MmField
              label="From its left edge"
              value={pl.offsetX}
              min={-5000}
              max={5000}
              onChange={(v) => update(item.id, { placement: { ...pl, offsetX: v } })}
            />
          </div>
          <p className="hint">Backs line up; it moves with the piece below.</p>
        </>
      )}
      {kind === 'free' && (
        <div className="dims3">
          <MmField
            label="From left"
            value={pos.x}
            min={-20000}
            max={20000}
            onChange={(v) => update(item.id, { position: { ...pos, x: v } })}
          />
          <MmField
            label="From back"
            value={pos.z}
            min={-20000}
            max={20000}
            onChange={(v) => update(item.id, { position: { ...pos, z: v } })}
          />
          <MmField
            label="Above floor"
            value={pos.y}
            min={0}
            max={3000}
            onChange={(v) => update(item.id, { position: { ...pos, y: v } })}
          />
        </div>
      )}
    </>
  );
}

const FRONTS = new Set<Panel['role']>(['door', 'drawer-front']);
const DRAWER_BOX = new Set<Panel['role']>([
  'drawer-side',
  'drawer-back',
  'drawer-inner-front',
  'drawer-bottom',
]);

const onKey = (f: () => void) => (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    f();
  }
};

/** The project drawing: the plan from above, and the whole room seen from the front below it. */
export function PlanView() {
  const pm = useDesign((s) => s.projectModel);
  const placingId = useDesign((s) => s.placingItemId);
  const stop = useDesign((s) => s.stopPlacing);
  // Cancel takes the just-added piece out again: a project undo, which also ends placing.
  const undoProject = useDesign((s) => s.undoProject);
  const ref = useRef<HTMLDivElement>(null);
  const placing = pm?.pieces.find((pc) => pc.item.id === placingId);
  const drawing = useDesign((s) => s.drawingRoom);
  const hasRoom = useDesign((s) => !!s.project?.room);
  const finishDraw = useDesign((s) => s.finishDrawRoom);
  const cancelDraw = useDesign((s) => s.cancelDrawRoom);
  useEffect(() => {
    if (placingId || drawing) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [placingId, drawing]);
  // A check tapped under Checks (ADR-071): bring the plan, with the problem and its repairs, into view.
  const problem = useFocusedProblem();
  const tapped = useProblem((s) => s.tapped);
  const seenTap = useRef(tapped);
  useEffect(() => {
    if (tapped === seenTap.current) return;
    seenTap.current = tapped;
    ref.current?.scrollIntoView({ block: 'start' });
  }, [tapped]);
  if (!pm || (!pm.pieces.length && !hasRoom && !drawing))
    return (
      <div className="no-3d">
        <p>Add pieces to see them on the plan.</p>
      </div>
    );
  return (
    <div className={`plan-views ${placing || drawing ? 'placing' : ''}`} ref={ref}>
      {drawing && (
        <div className="place-banner" role="status">
          <span>
            Tap the corners of the room, going round it ({drawing.length} so far). Walls snap along
            the room.
          </span>
          <button
            type="button"
            className="btn sm"
            disabled={drawing.length < 3}
            onClick={finishDraw}
          >
            Close the room
          </button>
          <button type="button" className="btn sm ghost" onClick={cancelDraw}>
            Cancel
          </button>
        </div>
      )}
      {placing && (
        <div className="place-banner" role="status">
          <span>
            Tap the plan to place <strong>{placing.item.design.name}</strong>
          </span>
          <button type="button" className="btn sm" onClick={stop}>
            Place to the right
          </button>
          <button type="button" className="btn sm ghost" onClick={undoProject}>
            Cancel
          </button>
        </div>
      )}
      {problem && !placing && !drawing && <ProblemBanner problem={problem} />}
      <RoomPlan pm={pm} problem={problem} />
      {/* While a problem is shown the plan takes the room the front view had (ADR-071). */}
      {pm.pieces.length > 0 && !(problem && !placing && !drawing) && <RoomFront pm={pm} />}
    </div>
  );
}

/**
 * Top-down plan of the room: x to the right, the back wall at the top. Tap a piece to select it; drag it, or use
 * the arrow keys on it, to move it (ADR-065).
 */
function RoomPlan({ pm, problem }: { pm: ProjectModel; problem?: FocusedProblem | null }) {
  const selectedId = useDesign((s) => s.selectedItemId);
  const select = useDesign((s) => s.selectItem);
  const placingId = useDesign((s) => s.placingItemId);
  const placeAt = useDesign((s) => s.placeAt);
  const [hover, setHover] = useState<{ x: number; z: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const placing = pm.pieces.find((pc) => pc.item.id === placingId);
  const room = useDesign((s) => s.project?.room);
  const drawing = useDesign((s) => s.drawingRoom);
  const addCorner = useDesign((s) => s.addRoomCorner);
  const tapping = !!placing || !!drawing;
  const moveItemBy = useDesign((s) => s.moveItemBy);
  /** The press or drag in progress (ADR-065); the ref keeps pointer handlers in step between renders. */
  const [pressed, setDragState] = useState<DragGesture | null>(null);
  // Tap modes (placing a new piece, drawing the room) turn dragging off (ADR-056, ADR-059).
  const drag = tapping ? null : pressed;
  const dragRef = useRef<DragGesture | null>(null);
  const setDrag = (g: DragGesture | null) => {
    dragRef.current = g;
    setDragState(g);
  };
  useEffect(() => {
    if (!drag) return;
    const onEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setDrag(null);
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [drag]);
  // Chrome ignores `touch-action` on SVG shapes, so a touch drag on a piece would start a page scroll and cancel the
  // pointer. While a piece is pressed, touchmove is prevented (non-passive) so the drag keeps the pointer.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onMove = (e: TouchEvent) => {
      if (dragRef.current) e.preventDefault();
    };
    svg.addEventListener('touchmove', onMove, { passive: false });
    return () => svg.removeEventListener('touchmove', onMove);
  }, []);
  /** Screen point → room mm on the plan (x along the back wall, z away from it). */
  const toRoom = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current,
      m = svg?.getScreenCTM();
    if (!svg || !m) return null;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: Math.round(pt.x), z: Math.round(pt.y) };
  };
  const at = (e: { pointerId: number; clientX: number; clientY: number }): PointerAt => ({
    pointerId: e.pointerId,
    sx: e.clientX,
    sy: e.clientY,
    room: toRoom(e),
  });
  const dragged = drag?.dragging ? pm.pieces.find((pc) => pc.item.id === drag.id) : undefined;
  const dropAt = dragged && drag ? dragPosition(dragged.item, drag.dx, drag.dz) : null;
  const pts = [...(room?.outline ?? []), ...(drawing ?? [])];
  const xs = [
      ...pm.pieces.flatMap((p) => [p.bounds.x, p.bounds.x + p.bounds.w]),
      ...pts.map((p) => p[0]),
    ],
    zs = [
      ...pm.pieces.flatMap((p) => [p.bounds.z, p.bounds.z + p.bounds.d]),
      ...pts.map((p) => p[1]),
    ];
  const x0 = Math.min(0, ...xs),
    x1 = Math.max(1000, ...xs),
    z0 = Math.min(0, ...zs),
    z1 = Math.max(1000, ...zs);
  const span = Math.max(x1 - x0, z1 - z0, 1000);
  const pad = span * 0.1,
    fs = span / 40,
    dfs = span / 32;
  const sel = pm.pieces.find((p) => p.item.id === selectedId)?.bounds;
  const frontLine = (b: { x: number; z: number; w: number; d: number }, r: QuarterTurn) =>
    r === 0
      ? [b.x, b.z + b.d, b.x + b.w, b.z + b.d]
      : r === 90
        ? [b.x + b.w, b.z, b.x + b.w, b.z + b.d]
        : r === 180
          ? [b.x, b.z, b.x + b.w, b.z]
          : [b.x, b.z, b.x, b.z + b.d];
  return (
    <figure className="plan" aria-label="Room plan, seen from above. Select a piece.">
      <svg
        ref={svgRef}
        viewBox={`${x0 - pad * 1.2} ${z0 - pad * 1.6} ${x1 - x0 + pad * 2.4} ${z1 - z0 + pad * 2.8}`}
        className={tapping ? 'placing' : undefined}
        onPointerMove={tapping ? (e) => setHover(toRoom(e)) : undefined}
        onPointerLeave={() => setHover(null)}
        onPointerDown={(e) => {
          // A second finger (or any other pointer) while a piece is pressed cancels the drag.
          if (dragRef.current && e.pointerId !== dragRef.current.pointerId) setDrag(null);
        }}
        onClick={
          tapping
            ? (e) => {
                const p = toRoom(e);
                if (!p) return;
                e.stopPropagation();
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
        {room ? (
          <RoomOutline room={room} fs={fs} />
        ) : (
          <>
            <line className="wall" x1={x0 - pad} y1={0} x2={x1 + pad} y2={0} />
            <text className="wall-label" x={x0} y={-pad * 0.5} fontSize={fs}>
              Back wall
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
          const [fx1, fz1, fx2, fz2] = frontLine(b, pc.item.rotationY);
          const on = pc.item.id === selectedId;
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
          return (
            <g
              key={pc.item.id}
              className={`plan-piece ${on ? 'on' : ''} ${b.y > 0 ? 'raised' : ''}`}
              role="button"
              tabIndex={0}
              aria-pressed={on}
              aria-label={`${pc.item.design.name}, ${b.w} by ${b.d} mm`}
              onClick={tapping ? undefined : () => select(pc.item.id)}
              onKeyDown={(e) => {
                const m = tapping ? null : arrowMove(e.key, e.shiftKey);
                if (!m) return onKey(() => select(pc.item.id))(e);
                e.preventDefault();
                moveItemBy(pc.item.id, m.dx, m.dz);
              }}
              onPointerDown={
                tapping
                  ? undefined
                  : (e) => {
                      if (e.pointerType === 'mouse' && e.button !== 0) return;
                      // Another pointer already pressing: the plan's handler cancels that drag instead.
                      const cur = dragRef.current;
                      if (cur && cur.pointerId !== e.pointerId) return;
                      const g = pressPiece(null, pc.item.id, at(e));
                      if (!g) return;
                      e.currentTarget.setPointerCapture?.(e.pointerId);
                      setDrag(g);
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
                select(end.id);
                if (end.kind === 'drop') moveItemBy(end.id, end.dx, end.dz);
              }}
              onPointerCancel={() => setDrag(null)}
            >
              <rect x={b.x} y={b.z} width={b.w} height={b.d} />
              <line className="front" x1={fx1} y1={fz1} x2={fx2} y2={fz2} />
              <text
                x={b.x + b.w / 2}
                y={b.z + b.d / 2 + dy}
                fontSize={size}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {pc.item.quantity > 1 ? `${pc.item.quantity}× ` : ''}
                {pc.item.design.name}
              </text>
            </g>
          );
        })}
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
            >
              <title>Needed to open; something is in the way</title>
            </rect>
          ))}
        {problem && !tapping && <ProblemOutline problem={problem} fs={fs} />}
        {dragged && dropAt && (
          <g className="drag-ghost" aria-hidden="true">
            <rect
              x={dragged.bounds.x + dropAt.x - dragged.item.position.x}
              y={dragged.bounds.z + dropAt.z - dragged.item.position.z}
              width={dragged.bounds.w}
              height={dragged.bounds.d}
            />
            <text
              x={dragged.bounds.x + dropAt.x - dragged.item.position.x}
              y={dragged.bounds.z + dropAt.z - dragged.item.position.z - fs * 0.5}
              fontSize={fs}
            >
              From left {dropAt.x} · From back {dropAt.z} mm
            </text>
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
      </svg>
      <figcaption>
        Seen from above. The yellow edge is each piece's front; dashed pieces hang on the wall; red
        dashes show where a selected piece's doors or drawers cannot open. Drag a piece, or use the
        arrow keys on it, to move it; Esc cancels a drag.
      </figcaption>
    </figure>
  );
}

/** The room on the plan (ADR-058/0056): walls with their numbers, door swings, windows and obstacles. */
function RoomOutline({ room, fs }: { room: Room; fs: number }) {
  const n = room.outline.length;
  return (
    <g className="room-outline">
      <polygon className="room-floor" points={room.outline.map((p) => p.join(',')).join(' ')} />
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
            >{`Wall ${i + 1} · ${wallLength(room, i)}`}</text>
          </g>
        );
      })}
      {room.features.map((f) => {
        const b = featureBox(room, f);
        if (!b || (f.wall !== null && f.wall >= n)) return null;
        if (f.kind === 'obstacle')
          return (
            <rect key={f.id} className="room-obstacle" x={b.x} y={b.z} width={b.w} height={b.d}>
              <title>{f.label}</title>
            </rect>
          );
        if (f.kind === 'window')
          return (
            <rect key={f.id} className="room-window" x={b.x} y={b.z} width={b.w} height={b.d}>
              <title>{f.label}</title>
            </rect>
          );
        const sw = doorSwing(room, f);
        return (
          <g key={f.id}>
            {/* The area the check keeps free (as deep as the door is wide), drawn faintly. */}
            <rect className="room-door" x={b.x} y={b.z} width={b.w} height={b.d}>
              <title>{`${f.label}: keep free for the swing`}</title>
            </rect>
            {sw && (
              <path
                className="room-door-swing"
                d={`M ${sw.hinge.join(' ')} L ${sw.closed.join(' ')} A ${sw.radius} ${sw.radius} 0 0 ${sw.sweep} ${sw.open.join(' ')} Z`}
              >
                <title>{`${f.label}: door swing`}</title>
              </path>
            )}
          </g>
        );
      })}
    </g>
  );
}

/** The whole room seen from the front (looking at the back wall), floor at the bottom. Tap a piece to select it. */
function RoomFront({ pm }: { pm: ProjectModel }) {
  const selectedId = useDesign((s) => s.selectedItemId);
  const select = useDesign((s) => s.selectItem);
  const showFronts = useDesign((s) => s.showFronts);
  const room = useDesign((s) => s.project?.room);
  const rv = useMemo(() => (room ? roomFrontView(room) : null), [room]);
  const colors = useMemo(
    () =>
      new Map(
        pm.pieces.flatMap((pc) =>
          pc.item.design.materials.map((m) => [`${pc.item.id}:${m.id}`, m.color] as const),
        ),
      ),
    [pm.pieces],
  );
  const b = pm.model.bounds;
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
  const sel = pm.pieces.find((p) => p.item.id === selectedId)?.bounds;
  return (
    <figure className="plan" aria-label="Room seen from the front. Select a piece.">
      <svg
        viewBox={`${x0 - pad * 1.2} ${-top - pad * 0.8} ${x1 - x0 + pad * 2.4} ${top + pad * 1.8}`}
      >
        <rect className="floor" x={x0 - pad} y={0} width={x1 - x0 + 2 * pad} height={pad * 0.15} />
        {rv && (
          <g className="room-front">
            <line className="room-ceiling" x1={rv.x0} y1={-rv.height} x2={rv.x1} y2={-rv.height}>
              <title>{`Room height ${rv.height}`}</title>
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
                <title>{`${f.label} on the back wall`}</title>
              </rect>
            ))}
          </g>
        )}
        {structure.map(({ p, pc }) => (
          <polygon
            key={p.id}
            className={`el-panel ${pc.item.id === selectedId ? 'hl' : ''}`}
            points={outlinePoints(p)}
            style={{ fill: colors.get(`${pc.item.id}:${p.materialId}`) }}
          />
        ))}
        {showFronts &&
          fronts.map(({ p }) => (
            <polygon key={p.id} className="el-front" points={outlinePoints(p)} />
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
            aria-pressed={pc.item.id === selectedId}
            aria-label={`${pc.item.design.name}, ${pc.bounds.w} wide, ${pc.bounds.h} high`}
            onClick={() => select(pc.item.id)}
            onKeyDown={onKey(() => select(pc.item.id))}
          />
        ))}
        <Dim x1={x0} x2={x1} y={pad * 0.6} fontSize={dfs} label={`${x1 - x0}`} />
        <DimV y1={0} y2={-top} x={x0 - pad * 0.6} fontSize={dfs} label={`${top}`} />
        {sel && (
          <>
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
          </>
        )}
      </svg>
      <figcaption>
        Seen from the front. Sizes in mm: overall in yellow, the selected piece in green.
        {rv &&
          ' The room height and the doors, windows and obstacles on the back wall are outlined.'}
      </figcaption>
    </figure>
  );
}

/** Choose a starting piece or a saved piece to add to the project. */
export function AddPieceList({ onDone, onBrowse }: { onDone: () => void; onBrowse?: () => void }) {
  const add = useDesign((s) => s.addPiece);
  const [saved, setSaved] = useState<StoredDesign[]>([]);
  useEffect(() => {
    listDesigns()
      .then(setSaved)
      .catch(() => setSaved([]));
  }, []);
  return (
    <>
      <StartFrom
        onPick={(d) => {
          add(d);
          onDone();
        }}
        onBrowse={onBrowse}
      />
      {saved.length > 0 && (
        <>
          <h3 className="list-head">Your saved pieces</h3>
          <ul className="template-list">
            {saved.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="row-btn"
                  onClick={() => {
                    add(r.design, r.id);
                    onDone();
                  }}
                >
                  <span className="glyph">
                    <Icon name={templateGlyph(r.design.product.kind)} />
                  </span>
                  <span>
                    <strong>{r.name}</strong>
                    <span className="sub">
                      A copy is added; “Update from saved piece” pulls later changes.
                    </span>
                  </span>
                  <Icon name="chevron-right" className="chev sm" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

/**
 * Worktop, plinth, fillers and cover panels along runs of base units (ADR-036, ADR-054): suggested, listed with a
 * reason, removable; kept up to date when pieces change (ADR-061).
 */
function RunParts() {
  const project = useDesign((s) => s.project)!;
  const suggestParts = useDesign((s) => s.suggestRunParts);
  const removeRunPart = useDesign((s) => s.removeRunPart);
  const setRunSettings = useDesign((s) => s.setRunSettings);
  const parts = project.runParts ?? [];
  const removed = project.runPartsRemoved ?? [];
  const settings = project.runSettings;
  const notes = useMemo(
    () => (parts.length || settings?.auto ? planRuns(project).notes : []),
    [project, parts.length, settings?.auto],
  );
  const suggest = async () => {
    if (
      (parts.length || removed.length) &&
      !(await askConfirm(
        'Suggest the run parts again for where the pieces are now? Parts you removed come back.',
        { confirmLabel: 'Suggest again' },
      ))
    )
      return;
    suggestParts();
  };
  return (
    <section className="section run-parts" aria-label="Run parts">
      <div className="card-title">
        <span>Run parts</span>
      </div>
      <p className="hint">
        For rows of base units side by side: one worktop, a filler in each gap, a cover panel on
        each open end, and one plinth along the run when the cabinets stand on their bottoms (it
        replaces their own plinths).
      </p>
      {parts.length > 0 && (
        <ul className="run-list">
          {parts.map((rp) => (
            <li key={rp.id}>
              <span>
                <strong>{rp.label}</strong>{' '}
                <span className="num">
                  {rp.box.w} × {rp.box.h} × {rp.box.d}
                </span>
                <span className="sub">
                  {rp.reason}
                  {rp.changed ? ` · updated: ${rp.changed}` : ''}
                </span>
              </span>
              <button
                type="button"
                className="btn icon ghost sm"
                aria-label={`Remove ${rp.label}`}
                onClick={() => removeRunPart(rp.id)}
              >
                <Icon name="trash" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {notes.map((n) => (
        <p key={n} className="hint warn">
          {n}
        </p>
      ))}
      {removed.length > 0 && (
        <p className="hint">
          {removed.length} removed {removed.length === 1 ? 'part stays' : 'parts stay'} removed.
        </p>
      )}
      <MmField
        label="Scribe allowance for fillers"
        value={settings?.scribe ?? 0}
        min={0}
        max={200}
        onChange={(v) => setRunSettings({ scribe: v })}
        hint="Cut fillers this much wider to scribe them to fit; 0 = exact"
      />
      {(parts.length > 0 || settings?.auto) && (
        <Toggle
          label="Keep run parts up to date"
          checked={!!settings?.auto}
          onChange={(v) => setRunSettings({ auto: v })}
        />
      )}
      <button
        type="button"
        className="btn outline block"
        onClick={suggest}
        disabled={!project.items.length}
      >
        <Icon name="refresh" className="sm" />
        {parts.length ? 'Suggest again' : 'Suggest worktop, plinth, fillers and covers'}
      </button>
    </section>
  );
}

const SHAPES: { value: RoomShape; label: string }[] = [
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'l-shape', label: 'L-shape' },
  { value: 'u-shape', label: 'U-shape' },
  { value: 'alcove', label: 'Alcove' },
];
const FEATURE_KIND: Record<RoomFeature['kind'], string> = {
  door: 'Door',
  window: 'Window',
  obstacle: 'Obstacle',
};

/** The room (ADR-058/0056): shape and walls, height, doors, windows and obstacles, checked against the pieces. */
function RoomSection() {
  const project = useDesign((s) => s.project)!;
  const pm = useDesign((s) => s.projectModel);
  const setRoom = useDesign((s) => s.setRoom);
  const startDraw = useDesign((s) => s.startDrawRoom);
  const room = project.room;
  const [shapeChoice, setShape] = useState<RoomShape>('rectangle');
  const shape = room?.shape?.kind ?? shapeChoice;
  const right = pm?.pieces.length
    ? Math.max(...pm.pieces.map((pc) => pc.bounds.x + pc.bounds.w))
    : 0;
  const deep = pm?.pieces.length
    ? Math.max(...pm.pieces.map((pc) => pc.bounds.z + pc.bounds.d))
    : 0;
  const [sizes, setSizes] = useState<ShapeSizes>(() => ({
    width: Math.max(3000, Math.ceil(right / 100) * 100),
    depth: Math.max(3000, Math.ceil((deep + 1000) / 100) * 100),
    cutWidth: 1000,
    cutDepth: 1000,
    offset: 1000,
  }));
  const make = (sh: RoomShape, sz: ShapeSizes) =>
    setRoom({
      height: room?.height ?? DEFAULT_ROOM_HEIGHT,
      features: room?.features ?? [],
      outline: shapeOutline(sh, sz),
      shape: { kind: sh, sizes: sz },
    });
  const shown = room?.shape?.sizes ?? sizes;
  const setSize = (k: keyof ShapeSizes, v: number) => {
    const next = { ...shown, [k]: v };
    setSizes(next);
    if (room) make(shape, next);
  };
  const issues = room ? outlineIssues(room.outline) : [];
  const walls = room ? room.outline.map((_, i) => i) : [];
  const addFeature = (kind: RoomFeature['kind']) => {
    if (!room) return;
    const n = room.features.filter((f) => f.kind === kind).length + 1;
    const f: RoomFeature =
      kind === 'door'
        ? {
            id: newId(),
            kind,
            wall: room.outline.length - 1,
            from: 100,
            width: 800,
            sill: 0,
            height: 2000,
            depth: 0,
            label: `Door ${n}`,
          }
        : kind === 'window'
          ? {
              id: newId(),
              kind,
              wall: 0,
              from: 500,
              width: 1000,
              sill: 900,
              height: 1200,
              depth: 0,
              label: `Window ${n}`,
            }
          : {
              id: newId(),
              kind,
              wall: 0,
              from: 0,
              width: 600,
              sill: 100,
              height: 600,
              depth: 100,
              label: `Obstacle ${n}`,
            };
    setRoom({ ...room, features: [...room.features, f] });
  };
  const setFeature = (id: string, patch: Partial<RoomFeature>) =>
    room &&
    setRoom({
      ...room,
      features: room.features.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    });
  return (
    <section className="section room" aria-label="Room">
      <div className="card-title">
        <span>Room</span>
      </div>
      {!room ? (
        <>
          <p className="hint">
            Add the room to check the pieces against its walls, doors, windows and obstacles.
          </p>
          <Segmented<RoomShape> label="Shape" value={shape} options={SHAPES} onChange={setShape} />
          <button type="button" className="btn outline block" onClick={() => make(shape, sizes)}>
            <Icon name="plus" className="sm" />
            Add the room
          </button>
          <button type="button" className="btn ghost block" onClick={startDraw}>
            <Icon name="pencil" className="sm" />
            Draw the room
          </button>
        </>
      ) : (
        <>
          {room.shape ? (
            <>
              <Segmented<RoomShape>
                label="Shape"
                value={shape}
                options={SHAPES}
                onChange={(v) => {
                  setShape(v);
                  make(v, shown);
                }}
              />
              <div className="room-sizes">
                <MmField
                  label="Room width"
                  value={shown.width}
                  min={500}
                  max={30000}
                  onChange={(v) => setSize('width', v)}
                />
                <MmField
                  label="Room depth"
                  value={shown.depth}
                  min={500}
                  max={30000}
                  onChange={(v) => setSize('depth', v)}
                />
                {shape !== 'rectangle' && (
                  <>
                    <MmField
                      label={
                        shape === 'alcove'
                          ? 'Alcove width'
                          : shape === 'u-shape'
                            ? 'Notch width'
                            : 'Cut-out width'
                      }
                      value={shown.cutWidth}
                      min={100}
                      max={20000}
                      onChange={(v) => setSize('cutWidth', v)}
                    />
                    <MmField
                      label={
                        shape === 'alcove'
                          ? 'Alcove depth'
                          : shape === 'u-shape'
                            ? 'Notch depth'
                            : 'Cut-out depth'
                      }
                      value={shown.cutDepth}
                      min={100}
                      max={20000}
                      onChange={(v) => setSize('cutDepth', v)}
                    />
                    {shape !== 'l-shape' && (
                      <MmField
                        label={shape === 'alcove' ? 'Alcove from the left' : 'Notch from the left'}
                        value={shown.offset}
                        min={0}
                        max={20000}
                        onChange={(v) => setSize('offset', v)}
                      />
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <p className="hint">
              Drawn or edited wall by wall.{' '}
              <button type="button" className="link" onClick={() => make(shapeChoice, sizes)}>
                Use a ready shape instead
              </button>
            </p>
          )}
          <MmField
            label="Room height"
            value={room.height}
            min={1000}
            max={10000}
            onChange={(v) => setRoom({ ...room, height: v })}
            hint="Measure your ceiling"
          />
          <h4>Walls</h4>
          <ul className="wall-list">
            {walls.map((i) => (
              <li key={i}>
                <MmField
                  label={`Wall ${i + 1}`}
                  value={wallLength(room, i)}
                  min={100}
                  max={30000}
                  onChange={(v) => setRoom(setWallLength(room, i, v))}
                />
              </li>
            ))}
          </ul>
          {issues.map((m) => (
            <p key={m} className="hint warn">
              {m}
            </p>
          ))}
          <button type="button" className="btn ghost" onClick={startDraw}>
            <Icon name="pencil" className="sm" />
            Draw the room again
          </button>
          <h4>Doors, windows and obstacles</h4>
          {room.features.length === 0 && <p className="hint">None yet.</p>}
          {room.features.map((f) => (
            <fieldset key={f.id} className="room-feature" aria-label={f.label}>
              <legend>{f.label}</legend>
              <Select
                label="On"
                value={f.wall === null ? 'floor' : String(f.wall)}
                options={[
                  ...walls.map((i) => ({ value: String(i), label: `Wall ${i + 1}` })),
                  ...(f.kind === 'obstacle' ? [{ value: 'floor', label: 'Free-standing' }] : []),
                ]}
                onChange={(v) =>
                  setFeature(f.id, v === 'floor' ? { wall: null, x: 0, z: 0 } : { wall: Number(v) })
                }
              />
              {f.wall === null ? (
                <>
                  <MmField
                    label="From left"
                    value={f.x ?? 0}
                    min={-30000}
                    max={30000}
                    onChange={(v) => setFeature(f.id, { x: v })}
                  />
                  <MmField
                    label="From back"
                    value={f.z ?? 0}
                    min={-30000}
                    max={30000}
                    onChange={(v) => setFeature(f.id, { z: v })}
                  />
                </>
              ) : (
                <MmField
                  label="From the wall's start"
                  value={f.from}
                  min={0}
                  max={30000}
                  onChange={(v) => setFeature(f.id, { from: v })}
                />
              )}
              <MmField
                label="Width"
                value={f.width}
                min={10}
                max={30000}
                onChange={(v) => setFeature(f.id, { width: v })}
              />
              {f.kind !== 'door' && (
                <MmField
                  label={f.kind === 'window' ? 'Sill height' : 'Bottom above floor'}
                  value={f.sill}
                  min={0}
                  max={10000}
                  onChange={(v) => setFeature(f.id, { sill: v })}
                />
              )}
              <MmField
                label="Height"
                value={f.height}
                min={10}
                max={10000}
                onChange={(v) => setFeature(f.id, { height: v })}
              />
              {f.kind === 'obstacle' && (
                <MmField
                  label="Comes out"
                  value={f.depth}
                  min={1}
                  max={30000}
                  onChange={(v) => setFeature(f.id, { depth: v })}
                />
              )}
              <button
                type="button"
                className="danger-link"
                onClick={() =>
                  setRoom({ ...room, features: room.features.filter((x) => x.id !== f.id) })
                }
              >
                Remove {FEATURE_KIND[f.kind].toLowerCase()}
              </button>
            </fieldset>
          ))}
          <div className="split-actions">
            <button type="button" className="btn outline sm" onClick={() => addFeature('door')}>
              Add door
            </button>
            <button type="button" className="btn outline sm" onClick={() => addFeature('window')}>
              Add window
            </button>
            <button type="button" className="btn outline sm" onClick={() => addFeature('obstacle')}>
              Add obstacle
            </button>
          </div>
          <button
            type="button"
            className="danger-link"
            onClick={async () => {
              if (
                await askConfirm('Remove the room? The pieces stay.', {
                  confirmLabel: 'Remove',
                  danger: true,
                })
              )
                setRoom(undefined);
            }}
          >
            Remove the room
          </button>
        </>
      )}
    </section>
  );
}
