import { Canvas, invalidate } from '@react-three/fiber';
import {
  CountsAnchor,
  CUT_ACROSS,
  CUT_POSITION,
  DragNote,
  Fit,
  HeightHandle,
  HeightNote,
  KeyLight,
  LockAnchors,
  ModelItems,
  Occlusion,
  Panels,
  PictureNote,
  ProblemBoxes,
  ResizeNote,
  RoomLight,
  RoomWalls,
  SeamLines,
  SectionClip,
  SetRoomWalls,
  ShadowCatcher,
  Stage,
  ThreeMore,
  ZoneBoxes,
} from './ViewerScene';
import { ContactShadows } from '@react-three/drei';
import {
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  type BufferGeometry,
  BoxGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Matrix4,
  Path,
  ClampToEdgeWrapping,
  RepeatWrapping,
  SRGBColorSpace,
  Shape,
  Texture,
  TextureLoader,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { explode } from '../core/explode';
import { t } from '../core/i18n';
import { setPictureFit, useAdjustMode, useAdjustWall } from './wallPictureDrag';
import { inPlaneAxes, union } from '../core/geometry';
import { aabbOf } from '../core/shape';
import { boxUvs, planeUvs } from '../core/surface';
import { useDesign } from '../store/designStore';
import { useView, ViewOverride } from '../store/useView';
import { useTheme } from '../store/useTheme';
import { useLook } from '../store/useLook';
import { setSolidWalls, useSolidWalls } from '../store/useSolidWalls';
import { useRendering } from './renderBridge';
import { useClearances } from '../store/clearances';
import { useSnap } from '../store/useSnap';
import { SELECT } from './panelResources';
import { SNAP_RANGE } from '../core/snap';
import { S, useMoveMode } from './pieceDrag';
import { ARBridge, useARState } from './AR';
import { AXIS_LABEL, cutAt, setSection, useSection, type SectionAxis } from './section';
import type { MaterialImage, Panel } from '../core/types';

export const FRONT = new Set<Panel['role']>(['door', 'drawer-front']);
export const HIGHLIGHT = '#f2c230';

const geoCache = new WeakMap<Panel, ExtrudeGeometry>();
const unit = (a: 'x' | 'y' | 'z') => [a === 'x' ? 1 : 0, a === 'y' ? 1 : 0, a === 'z' ? 1 : 0];
/** A profiled board (ADR-040): its outline extruded through the thickness, placed on the blank's in-plane axes. */
export function profileGeometry(p: Panel): ExtrudeGeometry {
  const hit = geoCache.get(p);
  if (hit) return hit;
  if (p.shape?.kind !== 'profile') throw new Error('not a profile');
  const pts = p.shape.points;
  const shape = new Shape();
  pts.forEach(([u, v], i) => (i ? shape.lineTo(u * S, v * S) : shape.moveTo(u * S, v * S)));
  // Holes cut through the board (ADR-205: a back cut around a pipe or outlet) are extruded too.
  for (const hole of p.shape.holes ?? []) {
    const path = new Path();
    hole.forEach(([u, v], i) => (i ? path.lineTo(u * S, v * S) : path.moveTo(u * S, v * S)));
    shape.holes.push(path);
  }
  const tAxis = p.thicknessAxis,
    t = tAxis === 'x' ? p.box.w : tAxis === 'y' ? p.box.h : p.box.d;
  const g = new ExtrudeGeometry(shape, { depth: t * S, bevelEnabled: false });
  const [ua, va] = inPlaneAxes(tAxis);
  const [e1, e2, e3] = [unit(ua), unit(va), unit(tAxis)];
  g.applyMatrix4(
    new Matrix4().set(
      e1[0],
      e2[0],
      e3[0],
      p.box.x * S,
      e1[1],
      e2[1],
      e3[1],
      p.box.y * S,
      e1[2],
      e2[2],
      e3[2],
      p.box.z * S,
      0,
      0,
      0,
      1,
    ),
  );
  g.computeVertexNormals();
  geoCache.set(p, g);
  return g;
}

const followCache = new WeakMap<Panel, BufferGeometry | null>();
/** An extruded outline, placed by a matrix whose columns are where the shape's x, y and extrusion go, and its origin. */
function placedExtrude(
  outline: [number, number][],
  holes: [number, number][][],
  depth: number,
  cols: [number[], number[], number[]],
  origin: [number, number, number],
): ExtrudeGeometry {
  const shape = new Shape();
  outline.forEach(([u, v], i) => (i ? shape.lineTo(u * S, v * S) : shape.moveTo(u * S, v * S)));
  for (const hole of holes) {
    const path = new Path();
    hole.forEach(([u, v], i) => (i ? path.lineTo(u * S, v * S) : path.moveTo(u * S, v * S)));
    shape.holes.push(path);
  }
  const g = new ExtrudeGeometry(shape, { depth: depth * S, bevelEnabled: false });
  const [a, b, c] = cols;
  g.applyMatrix4(
    new Matrix4().set(
      a[0],
      b[0],
      c[0],
      origin[0] * S,
      a[1],
      b[1],
      c[1],
      origin[1] * S,
      a[2],
      b[2],
      c[2],
      origin[2] * S,
      0,
      0,
      0,
      1,
    ),
  );
  return g;
}

/**
 * ADR-209, display only: a crown's or pelmet's profile extruded along its length (`section`), or a worktop with its
 * rounded or bevelled front edge (`edgeProfile`), drawn as a lower slab, a top slab stopping `size` short of the front
 * and the shaped edge strip; its cut-out holes stay. Null when the panel has neither.
 */
export function followUpGeometry(p: Panel): BufferGeometry | null {
  if (followCache.has(p)) return followCache.get(p)!;
  const b = p.box;
  let g: BufferGeometry | null = null;
  if (p.section && p.section.length >= 3) {
    // Across (z) and up (y) from the back-bottom corner, extruded along x.
    g = placedExtrude(
      p.section,
      [],
      b.w,
      [
        [0, 0, 1],
        [0, 1, 0],
        [1, 0, 0],
      ],
      [b.x, b.y, b.z],
    );
  } else if (p.edgeProfile && p.thicknessAxis === 'y') {
    const { kind, size: s, face } = p.edgeProfile;
    const t = b.h;
    const own = p.shape?.kind === 'profile' ? p.shape : null;
    const pts: [number, number][] = own
      ? own.points
      : [
          [0, 0],
          [b.w, 0],
          [b.w, b.d],
          [0, b.d],
        ];
    const holes = own?.holes ?? [];
    // The worktop's plan: u along x, v along z; the front line and how a point moves back from it.
    const onU = face[1] === 'x';
    const at = face === '+z' ? b.d : face === '+x' ? b.w : 0;
    const back = face[0] === '+' ? -s : s;
    const isFront = ([u, v]: [number, number]) => (onU ? u : v) === at;
    const pull = ([u, v]: [number, number]): [number, number] =>
      isFront([u, v]) ? (onU ? [u + back, v] : [u, v + back]) : [u, v];
    const clamp = ([u, v]: [number, number]): [number, number] => {
      const lim = at + back;
      const c = onU ? u : v;
      const k = face[0] === '+' ? Math.min(c, lim) : Math.max(c, lim);
      return onU ? [k, v] : [u, k];
    };
    const along = pts.filter(isFront).map(([u, v]) => (onU ? v : u));
    const plan: [number[], number[], number[]] = [
      [1, 0, 0],
      [0, 0, 1],
      [0, 1, 0],
    ];
    const parts: BufferGeometry[] = [
      placedExtrude(pts, holes, t - s, plan, [b.x, b.y, b.z]),
      placedExtrude(
        pts.map(pull),
        holes.map((h) => h.map(clamp)),
        s,
        plan,
        [b.x, b.y + t - s, b.z],
      ),
    ];
    if (along.length >= 2) {
      const e0 = Math.min(...along),
        e1 = Math.max(...along);
      // The edge strip's section: a back from the front, b up from the top slab's underside.
      const sec: [number, number][] = [
        [0, 0],
        [s, 0],
        [s, s],
      ];
      if (kind === 'rounded')
        for (let i = 1; i < 12; i++) {
          const th = (i / 12) * (Math.PI / 2);
          sec.push([s - s * Math.sin(th), s * Math.cos(th)]);
        }
      const y0 = b.y + t - s;
      const [aDir, eDir, origin]: [number[], number[], [number, number, number]] =
        face === '+z'
          ? [
              [0, 0, -1],
              [1, 0, 0],
              [b.x + e0, y0, b.z + b.d],
            ]
          : face === '-z'
            ? [
                [0, 0, 1],
                [1, 0, 0],
                [b.x + e0, y0, b.z],
              ]
            : face === '+x'
              ? [
                  [-1, 0, 0],
                  [0, 0, 1],
                  [b.x + b.w, y0, b.z + e0],
                ]
              : [
                  [1, 0, 0],
                  [0, 0, 1],
                  [b.x, y0, b.z + e0],
                ];
      parts.push(placedExtrude(sec, [], e1 - e0, [aDir, [0, 1, 0], eDir], origin));
    }
    g = mergeGeometries(parts.map((x) => x.toNonIndexed()));
  }
  g?.computeVertexNormals();
  followCache.set(p, g);
  return g;
}

/** A board with a picture (ADR-048): texture coordinates from the core, scaled to the part's size in mm. */
export function PictureGeometry({ p, img }: { p: Panel; img: MaterialImage }) {
  const g = useMemo(() => {
    if (p.shape?.kind === 'profile') {
      // Own copy of the extruded outline so its texture coordinates can change.
      const base = profileGeometry(p).clone();
      const [ua, va] = inPlaneAxes(p.thicknessAxis);
      // Extruded outlines carry coordinates in metres along the outline's plane; turn them into picture coordinates.
      const uv = base.getAttribute('uv');
      const mm = Array.from(uv.array as Float32Array, (v) => v / S);
      base.setAttribute('uv', new Float32BufferAttribute(planeUvs(p, img, ua, va, mm), 2));
      return base;
    }
    const b = new BoxGeometry(p.box.w * S, p.box.h * S, p.box.d * S);
    b.setAttribute('uv', new Float32BufferAttribute(boxUvs(p, img), 2));
    return b;
  }, [p, img]);
  useEffect(() => () => g.dispose(), [g]);
  return <primitive object={g} attach="geometry" />;
}

/** One texture per picture, shared by every part; freed when no material uses the picture any more. */
export function useTextures(urls: Map<string, string>, repeat = true): Map<string, Texture> {
  const textures = useMemo(() => {
    const m = new Map<string, Texture>();
    const loader = new TextureLoader();
    for (const [id, url] of urls) {
      if (url === 'missing') continue;
      // Rendered on demand (ADR-121): draw again once the picture has arrived.
      const t = loader.load(url, () => invalidate());
      t.wrapS = t.wrapT = repeat ? RepeatWrapping : ClampToEdgeWrapping;
      t.colorSpace = SRGBColorSpace;
      t.anisotropy = 4;
      m.set(id, t);
    }
    return m;
  }, [urls, repeat]);
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures]);
  return textures;
}

/**
 * Non-authoritative preview: renders the model's panels exactly as built, never edits them.
 * A tap selects the whole piece, then one level smaller per tap at the hit point (ADR-083).
 * One exception (ADR-093): in a project, the Move button lets a piece be dragged across the floor and the turn
 * buttons or R / Shift+R turn it; both go through the same store actions as the Plan.
 */
/**
 * What the app draws inside the 3D view (ADR-230): the viewer imports nothing from `src/ui`, so the ui pieces it shows
 * come in as render props. Without them (a shared item's preview) nothing is drawn there.
 */
interface Viewer3DProps {
  /** The quick-count card (ADR-085) with this class. */
  countCard?: (className: string) => ReactNode;
  /** The one-tap Move to buttons (ADR-147) for a piece or a block of pieces, with this class. */
  moveTo?: (id: string | readonly string[], className: string) => ReactNode;
  /** On a phone, the slot under the view where the card docks (G-070); null floats it over the view. */
  countDock?: HTMLElement | null;
}

export default function Viewer3D({ countCard, moveTo, countDock = null }: Viewer3DProps = {}) {
  const view = useView();
  // A shared item's preview (ADR-143): shown only, nothing selected, no tools or cards.
  const preview = !!useContext(ViewOverride);
  const exploded = useDesign((s) => s.exploded);
  const theme = useTheme();
  const look = useLook();
  // A render (ADR-068) always uses the realistic look.
  const rendering = useRendering();
  const realistic = rendering || look === 'realistic';
  // In AR, drei's contact shadows would render their depth pass through the XR camera: a wrong blob under the pieces.
  const arOn = useARState() !== 'off';
  // Stage colours come from the stylesheet tokens so the canvas matches the light or dark theme.
  const bg = useMemo(() => {
    void theme;
    return (
      getComputedStyle(document.documentElement).getPropertyValue('--stage-3d').trim() || '#e7eae7'
    );
  }, [theme]);
  // Connection seams (ADR-179) in the primary colour, the plan's tick colour.
  const primary = useMemo(() => {
    void theme;
    return (
      getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || SELECT
    );
  }, [theme]);
  const designId = `${preview ? `preview:${view.title}` : view.mode === 'project' ? 'project' : `design:${useDesign.getState().design.id}`}:${exploded ? 'exploded' : 'built'}`;
  // Exploded: positions only, for looking; parts, sheets and checks always use the built model.
  // Isolate (ADR-122): only the selected project pieces are shown; the model, checks and exports are unchanged.
  const section = useSection();
  const selectedIds = useDesign((s) => s.selectedItemIds);
  const isolating = view.mode === 'project' && section.isolate && selectedIds.length > 0;
  const panels = useMemo(() => {
    const all = exploded ? explode(view.pieces) : view.model.panels;
    if (!isolating) return all;
    const keep = new Set(selectedIds);
    return all.filter((p) => keep.has(p.nodeId.split(':')[0]));
  }, [exploded, view, isolating, selectedIds]);
  // A project's display-only 3D models (ADR-076) are framed too.
  const extent = useDesign((s) => (view.mode === 'project' ? s.projectModel?.extent : undefined));
  const bounds = useMemo(
    () => (exploded ? union(panels.map(aabbOf)) : (extent ?? view.model.bounds)),
    [exploded, panels, view, extent],
  );
  // A project piece drilled into from the project editor (ADR-088) gets the card too.
  const drillOn = useDesign(
    (s) => !!s.project && !s.editingItemId && !!s.drillItemId && s.drillItemId === s.selectedItemId,
  );
  const counts =
    (view.mode === 'design' || (view.mode === 'project' && drillOn)) && !rendering && !preview;
  // On a phone the short 3D view would be mostly covered by a floating card: it docks under the view (G-070).
  // The slot under the view, which App renders on phones and passes in; floating when it is missing.
  const dock = countDock;
  const docked = !!dock;
  // A project with nothing in it yet says so over the empty stage (G-059).
  const emptyProject = useDesign(
    (s) =>
      view.mode === 'project' &&
      !!s.projectModel &&
      !s.projectModel.pieces.length &&
      !s.projectModel.models.length &&
      !s.project?.room,
  );
  const cardRef = useRef<HTMLDivElement>(null);
  // Locked project pieces (ADR-095) get a "Locked" label over them: DOM spans placed each frame, as the counts card.
  const projectPieces = useDesign((s) =>
    view.mode === 'project' ? s.projectModel?.pieces : undefined,
  );
  const locked = useMemo(
    () => (projectPieces ?? []).filter((pc) => pc.item.locked),
    [projectPieces],
  );
  const showLocks = !exploded && !rendering && locked.length > 0;
  // AR per-piece sizes (ADR-218): each project piece's box and own size; a single design is one piece.
  const arPieces = useMemo(
    () =>
      projectPieces
        ? projectPieces.map((pc) => ({
            box: pc.bounds,
            w: pc.outline.w,
            h: pc.outline.h,
            d: pc.outline.d,
          }))
        : [{ box: bounds, w: bounds.w, h: bounds.h, d: bounds.d }],
    [projectPieces, bounds],
  );
  const lockBadges = useRef(new Map<string, HTMLSpanElement>());
  // Bottom centre of the card at the anchor, kept inside the view (the anchor's screen point, or null to hide).
  const placeCard = useCallback((at: { x: number; y: number } | null) => {
    const el = cardRef.current,
      box = el?.parentElement;
    if (!el || !box) return;
    if (!at) {
      el.style.visibility = 'hidden';
      return;
    }
    const w = el.offsetWidth,
      h = el.offsetHeight,
      gap = 6;
    const left = Math.max(gap, Math.min(at.x - w / 2, box.clientWidth - w - gap));
    const top = Math.max(gap, Math.min(at.y - h - gap, box.clientHeight - h - gap));
    el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    el.style.visibility = 'visible';
  }, []);
  // Placing project pieces from 3D (ADR-093).
  const inProject = view.mode === 'project';
  // 3D models count too: in Move mode their size can be dragged (ADR-102).
  const hasPieces = useDesign(
    (s) => inProject && !!(s.projectModel?.pieces.length || s.projectModel?.models.length),
  );
  const [moveOn, setMoveOn] = useMoveMode();
  // Placing a new piece or drawing the room on the Plan turns moving and turning off, as on the Plan (ADR-056, 059).
  const tapping = useDesign((s) => !!s.placingItemId || !!s.drawingRoom);
  const moving = moveOn && hasPieces && !exploded && !rendering && !tapping;
  // The views' shared Select (ADR-097, ADR-159): taps add and remove whole pieces.
  const multi = useDesign((s) => s.multiSelect);
  const setMulti = useDesign((s) => s.setMultiSelect);
  const [snapOn, setSnapOn] = useSnap();
  // Adjusting a wall picture from 3D (ADR-146): only one of Move and Adjust wall picture is on.
  const hasPicture = useDesign((s) => inProject && !!s.project?.room?.walls?.some((f) => f.image));
  const [adjustOn, setAdjustOn] = useAdjustMode();
  const adjusting = adjustOn && hasPicture && !exploded && !rendering && !tapping && !isolating;
  const [adjustWall] = useAdjustWall();
  const turnId = useDesign((s) =>
    inProject && s.selectedItemId && s.project?.items.some((i) => i.id === s.selectedItemId)
      ? s.selectedItemId
      : null,
  );
  const turnItem = useDesign((s) => s.turnItem);
  // A selected display-only model turns too (ADR-203, G-105).
  const modelTurnId = useDesign((s) =>
    inProject && s.selectedItemId && s.project?.models?.some((m) => m.id === s.selectedItemId)
      ? s.selectedItemId
      : null,
  );
  const turnModel = useDesign((s) => s.turnModel);
  const turnSelected = (dir: 1 | -1) => {
    if (turnId) turnItem(turnId, dir);
    else if (modelTurnId) turnModel(modelTurnId, dir);
  };
  const [moveToOpen, setMoveToOpen] = useState(false);
  // Several pieces selected: Move to moves them as one block (ADR-182).
  const pieceItems = useDesign((s) => s.project?.items);
  const moveToIds = useMemo(() => {
    const ids = selectedIds.filter((id) => pieceItems?.some((i) => i.id === id));
    return ids.length >= 2 ? ids : turnId;
  }, [selectedIds, pieceItems, turnId]);
  // R / Shift+R turn the selected piece about its centre (ADR-069), as on the Plan; not while typing or in a dialog.
  useEffect(() => {
    if (!turnId || rendering || tapping) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'r' || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented)
        return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('input, textarea, select, [contenteditable], dialog, .plan-piece')) return;
      if (document.querySelector('dialog[open]')) return;
      e.preventDefault();
      // Holding the key turns once (each turn is an undo step).
      if (!e.repeat) turnItem(turnId, e.shiftKey ? -1 : 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [turnId, rendering, tapping, turnItem]);
  // Section (ADR-122): a cut across one axis of what is shown, in the project's 3D view; never in a rendered picture.
  const sectionOn = inProject && section.on && !rendering;
  const span = (a: SectionAxis): [number, number] =>
    a === 'x'
      ? [bounds.x, bounds.x + bounds.w]
      : a === 'y'
        ? [bounds.y, bounds.y + bounds.h]
        : [bounds.z, bounds.z + bounds.d];
  const [lo, hi] = span(section.axis);
  const cut = sectionOn ? cutAt(section, lo, hi) : null;
  const canIsolate = inProject && selectedIds.length > 0;
  const hasRoom = useDesign((s) => !!s.project?.room);
  const solidWalls = useSolidWalls();
  // The plan's Clearances switch also draws the zones in 3D (ADR-205).
  const [zonesOn, setZonesOn] = useClearances();
  return (
    <>
      <Canvas
        camera={{ fov: 32, near: 0.01, far: 100 }}
        // Draw only when something changes (ADR-121): orbiting, a change in the scene, a drag. Idle = no frames.
        frameloop="demand"
        dpr={[1, 2]}
        shadows={realistic}
        onPointerMissed={() => {
          if (preview) return;
          const st = useDesign.getState();
          if (st.project && !st.editingItemId) st.selectItem(null);
          else st.select(undefined);
        }}
      >
        <color attach="background" args={[bg]} />
        <Stage />
        {realistic ? (
          <>
            <RoomLight />
            <KeyLight bounds={bounds} />
            <ShadowCatcher bounds={bounds} />
            {!rendering && <Occlusion />}
          </>
        ) : (
          <>
            <hemisphereLight args={['#ffffff', '#b9bdb6', 1.1]} />
            <directionalLight position={[2.5, 4, 3]} intensity={1.6} />
            <directionalLight position={[-3, 2, -1]} intensity={0.35} />
            {!arOn && (
              <ContactShadows
                position={[
                  bounds.x * S + (bounds.w * S) / 2,
                  -0.0005,
                  bounds.z * S + (bounds.d * S) / 2,
                ]}
                scale={Math.max(bounds.w, bounds.d) * S * 2.2}
                blur={2.4}
                opacity={0.38}
                far={1.2}
              />
            )}
          </>
        )}
        <Panels
          panels={panels}
          realistic={realistic}
          plain={rendering}
          moving={moving}
          snapOn={snapOn}
        />
        {counts && !docked && (
          <CountsAnchor place={placeCard} inProject={view.mode === 'project'} />
        )}
        {view.mode === 'project' && !exploded && !isolating && (
          <>
            <RoomWalls adjusting={adjusting} snapOn={snapOn} />
            <SetRoomWalls />
          </>
        )}
        {view.mode === 'project' && !exploded && !isolating && (
          <ModelItems plain={rendering} moving={moving} snapOn={snapOn} />
        )}
        {view.mode === 'project' && !exploded && !rendering && !preview && (
          <SeamLines color={primary} only={isolating ? selectedIds : undefined} />
        )}
        {moving && turnId && <HeightHandle id={turnId} />}
        {view.mode === 'project' && zonesOn && !exploded && !rendering && <ZoneBoxes />}
        {view.mode === 'project' && !exploded && !rendering && !preview && <ProblemBoxes />}
        {sectionOn && <SectionClip axis={section.axis} at={cut!} />}
        {showLocks && <LockAnchors pieces={locked} badges={lockBadges} />}
        <Fit key={designId} bounds={bounds} />
        {!preview && <ARBridge bounds={bounds} pieces={arPieces} />}
      </Canvas>
      {showLocks && (
        <div className="lock-badges" aria-hidden="true">
          {locked.map((pc) => (
            <span
              key={pc.item.id}
              className="lock-badge-3d"
              style={{ visibility: 'hidden' }}
              ref={(el) => {
                if (el) lockBadges.current.set(pc.item.id, el);
                else lockBadges.current.delete(pc.item.id);
              }}
            >
              {t('Locked')}
            </span>
          ))}
        </div>
      )}
      {!(hasPieces || hasPicture) && !rendering && !preview && (
        <div className="three-tools" role="toolbar" aria-label={t('3D view tools')}>
          <ThreeMore name={view.title} />
        </div>
      )}
      {(hasPieces || hasPicture) && !rendering && (
        <div className="three-tools" role="toolbar" aria-label={t('Place pieces in 3D')}>
          {!preview && <ThreeMore name={view.title} />}
          {hasPieces && (
            <button
              type="button"
              className="btn sm outline move-toggle"
              aria-pressed={moving}
              disabled={exploded}
              title={
                exploded
                  ? t('Turn off Exploded 3D to move pieces')
                  : t('Drag a piece to move it; dragging empty space turns the view')
              }
              // A tap flips what the button shows (G-181): Move can be on but not in effect (placing a piece or drawing the
              // room), and flipping the stored value then changed nothing on screen, so the first tap seemed lost.
              onClick={() => {
                setMoveOn(!moving);
                setAdjustOn(false);
              }}
            >
              {t('Move')}
            </button>
          )}
          {hasPieces && (
            <button
              type="button"
              className="btn sm outline select-toggle"
              aria-pressed={multi}
              title={t('Tap pieces to add them to the selection or take them out')}
              onClick={() => setMulti(!multi)}
            >
              {t('Select')}
            </button>
          )}
          {hasPicture && (
            <button
              type="button"
              className="btn sm outline adjust-toggle"
              aria-pressed={adjusting}
              disabled={exploded}
              title={
                exploded
                  ? t('Turn off Exploded 3D to adjust a wall picture')
                  : t(
                      'Tap a wall with a picture, then drag the picture to shift it or its handles to stretch it',
                    )
              }
              onClick={() => {
                setAdjustOn(!adjusting);
                setMoveOn(false);
              }}
            >
              {t('Adjust wall picture')}
            </button>
          )}
          {adjusting && adjustWall !== null && (
            <button
              type="button"
              className="btn sm outline"
              title={t('Make the picture cover the whole wall')}
              onClick={() => setPictureFit(adjustWall, null)}
            >
              {t('Fill wall')}
            </button>
          )}
          {(moving || adjusting) && (
            <button
              type="button"
              className="btn sm outline snap-toggle"
              aria-pressed={snapOn}
              title={t('Snap within {n} mm to walls and neighbours; hold Alt to place freely', {
                n: SNAP_RANGE,
              })}
              onClick={() => setSnapOn(!snapOn)}
            >
              {t('Snap')}
            </button>
          )}
          {(turnId || modelTurnId) && !tapping && (
            <>
              <button
                type="button"
                className="btn sm outline"
                aria-label={t('Turn 90° anticlockwise about its centre')}
                title={t('Turn about its centre (R)')}
                onClick={() => turnSelected(1)}
              >
                {t('Turn 90° ↺')}
              </button>
              <button
                type="button"
                className="btn sm outline"
                aria-label={t('Turn 90° clockwise about its centre')}
                title={t('Turn about its centre (Shift+R)')}
                onClick={() => turnSelected(-1)}
              >
                {t('Turn 90° ↻')}
              </button>
            </>
          )}
          {/* One-tap Move to over the 3D view while Move is on (ADR-147), behind a toggle so it does not cover it. */}
          {moving && turnId && (
            <button
              type="button"
              className="btn sm outline"
              aria-expanded={moveToOpen}
              onClick={() => setMoveToOpen(!moveToOpen)}
            >
              {t('Move to…')}
            </button>
          )}
          {moving && turnId && moveToOpen && moveTo && (
            <Fragment key={typeof moveToIds === 'string' ? moveToIds : moveToIds?.join(',')}>
              {moveTo(moveToIds ?? turnId, 'three-move-to')}
            </Fragment>
          )}
          <button
            type="button"
            className="btn sm outline section-toggle"
            aria-pressed={section.on}
            title={t('Cut through the project to see inside')}
            onClick={() => setSection({ on: !section.on })}
          >
            {t('Section')}
          </button>
          {(canIsolate || section.isolate) && (
            <button
              type="button"
              className="btn sm outline isolate-toggle"
              // Pressed while Isolate is on, also with nothing selected (it then waits for a selection): the tap turns
              // off what the button shows (G-181), not a value it hid.
              aria-pressed={section.isolate}
              title={t('Show only the selected pieces')}
              onClick={() => setSection({ isolate: !section.isolate })}
            >
              {t('Isolate')}
            </button>
          )}
          {view.mode === 'project' && hasRoom && (
            <button
              type="button"
              className="btn sm outline walls-toggle"
              aria-pressed={solidWalls}
              title={t('Show the room walls solid or see-through')}
              onClick={() => setSolidWalls(!solidWalls)}
            >
              {t('Solid walls')}
            </button>
          )}
          {view.mode === 'project' && hasPieces && (
            <button
              type="button"
              className="btn sm outline zones-toggle"
              aria-pressed={zonesOn}
              title={t('Show clearance zones in 3D')}
              onClick={() => setZonesOn(!zonesOn)}
            >
              {t('Clearances')}
            </button>
          )}
          {sectionOn && (
            <div className="section-tools" role="group" aria-label={t('Section cut')}>
              {(['x', 'y', 'z'] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  className="btn sm outline"
                  aria-pressed={section.axis === a}
                  title={CUT_ACROSS[a]}
                  onClick={() => setSection({ axis: a, at: null })}
                >
                  {AXIS_LABEL[a]}
                </button>
              ))}
              <label className="section-cut">
                <span>{t('Cut at {n} mm', { n: cut ?? '' })}</span>
                <input
                  type="range"
                  min={lo}
                  max={hi}
                  step={1}
                  value={cut ?? lo}
                  aria-label={CUT_POSITION[section.axis]}
                  onChange={(e) => setSection({ at: Number(e.target.value) })}
                />
              </label>
            </div>
          )}
        </div>
      )}
      {adjusting && <PictureNote />}
      {moving && <DragNote snapOn={snapOn} />}
      {moving && <ResizeNote />}
      {moving && <HeightNote />}
      {emptyProject && (
        <div className="no-3d empty-3d">
          <p>{t('Add pieces under Compose to see them in 3D.')}</p>
        </div>
      )}
      {/* The docked card (G-070) folds to one row on a phone (G-058). */}
      {counts && countCard && dock && createPortal(countCard('in-3d docked'), dock)}
      {counts && countCard && !docked && (
        <div ref={cardRef} className="count-anchor" style={{ visibility: 'hidden' }}>
          {countCard('in-3d')}
        </div>
      )}
    </>
  );
}

export * from './ViewerScene';
