/**
 * The glTF reader (ADR-076), loaded only when a model is imported or shown: three's own GLTFLoader, no new
 * dependency. Files reach it only after `checkGltf` (src/core/model3d.ts) refused external URIs, oversize files and
 * decoders that would be downloaded; the loading manager also turns any URL that is not `data:` or `blob:` into an
 * empty one, so nothing is ever requested from the network (ADR-002). Glue only: what is valid is decided in core.
 */
import {
  Box3,
  DirectionalLight,
  HemisphereLight,
  LoadingManager,
  Mesh,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export async function parseGltf(bytes: ArrayBuffer): Promise<Object3D> {
  const manager = new LoadingManager();
  manager.setURLModifier((url) => (/^(data|blob):/i.test(url) ? url : 'data:,'));
  const gltf = await new GLTFLoader(manager).parseAsync(bytes, '');
  return gltf.scene;
}

/** Bounds in the file's units (metres) and the triangles actually drawn. */
export function measure(scene: Object3D): { size: Vector3; center: Vector3; triangles: number } {
  scene.updateMatrixWorld(true);
  const box = new Box3().setFromObject(scene);
  let triangles = 0;
  scene.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const g = o.geometry;
    triangles += Math.floor((g.index ? g.index.count : (g.attributes.position?.count ?? 0)) / 3);
  });
  if (box.isEmpty()) return { size: new Vector3(), center: new Vector3(), triangles };
  return { size: box.getSize(new Vector3()), center: box.getCenter(new Vector3()), triangles };
}

/** A small PNG of the model seen from the front-right, for the library list; undefined when it cannot be drawn. */
export async function thumbnail(scene: Object3D, px = 128): Promise<ArrayBuffer | undefined> {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = px;
  let renderer: WebGLRenderer | undefined;
  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(px, px, false);
    const { size, center } = measure(scene);
    const radius = Math.max(size.length() / 2, 1e-3);
    const stage = new Scene();
    stage.add(new HemisphereLight('#ffffff', '#9aa09a', 2));
    const sun = new DirectionalLight('#ffffff', 1.5);
    sun.position.set(2, 4, 3);
    stage.add(sun);
    const holder = scene.clone(true);
    stage.add(holder);
    const cam = new PerspectiveCamera(32, 1, radius / 100, radius * 100);
    const dist = radius / Math.sin((16 * Math.PI) / 180);
    const dir = new Vector3(0.55, 0.35, 0.85).normalize();
    cam.position.copy(center).addScaledVector(dir, dist);
    cam.lookAt(center);
    renderer.render(stage, cam);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
    return blob ? await blob.arrayBuffer() : undefined;
  } catch {
    return undefined;
  } finally {
    renderer?.dispose();
    renderer?.forceContextLoss();
  }
}
