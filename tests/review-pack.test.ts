import { describe, expect, it } from 'vitest';
import { setItemRotation } from '../src/core/arrange';
import { templates } from '../src/core/design';
import {
  buildProjectModel,
  makeItem,
  newProject,
  projectCutlist,
  resolvePlacements,
  type Project,
} from '../src/core/project';
import { planSvg, reviewPackFiles, reviewPackZip, summaryHtml } from '../src/core/reviewPack';
import { cutlistCsvRo } from '../src/core/ro';
import { snapshotSvg } from '../src/core/snapshot';
import { crc32, zipStore } from '../src/core/zip';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
function run(ids: string[]): Project {
  let p = newProject('Kitchen <A&B>');
  for (const id of ids) p = { ...p, items: [...p.items, makeItem(p, t(id))] };
  return resolvePlacements(p);
}

/** The files a .zip holds, read back from its central directory. */
function unzip(bytes: Uint8Array): Record<string, string> {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  expect(v.getUint32(end, true)).toBe(0x06054b50);
  const n = v.getUint16(end + 10, true);
  let at = v.getUint32(end + 16, true);
  const out: Record<string, string> = {};
  const dec = new TextDecoder();
  for (let i = 0; i < n; i++) {
    expect(v.getUint32(at, true)).toBe(0x02014b50);
    const size = v.getUint32(at + 20, true),
      nameLen = v.getUint16(at + 28, true),
      local = v.getUint32(at + 42, true);
    const name = dec.decode(bytes.subarray(at + 46, at + 46 + nameLen));
    const lnLen = v.getUint16(local + 26, true);
    const data = bytes.subarray(local + 30 + lnLen, local + 30 + lnLen + size);
    expect(crc32(data)).toBe(v.getUint32(at + 16, true));
    out[name] = dec.decode(data);
    at += 46 + nameLen;
  }
  return out;
}

describe('the .zip writer (ADR-121)', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('stores files that read back byte for byte, with UTF-8 names', () => {
    const enc = new TextEncoder();
    const z = zipStore([
      { name: 'a.txt', data: enc.encode('hello') },
      { name: 'listă-piese.csv', data: enc.encode('Denumire;Buc.\n') },
    ]);
    expect(unzip(z)).toEqual({ 'a.txt': 'hello', 'listă-piese.csv': 'Denumire;Buc.\n' });
  });
});

describe('the review pack (ADR-121)', () => {
  const p0 = run(['base-door', 'base-door', 'chest']);
  const p = setItemRotation(p0, p0.items[0].id, 30).project;
  const pm = buildProjectModel(p);
  const json = JSON.stringify(p);
  const files = reviewPackFiles(p, pm, json, 'kitchen', '27.10.2026');

  it('holds the summary, parts CSV, plan, 3D view and project file, each from the project model', () => {
    expect(files.map((f) => f.name)).toEqual([
      'kitchen-rezumat.html',
      'kitchen-piese.csv',
      'kitchen-plan.svg',
      'kitchen-3d.svg',
      'kitchen-proiect.json',
    ]);
    const by = Object.fromEntries(files.map((f) => [f.name, f.text]));
    expect(by['kitchen-piese.csv']).toBe(cutlistCsvRo(projectCutlist(p)));
    expect(by['kitchen-3d.svg']).toBe(snapshotSvg(pm.model, pm.materials, 900));
    expect(by['kitchen-plan.svg']).toBe(planSvg(pm, p));
    expect(by['kitchen-proiect.json']).toBe(json);
    expect(by['kitchen-rezumat.html']).toBe(summaryHtml(pm, p, '27.10.2026'));
  });

  it('lists every piece with its turn and every problem, and escapes names', () => {
    const html = summaryHtml(pm, p, '27.10.2026');
    expect(html).toContain('Kitchen &lt;A&amp;B&gt;');
    expect(html).not.toContain('<A&B>');
    expect(html).toContain('30°');
    const errors = pm.diagnostics.filter((x) => x.severity === 'error');
    // The turned piece overlaps its neighbour: there is at least one error, and each is listed.
    expect(errors.length).toBeGreaterThan(0);
    for (const d of errors) expect(html).toContain(`<b>Eroare:</b> ${d.message}`);
    expect((html.match(/<tr><td>/g) ?? []).length).toBe(3);
  });

  it('draws the turned piece turned on the plan', () => {
    const svg = planSvg(pm, p);
    expect((svg.match(/<polygon/g) ?? []).length).toBe(3);
    expect(svg).toContain('văzut de sus');
  });

  it('zips all of it', () => {
    const back = unzip(reviewPackZip(files, new Date(2026, 9, 27, 12, 0, 0)));
    expect(Object.keys(back)).toEqual(files.map((f) => f.name));
    expect(back['kitchen-proiect.json']).toBe(json);
  });
});
