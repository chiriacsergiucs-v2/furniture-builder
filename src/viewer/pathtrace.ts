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
  WebGLRenderer,
  type Light,
} from 'three';
import { GradientEquirectTexture, WebGLPathTracer } from 'three-gpu-pathtracer';
import { getStage, setRendering, SHADOW_CATCHER } from './renderBridge';

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

export async function startRender({
  width,
  height,
  samples,
  onProgress,
}: {
  width: number;
  height: number;
  samples: number;
  onProgress: (n: number) => void;
}): Promise<RenderJob> {
  const stage = getStage();
  if (!stage) throw new Error('Open the 3D view first.');
  // Realistic look with no selection tint; two frames so React and the viewer have redrawn.
  setRendering(true);
  let renderer: WebGLRenderer | null = null;
  let tracer: WebGLPathTracer | null = null;
  try {
    await nextFrame();
    await nextFrame();
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
    setRendering(false);
    throw e;
  }
  // The tracer has copied the materials; the live view may show the selection again.
  setRendering(false);

  const r = renderer,
    t = tracer;
  let stopped = false;
  let finish: (b: Blob | null) => void = () => {};
  const done = new Promise<Blob | null>((res) => (finish = res));
  const tick = () => {
    if (stopped) return;
    t.renderSample();
    const n = Math.min(samples, Math.floor(t.samples));
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
      t.dispose();
      r.dispose();
      r.forceContextLoss();
    },
  };
}
