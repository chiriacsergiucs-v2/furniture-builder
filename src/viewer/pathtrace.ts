import {
  ACESFilmicToneMapping,
  Box3,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  SRGBColorSpace,
  Vector3,
  Scene,
  WebGLRenderer,
  type Camera,
  type Light,
} from 'three';
import { GradientEquirectTexture, WebGLPathTracer } from 'three-gpu-pathtracer';
import { getStage, setRendering, SHADOW_CATCHER } from './renderBridge';
import { t } from '../core/i18n';
import type { RenderEngineName } from '../shared/renderSupport';

/**
 * A photo-quality still of the 3D view (ADR-068): the scene the user is looking at, path-traced on this device's
 * GPU with three-gpu-pathtracer. Loaded only when the user presses Render; nothing leaves the device (ADR-002).
 */
export interface RenderJob {
  /** The picture as it sharpens; show it while rendering. */
  canvas: HTMLCanvasElement;
  /** Resolves with the finished PNG, or null when cancelled. */
  done: Promise<Blob | null>;
  cancel: () => void;
  /** Frees the GPU; call when the picture is no longer shown. */
  dispose: () => void;
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

interface RenderOptions {
  width: number;
  height: number;
  samples: number;
  onProgress: (n: number) => void;
}

/**
 * The render engine seam (ADR-208): start a render of the prepared scene; the job reports samples, can be cancelled
 * and gives the PNG. Denoiser and upscaler stay off (they need weight files).
 */
export type RenderEngine = (scene: Scene, camera: Camera, o: RenderOptions) => Promise<RenderJob>;

/** Render the 3D view with `engine` (ADR-068, ADR-208). */
export async function startRender(
  o: RenderOptions & { engine?: RenderEngineName },
): Promise<RenderJob> {
  const stage = getStage();
  if (!stage) throw new Error(t('Open the 3D view first.'));
  // Realistic look with no selection tint; two frames so React and the viewer have redrawn.
  setRendering(true);
  let prepared: { scene: Scene; camera: Camera };
  try {
    await nextFrame();
    await nextFrame();
    prepared = prepareScene(stage, o.width, o.height);
  } catch (e) {
    setRendering(false);
    throw e;
  }
  try {
    const engine: RenderEngine =
      o.engine === 'WebGPU' ? (await import('./pathtraceGpu')).webgpuEngine : webglEngine;
    return await engine(prepared.scene, prepared.camera, o);
  } finally {
    // The tracer has copied the materials; the live view may show the selection again.
    setRendering(false);
  }
}

/** A copy of the live scene for tracing: a light floor, one sun aimed at the furniture, a soft sky. */
function prepareScene(
  stage: { scene: Scene; camera: Camera },
  width: number,
  height: number,
): { scene: Scene; camera: Camera } {
  const scene = stage.scene.clone();
  const env = new GradientEquirectTexture(512);
  env.topColor.set('#ffffff');
  env.bottomColor.set('#8c8f8a');
  env.exponent = 2;
  env.update();
  scene.environment = env;
  scene.environmentIntensity = 1;
  scene.background = new Color('#f1f2ef');

  // The live lights have targets outside the copy: use one fresh sun light aimed at the furniture.
  const lights: Light[] = [];
  scene.traverse((o) => {
    if ((o as Light).isLight) lights.push(o as Light);
  });
  lights.forEach((l) => l.removeFromParent());
  // Measured on the live scene: room walls and floors are display-only (their own `raycast` picks nothing).
  const box = new Box3();
  stage.scene.traverse((o) => {
    if ((o as Mesh).isMesh && o.name !== SHADOW_CATCHER && !Object.hasOwn(o, 'raycast'))
      box.expandByObject(o);
  });
  if (box.isEmpty()) box.setFromObject(stage.scene);
  const c = box.getCenter(new Vector3());
  const r = Math.max(0.5, box.getSize(new Vector3()).length() / 2);
  const sun = new DirectionalLight('#ffffff', 2.2);
  sun.position.set(c.x + r * 1.2, c.y + r * 2, c.z + r * 1.6);
  sun.target.position.copy(c);
  scene.add(sun, sun.target);

  // The shadow-only floor becomes a real light floor.
  scene.traverse((o) => {
    if (o.name === SHADOW_CATCHER && (o as Mesh).isMesh)
      (o as Mesh).material = new MeshStandardMaterial({ color: '#e6e4de', roughness: 0.9 });
  });
  scene.updateMatrixWorld(true);

  const camera = (stage.camera as PerspectiveCamera).clone();
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  return { scene, camera };
}

/** The WebGL 2 path tracer (ADR-068). */
const webglEngine: RenderEngine = async (scene, camera, { width, height, samples, onProgress }) => {
  let renderer: WebGLRenderer | null = null;
  let tracer: WebGLPathTracer | null = null;
  try {
    renderer = new WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.outputColorSpace = SRGBColorSpace;
    tracer = new WebGLPathTracer(renderer);
    tracer.renderDelay = 0;
    tracer.fadeDuration = 0;
    tracer.minSamples = 0;
    tracer.dynamicLowRes = false;
    tracer.renderToCanvas = true;
    tracer.bounces = 5;
    tracer.setScene(scene, camera);
  } catch (e) {
    tracer?.dispose();
    renderer?.dispose();
    throw e;
  }

  const r = renderer,
    pt = tracer;
  let stopped = false;
  let finish: (b: Blob | null) => void = () => {};
  const done = new Promise<Blob | null>((res) => (finish = res));
  const tick = () => {
    if (stopped) return;
    pt.renderSample();
    const n = Math.min(samples, Math.floor(pt.samples));
    onProgress(n);
    if (n >= samples) {
      stopped = true;
      r.domElement.toBlob((b) => finish(b), 'image/png');
    } else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return {
    canvas: r.domElement,
    done,
    cancel: () => {
      if (stopped) return;
      stopped = true;
      finish(null);
    },
    dispose: () => {
      stopped = true;
      finish(null);
      pt.dispose();
      r.dispose();
      r.forceContextLoss();
    },
  };
};
