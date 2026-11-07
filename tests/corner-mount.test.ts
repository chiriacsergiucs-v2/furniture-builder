// ADR-177 (user 2026-11-05): corner pieces stand on the floor or hang on the wall, as cabinets do. A hung corner has
// no plinth, no automatic brackets or rail, and one line asking the user to choose the hanging brackets; it counts as
// wall-hung for placement checks. Design schemaVersion 7; 1 to 6 still load.
import { afterEach, describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import {
  cornerDefaults,
  SCHEMA_VERSION,
  upgradeDesign,
  validateDesign,
  wrap,
} from '../src/core/design';
import { kitchen } from '../src/core/catalog/kitchen';
import { setPrintLang } from '../src/core/i18n/print';
import { buildProjectModel, isWallHung, makeItem, newProject } from '../src/core/project';
import { hardwareRo } from '../src/core/ro';
import { shoppingList } from '../src/core/shopping';
import type { CornerParams, Design } from '../src/core/types';

const VARIANTS = ['blind', 'l-shape', 'diagonal'] as const;
const corner = (v: CornerParams['variant'], over: Partial<CornerParams> = {}): Design =>
  wrap('C', { kind: 'corner', id: 'C', params: { ...cornerDefaults(v), ...over } });
const hung = (v: CornerParams['variant']) => corner(v, { mount: 'wall', mountHeight: 1450 });
const errors = (d: Design) => buildModel(d).diagnostics.filter((x) => x.severity === 'error');
const LINE = 'Wall hanging brackets: choose for this corner unit';

afterEach(() => setPrintLang('ro'));

describe('hung corner pieces (ADR-177)', () => {
  it('a hung corner has no plinth panel, one choose-the-brackets line and no bracket or rail lines', () => {
    for (const v of VARIANTS) {
      const floor = buildModel(corner(v));
      expect(
        floor.panels.some((p) => p.role === 'plinth'),
        v,
      ).toBe(true);
      expect(floor.hardware.some((h) => h.kind === 'wall-hanging')).toBe(false);
      const d = hung(v);
      expect(errors(d), v).toEqual([]);
      const m = buildModel(d);
      expect(
        m.panels.some((p) => p.role === 'plinth'),
        v,
      ).toBe(false);
      // Nothing starts above the floor: the plinth height is not left as a gap under the carcass.
      expect(Math.min(...m.panels.map((p) => p.box.y)), v).toBe(0);
      const lines = m.hardware.filter((h) => h.kind === 'wall-hanging');
      expect(lines, v).toHaveLength(1);
      expect(lines[0].label).toBe(LINE);
      expect(lines[0].sizeMm).toBeUndefined();
      expect(m.hardware.some((h) => h.kind === 'wall-bracket' || h.kind === 'wall-rail')).toBe(
        false,
      );
      // No anti-tip fixing: it hangs.
      expect(m.hardware.some((h) => h.kind === 'wall-fixing')).toBe(false);
    }
  });
  it('the line prints in the print language and is listed to choose before buying', () => {
    const m = buildModel(hung('blind'));
    const h = m.hardware.find((x) => x.kind === 'wall-hanging')!;
    expect(hardwareRo(h).item).toBe('Agățători de perete pentru corpul de colț: la alegerea dvs.');
    setPrintLang('en');
    expect(hardwareRo(h).item).toBe(LINE);
    setPrintLang('ru');
    expect(hardwareRo(h).item).toMatch(/[А-Яа-яЁё]/);
    const shop = shoppingList({ rows: [], materials: [], hardware: m.hardware, sheets: null });
    expect(shop.find((l) => l.label === LINE)?.section).toBe('choose');
  });
  it('counts as wall-hung: no placement-not-hung when hung, placement-wall-on-floor when put on the floor', () => {
    const codes = (d: Design, floor = false) => {
      const p = newProject('P');
      const it = makeItem(p, d);
      p.items = [
        floor ? { ...it, placement: { kind: 'floor' }, position: { ...it.position, y: 0 } } : it,
      ];
      return buildProjectModel(p).diagnostics.map((x) => x.code);
    };
    for (const v of VARIANTS) {
      expect(isWallHung(hung(v))).toBe(true);
      expect(isWallHung(corner(v))).toBe(false);
      const item = makeItem(newProject('P'), hung(v));
      expect(item.placement).toEqual({ kind: 'wall', height: 1450 });
      expect(codes(hung(v)), v).not.toContain('placement-not-hung');
      expect(codes(hung(v), true), v).toContain('placement-wall-on-floor');
      // A floor corner lifted onto the wall still gets the warning.
      const p = newProject('P');
      const fl = makeItem(p, corner(v));
      p.items = [{ ...fl, placement: { kind: 'wall', height: 1450 } }];
      expect(buildProjectModel(p).diagnostics.map((x) => x.code)).toContain('placement-not-hung');
    }
  });
  it('the wall corner templates are hung', () => {
    for (const id of ['corner-blind-wall', 'corner-l-wall']) {
      const v = kitchen.flatMap((f) => f.variants).find((x) => x.id === id)!;
      const d = v.create!();
      expect(d.product.kind === 'corner' && d.product.params.mount, id).toBe('wall');
      expect(validateDesign(d), id).toEqual([]);
      expect(isWallHung(d), id).toBe(true);
    }
  });
});

describe('corner mount in the design document (ADR-177, ADR-011)', () => {
  it('corner mount came with schemaVersion 7 (now 9); a v6 corner still loads and builds on the floor', () => {
    expect(SCHEMA_VERSION).toBe(9);
    const v6 = { ...corner('blind'), schemaVersion: 6 as const };
    expect(validateDesign(v6)).toEqual([]);
    const up = upgradeDesign(v6);
    expect(up.schemaVersion).toBe(9);
    expect(up.product).toEqual(v6.product);
    expect(buildModel(up).panels.some((p) => p.role === 'plinth')).toBe(true);
    for (const v of [1, 2, 3, 4, 5, 8] as const)
      expect(validateDesign({ ...corner('l-shape'), schemaVersion: v }), String(v)).toEqual([]);
  });
  it('refuses an invalid corner mount, a fractional mount height and a mount on an older version', () => {
    expect(validateDesign(corner('blind', { mount: 'ceiling' as unknown as 'wall' }))).toContain(
      'Invalid mount',
    );
    expect(validateDesign(corner('l-shape', { mount: 'wall', mountHeight: 12.5 }))).toContain(
      'mountHeight must be a whole number of mm',
    );
    expect(validateDesign({ ...hung('diagonal'), schemaVersion: 6 })).toContain(
      'Corner mount needs schemaVersion 7',
    );
    expect(validateDesign(hung('diagonal'))).toEqual([]);
    expect(validateDesign({ ...hung('diagonal'), schemaVersion: 7 })).toEqual([]);
    expect(validateDesign(corner('blind', { mount: 'floor' }))).toEqual([]);
  });
});
