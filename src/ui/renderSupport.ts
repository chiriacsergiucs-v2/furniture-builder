/**
 * Render settings and the device check for photo-quality stills (ADR-068). Pure apart from the canvas the caller
 * passes in; no three.js here, so the main bundle stays small.
 */
export const RENDER_SAMPLES = 256;
export const RENDER_SIZES = [
  { value: '1920x1080', label: '1920 × 1080', width: 1920, height: 1080 },
  { value: '1280x720', label: '1280 × 720', width: 1280, height: 720 },
] as const;
export type RenderSize = (typeof RENDER_SIZES)[number]['value'];

/** True when this device can path-trace: it needs WebGL 2. Never throws. */
export function hasWebGL2(
  makeCanvas: () => { getContext: (k: string) => unknown } = () => document.createElement('canvas'),
): boolean {
  try {
    return !!makeCanvas().getContext('webgl2');
  } catch {
    return false;
  }
}

/** "Kitchen 3 m render.png" — the design's name with characters file systems refuse replaced. */
export function renderFileName(name: string): string {
  const clean = Array.from(name, (ch) => (ch < ' ' || '\\/:*?"<>|'.includes(ch) ? ' ' : ch))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  return `${clean || 'Furniture'} render.png`;
}
