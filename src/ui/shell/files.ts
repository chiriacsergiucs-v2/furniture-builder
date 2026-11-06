import { bytesToBase64 } from '../../core/surface';
import type { Design } from '../../core/types';
import { loadImage } from '../../persist/db';

export function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const fileName = (s: string) =>
  s
    .trim()
    .replace(/[^\w\- ]+/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase() || 'design';

/** Self-contained styles for the exported SVG drawing (the app stylesheet does not travel with the file). */
const SVG_STYLE = `.floor{fill:#b9c0bb}.el-back{fill:#d9ddd9}.el-panel{stroke:#22272a;stroke-width:1.2;vector-effect:non-scaling-stroke}
.el-front{fill:none;stroke:#5a625e;stroke-dasharray:5 4;vector-effect:non-scaling-stroke}.el-handle{stroke:#22272a;stroke-width:3;stroke-linecap:round;vector-effect:non-scaling-stroke}
.el-knob{fill:#22272a}.dim line{stroke:#22272a;stroke-width:1;vector-effect:non-scaling-stroke}.dim rect{fill:#f2c230}.dim text{fill:#3a2e00;font-family:sans-serif;font-weight:600}
.dim.subtle{display:none}`;

/** A stored picture as a JPEG data URL (ADR-206), or null when it is not on this device or cannot be drawn. */
async function jpegDataUrl(id: string): Promise<string | null> {
  try {
    const row = await loadImage(id);
    if (!row) return null;
    if (row.type === 'image/jpeg') return `data:image/jpeg;base64,${bytesToBase64(row.bytes)}`;
    const bitmap = await createImageBitmap(new Blob([row.bytes], { type: row.type }));
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
    bitmap.close();
    const url = canvas.toDataURL('image/jpeg', 0.9);
    return url.startsWith('data:image/jpeg') ? url : null;
  } catch {
    return null;
  }
}

/**
 * Save the front elevation on screen as a standalone SVG file; false when no elevation is drawn. Board pictures travel
 * inside the file (ADR-206, replacing ADR-048's plain colours for this download): each used pattern's picture is
 * embedded as a JPEG data URL from the stored image; a picture not on this device falls back to the plain colour.
 */
export async function downloadFrontSvg(design: Design): Promise<boolean> {
  const svg = document.querySelector('.view.front .elevation svg');
  if (!svg) return false;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.querySelectorAll('.el-space, .el-label, .el-selection').forEach((n) => n.remove());
  const filled = [...clone.querySelectorAll<SVGElement>('[data-plain]')];
  const used = new Set(
    filled.flatMap((n) => {
      const m = /url\(["']?#([^"')]+)["']?\)/.exec(n.style.fill);
      return m ? [m[1]] : [];
    }),
  );
  const pictures = new Map<string, string | null>();
  for (const pat of [...clone.querySelectorAll<SVGPatternElement>('pattern')]) {
    const id = pat.dataset.image;
    const img = pat.querySelector('image');
    if (!used.has(pat.id) || !id || !img) {
      pat.remove();
      continue;
    }
    if (!pictures.has(id)) pictures.set(id, await jpegDataUrl(id));
    const url = pictures.get(id);
    if (!url) {
      pat.remove();
      continue;
    }
    img.setAttribute('href', url);
    pat.removeAttribute('data-image');
  }
  const kept = new Set([...clone.querySelectorAll('pattern')].map((p) => p.id));
  for (const n of filled) {
    const m = /url\(["']?#([^"')]+)["']?\)/.exec(n.style.fill);
    if (!m || !kept.has(m[1])) n.style.fill = n.dataset.plain ?? '';
    delete n.dataset.plain;
  }
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = SVG_STYLE;
  clone.prepend(style);
  download(
    `${fileName(design.name)}-front.svg`,
    new XMLSerializer().serializeToString(clone),
    'image/svg+xml',
  );
  return true;
}
