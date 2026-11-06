import { Mesh, type Object3D } from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { t } from '../core/i18n';
import { getStage, setRendering, SHADOW_CATCHER } from './renderBridge';

/**
 * Export scene (.glb) (ADR-206): the scene the 3D view shows, as one binary glTF file with its materials and board
 * pictures embedded, for Blender or another renderer. three's own GLTFExporter (part of `three`, MIT), loaded only
 * from here when the user asks; it reads the scene and never edits it (ADR-014); nothing leaves the device (ADR-002).
 */
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

export async function exportSceneGlb(): Promise<Blob> {
  const stage = getStage();
  if (!stage) throw new Error(t('Open the 3D view first.'));
  // As for a render: the realistic look with no selection or hover tint, so the file holds only the furniture.
  setRendering(true);
  try {
    await nextFrame();
    await nextFrame();
    const scene = stage.scene.clone();
    // Lights, cameras, the shadow-only floor and drawn edge lines are view helpers, not the furniture.
    const drop: Object3D[] = [];
    scene.traverse((o) => {
      const helper =
        o.name === SHADOW_CATCHER ||
        (o as { isLight?: boolean }).isLight ||
        (o as { isCamera?: boolean }).isCamera ||
        (o as { isLine?: boolean }).isLine ||
        (o as { isLineSegments?: boolean }).isLineSegments ||
        (o as { isLine2?: boolean }).isLine2 ||
        (o as { isLineSegments2?: boolean }).isLineSegments2 ||
        (o as { isPoints?: boolean }).isPoints;
      if (helper) drop.push(o);
      else if (o instanceof Mesh && !o.visible) drop.push(o);
    });
    drop.forEach((o) => o.removeFromParent());
    const result = await new GLTFExporter().parseAsync(scene, {
      binary: true,
      onlyVisible: true,
      maxTextureSize: 2048,
    });
    if (!(result instanceof ArrayBuffer)) throw new Error(t('The scene could not be exported.'));
    return new Blob([result], { type: 'model/gltf-binary' });
  } finally {
    setRendering(false);
  }
}
