/**
 * The review pack (ADR-121): one package to hand a project to a professional for review, built only from the project
 * and its `buildProjectModel()` (ADR-004). The printed summary and the parts CSV are in Romanian (ADR-020); the
 * problems keep the app's own words. Pure: the caller saves or shares the bytes; the app sends nothing (ADR-002).
 */
import { snapshotSvg } from './snapshot';
import { cutlistCsvRo } from './ro';
import { projectCutlist, rotationOf, type Project, type ProjectModel } from './project';
import { zipStore, type ZipEntry } from './zip';

export interface PackFile {
  name: string;
  text: string;
  /** What it is, for the dialog's list. */
  what: string;
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

const f1 = (n: number) => String(Math.round(n * 10) / 10);

/** The room seen from above: walls, pieces (turned ones turned) with their names, in mm. */
export function planSvg(pm: ProjectModel, project: Project): string {
  const pts = [
    ...pm.pieces.flatMap((pc) => pc.footprint),
    ...(project.room?.outline ?? []).map(([x, z]) => [x, z] as [number, number]),
  ];
  if (!pts.length) return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"/>\n';
  const xs = pts.map((p) => p[0]),
    zs = pts.map((p) => p[1]);
  const x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    z0 = Math.min(...zs),
    z1 = Math.max(...zs);
  const span = Math.max(x1 - x0, z1 - z0, 1000);
  const pad = span * 0.08,
    fs = span / 45;
  const out: string[] = [];
  if (project.room)
    out.push(
      `<polygon points="${project.room.outline.map((p) => p.join(',')).join(' ')}" fill="#f4f1ea" stroke="#22272a" stroke-width="${f1(span / 300)}"/>`,
    );
  for (const pc of pm.pieces) {
    const poly = pc.footprint.map((p) => p.map(f1).join(',')).join(' ');
    const [a, b, c, d] = pc.front;
    const cx = pc.footprint.reduce((s, p) => s + p[0], 0) / 4,
      cz = pc.footprint.reduce((s, p) => s + p[1], 0) / 4;
    out.push(
      `<polygon points="${poly}" fill="#d9ddd9" stroke="#22272a" stroke-width="${f1(span / 600)}"/>`,
      `<line x1="${f1(a)}" y1="${f1(b)}" x2="${f1(c)}" y2="${f1(d)}" stroke="#c0631d" stroke-width="${f1(span / 250)}"/>`,
      `<text x="${f1(cx)}" y="${f1(cz)}" font-size="${f1(fs)}" font-family="sans-serif" text-anchor="middle" dominant-baseline="middle">${esc(pc.item.design.name)}</text>`,
    );
  }
  out.push(
    `<text x="${f1(x0)}" y="${f1(z1 + pad * 0.7)}" font-size="${f1(fs)}" font-family="sans-serif">${Math.round(x1 - x0)} × ${Math.round(z1 - z0)} mm, văzut de sus; linia portocalie = fața</text>`,
  );
  const vb = [x0 - pad, z0 - pad, x1 - x0 + 2 * pad, z1 - z0 + 2 * pad].map(f1).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="1000" height="${Math.round((1000 * (z1 - z0 + 2 * pad)) / (x1 - x0 + 2 * pad))}">${out.join('')}</svg>\n`;
}

/** The printable summary: pieces with size, place and turn, and every problem the app found. */
export function summaryHtml(pm: ProjectModel, project: Project, date: string): string {
  const rows = pm.pieces
    .map((pc) => {
      const b = pc.model.bounds;
      const p = pc.item.position;
      return `<tr><td>${esc(pc.item.design.name)}</td><td class="n">${pc.item.quantity}</td><td class="n">${b.w} × ${b.h} × ${b.d}</td><td class="n">${p.x} / ${p.y} / ${p.z}</td><td class="n">${rotationOf(pc.item)}°</td></tr>`;
    })
    .join('');
  const problems = pm.diagnostics;
  const list = problems.length
    ? `<ul>${problems.map((d) => `<li><b>${d.severity === 'error' ? 'Eroare' : 'Atenție'}:</b> ${esc(d.message)}</li>`).join('')}</ul>`
    : '<p>Aplicația nu a găsit probleme.</p>';
  const b = pm.model.bounds;
  return `<!doctype html><html lang="ro"><head><meta charset="utf-8"><title>${esc(project.name)} — de verificat</title>
<style>body{font-family:sans-serif;margin:24px;color:#22272a}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:4px 6px;text-align:left}td.n{text-align:right;font-variant-numeric:tabular-nums}h1{font-size:20px}h2{font-size:16px;margin-top:20px}@media print{body{margin:0}}</style></head>
<body><h1>${esc(project.name)}</h1>
<p>Proiect de verificat · ${esc(date)} · gabarit ${b.w} × ${b.h} × ${b.d} mm · ${pm.pieces.length} piese</p>
<p>Dimensiuni în mm. Poziția este colțul din stânga-spate-jos al piesei (x de la stânga, y de la podea, z de la peretele din spate). Rotirea este în grade, în jurul centrului piesei.</p>
<h2>Piese</h2>
<table><thead><tr><th>Piesă</th><th>Buc.</th><th>Lățime × înălțime × adâncime</th><th>Poziție x / y / z</th><th>Rotire</th></tr></thead><tbody>${rows}</tbody></table>
<h2>Probleme găsite de aplicație</h2>${list}
<h2>Fișiere</h2><p>Lista de piese (CSV), planul văzut de sus și vederea 3D (SVG), fișierul proiectului (JSON, se deschide în aplicație).</p>
</body></html>
`;
}

/**
 * The files of the pack. `projectJson` is the project file as the app saves it (pictures included by the caller);
 * `base` is the file-name stem.
 */
export function reviewPackFiles(
  project: Project,
  pm: ProjectModel,
  projectJson: string,
  base: string,
  date: string,
): PackFile[] {
  return [
    {
      name: `${base}-rezumat.html`,
      text: summaryHtml(pm, project, date),
      what: 'Summary to print',
    },
    {
      name: `${base}-piese.csv`,
      text: cutlistCsvRo(projectCutlist(project)),
      what: 'Parts list (CSV)',
    },
    { name: `${base}-plan.svg`, text: planSvg(pm, project), what: 'Plan seen from above (SVG)' },
    {
      name: `${base}-3d.svg`,
      text: snapshotSvg(pm.model, pm.materials, 900),
      what: '3D view (SVG)',
    },
    { name: `${base}-proiect.json`, text: projectJson, what: 'Project file (opens in this app)' },
  ];
}

/** The pack as one .zip. */
export function reviewPackZip(files: PackFile[], when?: Date): Uint8Array {
  const enc = new TextEncoder();
  const entries: ZipEntry[] = files.map((f) => ({ name: f.name, data: enc.encode(f.text) }));
  return zipStore(entries, when);
}
