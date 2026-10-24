import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Edges, OrbitControls } from '@react-three/drei';
import { useEffect, useMemo, useRef, type ComponentRef } from 'react';
import {
  BoxGeometry,
  Color,
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
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { explode } from '../core/explode';
import { roomDisplayBoxes } from '../core/room';
import { inPlaneAxes, union } from '../core/geometry';
import { aabbOf } from '../core/shape';
import { boxUvs, finishLook, planeUvs } from '../core/surface';
import { imageKey, useImageUrls } from '../persist/images';
import { useDesign } from '../store/designStore';
import { useView } from '../ui/useView';
import { useTheme } from '../ui/useTheme';
import { useLook } from '../ui/useLook';
import { SHADOW_CATCHER, setStage, useRendering } from './renderBridge';
import type { Box, MaterialImage, Panel } from '../core/types';

const S = 0.001; // mm → metres
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
 * Click a panel to select the space that owns it.
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
  const bounds = useMemo(
    () => (exploded ? union(panels.map(aabbOf)) : view.model.bounds),
    [exploded, panels, view],
  );
  return (
    <Canvas
      camera={{ fov: 32, near: 0.01, far: 100 }}
      dpr={[1, 2]}
      shadows={realistic}
      onPointerMissed={() => {
        const st = useDesign.getState();
        if (st.project && !st.editingItemId) st.selectItem(null);
        else st.select(null);
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
      <Panels panels={panels} realistic={realistic} plain={rendering} />
      {view.mode === 'project' && !exploded && <RoomWalls />}
      <Fit key={designId} bounds={bounds} />
    </Canvas>
  );
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
}: {
  panels: Panel[];
  realistic: boolean;
  /** No selection or hover tint (while rendering a picture). */
  plain: boolean;
}) {
  const view = useView();
  const materials = view.materials;
  const selectedSpace = useDesign((s) => s.selectedId);
  const selectedItem = useDesign((s) => s.selectedItemId);
  const selectedId = view.mode === 'project' ? selectedItem : selectedSpace;
  const highlight = useDesign((s) => s.highlight);
  const showFronts = useDesign((s) => s.showFronts);
  const pick = useDesign((s) => s.pick);
  const colors = useMemo(() => new Map(materials.map((m) => [m.id, m.color])), [materials]);
  const finishes = useMemo(() => new Map(materials.map((m) => [m.id, m.finish])), [materials]);
  const images = useMemo(
    () => new Map(materials.flatMap((m) => (m.image ? [[m.id, m.image] as const] : []))),
    [materials],
  );
  const textures = useTextures(useImageUrls(imageKey(materials)));
  const hl = useMemo(() => new Set(highlight), [highlight]);

  return (
    <group>
      {panels
        .filter((p) => showFronts || !FRONT.has(p.role))
        .map((p) => {
          const b = p.box;
          const selected =
            !plain &&
            selectedId !== null &&
            (view.mode === 'project'
              ? p.nodeId.startsWith(`${selectedId}:`)
              : p.nodeId === selectedId);
          const lit = !plain && hl.has(p.id);
          // A picture replaces the plain colour; without a readable one the plain colour stays (ADR-048).
          const img = images.get(p.materialId);
          const map = img ? textures.get(img.id) : undefined;
          const base = map ? '#ffffff' : (colors.get(p.materialId) ?? '#cccccc');
          const color = lit
            ? HIGHLIGHT
            : selected
              ? new Color(base).lerp(new Color(SELECT), 0.45).getStyle()
              : base;
          const side = p.shape?.kind === 'profile' ? DoubleSide : FrontSide;
          const look = realistic ? (
            <>
              {/* Realistic (ADR-067): the finish sets how matte or glossy a board is; backs stay opaque. The selection shows
                  as the green tint only: drei's outline is a mesh that the occlusion pass would smear. */}
              <meshPhysicalMaterial
                key={map ? map.uuid : 'plain'}
                map={map ?? null}
                color={color}
                metalness={0}
                {...finishLook(finishes.get(p.materialId))}
                side={side}
              />
            </>
          ) : (
            <>
              <meshStandardMaterial
                key={map ? map.uuid : 'plain'}
                map={map ?? null}
                color={color}
                roughness={0.78}
                metalness={0}
                transparent={p.role === 'back'}
                opacity={p.role === 'back' ? 0.92 : 1}
                side={side}
              />
              <Edges
                threshold={15}
                color={selected ? SELECT : '#3b403c'}
                lineWidth={selected ? 1.6 : 1}
              />
            </>
          );
          const onClick = (e: { stopPropagation: () => void }) => {
            e.stopPropagation();
            pick(p.nodeId);
          };
          const geometry =
            map && img ? (
              <PictureGeometry p={p} img={img} />
            ) : (
              <boxGeometry args={[b.w * S, b.h * S, b.d * S]} />
            );
          if (p.shape?.kind === 'profile') {
            return map && img ? (
              <mesh key={p.id} onClick={onClick} castShadow={realistic} receiveShadow={realistic}>
                <PictureGeometry p={p} img={img} />
                {look}
              </mesh>
            ) : (
              <mesh
                key={p.id}
                geometry={profileGeometry(p)}
                onClick={onClick}
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
