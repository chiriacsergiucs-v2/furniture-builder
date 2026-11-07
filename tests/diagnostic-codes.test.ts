/**
 * ADR-225: every diagnostic code is listed in `DiagnosticCode`, every listed code is given somewhere, and no two
 * different problems share a code. The emit sites are read from the source: a `code: '…'` property or a check helper
 * called with a code (`err('…', …)`), and the first message text after it.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMPAT_RULES } from '../src/core/compat';
import {
  DIAGNOSTIC_CODES,
  isDiagnosticCode,
  type DiagnosticCode,
} from '../src/core/diagnosticCodes';

const root = new URL('../src/', import.meta.url).pathname;
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === 'i18n' ? [] : files(p);
    return /\.tsx?$/.test(n) && n !== 'diagnosticCodes.ts' ? [p] : [];
  });
const sources = files(root).map((p) => ({
  p: p.slice(root.length),
  text: readFileSync(p, 'utf8'),
}));

/**
 * Files whose `code` fields are not diagnostics: a template file's problems (`catalog/local.ts`), the board CSV columns
 * (`materials.ts`) and the wizard's own problems (`wizard/engine.ts`, which copies a diagnostic's code through).
 */
const OTHER_CODES = new Set([
  'core/catalog/local.ts',
  'core/materials.ts',
  'core/wizard/engine.ts',
]);
/** The check helpers that take a code (cabinet, frame, desk, corner, rules, roomfill, wallfill, envelopes). */
const HELPER =
  /\b(?:err|warn|note|info|bad|flag)\(\s*(?:(?:'(?:error|warning)'|\w+),\s*)?'(?!error'|warning')([a-z0-9-]+)',\s*/g;
const PROP = /\bcode: '([a-z0-9-]+)',(?!\s*appliesTo)/g;
const TEXT = String.raw`t[xr]?\(\s*(['"\`])((?:\\.|(?!\1)[^\\])*)\1`;
/** A helper's message argument, or an object's `message:` (either branch's first text when it picks one). */
const HELPER_TEXT = new RegExp(`^(?:[^,]*?\\?\\s*)?${TEXT}`);
const PROP_TEXT = new RegExp(`message:\\s*(?:[^,]*?\\?\\s*)?${TEXT}`);

interface Site {
  code: string;
  where: string;
  text: string | undefined;
}
/** The diagnostics the source gives: code, file:line and its message text when it is written there. */
const sites: Site[] = sources
  .filter(({ p }) => !OTHER_CODES.has(p))
  .flatMap(({ p, text }) => {
    const out: Site[] = [];
    for (const [re, tx] of [
      [HELPER, HELPER_TEXT],
      [PROP, PROP_TEXT],
    ] as const)
      for (const m of text.matchAll(re)) {
        const at = m.index + m[0].length;
        const rest = text.slice(at, at + 600);
        // Stop at the next diagnostic, so a site never takes the next one's text.
        const next = rest.search(/\bcode: '|\b(?:err|warn|note|info|bad|flag)\(/);
        const own = next < 0 ? rest : rest.slice(0, next);
        const line = text.slice(0, m.index).split('\n').length;
        out.push({ code: m[1], where: `${p}:${line}`, text: tx.exec(own)?.[2] });
      }
    return out;
  });

/**
 * Codes given with more than one wording because they are one problem said for each piece or place (ADR-225): each
 * entry is the number of wordings and why they are one problem. A new wording for a listed code changes its count;
 * a different problem gets its own code instead.
 */
const SAME_PROBLEM: Record<string, [number, string]> = {
  'back-height': [2, 'the seat is too high for the back, said for a sofa and for a bought base'],
  'band-narrow': [2, 'the edge band is narrower than the board, on a piece and on a run part'],
  'connection-broken': [2, 'a connection no longer joins, to a wall or to a piece'],
  'corner-size': [3, 'a corner unit is too small, said for the diagonal, blind and L corners'],
  'door-small': [1, 'one wording since flap-small was split off'],
  'drawer-heights': [2, 'the drawer heights do not fit, the fronts or the boxes'],
  'drawer-low': [2, 'the drawers are too low: all of them, or one box'],
  'frame-too-small': [2, 'the frame is too small for its legs or its bought base'],
  'handle-fit': [2, 'a handle does not fit its front, on a cabinet and on a panel'],
  'installation-height': [
    2,
    'the piece cannot be stood up in the room, from lying down or from its back',
  ],
  'knee-narrow': [
    2,
    'the knee space is narrow: an error below sitting width, a warning below the usual width',
  ],
  'material-missing': [6, 'a board the piece uses does not exist, said for each kind of piece'],
  'model-overlap': [2, 'a 3D model overlaps a piece or another model'],
  'opening-blocked': [2, 'a front cannot open fully, against a piece or a wall'],
  'outside-room': [
    2,
    'a piece does not fit in the room, through a wall or above the ceiling (one repair family)',
  ],
  'room-feature': [3, 'a door, window or obstacle is not inside the walls'],
  'room-input': [3, 'the walls to fill are not usable (one form field)'],
  'room-island': [4, 'the island cannot be placed (the walkway field, ADR-210)'],
  'safety-not-checked': [2, 'a safety standard is not checked, for a bunk bed and for a cot'],
  'split-fit': [2, 'the parts of a split do not fit'],
  'variable-problem': [2, 'a variable is not valid, in a set or on the piece'],
  'wall-input': [3, 'a wall field is not a valid number (one form field)'],
  'worktop-corner-joint': [
    2,
    'a worktop corner joint is not fully chosen: the joint or the part that runs through',
  ],
  'worktop-edge-size': [
    2,
    'a rounded or bevelled worktop edge has no usable size, so it is drawn square',
  ],
};

describe('diagnostic codes (ADR-225)', () => {
  it('finds the emit sites', () => {
    if (process.env.DUMP_SITES)
      console.log(sites.map((x) => `${x.code}\t${x.where}\t${x.text}`).join('\n'));
    expect(sites.length).toBeGreaterThan(200);
  });

  it('every code the source gives is a DiagnosticCode', () => {
    expect(
      sites.filter((s) => !isDiagnosticCode(s.code)).map((s) => `${s.code} ${s.where}`),
    ).toEqual([]);
    for (const r of COMPAT_RULES) expect(isDiagnosticCode(`compat-${r.id}`)).toBe(true);
    expect(isDiagnosticCode('no-such-code')).toBe(false);
    // `pnpm typecheck` fails on an unknown code literal: this line would compile without the error it expects.
    // @ts-expect-error an unknown code is not a DiagnosticCode (ADR-225)
    const unknown: DiagnosticCode = 'no-such-code';
    const known: DiagnosticCode[] = ['door-small', 'compat-family'];
    expect([unknown, ...known].map(isDiagnosticCode)).toEqual([false, true, true]);
  });

  it('every listed code is given somewhere, and none is listed twice', () => {
    expect(new Set(DIAGNOSTIC_CODES).size).toBe(DIAGNOSTIC_CODES.length);
    const given = new Set(sites.map((s) => s.code));
    // Templated codes: `${kind}-no-worktop`, `-cutout-deep`, `-cutout-wide` for a hob or a sink (ADR-125).
    const all = sources.map((s) => s.text).join('\n');
    const templated = (c: string) => {
      const m = /^(hob|sink)(-.+)$/.exec(c);
      return !!m && all.includes(`\${kind}${m[2]}\``);
    };
    // Codes a check picks by a condition (`flag(…, hit ? 'a' : 'b', …)`) appear as literals beside it.
    const literal = (c: string) => all.includes(`'${c}'`);
    expect(DIAGNOSTIC_CODES.filter((c) => !given.has(c) && !templated(c) && !literal(c))).toEqual(
      [],
    );
  });

  it('no two different problems share a code', () => {
    const by = new Map<string, Set<string>>();
    for (const s of sites)
      if (s.text !== undefined) by.set(s.code, (by.get(s.code) ?? new Set()).add(s.text));
    const shared = [...by].filter(([, ts]) => ts.size > 1).map(([c, ts]) => [c, ts.size] as const);
    expect(Object.fromEntries(shared)).toEqual(
      Object.fromEntries(
        Object.entries(SAME_PROBLEM)
          .filter(([, [n]]) => n > 1)
          .map(([c, [n]]) => [c, n]),
      ),
    );
    // The codes ADR-225 split: each now has one wording of its own.
    for (const c of [
      'flap-small',
      'drawer-heights-count',
      'inset-doors-depth',
      'diagonal-proportion',
    ])
      expect(by.get(c)?.size, c).toBe(1);
  });
});
