import type { Design } from '../../core/types';

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

/** Save the front elevation on screen as a standalone SVG file; false when no elevation is drawn. */
export function downloadFrontSvg(design: Design): boolean {
  const svg = document.querySelector('.view.front .elevation svg');
  if (!svg) return false;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.querySelectorAll('.el-space, .el-label, .el-selection').forEach((n) => n.remove());
  // Pictures (ADR-048) live on this device only: the file gets the plain colours.
  clone.querySelectorAll('pattern').forEach((n) => n.remove());
  clone.querySelectorAll<SVGElement>('[data-plain]').forEach((n) => {
    n.style.fill = n.dataset.plain ?? '';
  });
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
