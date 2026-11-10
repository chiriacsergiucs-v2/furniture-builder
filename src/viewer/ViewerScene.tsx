// The 3D view's scene parts: panels, room, models, handles, overlays and the ⋯ menu (ADR-014): moved out of Viewer3D.tsx unchanged (cleanup audit 2026-11-09, item 13).
import { invalidate, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  type BufferGeometry,
  BoxGeometry,
  Color,
  EdgesGeometry,
  DoubleSide,
  type DirectionalLight,
  Float32BufferAttribute,
  FrontSide,
  type Intersection,
  type Material,
  Mesh,
  PMREMGenerator,
  Plane,
  PlaneGeometry,
  type Raycaster,
  Shape,
  ShapeGeometry,
  Vector2,
  Vector3,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { useFocusedProblem } from '../store/focusedProblem';
import { connectionSeams } from '../core/connections';
import { t } from '../core/i18n';
import { hitToMm, inSelection, selectionBox } from '../core/selectPath';
import {
  floorRect,
  roomDisplayBoxes,
  wallFinish,
  type Room,
  type WallFinish,
  type WallRect,
} from '../core/room';
import {
  boxSpan,
  pictureRect,
  rectLabel,
  splitSpan,
  wallAxes,
  wallToRoom,
  type PictureHandle,
  type WallPatch,
} from '../core/wallPicture';
import { pictureKey, useWallPictureUrls } from '../store/wallPictures';
import { useAdjustWall, usePictureDrag, usePicturePreview } from './wallPictureDrag';
import { pieceBoxToRoom, type PlacedPiece } from '../core/project';
import { aabbOf } from '../core/shape';
import { imageKey, useImageUrls } from '../store/useImageUrls';
import { loadModelScene, type ModelScene } from '../persist/models';
import { modelBox, modelYaw, type ModelItem } from '../core/model3d';
import { useDesign } from '../store/designStore';
import { setRooms } from '../core/setRoom';
import { useView, ViewOverride } from '../store/useView';
import { useSolidWalls } from '../store/useSolidWalls';
import { SHADOW_CATCHER, setCapture, setStage } from './renderBridge';
import type { ClearanceZone } from '../core/envelopes';
import { useViewStore } from '../store/viewStore';
import {
  boxOf,
  edgePositions,
  lookKey,
  makeMaterial,
  MergedEdges,
  panelMatrix,
  Pool,
  SELECT,
  sizeKey,
  type BoardLook,
  type EdgeItem,
} from './panelResources';
import { S, useGhost, usePieceDrag, type PieceGhost } from './pieceDrag';
import { landingY } from '../core/drag3d';
import { useModelResize, useResizePreview, type HandleAxis } from './modelResize';
import {
  cancelARCorner,
  cycleARPoint,
  enterAR,
  exitAR,
  exportUsdz,
  keepTapsForButtons,
  nudgeAR,
  placeARAgain,
  cycleARSizes,
  startARCorner,
  stepARWallGap,
  toggleAROcclusion,
  toggleARStep,
  turnAR,
  turnARStep,
  useARSupported,
  useARUi,
} from './AR';
import { useHeightDrag, useHeightPreview } from './heightDrag';
import { type SectionAxis } from './section';
import { heightDraggable, heightLabel } from '../core/height';
import type { Box, Panel, Yaw } from '../core/types';

import {
  followUpGeometry,
  FRONT,
  HIGHLIGHT,
  PictureGeometry,
  profileGeometry,
  useTextures,
} from './Viewer3D';

/**
 * The 3D toolbar's ⋯ menu (ADR-208): View in AR when this device offers immersive AR, and Export for AR (.usdz). The
 * AR overlay (dom-overlay) holds the hint, Turn 90° ↻ and Exit AR.
 */
export function ThreeMore({ name }: { name: string }) {
  const canAR = useARSupported();
  const arUi = useARUi();
  const ar = arUi.state;
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const overlay = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  // Taps on the overlay's buttons must not also place the furniture (WebXR 'beforexrselect'); taps elsewhere must.
  useEffect(() => {
    const el = overlay.current;
    if (!el) return;
    el.addEventListener('beforexrselect', keepTapsForButtons);
    return () => el.removeEventListener('beforexrselect', keepTapsForButtons);
  }, []);
  // AR hints (ADR-213 to ADR-215): look for the floor first, then what a tap does in the current mode.
  const hint =
    ar === 'placing'
      ? !arUi.found
        ? t('Looking for the floor — move the phone slowly.')
        : arUi.corner === 'first'
          ? arUi.walls
            ? t('Both walls found — tap to place in the corner.')
            : t('Tap the floor in the room corner.')
          : arUi.corner === 'second'
            ? t('Tap the floor along the wall the back goes against.')
            : t('Tap to place it on the outline.')
      : ar === 'placed'
        ? t('Placed at full size. Drag it, fine-tune with the arrows, or Place again.')
        : '';
  const sizesName =
    arUi.sizes === 'overall' ? t('Overall') : arUi.sizes === 'piece' ? t('Per piece') : t('Off');
  // The wall gap shows in Room corner mode and once placed by a corner (ADR-218).
  const showGap = (ar === 'placing' && !!arUi.corner) || (ar === 'placed' && arUi.byCorner);
  const pointName =
    arUi.point === 'centre'
      ? t('Centre')
      : arUi.point === 'back-left'
        ? t('Back-left')
        : t('Back-right');
  return (
    <>
      <details className="menu three-more" ref={menu}>
        <summary aria-label={t('More 3D actions')}>⋯</summary>
        <div className="three-more-panel" role="group" aria-label={t('More 3D actions')}>
          {canAR && (
            <button
              type="button"
              className="btn sm outline"
              onClick={async () => {
                menu.current?.removeAttribute('open');
                setNote(await enterAR(overlay.current));
              }}
            >
              {t('View in AR')}
            </button>
          )}
          <button
            type="button"
            className="btn sm outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setNote(await exportUsdz(name));
              setBusy(false);
              menu.current?.removeAttribute('open');
            }}
          >
            {t('Export for AR (.usdz)')}
          </button>
        </div>
      </details>
      {note && (
        <span className="plan-drag-note three-drag-note locked" role="alert">
          {note}
        </span>
      )}
      {/* On the page body, so no toolbar stacking context puts it under the app bar (in-page overlay). */}
      {createPortal(
        <div ref={overlay} className="ar-overlay" hidden={ar === 'off'}>
          <p className="ar-hint" role="status">
            {hint}
          </p>
          <div className="ar-actions">
            {ar === 'placed' && (
              <div className="ar-pad" role="group" aria-label={t('Fine-tune')}>
                <button
                  type="button"
                  className="btn"
                  aria-label={t('Turn left by the step')}
                  onClick={() => turnARStep(false)}
                >
                  ↺
                </button>
                <button type="button" className="btn" onClick={() => nudgeAR('back')}>
                  {t('↑ Back')}
                </button>
                <button
                  type="button"
                  className="btn"
                  aria-label={t('Turn right by the step')}
                  onClick={() => turnARStep(true)}
                >
                  ↻
                </button>
                <button type="button" className="btn" onClick={() => nudgeAR('left')}>
                  {t('← Left')}
                </button>
                <button type="button" className="btn" onClick={() => nudgeAR('forward')}>
                  {t('↓ Forward')}
                </button>
                <button type="button" className="btn" onClick={() => nudgeAR('right')}>
                  {t('→ Right')}
                </button>
              </div>
            )}
            {showGap && (
              <div className="ar-row ar-gap" role="group" aria-label={t('Wall gap')}>
                <button
                  type="button"
                  className="btn"
                  aria-label={t('Less wall gap')}
                  disabled={arUi.gap <= 0}
                  onClick={() => stepARWallGap(false)}
                >
                  −
                </button>
                <span className="ar-gap-value">{t('Wall gap: {mm} mm', { mm: arUi.gap })}</span>
                <button
                  type="button"
                  className="btn"
                  aria-label={t('More wall gap')}
                  disabled={arUi.gap >= 200}
                  onClick={() => stepARWallGap(true)}
                >
                  +
                </button>
              </div>
            )}
            <div className="ar-row">
              {ar === 'placing' && !arUi.corner && (
                <>
                  <button type="button" className="btn" onClick={cycleARPoint}>
                    {t('Point: {name}', { name: pointName })}
                  </button>
                  <button type="button" className="btn" onClick={startARCorner}>
                    {t('Room corner')}
                  </button>
                </>
              )}
              {ar === 'placing' && arUi.corner && (
                <button type="button" className="btn" onClick={cancelARCorner}>
                  {t('Cancel corner')}
                </button>
              )}
              {ar === 'placed' && (
                <>
                  <button type="button" className="btn" onClick={toggleARStep}>
                    {arUi.fine ? t('Step: 1 cm / 1°') : t('Step: 10 cm / 15°')}
                  </button>
                  <button type="button" className="btn" onClick={turnAR}>
                    {t('Turn 90° ↻')}
                  </button>
                  <button type="button" className="btn" onClick={placeARAgain}>
                    {t('Place again')}
                  </button>
                  <button type="button" className="btn" onClick={cycleARSizes}>
                    {t('Sizes: {name}', { name: sizesName })}
                  </button>
                  {arUi.depth && (
                    <button type="button" className="btn" onClick={toggleAROcclusion}>
                      {arUi.occlusion
                        ? t('Hide behind real objects: On')
                        : t('Hide behind real objects: Off')}
                    </button>
                  )}
                </>
              )}
              <button type="button" className="btn solid" onClick={exitAR}>
                {t('Exit AR')}
              </button>
            </div>
          </div>
        </div>,
        document.body,
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
 * A thin vertical line along the seam of every connection that still holds (ADR-179), at the pieces' front face,
 * from `connectionSeams`; display only, never picked (ADR-014). Not drawn while exploded or rendering. While
 * isolating (`only`), only seams between two shown pieces. The view store's `seams` holds the number drawn (ADR-230;
 * App shows it as `data-seams` on the 3D view for the find-it script).
 */
export function SeamLines({ color, only }: { color: string; only?: readonly string[] }) {
  const project = useDesign((s) => s.project);
  const pieces = useDesign((s) => s.projectModel?.pieces);
  const seams = useMemo(() => {
    if (!project || !pieces) return [];
    const all = connectionSeams(project, pieces);
    return only ? all.filter((c) => c.itemIds.every((id) => only.includes(id))) : all;
  }, [project, pieces, only]);
  const setSeams = useViewStore((s) => s.setSeams);
  useEffect(() => {
    setSeams(seams.length);
    return () => setSeams(null);
  }, [seams.length, setSeams]);
  const points = useMemo(() => {
    // A few mm in front of the face, so the line does not hide in the door edges.
    const o = 2;
    return seams.flatMap((c) => {
      const [x, z] = c.front;
      const dx = c.x1 === c.x2 ? 0 : x === c.x2 ? o : -o;
      const dz = c.x1 === c.x2 ? (z === c.z2 ? o : -o) : 0;
      return [
        [(x + dx) * S, c.y1 * S, (z + dz) * S] as [number, number, number],
        [(x + dx) * S, c.y2 * S, (z + dz) * S] as [number, number, number],
      ];
    });
  }, [seams]);
  if (!points.length) return null;
  return (
    <Line
      // drei's segment line does not pick up changed points.
      key={points.flat().join(',')}
      points={points}
      segments
      color={color}
      lineWidth={2}
      raycast={() => null}
    />
  );
}

/**
 * Quick counts (ADR-085): the same − N + card as over the drawing, a DOM overlay beside the canvas, placed each frame
 * right above the front top edge of the selected space and kept inside the view. The viewer itself still only
 * selects; the card changes the design through the store.
 */
export function CountsAnchor({
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
export function Stage() {
  const { scene, camera, gl } = useThree();
  useEffect(() => {
    setStage({ scene, camera });
    // A still for the client sheet and the assembly print's step pictures (ADR-206): one frame drawn and read.
    setCapture(() => {
      gl.render(scene, camera);
      const url = gl.domElement.toDataURL('image/png');
      invalidate();
      return url.startsWith('data:image/png') ? url : null;
    });
    return () => {
      setStage(null);
      setCapture(null);
    };
  }, [scene, camera, gl]);
  return null;
}

/** Image-based light (ADR-067) from three's generated room, so no light file is downloaded or shipped (ADR-002). */
export function RoomLight() {
  const get = useThree((s) => s.get);
  useEffect(() => {
    const { gl, scene } = get();
    const pmrem = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.35;
    invalidate();
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
export function KeyLight({ bounds }: { bounds: Box }) {
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
    invalidate();
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
export function ShadowCatcher({ bounds }: { bounds: Box }) {
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
export function Occlusion() {
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
  // Priority 1 takes over drawing from the default renderer. In AR the composer's passes would draw through the XR
  // camera into its own targets and show nothing, so AR draws the scene directly.
  useFrame(() => (gl.xr.isPresenting ? gl.render(scene, camera) : composer.render()), 1);
  return null;
}

/** Display-only 3D models of the project (ADR-076): shown and selectable; in Move mode the selected one is resized (ADR-102). */
export function ModelItems({
  plain,
  moving,
  snapOn,
}: {
  plain: boolean;
  moving: boolean;
  snapOn: boolean;
}) {
  const models = useDesign((s) => s.projectModel?.models);
  const preview = useResizePreview();
  // In Move mode a model drags across the floor as a piece does (ADR-203, G-105).
  const drag = usePieceDrag(moving, snapOn);
  if (!models?.length) return null;
  return (
    <>
      {models.map((m) => {
        // While a handle is dragged (ADR-102), the model shows the size it would get.
        const item = preview?.id === m.item.id ? { ...m.item, size: preview.size } : m.item;
        const box = item === m.item ? m.box : modelBox(item);
        return (
          <ModelItemMesh
            key={m.item.id}
            item={item}
            box={box}
            plain={plain}
            handles={moving ? m.item : null}
            drag={drag}
          />
        );
      })}
    </>
  );
}

/** One model stretched to its size in mm and turned in its box; a plain box while loading or when not on this device. */
function ModelItemMesh({
  item,
  box,
  plain,
  handles,
  drag,
}: {
  item: ModelItem;
  box: Box;
  plain: boolean;
  /** In Move mode, the saved item whose size the handles change when it is selected (ADR-102). */
  handles: ModelItem | null;
  /** Move mode's drag (ADR-203): pressing the model drags it. */
  drag: ReturnType<typeof usePieceDrag>;
}) {
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
  // Stretched on each axis to fill its box (ADR-102); a flat side takes the scale of the longest.
  const scale = ((): [number, number, number] => {
    if (!ms) return [1, 1, 1];
    const native = ms.size,
      mm = [w, h, d];
    const k = native.indexOf(Math.max(...native));
    const even = native[k] > 0 ? (mm[k] * S) / native[k] : 1;
    return [0, 1, 2].map((i) => (native[i] > 0 ? (mm[i] * S) / native[i] : even)) as [
      number,
      number,
      number,
    ];
  })();
  return (
    <>
      {selected && handles && <ResizeHandles item={handles} box={box} />}
      <group
        position={[(box.x + box.w / 2) * S, (box.y + box.h / 2) * S, (box.z + box.d / 2) * S]}
        rotation={[0, (modelYaw(item) * Math.PI) / 180, 0]}
        onPointerDown={(e) => drag.press(e, item.id)}
        onClick={(e) => {
          e.stopPropagation();
          // The click ending a 3D move (or the press that selected the model) does nothing more (ADR-093, ADR-203).
          if (drag.clicked()) return;
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
    </>
  );
}

const HANDLES: { axis: HandleAxis; label: string; glyph: string }[] = [
  { axis: 'x', label: t('Resize width'), glyph: '↔' },
  { axis: 'y', label: t('Resize height'), glyph: '↕' },
  { axis: 'z', label: t('Resize depth'), glyph: '⤢' },
];

/** The Section axis buttons' titles and the cut slider's label, one whole sentence per axis. */
export const CUT_ACROSS: Record<SectionAxis, string> = {
  x: t('Cut across the width'),
  y: t('Cut across the height'),
  z: t('Cut across the depth'),
};
export const CUT_POSITION: Record<SectionAxis, string> = {
  x: t('Cut position across the width, mm'),
  y: t('Cut position across the height, mm'),
  z: t('Cut position across the depth, mm'),
};

/**
 * The selected model's resize handles in Move mode (ADR-102): on the right face (width along the room), the top
 * (height) and the front (depth); the left, bottom and back stay put. Dragging one goes through `dragResize` (core).
 */
function ResizeHandles({ item, box }: { item: ModelItem; box: Box }) {
  const press = useModelResize();
  const cx = box.x + box.w / 2,
    cy = box.y + box.h / 2,
    cz = box.z + box.d / 2;
  const at: Record<HandleAxis, [number, number, number]> = {
    x: [box.x + box.w, cy, cz],
    y: [cx, box.y + box.h, cz],
    z: [cx, cy, box.z + box.d],
  };
  return (
    <>
      {HANDLES.map((hd) => (
        <Html
          key={hd.axis}
          position={at[hd.axis].map((v) => v * S) as [number, number, number]}
          center
          zIndexRange={[2, 1]}
        >
          <button
            type="button"
            className="model-handle"
            aria-label={hd.label}
            title={t('{label}: drag', { label: hd.label })}
            onPointerDown={(e) => press(e, item, hd.axis, at[hd.axis])}
          >
            {hd.glyph}
          </button>
        </Html>
      ))}
    </>
  );
}

/**
 * The selected wall unit's height handle in Move mode (ADR-122, wall-placed pieces only): on the middle of its top
 * front edge. Dragging it goes through `setWallHeight` (core); while dragging a translucent copy shows where it hangs.
 */
export function HeightHandle({ id }: { id: string }) {
  const press = useHeightDrag();
  const project = useDesign((s) => s.project);
  const pc = useDesign((s) => s.projectModel?.pieces.find((x) => x.item.id === id));
  const preview = useHeightPreview();
  if (!project || !pc || !heightDraggable(project, id) || pc.item.placement?.kind !== 'wall')
    return null;
  const b = pc.bounds;
  const start = pc.item.placement.height;
  const at: [number, number, number] = [b.x + b.w / 2, b.y + b.h, b.z + b.d];
  const dy = preview?.id === id ? preview.height - start : 0;
  return (
    <>
      <Html position={at.map((v) => v * S) as [number, number, number]} center zIndexRange={[2, 1]}>
        <button
          type="button"
          className="model-handle height-handle"
          aria-label={t('Change height')}
          title={t('Change height: drag up or down')}
          onPointerDown={(e) => press(e, id, start, at)}
        >
          ↕
        </button>
      </Html>
      {dy !== 0 && (
        <mesh
          position={[(b.x + b.w / 2) * S, (b.y + dy + b.h / 2) * S, (b.z + b.d / 2) * S]}
          raycast={() => null}
          renderOrder={5}
        >
          <boxGeometry args={[b.w * S, b.h * S, b.d * S]} />
          <meshBasicMaterial color={SELECT} transparent opacity={0.28} depthWrite={false} />
        </mesh>
      )}
    </>
  );
}

/** The live height while a wall unit's height handle is dragged (ADR-122): "From floor 1450 mm". */
export function HeightNote() {
  const preview = useHeightPreview();
  if (!preview) return null;
  return (
    <span
      className={`plan-drag-note three-drag-note${preview.height < 0 ? ' locked' : ''}`}
      role="status"
    >
      {preview.hint ?? heightLabel(preview.height)}
      {preview.height < 0 ? t(' — below the floor, it will not move') : ''}
    </span>
  );
}

/**
 * Section (ADR-122): the renderer clips everything past the cut, `at` mm across `axis`; what is shown only (the model,
 * checks and exports are unchanged). Kept: the side toward the back wall, the floor or the left.
 */
export function SectionClip({ axis, at }: { axis: SectionAxis; at: number }) {
  const get = useThree((s) => s.get);
  useEffect(() => {
    // The renderer is read when the cut changes (not held as React state, which is never written to).
    const renderer = get().gl;
    const n = new Vector3(axis === 'x' ? -1 : 0, axis === 'y' ? -1 : 0, axis === 'z' ? -1 : 0);
    renderer.clippingPlanes = [new Plane(n, at * S)];
    // Drawn on demand (ADR-121): a cut set outside React's props needs a frame of its own.
    invalidate();
    return () => {
      renderer.clippingPlanes = [];
      invalidate();
    };
  }, [get, axis, at]);
  return null;
}

/** The live size while a 3D model's handle is dragged (ADR-102). */
export function ResizeNote() {
  const preview = useResizePreview();
  if (!preview) return null;
  const { w, h, d } = preview.size;
  return (
    <span className="plan-drag-note three-drag-note" role="status">
      {t('{w} × {h} × {d} mm (W × H × D)', { w, h, d })}
    </span>
  );
}

/**
 * Places the "Locked" labels of locked project pieces (ADR-095) each frame: centred on each piece, clear of the
 * counts card over its top, and hidden when the point is behind the camera. Display only; the viewer only selects.
 */
export function LockAnchors({
  pieces,
  badges,
}: {
  pieces: PlacedPiece[];
  badges: { current: Map<string, HTMLSpanElement> };
}) {
  const v = useMemo(() => new Vector3(), []);
  useFrame(({ camera, size }) => {
    for (const pc of pieces) {
      const el = badges.current.get(pc.item.id);
      if (!el) continue;
      const b = pc.bounds;
      v.set((b.x + b.w / 2) * S, (b.y + b.h / 2) * S, (b.z + b.d / 2) * S).project(camera);
      if (v.z > 1) {
        el.style.visibility = 'hidden';
        continue;
      }
      // The label is always "Locked": its size is read once, not each frame (no layout per frame).
      if (!el.dataset.w && el.offsetWidth) {
        el.dataset.w = String(el.offsetWidth);
        el.dataset.h = String(el.offsetHeight);
      }
      const x = ((v.x + 1) / 2) * size.width - Number(el.dataset.w ?? 0) / 2;
      const y = ((1 - v.y) / 2) * size.height - Number(el.dataset.h ?? 0) / 2;
      el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      el.style.visibility = 'visible';
    }
  });
  return null;
}

/**
 * The project's room (ADR-058): walls with openings, obstacles; display only, never picked. Walls are drawn as their
 * inner faces (ADR-145): see-through by default; with Solid walls on they are opaque and seen only from inside the
 * room, so the walls between the camera and the pieces drop away. A wall's background paints it with its colour, or
 * with its picture covering one rectangle of the wall once, straightened when asked, its average colour around it
 * (ADR-146). With Adjust wall picture on, a wall with a picture is chosen by a tap and its picture dragged.
 */
export function RoomWalls({
  adjusting,
  snapOn,
  room: given,
}: {
  adjusting: boolean;
  snapOn: boolean;
  /** A value set's room copy (ADR-167) instead of the project's room. */
  room?: Room;
}) {
  const own = useDesign((s) => s.project?.room);
  const room = given ?? own;
  const solid = useSolidWalls();
  const boxes = useMemo(() => (room ? roomDisplayBoxes(room) : null), [room]);
  const textures = useTextures(useWallPictureUrls(room?.walls ?? NO_WALLS), false);
  const [chosen, choose] = useAdjustWall();
  const live = usePicturePreview();
  const press = usePictureDrag(snapOn);
  // Leaving the 3D view forgets the chosen wall: its handles are never mounted with a new canvas, where their DOM
  // overlay (drei Html) fails to unmount cleanly.
  useEffect(() => () => choose(null), [choose]);
  if (!boxes || !room) return null;
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
  const rectOf = (w: number) => {
    const img = wallFinish(room, w)?.image;
    if (!img) return null;
    return live?.wall === w ? live.rect : pictureRect(room, w, img);
  };
  return (
    <>
      {boxes.walls.flatMap((b, i) => {
        const w = boxes.wallOf[i];
        const f = wallFinish(room, w);
        const tex = f?.image ? textures.get(pictureKey(f.image)) : undefined;
        const patches = splitSpan(boxSpan(room, w, b), tex ? rectOf(w) : null);
        const pickable = adjusting && !!f?.image;
        return patches.map((pt, k) => (
          <WallPatchMesh
            // A new mesh when its picture arrives: a material does not pick up a map added after its first frame.
            key={`w${i}-${k}-${pt.picture && tex ? tex.uuid : 'plain'}`}
            room={room}
            wall={w}
            patch={pt}
            onPress={
              pickable
                ? (e) => {
                    e.stopPropagation();
                    if (chosen !== w) choose(w);
                    else press(e.nativeEvent, w, 'move');
                  }
                : null
            }
          >
            <meshStandardMaterial
              color={pt.picture ? '#ffffff' : (f?.colour ?? '#c9cdc8')}
              map={pt.picture ? (tex ?? null) : null}
              transparent={!solid}
              opacity={solid ? 1 : f ? 0.5 : 0.28}
              depthWrite={solid}
              side={solid ? FrontSide : DoubleSide}
            />
          </WallPatchMesh>
        ));
      })}
      {adjusting && chosen !== null && rectOf(chosen) && (
        <PictureHandles room={room} wall={chosen} rect={rectOf(chosen)!} press={press} />
      )}
      {boxes.obstacles.map((b, i) => mesh(b, `o${i}`, '#b3261e', 0.35))}
      {boxes.walls.length > 0 && <RoomFloor room={room} />}
    </>
  );
}
const NO_WALLS: WallFinish[] = [];

/** Wall coordinates (mm along from the left end, up from the floor, out into the room) → scene position. */
function onWallAt(
  room: Room,
  wall: number,
  u: number,
  y: number,
  out = 0,
): [number, number, number] {
  const [x, z] = wallToRoom(room, wall, u);
  const [nx, nz] = wallAxes(room, wall).inward;
  return [(x + nx * out) * S, y * S, (z + nz * out) * S];
}

/** The turn about y that makes a plane facing +z face into the room from the wall; its +x then runs to the right. */
const wallTurn = ([nx, nz]: [number, number]) =>
  nz > 0 ? 0 : nz < 0 ? Math.PI : nx > 0 ? Math.PI / 2 : -Math.PI / 2;

/**
 * One part of a wall's inner face (ADR-146): the picture's part with its picture coordinates, or a plain part. With
 * `onPress` (Adjust wall picture) it is picked, only from inside the room.
 */
function WallPatchMesh({
  room,
  wall,
  patch: pt,
  onPress,
  children,
}: {
  room: Room;
  wall: number;
  patch: WallPatch;
  onPress: ((e: ThreeEvent<PointerEvent>) => void) | null;
  children: ReactNode;
}) {
  const inward = wallAxes(room, wall).inward;
  const w = pt.u1 - pt.u0,
    h = pt.y1 - pt.y0;
  const pic = pt.picture;
  const g = useMemo(() => {
    const geo = new PlaneGeometry(w * S, h * S);
    if (pic)
      geo.setAttribute(
        'uv',
        // PlaneGeometry's corners: top-left, top-right, bottom-left, bottom-right.
        new Float32BufferAttribute(
          [pic.s0, pic.t1, pic.s1, pic.t1, pic.s0, pic.t0, pic.s1, pic.t0],
          2,
        ),
      );
    return geo;
  }, [w, h, pic]);
  useEffect(() => () => g.dispose(), [g]);
  const at = onWallAt(room, wall, (pt.u0 + pt.u1) / 2, (pt.y0 + pt.y1) / 2);
  const [ax, , az] = at;
  const [nx, nz] = inward;
  const pick = useMemo(
    () =>
      function (this: Mesh, rc: Raycaster, hits: Intersection[]) {
        const o = rc.ray.origin;
        if ((o.x - ax) * nx + (o.z - az) * nz > 0) Mesh.prototype.raycast.call(this, rc, hits);
      },
    [ax, az, nx, nz],
  );
  return (
    <mesh
      position={at}
      rotation={[0, wallTurn(inward), 0]}
      raycast={onPress ? pick : () => null}
      onPointerDown={onPress ?? undefined}
    >
      <primitive object={g} attach="geometry" />
      {children}
    </mesh>
  );
}

const PICTURE_HANDLES: {
  handle: PictureHandle;
  label: string;
  glyph: string;
  at: [number, number];
}[] = [
  { handle: 'nw', label: t('top-left corner'), glyph: '⤡', at: [0, 1] },
  { handle: 'n', label: t('top edge'), glyph: '↕', at: [0.5, 1] },
  { handle: 'ne', label: t('top-right corner'), glyph: '⤢', at: [1, 1] },
  { handle: 'e', label: t('right edge'), glyph: '↔', at: [1, 0.5] },
  { handle: 'se', label: t('bottom-right corner'), glyph: '⤡', at: [1, 0] },
  { handle: 's', label: t('bottom edge'), glyph: '↕', at: [0.5, 0] },
  { handle: 'sw', label: t('bottom-left corner'), glyph: '⤢', at: [0, 0] },
  { handle: 'w', label: t('left edge'), glyph: '↔', at: [0, 0.5] },
];

/** The chosen wall picture's outline and its eight stretch handles (ADR-146), just in front of the wall. */
function PictureHandles({
  room,
  wall,
  rect: r,
  press,
}: {
  room: Room;
  wall: number;
  rect: WallRect;
  press: ReturnType<typeof usePictureDrag>;
}) {
  const corner = (a: number, b: number) => onWallAt(room, wall, r.x + a * r.w, r.y + b * r.h, 4);
  return (
    <>
      <Line
        points={[corner(0, 0), corner(1, 0), corner(1, 1), corner(0, 1), corner(0, 0)]}
        color={SELECT}
        lineWidth={2}
        raycast={() => null}
      />
      {PICTURE_HANDLES.map((hd) => (
        <Html key={hd.handle} position={corner(...hd.at)} center zIndexRange={[2, 1]}>
          <button
            type="button"
            className="model-handle"
            aria-label={t('Stretch the picture: {handle}', { handle: hd.label })}
            title={t('Stretch the picture: drag the {handle}', { handle: hd.label })}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              press(e, wall, hd.handle);
            }}
          >
            {hd.glyph}
          </button>
        </Html>
      ))}
    </>
  );
}

/** The room copies of the value sets (ADR-167), drawn at their origins; pictures are not adjusted there. */
export function SetRoomWalls() {
  const project = useDesign((s) => s.project);
  const rooms = useMemo(() => (project ? setRooms(project) : []), [project]);
  return (
    <>
      {rooms.map((sr) => (
        <RoomWalls key={sr.set.id} adjusting={false} snapOn={false} room={sr.room} />
      ))}
    </>
  );
}

/** What Adjust wall picture is doing (ADR-146): the chosen picture's place and size, live while dragging. */
export function PictureNote() {
  const [wall] = useAdjustWall();
  const live = usePicturePreview();
  const room = useDesign((s) => s.project?.room);
  const img = room && wall !== null ? wallFinish(room, wall)?.image : undefined;
  if (!room || wall === null || !img)
    return (
      <span className="plan-drag-note three-drag-note" role="status">
        {t('Tap a wall with a picture to adjust it')}
      </span>
    );
  const rect = live?.wall === wall ? live.rect : pictureRect(room, wall, img);
  return (
    <span className="plan-drag-note three-drag-note" role="status">
      {t('Wall {n} picture: {rect}', { n: wall + 1, rect: rectLabel(rect) })}
    </span>
  );
}

/**
 * The floor inside the room outline, just under the pieces; with a floor background (ADR-208) in its colour, or its
 * picture over the plan rectangle it covers (`floorRect`).
 */
function RoomFloor({ room }: { room: Room }) {
  const outline = room.outline;
  const f = room.floor;
  const finishes = useMemo<WallFinish[]>(() => (f ? [{ wall: 0, ...f }] : []), [f]);
  const urls = useWallPictureUrls(finishes);
  const textures = useTextures(urls, false);
  const tex = f?.image ? textures.get(pictureKey(f.image)) : undefined;
  const rect = f?.image ? floorRect(room, f.image) : null;
  const geo = useMemo(() => {
    const g = new ShapeGeometry(new Shape(outline.map(([x, z]) => new Vector2(x * S, -z * S))));
    if (rect) {
      // Picture coordinates from plan mm: across from the rectangle's left, down from its back edge.
      const pos = g.getAttribute('position');
      const uv: number[] = [];
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) / S,
          z = -pos.getY(i) / S;
        uv.push((x - rect.x) / rect.w, 1 - (z - rect.z) / rect.d);
      }
      g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    }
    return g;
    // The rectangle is compared by value: a new object each render must not rebuild the floor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outline, rect?.x, rect?.z, rect?.w, rect?.d]);
  useEffect(() => () => geo.dispose(), [geo]);
  const solid = useSolidWalls();
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.001, 0]}
      raycast={() => null}
      geometry={geo}
    >
      <meshStandardMaterial
        key={tex ? tex.uuid : 'plain'}
        color={tex ? '#ffffff' : (f?.colour ?? '#d9dcd6')}
        map={tex ?? null}
        transparent={!f || !solid}
        opacity={f ? (solid ? 1 : 0.85) : 0.35}
        depthWrite={!!f && solid}
        side={DoubleSide}
      />
    </mesh>
  );
}

export function Fit({ bounds }: { bounds: Box }) {
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
  // Frame once per design (and when the user asks, through the view store's fit request, ADR-230); editing dimensions
  // must not yank the camera. A fit request frames what was framed when this mounted, as before.
  const framed = useRef<{ target: readonly [number, number, number]; dist: number } | null>(null);
  useEffect(() => {
    const dist = fitDist / Math.hypot(0.55, 0.35, 0.85);
    framed.current = { target, dist };
    camera.position.set(target[0] + dist * 0.55, target[1] + dist * 0.35, target[2] + dist * 0.85);
    camera.lookAt(...target);
    controls.current?.target.set(...target);
    controls.current?.update();
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const fitRequest = useViewStore((s) => s.fitRequest);
  const seenFit = useRef(fitRequest);
  useEffect(() => {
    if (fitRequest === seenFit.current || !framed.current) return;
    seenFit.current = fitRequest;
    const { target: at, dist } = framed.current;
    camera.position.set(at[0] + dist * 0.55, at[1] + dist * 0.35, at[2] + dist * 0.85);
    controls.current?.target.set(...at);
    controls.current?.update();
    invalidate();
  }, [fitRequest, camera]);
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

export function Panels({
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
  const preview = !!useContext(ViewOverride);
  const materials = view.materials;
  const selectedSpace = useDesign((s) => s.selectedId);
  const selectedItem = useDesign((s) => s.selectedItemId);
  const selectedId = preview ? undefined : view.mode === 'project' ? selectedItem : selectedSpace;
  const highlight = useDesign((s) => s.highlight);
  const showFronts = useDesign((s) => s.showFronts);
  const tapPiece = useDesign((s) => s.tapPiece);
  const tapItem = useDesign((s) => s.tapItem);
  // Several selected pieces (ADR-159): each is tinted; Select on, or Shift/Ctrl/Cmd, adds or removes one.
  const selectedIds = useDesign((s) => s.selectedItemIds);
  const multi = useDesign((s) => s.multiSelect);
  const toggleItem = useDesign((s) => s.toggleItem);
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
  // An assembly step lights its parts (ADR-174): the rest goes translucent, as outside a selected space.
  const litIds = useDesign((s) => s.litPanelIds);
  const litSet = useMemo(() => (litIds ? new Set(litIds) : null), [litIds]);
  // The number lit, in the view store (ADR-230; App shows it as `data-lit` on the 3D view for the find-it script).
  const setLit = useViewStore((s) => s.setLit);
  useEffect(() => {
    setLit(litIds?.length ?? 0);
    return () => setLit(null);
  }, [litIds, setLit]);
  // Shared materials and boxes (ADR-238): one per look and per size, kept while a panel uses them.
  const pools = useMemo(
    () => ({ materials: new Pool<Material>(), boxes: new Pool<BufferGeometry>() }),
    [],
  );
  const usedLooks = new Set<string>();
  const usedSizes = new Set<string>();
  const materialFor = (l: BoardLook) => {
    const k = lookKey(l);
    usedLooks.add(k);
    return pools.materials.get(k, () => makeMaterial(l));
  };
  const boxFor = (b: Box) => {
    usedSizes.add(sizeKey(b.w, b.h, b.d));
    return boxOf(pools.boxes, b.w, b.h, b.d);
  };
  // The Simple look's panel edges, merged into one line per edge style (ADR-238).
  const edgeItems: EdgeItem[] = [];
  const isFaded = (p: Panel) => {
    if (litSet && !litSet.has(p.id)) return true;
    if (!fadeBox) return false;
    if (!inProject) return !inSelection(fadeBox, (built.get(p.id) ?? p).box);
    const own = p.id.startsWith(prefix) ? local.get(p.id.slice(prefix.length)) : undefined;
    return !own || !inSelection(fadeBox, own.box);
  };

  const meshes = panels
    .filter((p) => showFronts || !FRONT.has(p.role))
    .map((p) =>
      yawed(
        p,
        (() => {
          const b = p.box;
          // The whole piece selected (ADR-083) tints every panel.
          const selected =
            !plain &&
            (view.mode === 'project'
              ? !preview && selectedIds.includes(p.nodeId.split(':')[0])
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
          // A moulding profile or a shaped worktop edge (ADR-209) is drawn from its own geometry.
          const follow = followUpGeometry(p);
          const side = p.shape?.kind === 'profile' || follow ? DoubleSide : FrontSide;
          const material = materialFor({
            realistic,
            color,
            map: map ?? null,
            faded,
            side,
            back: p.role === 'back',
            finish: finishes.get(p.materialId),
          });
          // Realistic (ADR-067): the finish sets how matte or glossy a board is; backs stay opaque. Panel edges are
          // not drawn (an edge outline is a mesh the occlusion pass would smear); the selection outline is.
          const edges = (g: BufferGeometry, centred: boolean) => {
            if (!realistic)
              edgeItems.push({
                positions: edgePositions(g),
                matrix: panelMatrix(p, centred),
                selected: tinted || own,
                faded,
              });
          };
          // Outside in, one level per tap at the hit point (ADR-083).
          const onClick = (e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            // The click ending a 3D move (or the press that selected the piece) does nothing more (ADR-093).
            if (drag.clicked() || preview) return;
            const at = hitToMm(e.point, built.get(p.id), exploded);
            const n = e.nativeEvent;
            if (view.mode === 'project' && (multi || n.shiftKey || n.ctrlKey || n.metaKey))
              toggleItem(p.nodeId.split(':')[0]);
            else if (view.mode === 'project') tapItem(p.nodeId.split(':')[0], at);
            else tapPiece(at.x, at.y);
          };
          const onDown = (e: ThreeEvent<PointerEvent>) => drag.press(e, p.nodeId.split(':')[0]);
          // A board with a picture has its own texture coordinates; a plain box shares its size's geometry.
          // A mesh never switches between the two (keyed apart): a removed geometry prop would reset it.
          const box = map && img ? null : boxFor(b);
          const geometry = box ? null : <PictureGeometry p={p} img={img!} />;
          const shared = box ? { geometry: box } : {};
          const meshKey = box ? p.id : `${p.id}:picture`;
          if (follow) {
            edges(follow, false);
            return (
              <mesh
                key={p.id}
                geometry={follow}
                material={material}
                onClick={onClick}
                onPointerDown={onDown}
                castShadow={realistic}
                receiveShadow={realistic}
              />
            );
          }
          if (p.shape?.kind === 'profile') {
            // A picture's copy of the outline has the same edges as the outline.
            edges(profileGeometry(p), false);
            return map && img ? (
              <mesh
                key={p.id}
                material={material}
                onClick={onClick}
                onPointerDown={onDown}
                castShadow={realistic}
                receiveShadow={realistic}
              >
                <PictureGeometry p={p} img={img} />
              </mesh>
            ) : (
              <mesh
                key={p.id}
                geometry={profileGeometry(p)}
                material={material}
                onClick={onClick}
                onPointerDown={onDown}
                castShadow={realistic}
                receiveShadow={realistic}
              />
            );
          }
          // A picture's box has the same edges as the plain box of its size.
          edges(box ?? boxOf(pools.boxes, b.w, b.h, b.d), true);
          if (!box) usedSizes.add(sizeKey(b.w, b.h, b.d));
          const mesh = (
            <mesh
              key={meshKey}
              position={[(b.x + b.w / 2) * S, (b.y + b.h / 2) * S, (b.z + b.d / 2) * S]}
              {...shared}
              material={material}
              onClick={onClick}
              onPointerDown={onDown}
              castShadow={realistic}
              receiveShadow={realistic}
            >
              {geometry}
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
                key={meshKey}
                {...shared}
                material={material}
                onClick={onClick}
                onPointerDown={onDown}
                castShadow={realistic}
                receiveShadow={realistic}
              >
                {geometry}
              </mesh>
            </group>
          );
        })(),
      ),
    );
  // After each commit the looks and sizes this render did not use are disposed; everything on unmount.
  useEffect(() => {
    pools.materials.sweep(usedLooks);
    pools.boxes.sweep(usedSizes);
  });
  useEffect(() => () => (pools.materials.clear(), pools.boxes.clear()), [pools]);

  return (
    <group>
      {outline && !exploded && (
        // Keyed by the box: drei's segment line does not pick up changed points.
        // An angled piece's outline turns with its panels (ADR-121, ADR-203).
        <YawGroup yaw={outline.yaw}>
          <SelectionOutline
            key={`${outline.x},${outline.y},${outline.w},${outline.h}`}
            box={outline}
          />
        </YawGroup>
      )}
      {moving && <MoveGhost panels={view.model.panels} showFronts={showFronts} />}
      {meshes}
      {!realistic && (
        <PanelEdges
          items={edgeItems}
          deps={[
            panels,
            showFronts,
            edgeItems.map((i) => (i.selected ? 1 : 0) + (i.faded ? 2 : 0)).join(''),
          ]}
        />
      )}
    </group>
  );
}

/**
 * The Simple look's panel edges (ADR-238): one line per edge style for the whole model, built again only when the
 * panels or their styles change, the old lines disposed then; never picked (ADR-014).
 */
function PanelEdges({ items, deps }: { items: EdgeItem[]; deps: readonly unknown[] }) {
  const size = useThree((s) => s.size);
  const [merged] = useState(() => new MergedEdges());
  const lines = merged.update(deps, () => items);
  useEffect(() => () => merged.dispose(), [merged]);
  useLayoutEffect(() => {
    for (const l of lines) l.material.resolution.set(size.width, size.height);
    invalidate();
  }, [lines, size]);
  return (
    <>
      {lines.map((l) => (
        <primitive key={l.uuid} object={l} />
      ))}
    </>
  );
}

/** Children turned as an angled piece's panels are (ADR-121): the selection outline and the Move ghost (ADR-203). */
function YawGroup({ yaw, children }: { yaw?: Yaw; children: ReactNode }) {
  if (!yaw) return <>{children}</>;
  return (
    <group position={[yaw.cx * S, 0, yaw.cz * S]} rotation={[0, (yaw.deg * Math.PI) / 180, 0]}>
      <group position={[-yaw.cx * S, 0, -yaw.cz * S]}>{children}</group>
    </group>
  );
}

const ZONE_COLOR: Record<ClearanceZone['severity'], string> = {
  none: '#3f8f5a',
  warning: '#d99a00',
  error: '#c0392b',
};

/**
 * Every clearance zone of the project (ADR-205, the Clearances switch): a translucent box coloured by its worst
 * problem, turned with a piece at an angle. Display only: never picked, never edited; the zones come from the core.
 */
export function ZoneBoxes() {
  const zones = useDesign((s) => s.projectModel?.zones);
  if (!zones?.length) return null;
  return (
    <>
      {zones.map((z, i) => {
        const b = z.box;
        if (b.w <= 0 || b.h <= 0 || b.d <= 0) return null;
        const mesh = (
          <mesh
            key={i}
            position={[(b.x + b.w / 2) * S, (b.y + b.h / 2) * S, (b.z + b.d / 2) * S]}
            raycast={() => null}
            renderOrder={4}
          >
            <boxGeometry args={[b.w * S, b.h * S, b.d * S]} />
            <meshBasicMaterial
              color={ZONE_COLOR[z.severity]}
              transparent
              opacity={z.kind === 'body' ? 0.12 : 0.22}
              depthWrite={false}
            />
          </mesh>
        );
        const y = b.yaw;
        return y ? (
          <group
            key={i}
            position={[y.cx * S, 0, y.cz * S]}
            rotation={[0, (y.deg * Math.PI) / 180, 0]}
          >
            <group position={[-y.cx * S, 0, -y.cz * S]}>{mesh}</group>
          </group>
        ) : (
          mesh
        );
      })}
    </>
  );
}

/** The twelve edges of a box, as segment pairs in metres. */
function boxSegments(b: Box): [number, number, number][] {
  const [x0, x1] = [b.x * S, (b.x + b.w) * S];
  const [y0, y1] = [b.y * S, (b.y + b.h) * S];
  const [z0, z1] = [b.z * S, (b.z + b.d) * S];
  const corners = [x0, x1].flatMap((x) =>
    [y0, y1].flatMap((y) => [z0, z1].map((z) => [x, y, z] as [number, number, number])),
  );
  const segs: [number, number, number][] = [];
  for (let i = 0; i < 8; i++)
    for (const bit of [1, 2, 4]) if (!(i & bit)) segs.push(corners[i], corners[i | bit]);
  return segs;
}

/**
 * The problem picked under Checks (ADR-209, G-034), in 3D: its box as a translucent red box and the chosen repair's
 * result as dashed outlines labelled "After repair", as on the plan. Display only: never picked, never edited.
 */
export function ProblemBoxes() {
  const problem = useFocusedProblem();
  // drei's Html puts its label in the canvas's container when it mounts. With a problem already picked, it mounts with
  // the view itself, before that container is ready: the label was lost and removing it later threw. Labels wait for
  // the first frame.
  const [labels, setLabels] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setLabels(true));
    return () => cancelAnimationFrame(id);
  }, []);
  if (!problem) return null;
  const b = problem.d.box;
  const zone = b && b.w > 0 && b.h > 0 && b.d > 0 ? b : null;
  return (
    <>
      {zone && (
        <mesh
          position={[
            (zone.x + zone.w / 2) * S,
            (zone.y + zone.h / 2) * S,
            (zone.z + zone.d / 2) * S,
          ]}
          raycast={() => null}
          renderOrder={5}
        >
          <boxGeometry args={[zone.w * S, zone.h * S, zone.d * S]} />
          <meshBasicMaterial color="#c0392b" transparent opacity={0.3} depthWrite={false} />
        </mesh>
      )}
      {problem.chosen?.preview.map((p) => (
        <group key={p.id}>
          <Line
            points={boxSegments(p.box)}
            segments
            dashed
            dashSize={0.03}
            gapSize={0.02}
            color="#c0392b"
            lineWidth={2}
            depthTest={false}
            transparent
            renderOrder={10}
            raycast={() => null}
          />
          {labels && (
            <Html
              position={[p.box.x * S, (p.box.y + p.box.h) * S, (p.box.z + p.box.d) * S]}
              className="repair-label-3d"
              zIndexRange={[5, 0]}
            >
              <span className="repair-preview-3d">{t('After repair')}</span>
            </Html>
          )}
        </group>
      ))}
    </>
  );
}

/**
 * A part of a piece at an angle (ADR-121): drawn inside a group turned about the piece's vertical line. Three.js turns
 * (x, z) about y the same way the core's yaw does, so the angle is used as it is.
 */
function yawed(p: Panel, el: ReactElement): ReactElement {
  const y = p.box.yaw;
  if (!y) return el;
  return (
    <group key={p.id} position={[y.cx * S, 0, y.cz * S]} rotation={[0, (y.deg * Math.PI) / 180, 0]}>
      <group position={[-y.cx * S, 0, -y.cz * S]}>{el}</group>
    </group>
  );
}

/**
 * The translucent copy of a dragged piece (ADR-093), where it would land: its boards' outlines moved by the drop the
 * core worked out. Display only, never picked.
 */
function MoveGhost({ panels, showFronts }: { panels: Panel[]; showFronts: boolean }) {
  const ghost = useGhost();
  // A locked piece does not follow the pointer (ADR-095): no ghost, the note says why.
  if (!ghost || ghost.blocked) return null;
  // A display-only model (ADR-203): its box where it would land.
  if (ghost.model) {
    const b = ghost.target.box;
    return (
      <mesh
        position={[(b.x + b.w / 2) * S, (b.y + b.h / 2) * S, (b.z + b.d / 2) * S]}
        raycast={() => null}
        renderOrder={5}
      >
        <boxGeometry args={[b.w * S, b.h * S, b.d * S]} />
        <meshBasicMaterial
          color={ghost.target.snap ? '#2e7d4f' : SELECT}
          transparent
          opacity={0.28}
          depthWrite={false}
        />
      </mesh>
    );
  }
  return <GhostBoxes ghost={ghost} panels={panels} showFronts={showFronts} />;
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
        // An angled piece's boards are drawn unturned, then turned with it (ADR-121, ADR-203).
        .map((p) => {
          const { yaw, ...flat } = p.box;
          return { box: aabbOf({ ...p, box: flat }), yaw };
        }),
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
      {own.map(({ box: b, yaw }, i) => (
        <YawGroup key={i} yaw={yaw}>
          <mesh
            position={[(b.x + b.w / 2) * S, (b.y + b.h / 2) * S, (b.z + b.d / 2) * S]}
            raycast={() => null}
            renderOrder={5}
          >
            <boxGeometry args={[b.w * S, b.h * S, b.d * S]} />
            <meshBasicMaterial color={color} transparent opacity={0.28} depthWrite={false} />
          </mesh>
        </YawGroup>
      ))}
    </group>
  );
}

/** The live drop label over the 3D view while a piece is dragged (ADR-093), as on the Plan (ADR-080). */
export function DragNote({ snapOn }: { snapOn: boolean }) {
  const ghost = useGhost();
  // Why the last move did nothing (a locked piece, ADR-095), until the next change or selection.
  const notice = useDesign((s) => s.notice);
  if (!ghost)
    return notice ? (
      <span className="plan-drag-note three-drag-note locked" role="status">
        {notice}
      </span>
    ) : null;
  if (ghost.blocked)
    return (
      <span className="plan-drag-note three-drag-note locked" role="status">
        {ghost.blocked}
      </span>
    );
  const tg = ghost.target;
  return (
    <span className="plan-drag-note three-drag-note" role="status">
      {t('From left {x} · From back {z} mm', { x: tg.position.x, z: tg.position.z })}
      {' · '}
      {tg.snap
        ? t('Snaps: {list}', { list: [tg.snap.label, ...tg.snap.notes].join(' · ') })
        : (tg.hint ??
          (!ghost.snapping && snapOn ? t('Alt held: placing freely.') : t('Snap is off.')))}
    </span>
  );
}
