import { ACESFilmicToneMapping, SRGBColorSpace, WebGPURenderer } from 'three/webgpu';
import { WebGPUPathTracer } from 'three-gpu-pathtracer/webgpu';
import type { RenderEngine } from './pathtrace';

/**
 * The WebGPU path tracer (ADR-208, G-022): `WebGPUPathTracer` from three-gpu-pathtracer 0.0.27 (MIT) on
 * `three/webgpu`, used when the device has a WebGPU adapter. Loaded only when a render starts with it. The denoiser
 * and upscaler stay off (they need weight files from elsewhere, ADR-002).
 */
export const webgpuEngine: RenderEngine = async (
  scene,
  camera,
  { width, height, samples, onProgress },
) => {
  const renderer = new WebGPURenderer({ antialias: false });
  let tracer: WebGPUPathTracer | null = null;
  try {
    await renderer.init();
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.outputColorSpace = SRGBColorSpace;
    tracer = new WebGPUPathTracer(renderer);
    tracer.renderDelay = 0;
    tracer.fadeDuration = 0;
    tracer.minSamples = 0;
    tracer.dynamicLowRes = false;
    tracer.maxBounces = 5;
    tracer.maxSamples = samples;
    tracer.setScene(scene, camera);
  } catch (e) {
    tracer?.dispose();
    renderer.dispose();
    throw e;
  }
  const pt = tracer;
  let stopped = false;
  let frames = 0;
  let finish: (b: Blob | null) => void = () => {};
  const done = new Promise<Blob | null>((res) => (finish = res));
  const tick = async () => {
    if (stopped) return;
    pt.renderSample();
    // The sample count is read back from the GPU; every few frames is enough for the progress line.
    if (++frames % 4 === 0 || frames === 1) {
      const counts = await pt.getSampleCountsAsync().catch(() => null);
      if (stopped) return;
      const n = Math.min(samples, Math.floor(counts?.min ?? 0));
      onProgress(n);
      if (n >= samples) {
        stopped = true;
        // Drawn and copied in the same task, so the canvas still holds the picture.
        pt.renderSample();
        renderer.domElement.toBlob((b) => finish(b), 'image/png');
        return;
      }
    }
    requestAnimationFrame(() => void tick());
  };
  requestAnimationFrame(() => void tick());
  return {
    canvas: renderer.domElement,
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
      renderer.dispose();
    },
  };
};
