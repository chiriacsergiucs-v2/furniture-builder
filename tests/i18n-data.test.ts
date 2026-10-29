import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import {
  CAPABILITY_WAITS,
  catalogFamilies,
  FUNCTION_LABEL,
  isSafetyConfirmed,
  ROOM_LABEL,
  setSafetyConfirmed,
} from '../src/core/catalog';
import { COMPAT_RULES } from '../src/core/compat';
import { baseLabel } from '../src/core/cutlist';
import { defaultMaterials, templates } from '../src/core/design';
import { JOINTS } from '../src/core/fasteners';
import { hasRu, setLang, tr } from '../src/core/i18n';
import { BAND_KINDS, KINDS, MAKERS } from '../src/core/materials';
import { sampleProjects } from '../src/core/samples/mobila';
import { builtInStyles, HANDLE_NAMES } from '../src/core/styles';
import type { Design } from '../src/core/types';

/** Every text a built-in design shows: its name, boards, part names, hardware and notes. */
function designTexts(d: Design): string[] {
  const out = [d.name, ...d.materials.map((m) => m.name)];
  if (d.catalog?.hardwareToChoose) out.push(d.catalog.hardwareToChoose);
  if (d.product.kind === 'panels') {
    if (d.product.params.note) out.push(d.product.params.note);
    out.push(...d.product.params.panels.map((p) => p.name));
  }
  const m = buildModel(d);
  for (const p of m.panels) out.push(p.label, baseLabel(p.label));
  for (const h of m.hardware) out.push(h.label, ...(h.note ? [h.note] : []));
  return out;
}

const missing = (texts: (string | undefined)[]) =>
  [...new Set(texts.filter((s): s is string => !!s && !!s.trim()))].filter((s) => !hasRu(s));

describe('Russian text for built-in data (ADR-155)', () => {
  let safety = false;
  beforeAll(() => {
    safety = isSafetyConfirmed();
    setSafetyConfirmed(true);
  });
  afterAll(() => setSafetyConfirmed(safety));

  it('covers every catalog family, item and the designs they build', () => {
    const texts: string[] = [
      ...Object.values(FUNCTION_LABEL),
      ...Object.values(ROOM_LABEL),
      ...Object.values(CAPABILITY_WAITS),
    ];
    for (const f of catalogFamilies) {
      texts.push(f.name, f.structure, ...f.aliases, ...f.configurations);
      for (const v of f.variants) {
        texts.push(v.name, v.summary, `${f.name} — ${v.name}`);
        if (v.hardware) texts.push(v.hardware);
        if (v.create) texts.push(...designTexts(v.create()));
      }
    }
    expect(missing(texts)).toEqual([]);
  });

  it('covers the built-in templates and the sample projects', () => {
    const texts: string[] = [];
    for (const t of templates) texts.push(t.name, t.description, ...designTexts(t.create()));
    for (const s of sampleProjects) {
      const p = s.create();
      texts.push(s.name, s.description, p.name);
      for (const it of p.items) texts.push(...designTexts(it.design));
    }
    expect(missing(texts)).toEqual([]);
  });

  it('covers boards, labels, styles, fastener types and compatibility rules', () => {
    const texts: (string | undefined)[] = [
      ...defaultMaterials().map((m) => m.name),
      ...[...MAKERS, ...KINDS, ...BAND_KINDS].map((x) => x.label),
      ...builtInStyles().map((s) => s.name),
      ...Object.values(HANDLE_NAMES),
      ...JOINTS.flatMap((j) => [j.title, j.line, j.one, j.many, j.how]),
      ...COMPAT_RULES.flatMap((r) => [r.name, r.text, r.appliesTo.when]),
    ];
    expect(missing(texts)).toEqual([]);
  });

  it('translates numbered part names and keeps English as is', () => {
    expect(tr('Drawer 3 front')).toBe('Drawer 3 front');
    setLang('ru');
    try {
      expect(tr('Shelf 2')).toBe('Полка 2');
      expect(tr('Drawer 3 front')).toBe('Фасад ящика 3');
      expect(tr('Base cabinet')).toBe('Нижний шкаф');
    } finally {
      setLang('en');
    }
  });
});
