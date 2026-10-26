import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { ContactShadows, Edges, Line, OrbitControls } from '@react-three/drei';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { createPortal } from 'react-dom';
import {
  BoxGeometry,
  Color,
  EdgesGeometry,
  DoubleSide,
  type DirectionalLight,
  ExtrudeGeometry,
  Float32BufferAttribute,
  FrontSide,
  Matrix4,
  PMREMGenerator,
  RepeatWrapping,
  SRGBColorSpace,
  Shape,
  Texture,
  TextureLoader,
  Vector2,
  Vector3,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { explode } from '../core/explode';
import { hitToMm, inSelection, selectionBox } from '../core/selectPath';
import { roomDisplayBoxes } from '../core/room';
import { pieceBoxToRoom } from '../core/project';
import { inPlaneAxes, union } from '../core/geometry';
import { aabbOf } from '../core/shape';
import { boxUvs, finishLook, planeUvs } from '../core/surface';
import { imageKey, useImageUrls } from '../persist/images';
import { loadModelScene, type ModelScene } from '../persist/models';
import { modelYaw, type ModelItem } from '../core/model3d';
import { useDesign } from '../store/designStore';
import { useView } from '../ui/useView';
import { PHONE, useMediaQuery } from '../ui/useMediaQuery';
import { useTheme } from '../ui/useTheme';
import { useLook } from '../ui/useLook';
import { SHADOW_CATCHER, setStage, useRendering } from './renderBridge';
import { CountStepper } from '../ui/CountStepper';
import { useSnap } from '../ui/useSnap';
import { SNAP_RANGE } from '../core/snap';
import { S, useGhost, usePieceDrag, type PieceGhost } from './pieceDrag';
import { landingY } from '../core/drag3d';
import type { Box, MaterialImage, Panel } from '../core/types';

const FRONT = new Set<Panel['role']>(['door', 'drawer-front']);
const SELECT = '#2d5b4c';
const HIGHLIGHT = '#f2c230';

const geoCache = new WeakMap<Panel, ExtrudeGeometry>();
const unit = (a: 'x' | 'y' | 'z') => [a === 'x' ? 1 : 0, a === 'y' ? 1 : 0, a === 'z' ? 1 : 0];
/** A profiled board (ADR-040): its outline extruded through the thickness, placed on the blank's in-plane axes. */
function profileGeometry(p: Panel): ExtrudeGeometry {
  const hit = geoCache.get(p);
  if (hit) return hit;
  if (p.shape?.kind !== 'profile') throw new Error('not a profile');
  const pts = p.shape.points;
  const shape = new Shape();
  pts.forEach(([u, v], i) => (i ? shape.lineTo(u * S, v * S) : shape.moveTo(u * S, v * S)));
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

/** A board with a picture (ADR-048): texture coordinates from the core, scaled to the part's size in mm. */
function PictureGeometry({ p, img }: { p: Panel; img: MaterialImage }) {
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
function useTextures(urls: Map<string, string>): Map<string, Texture> {
  const textures = useMemo(() => {
    const m = new Map<string, Texture>();
    const loader = new TextureLoader();
    for (const [id, url] of urls) {
      if (url === 'missing') continue;
      const t = loader.load(url);
      t.wrapS = t.wrapT = RepeatWrapping;
      t.colorSpace = SRGBColorSpace;
      t.anisotropy = 4;
      m.set(id, t);
    }
    return m;
  }, [urls]);
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures]);
  return textures;
}

/**
 * Non-authoritative preview: renders the model's panels exactly as built, never edits them.
 * A tap selects the whole piece, then one level smaller per tap at the hit point (ADR-083).
 * One exception (ADR-093): in a project, the Move button lets a piece be dragged across the floor and the turn
 * buttons or R / Shift+R turn it; both go through the same store actions as the Plan.
 */
export default function Viewer3D() {
  const view = useView();
  const exploded = useDesign((s) => s.exploded);
  const theme = useTheme();
  const look = useLook();
  // A render (ADR-068) always uses the realistic look.
  const rendering = useRendering();
  const realistic = rendering || look === 'realistic';
  // Stage colours come from the stylesheet tokens so the canvas matches the light or dark theme.
  const bg = useMemo(() => {
    void theme;
    return (
      getComputedStyle(document.documentElement).getPropertyValue('--stage-3d').trim() || '#e7eae7'
    );
  }, [theme]);
  const designId = `${view.mode === 'project' ? 'project' : `design:${useDesign.getState().design.id}`}:${exploded ? 'exploded' : 'built'}`;
  // Exploded: positions only, for looking; parts, sheets and checks always use the built model.
  const panels = useMemo(
    () => (exploded ? explode(view.pieces) : view.model.panels),
    [exploded, view],
  );
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
  const counts = (view.mode === 'design' || (view.mode === 'project' && drillOn)) && !rendering;
  // On a phone the short 3D view would be mostly covered by a floating card: it docks under the view (G-070).
  // The slot under the view, which App renders on phones before this lazy viewer mounts; floating when it is missing.
  const phone = useMediaQuery(PHONE);
  const dock = phone ? document.getElementById('count-dock') : null;
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
  const hasPieces = useDesign((s) => inProject && !!s.projectModel?.pieces.length);
  const [moveOn, setMoveOn] = useState(false);
  // Placing a new piece or drawing the room on the Plan turns moving and turning off, as on the Plan (ADR-056, 059).
  const tapping = useDesign((s) => !!s.placingItemId || !!s.drawingRoom);
  const moving = moveOn && hasPieces && !exploded && !rendering && !tapping;
  const [snapOn, setSnapOn] = useSnap();
  const turnId = useDesign((s) =>
    inProject && s.selectedItemId && s.project?.items.some((i) => i.id === s.selectedItemId)
      ? s.selectedItemId
      : null,
  );
  const turnItem = useDesign((s) => s.turnItem);
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
  return (
    <>
      <Canvas
        camera={{ fov: 32, near: 0.01, far: 100 }}
        dpr={[1, 2]}
        shadows={realistic}
        onPointerMissed={() => {
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
        {view.mode === 'project' && !exploded && <RoomWalls />}
        {view.mode === 'project' && !exploded && <ModelItems plain={rendering} />}
        <Fit key={designId} bounds={bounds} />
      </Canvas>
      {hasPieces && !rendering && (
        <div className="three-tools" role="toolbar" aria-label="Place pieces in 3D">
          <button
            type="button"
            className="btn sm outline move-toggle"
            aria-pressed={moving}
            disabled={exploded}
            title={
              exploded
                ? 'Turn off Exploded 3D to move pieces'
                : 'Drag a piece to move it; dragging empty space turns the view'
            }
            onClick={() => setMoveOn(!moveOn)}
          >
            Move
          </button>
          {moving && (
            <button
              type="button"
              className="btn sm outline snap-toggle"
              aria-pressed={snapOn}
              title={`Snap within ${SNAP_RANGE} mm to walls and neighbours; hold Alt to place freely`}
              onClick={() => setSnapOn(!snapOn)}
            >
              Snap
            </button>
          )}
          {turnId && !tapping && (
            <>
              <button
                type="button"
                className="btn sm outline"
                aria-label="Turn 90° anticlockwise about its centre"
                title="Turn about its centre (R)"
                onClick={() => turnItem(turnId, 1)}
              >
                Turn 90° ↺
              </button>
              <button
                type="button"
                className="btn sm outline"
                aria-label="Turn 90° clockwise about its centre"
                title="Turn about its centre (Shift+R)"
                onClick={() => turnItem(turnId, -1)}
              >
                Turn 90° ↻
              </button>
            </>
          )}
        </div>
      )}
      {moving && <DragNote snapOn={snapOn} />}
      {emptyProject && (
        <div className="no-3d empty-3d">
          <p>Add pieces under Compose to see them in 3D.</p>
        </div>
      )}
      {/* The docked card (G-070) folds to one row on a phone (G-058). */}
      {counts && dock && createPortal(<CountStepper className="in-3d docked" foldable />, dock)}
      {counts && !docked && (
        <div ref={cardRef} className="count-anchor" style={{ visibility: 'hidden' }}>
          <CountStepper className="in-3d" foldable />
        </div>
      )}
    </>
  );
}

/** The project piece loaded for edits from the project editor while it is the selected piece (ADR-088). */
function useDrillItem() {
  const project = useDesign((s) => s.project);
  const id = useDesign((s) =>
    s.project && !s.editingItemId && s.drillItemId === s.selectedItemId ? s.drillItemId : null,
  );
  return useMemo(() => (id ? project?.items.find((i) => i.id === id) : undefined), [project, id]);
}

/** How much of a panel outside the selected space shows (ADR-087). */
const FADED = 0.28;

/**
 * The selected space's or piece's box as a thick outline (ADR-087), drawn over the panels so it shows through the
 * doors, a few mm outside the box so it does not hide in the panel edges.
 */
function SelectionOutline({ box }: { box: Box }) {
  const points = useMemo(() => {
    const o = 3;
    const [x0, x1] = [(box.x - o) * S, (box.x + box.w + o) * S];
    const [y0, y1] = [(box.y - o) * S, (box.y + box.h + o) * S];
    const [z0, z1] = [(box.z - o) * S, (box.z + box.d + o) * S];
    const c = (x: number, y: number, z: number) => [x, y, z] as [number, number, number];
    const corners = [x0, x1].flatMap((x) =>
      [y0, y1].flatMap((y) => [z0, z1].map((z) => c(x, y, z))),
    );
    // Index = 4·x + 2·y + z; an edge joins corners that differ in one bit.
    const segs: [number, number, number][] = [];
    for (let i = 0; i < 8; i++)
      for (const bit of [1, 2, 4]) if (!(i & bit)) segs.push(corners[i], corners[i | bit]);
    return segs;
  }, [box]);
  return (
    <Line
      points={points}
      segments
      color={SELECT}
      lineWidth={3.5}
      depthTest={false}
      depthWrite={false}
      // Drawn last, after the transparent (faded) panels, so nothing covers it.
      transparent
      renderOrder={10}
      raycast={() => null}
    />
  );
}

/**
 * Quick counts (ADR-085): the same − N + card as over the drawing, a DOM overlay beside the canvas, placed each frame
 * right above the front top edge of the selected space and kept inside the view. The viewer itself still only
 * selects; the card changes the design through the store.
 */
function CountsAnchor({
  place,
  inProject,
}: {
  place: (at: { x: number; y: number } | null) => void;
  inProject: boolean;
}) {
  const selectedId = useDesign((s) => s.selectedId);
  const model = useDesign((s) => s.model);
  const item = useDrillItem();
  // The whole piece (ADR-083 `null`) anchors on the piece's bounds; the same box the selection outline draws (ADR-087).
  // In a project the box is placed in the room like the piece (ADR-088).
  const box = useMemo(() => {
    const local = selectionBox(model, inProject ? (selectedId ?? null) : selectedId);
    if (!inProject) return local;
    return item && local ? pieceBoxToRoom(item, model, local) : undefined;
  }, [model, selectedId, inProject, item]);
  const v = useMemo(() => new Vector3(), []);
  useFrame(({ camera, size }) => {
    if (!box) return place(null);
    v.set((box.x + box.w / 2) * S, (box.y + box.h) * S, (box.z + box.d) * S).project(camera);
    place(v.z > 1 ? null : { x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height });
  });
  return null;
}

/** Lets the path tracer (ADR-068) read the scene and camera the user is looking at. */
function Stage() {
  const { scene, camera } = useThree();
  useEffect(() => {
    setStage({ scene, camera });
    return () => setStage(null);
  }, [scene, camera]);
  return null;
}

/** Image-based light (ADR-067) from three's generated room, so no light file is downloaded or shipped (ADR-002). */
function RoomLight() {
  const get = useThree((s) => s.get);
  useEffect(() => {
    const { gl, scene } = get();
    const pmrem = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.35;
    room.dispose();
    pmrem.dispose();
    return () => {
      if (scene.environment === env) scene.environment = null;
      env.dispose();
    };
  }, [get]);
  return null;
}

/** One sun-like light above and to the front-right that casts soft shadows over the whole piece or project. */
function KeyLight({ bounds }: { bounds: Box }) {
  const ref = useRef<DirectionalLight>(null);
  const get = useThree((s) => s.get);
  const cx = (bounds.x + bounds.w / 2) * S,
    cy = (bounds.y + bounds.h / 2) * S,
    cz = (bounds.z + bounds.d / 2) * S;
  const r = Math.max(0.5, 0.6 * Math.hypot(bounds.w, bounds.h, bounds.d) * S);
  const e = r * 1.5;
  useEffect(() => {
    const l = ref.current;
    if (!l) return;
    const { scene } = get();
    l.target.position.set(cx, cy, cz);
    scene.add(l.target);
    l.shadow.camera.updateProjectionMatrix();
    return () => {
      scene.remove(l.target);
    };
  }, [get, cx, cy, cz, e]);
  return (
    <directionalLight
      ref={ref}
      position={[cx - r * 1.2, cy + r * 2.2, cz + r * 1.4]}
      intensity={1.3}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-radius={4}
      shadow-bias={-0.0004}
      shadow-normalBias={0.01}
      shadow-camera-left={-e}
      shadow-camera-right={e}
      shadow-camera-top={e}
      shadow-camera-bottom={-e}
      shadow-camera-near={0.05}
      shadow-camera-far={r * 6}
    />
  );
}

/** An invisible floor that only shows the shadows falling on it. */
function ShadowCatcher({ bounds }: { bounds: Box }) {
  const size = Math.max(bounds.w, bounds.d, 1000) * S * 4;
  return (
    <mesh
      name={SHADOW_CATCHER}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[(bounds.x + bounds.w / 2) * S, -0.0005, (bounds.z + bounds.d / 2) * S]}
      receiveShadow
      raycast={() => null}
    >
      <planeGeometry args={[size, size]} />
      <shadowMaterial opacity={0.35} />
    </mesh>
  );
}

/** Ambient occlusion with three's own GTAO pass: soft darkening where boards meet (ADR-067). */
function Occlusion() {
  const { gl, scene, camera, size } = useThree();
  const composer = useMemo(() => {
    const c = new EffectComposer(gl);
    c.addPass(new RenderPass(scene, camera));
    const ao = new GTAOPass(scene, camera, size.width, size.height);
    ao.blendIntensity = 0.9;
    ao.updateGtaoMaterial({ radius: 0.12, distanceFallOff: 1, thickness: 1 });
    c.addPass(ao);
    c.addPass(new OutputPass());
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera]);
  useEffect(() => {
    composer.setPixelRatio(gl.getPixelRatio());
    composer.setSize(size.width, size.height);
  }, [composer, gl, size.width, size.height]);
  useEffect(() => () => composer.dispose(), [composer]);
  // Priority 1 takes over drawing from the default renderer.
  useFrame(() => composer.render(), 1);
  return null;
}

/** Display-only 3D models of the project (ADR-076): shown and selectable, never edited (ADR-014). */
function ModelItems({ plain }: { plain: boolean }) {
  const models = useDesign((s) => s.projectModel?.models);
  if (!models?.length) return null;
  return (
    <>
      {models.map((m) => (
        <ModelItemMesh key={m.item.id} item={m.item} box={m.box} plain={plain} />
      ))}
    </>
  );
}

/** One model scaled to its size in mm and turned in its box; a plain box while loading or when not on this device. */
function ModelItemMesh({ item, box, plain }: { item: ModelItem; box: Box; plain: boolean }) {
  const [loaded, setLoaded] = useState<{ id: string; scene: ModelScene | null } | null>(null);
  useEffect(() => {
    let live = true;
    void loadModelScene(item.modelId).then((scene) => {
      if (live) setLoaded({ id: item.modelId, scene });
    });
    return () => {
      live = false;
    };
  }, [item.modelId]);
  const ms = loaded?.id === item.modelId ? loaded.scene : null;
  const clone = useMemo(() => ms?.scene.clone(true) ?? null, [ms]);
  const selected = useDesign((s) => s.selectedItemId === item.id) && !plain;
  const selectItem = useDesign((s) => s.selectItem);
  const { w, h, d } = item.size;
  const outline = useMemo(() => new EdgesGeometry(new BoxGeometry(w * S, h * S, d * S)), [w, h, d]);
  useEffect(() => () => outline.dispose(), [outline]);
  // Uniform scale (proportions locked), taken along the model's longest side.
  const scale = (() => {
    if (!ms) return 1;
    const native = ms.size,
      mm = [w, h, d];
    const k = native.indexOf(Math.max(...native));
    return native[k] > 0 ? (mm[k] * S) / native[k] : 1;
  })();
  return (
    <group
      position={[(box.x + box.w / 2) * S, (box.y + box.h / 2) * S, (box.z + box.d / 2) * S]}
      rotation={[0, (modelYaw(item) * Math.PI) / 180, 0]}
      onClick={(e) => {
        e.stopPropagation();
        selectItem(item.id);
      }}
    >
      {clone && ms ? (
        <group scale={scale}>
          <group position={[-ms.center[0], -ms.center[1], -ms.center[2]]}>
            <primitive object={clone} />
          </group>
        </group>
      ) : (
        <mesh>
          <boxGeometry args={[w * S, h * S, d * S]} />
          <meshStandardMaterial color="#9aa3a0" transparent opacity={0.45} depthWrite={false} />
        </mesh>
      )}
      {selected && (
        <lineSegments geometry={outline} raycast={() => null}>
          <lineBasicMaterial color={SELECT} />
        </lineSegments>
      )}
    </group>
  );
}

/** The project's room (ADR-058): translucent walls with openings, obstacles; display only, never picked. */
function RoomWalls() {
  const room = useDesign((s) => s.project?.room);
  const boxes = useMemo(() => (room ? roomDisplayBoxes(room) : null), [room]);
  if (!boxes) return null;
  const mesh = (b: Box, key: string, color: string, opacity: number) => (
    <mesh
      key={key}
      position={[(b.x + b.w / 2) * S, (b.y + b.h / 2) * S, (b.z + b.d / 2) * S]}
      raycast={() => null}
    >
      <boxGeometry args={[b.w * S, b.h * S, b.d * S]} />
      <meshStandardMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
  return (
    <>
      {boxes.walls.map((b, i) => mesh(b, `w${i}`, '#c9cdc8', 0.28))}
      {boxes.obstacles.map((b, i) => mesh(b, `o${i}`, '#b3261e', 0.35))}
      {room && boxes.walls.length > 0 && <RoomFloor outline={room.outline} />}
    </>
  );
}

/** The floor inside the room outline, just under the pieces. */
function RoomFloor({ outline }: { outline: [number, number][] }) {
  const shape = useMemo(
    () => new Shape(outline.map(([x, z]) => new Vector2(x * S, -z * S))),
    [outline],
  );
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} raycast={() => null}>
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial
        color="#d9dcd6"
        transparent
        opacity={0.35}
        depthWrite={false}
        side={DoubleSide}
      />
    </mesh>
  );
}

function Fit({ bounds }: { bounds: Box }) {
  const { camera, size: view } = useThree();
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const target = useMemo(
    () =>
      [
        (bounds.x + bounds.w / 2) * S,
        (bounds.y + bounds.h / 2) * S,
        (bounds.z + bounds.d / 2) * S,
      ] as const,
    [bounds],
  );
  // Distance that fits the bounding sphere in the narrower field of view.
  const radius = 0.5 * Math.hypot(bounds.w, bounds.h, bounds.d) * S;
  const vfov = (32 * Math.PI) / 180;
  const aspect = view.width > 10 && view.height > 10 ? view.width / view.height : 1;
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
  const fitDist = (radius / Math.sin(Math.min(vfov, hfov) / 2)) * 1.08;
  // Frame once per design (and when the user asks); editing dimensions must not yank the camera.
  useEffect(() => {
    const dist = fitDist / Math.hypot(0.55, 0.35, 0.85);
    camera.position.set(target[0] + dist * 0.55, target[1] + dist * 0.35, target[2] + dist * 0.85);
    camera.lookAt(...target);
    controls.current?.target.set(...target);
    controls.current?.update();
    const onFit = () => {
      camera.position.set(
        target[0] + dist * 0.55,
        target[1] + dist * 0.35,
        target[2] + dist * 0.85,
      );
      controls.current?.target.set(...target);
      controls.current?.update();
    };
    window.addEventListener('fb:fit', onFit);
    return () => window.removeEventListener('fb:fit', onFit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.12}
      minDistance={0.2}
      maxDistance={20}
    />
  );
}

function Panels({
  panels,
  realistic,
  plain,
  moving = false,
  snapOn = true,
}: {
  panels: Panel[];
  realistic: boolean;
  /** No selection or hover tint (while rendering a picture). */
  plain: boolean;
  /** Move mode in a project (ADR-093): pressing a piece drags it across the floor. */
  moving?: boolean;
  snapOn?: boolean;
}) {
  const view = useView();
  const materials = view.materials;
  const selectedSpace = useDesign((s) => s.selectedId);
  const selectedItem = useDesign((s) => s.selectedItemId);
  const selectedId = view.mode === 'project' ? selectedItem : selectedSpace;
  const highlight = useDesign((s) => s.highlight);
  const showFronts = useDesign((s) => s.showFronts);
  const tapPiece = useDesign((s) => s.tapPiece);
  const tapItem = useDesign((s) => s.tapItem);
  const exploded = useDesign((s) => s.exploded);
  const built = useMemo(() => new Map(view.model.panels.map((p) => [p.id, p])), [view.model]);
  const colors = useMemo(() => new Map(materials.map((m) => [m.id, m.color])), [materials]);
  const finishes = useMemo(() => new Map(materials.map((m) => [m.id, m.finish])), [materials]);
  const images = useMemo(
    () => new Map(materials.flatMap((m) => (m.image ? [[m.id, m.image] as const] : []))),
    [materials],
  );
  const textures = useTextures(useImageUrls(imageKey(materials)));
  const hl = useMemo(() => new Set(highlight), [highlight]);
  // Selection look A (ADR-087): a thick outline round the selected space or piece, everything outside it faded.
  // Simple and Realistic looks (G-064); never in a rendered picture. In a project, for the piece drilled into
  // (ADR-088): the box is placed in the room, and the fade is decided in the piece's own mm.
  const drillModel = useDesign((s) => s.model);
  const drillItem = useDrillItem();
  const inProject = view.mode === 'project';
  const look = !plain;
  const outline = useMemo(() => {
    if (!look) return undefined;
    if (!inProject) return selectionBox(view.model, selectedSpace);
    const local = drillItem && selectionBox(drillModel, selectedSpace ?? null);
    return drillItem && local ? pieceBoxToRoom(drillItem, drillModel, local) : undefined;
  }, [look, inProject, view.model, selectedSpace, drillItem, drillModel]);
  const fadeBox = !look
    ? undefined
    : !inProject
      ? outline
      : drillItem && typeof selectedSpace === 'string'
        ? selectionBox(drillModel, selectedSpace)
        : undefined;
  const local = useMemo(() => new Map(drillModel.panels.map((p) => [p.id, p])), [drillModel]);
  const drag = usePieceDrag(inProject && moving, snapOn);
  const prefix = drillItem ? `${drillItem.id}:` : '';
  const ownId = inProject ? `${prefix}${selectedSpace}` : selectedSpace;
  const isFaded = (p: Panel) => {
    if (!fadeBox) return false;
    if (!inProject) return !inSelection(fadeBox, (built.get(p.id) ?? p).box);
    const own = p.id.startsWith(prefix) ? local.get(p.id.slice(prefix.length)) : undefined;
    return !own || !inSelection(fadeBox, own.box);
  };

  return (
    <group>
      {outline && !exploded && (
        // Keyed by the box: drei's segment line does not pick up changed points.
        <SelectionOutline
          key={`${outline.x},${outline.y},${outline.w},${outline.h}`}
          box={outline}
        />
      )}
      {moving && <MoveGhost panels={view.model.panels} showFronts={showFronts} />}
      {panels
        .filter((p) => showFronts || !FRONT.has(p.role))
        .map((p) => {
          const b = p.box;
          // The whole piece selected (ADR-083) tints every panel.
          const selected =
            !plain &&
            (view.mode === 'project'
              ? !!selectedId && p.nodeId.startsWith(`${selectedId}:`)
              : selectedId === null || p.nodeId === selectedId);
          const lit = !plain && hl.has(p.id);
          const faded = isFaded(p);
          // With the outline, only the selected space's own panels are marked (green edges), and no tint.
          const tinted = selected && !outline;
          const own = !!outline && p.nodeId === ownId;
          // A picture replaces the plain colour; without a readable one the plain colour stays (ADR-048).
          const img = images.get(p.materialId);
          const map = img ? textures.get(img.id) : undefined;
          const base = map ? '#ffffff' : (colors.get(p.materialId) ?? '#cccccc');
          const color = lit
            ? HIGHLIGHT
            : tinted
              ? new Color(base).lerp(new Color(SELECT), 0.45).getStyle()
              : base;
          const side = p.shape?.kind === 'profile' ? DoubleSide : FrontSide;
          const look = realistic ? (
            <>
              {/* Realistic (ADR-067): the finish sets how matte or glossy a board is; backs stay opaque. Panel edges are
                  not drawn (drei's edge outline is a mesh the occlusion pass would smear); the selection outline is. */}
              <meshPhysicalMaterial
                key={`${map ? map.uuid : 'plain'}${faded ? ':faded' : ''}`}
                map={map ?? null}
                color={color}
                metalness={0}
                {...finishLook(finishes.get(p.materialId))}
                transparent={faded}
                opacity={faded ? FADED : 1}
                depthWrite={!faded}
                side={side}
              />
            </>
          ) : (
            <>
              <meshStandardMaterial
                key={`${map ? map.uuid : 'plain'}${faded ? ':faded' : ''}`}
                map={map ?? null}
                color={color}
                roughness={0.78}
                metalness={0}
                transparent={p.role === 'back' || faded}
                opacity={faded ? FADED : p.role === 'back' ? 0.92 : 1}
                depthWrite={!faded}
                side={side}
              />
              <Edges
                threshold={15}
                color={tinted || own ? SELECT : '#3b403c'}
                lineWidth={tinted || own ? 1.6 : 1}
                transparent={faded}
                opacity={faded ? FADED : 1}
              />
            </>
          );
          // Outside in, one level per tap at the hit point (ADR-083).
          const onClick = (e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            // The click ending a 3D move (or the press that selected the piece) does nothing more (ADR-093).
            if (drag.clicked()) return;
            const at = hitToMm(e.point, built.get(p.id), exploded);
            if (view.mode === 'project') tapItem(p.nodeId.split(':')[0], at);
            else tapPiece(at.x, at.y);
          };
          const onDown = (e: ThreeEvent<PointerEvent>) => drag.press(e, p.nodeId.split(':')[0]);
          const geometry =
            map && img ? (
              <PictureGeometry p={p} img={img} />
            ) : (
              <boxGeometry args={[b.w * S, b.h * S, b.d * S]} />
            );
          if (p.shape?.kind === 'profile') {
            return map && img ? (
              <mesh
                key={p.id}
                onClick={onClick}
                onPointerDown={onDown}
                castShadow={realistic}
                receiveShadow={realistic}
              >
                <PictureGeometry p={p} img={img} />
                {look}
              </mesh>
            ) : (
              <mesh
                key={p.id}
                geometry={profileGeometry(p)}
                onClick={onClick}
                onPointerDown={onDown}
                castShadow={realistic}
                receiveShadow={realistic}
              >
                {look}
              </mesh>
            );
          }
          const mesh = (
            <mesh
              key={p.id}
              position={[(b.x + b.w / 2) * S, (b.y + b.h / 2) * S, (b.z + b.d / 2) * S]}
              onClick={onClick}
              onPointerDown={onDown}
              castShadow={realistic}
              receiveShadow={realistic}
            >
              {geometry}
              {look}
            </mesh>
          );
          if (p.shape?.kind !== 'tilt') return mesh;
          // Tilted part (ADR-040): the blank turned about its pivot, right-hand rule, as in the model.
          const s = p.shape,
            pv = [b.x + s.pivot[0], b.y + s.pivot[1], b.z + s.pivot[2]],
            a = (s.angleDeg * Math.PI) / 180;
          return (
            <group
              key={p.id}
              position={[pv[0] * S, pv[1] * S, pv[2] * S]}
              rotation={[s.axis === 'x' ? a : 0, s.axis === 'y' ? a : 0, s.axis === 'z' ? a : 0]}
            >
              <mesh
                position={[
                  (b.x + b.w / 2 - pv[0]) * S,
                  (b.y + b.h / 2 - pv[1]) * S,
                  (b.z + b.d / 2 - pv[2]) * S,
                ]}
                onClick={onClick}
                onPointerDown={onDown}
                castShadow={realistic}
                receiveShadow={realistic}
              >
                {geometry}
                {look}
              </mesh>
            </group>
          );
        })}
    </group>
  );
}

/**
 * The translucent copy of a dragged piece (ADR-093), where it would land: its boards' outlines moved by the drop the
 * core worked out. Display only, never picked.
 */
function MoveGhost({ panels, showFronts }: { panels: Panel[]; showFronts: boolean }) {
  const ghost = useGhost();
  return ghost ? <GhostBoxes ghost={ghost} panels={panels} showFronts={showFronts} /> : null;
}

function GhostBoxes({
  ghost,
  panels,
  showFronts,
}: {
  ghost: PieceGhost;
  panels: Panel[];
  showFronts: boolean;
}) {
  const own = useMemo(
    () =>
      panels
        .filter((p) => p.nodeId.startsWith(`${ghost.id}:`) && (showFronts || !FRONT.has(p.role)))
        .map(aabbOf),
    [panels, ghost.id, showFronts],
  );
  const item = useDesign((s) => s.project?.items.find((i) => i.id === ghost.id));
  if (!item) return null;
  // Where the drop puts it (core): across the floor, and down to the floor when lifted off another piece.
  const dx = ghost.target.position.x - item.position.x,
    dy = landingY(item) - item.position.y,
    dz = ghost.target.position.z - item.position.z;
  const color = ghost.target.snap ? '#2e7d4f' : SELECT;
  return (
    <group position={[dx * S, dy * S, dz * S]}>
      {own.map((b, i) => (
        <mesh
          key={i}
          position={[(b.x + b.w / 2) * S, (b.y + b.h / 2) * S, (b.z + b.d / 2) * S]}
          raycast={() => null}
          renderOrder={5}
        >
          <boxGeometry args={[b.w * S, b.h * S, b.d * S]} />
          <meshBasicMaterial color={color} transparent opacity={0.28} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

/** The live drop label over the 3D view while a piece is dragged (ADR-093), as on the Plan (ADR-080). */
function DragNote({ snapOn }: { snapOn: boolean }) {
  const ghost = useGhost();
  if (!ghost) return null;
  const t = ghost.target;
  return (
    <span className="plan-drag-note three-drag-note" role="status">
      From left {t.position.x} · From back {t.position.z} mm{' · '}
      {t.snap
        ? `Snaps: ${[t.snap.label, ...t.snap.notes].join(' · ')}`
        : (t.hint ?? (!ghost.snapping && snapOn ? 'Alt held: placing freely.' : 'Snap is off.'))}
    </span>
  );
}
