import { describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { templates } from '../src/core/design';
import { exportFusionPython } from '../src/core/fusion';
import { cutlist } from '../src/core/cutlist';
import { cutlistCsvRo } from '../src/core/ro';
import { csvCell } from '../src/core/prices';
import { decodeCode, encodeCode, MAX_CODE_BYTES, MAX_CODE_CHARS } from '../src/core/shareCode';
import { MAX_PROJECT_ITEMS, validateProject } from '../src/core/projectValidate';
import { importFile, MAX_IMPORT_BYTES } from '../src/ui/shell/importFile';

describe('security fixes', () => {
  it('H-1: a hardware label with line breaks yields no code line at column 0 in the header', () => {
    const d = templates.find((t) => t.id === 'sideboard')!.create();
    const m = buildModel(d);
    const clean = exportFusionPython(d, m);
    const head = clean.slice(0, clean.indexOf('import adsk.core'));
    expect(head).toContain('Hardware (not modelled)');
    // Inject a hostile label through the model's hardware by renaming panels used in screw labels.
    const evil = 'A\nimport os\r import sys';
    const m2 = {
      ...m,
      hardware: m.hardware?.map((h) => ({ ...h, label: evil })),
      panels: m.panels.map((p) => ({ ...p, name: evil })),
    };
    const src = exportFusionPython(d, m2 as typeof m);
    const header = src.slice(0, src.indexOf('import adsk.core'));
    for (const line of header.split(/\r\n|\r|\n/).filter((l) => l.length > 0))
      expect(line.startsWith('#'), line).toBe(true);
    expect(header).toContain('A import os');
    for (const code of [0x2028, 0x85])
      expect(header.includes(String.fromCharCode(code))).toBe(false);
  });

  it('M-6: CSV cells starting with tab, CR or = are neutralised', () => {
    for (const lead of ['\t', '\r', '=', '+', '-', '@']) {
      const c = csvCell(`${lead}SUM(1)`);
      expect(c.replace(/^"/, '').startsWith("'"), JSON.stringify(lead)).toBe(true);
    }
    expect(csvCell('Plain')).toBe('Plain');
    const d = templates.find((t) => t.id === 'chest')!.create();
    const rows = cutlist(buildModel(d), d.materials);
    for (const lead of ['\t', '\r', '=']) {
      const csv = cutlistCsvRo(rows.map((r) => ({ ...r, labels: [`${lead}HYPERLINK("x")`] })));
      const first = csv.slice(1).split('\r\n')[1];
      expect(first.replace(/^"/, '').startsWith("'"), JSON.stringify(lead)).toBe(true);
    }
  });

  it('M-3: a too-long pasted code is refused and a normal one still decodes', async () => {
    const doc = { a: 1, b: 'x' };
    expect(await decodeCode(await encodeCode(doc))).toEqual({ ok: true, doc });
    const big = await decodeCode('FB1-' + 'A'.repeat(MAX_CODE_CHARS + 1));
    expect(big.ok).toBe(false);
  });

  it('M-3: a code that inflates past the limit is refused', async () => {
    const huge = { pad: 'a'.repeat(MAX_CODE_BYTES + 1000) };
    const code = await encodeCode(huge);
    expect(code.length).toBeLessThan(MAX_CODE_CHARS);
    const r = await decodeCode(code);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/too large/);
  });

  it('M-2: a project with too many items gets a diagnostic', () => {
    const errs = validateProject({
      id: 'p',
      name: 'P',
      schemaVersion: 1,
      items: Array.from({ length: MAX_PROJECT_ITEMS + 1 }, (_, i) => ({ id: `i${i}` })),
    });
    expect(errs.some((e) => /Too many items/.test(e))).toBe(true);
  });

  it('M-2: a file above the size limit is refused before it is read', async () => {
    let read = false;
    const f = {
      size: MAX_IMPORT_BYTES + 1,
      text: async () => {
        read = true;
        return '{}';
      },
    } as unknown as File;
    const r = await importFile(f);
    expect(r.opened).toBe(false);
    expect(r.message?.ok).toBe(false);
    expect(read).toBe(false);
  });
});
