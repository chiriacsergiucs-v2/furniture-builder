import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// ADR-114: every gap, padding and margin in the stylesheet uses the --s-* spacing tokens, and the top bar has one rule.
const CSS = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

/**
 * The few raw values kept, each with its reason. Borders and outlines are not gap, padding or margin, so they never
 * show up here.
 */
const ALLOW: { selector: string; prop: string; why: string }[] = [
  { selector: '.views.both', prop: 'gap', why: 'the 1 px hairline between the two drawings' },
  {
    selector: '.tabs button',
    prop: 'margin-bottom',
    why: 'a tab overlaps the 1 px border under the list',
  },
  {
    selector: '.item.compact .ro-line',
    prop: 'margin-top',
    why: 'a negative offset: the RO line tucks under the meta chips (ADR-118) instead of a full row gap',
  },
  {
    selector: '.label-row > .info-tip, .info-row > .info-tip',
    prop: 'margin-block',
    why: 'a negative offset: the 44 px info button does not make its title row taller',
  },
];

type Decl = { line: number; selector: string; prop: string; value: string; atRules: string[] };

/** Every declaration with the rule it sits in and the at-rules around it. */
function declarations(css: string): Decl[] {
  // Comments become spaces so the line numbers stay right.
  const s = css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  const out: Decl[] = [];
  const stack: string[] = [];
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '{') {
      stack.push(s.slice(start, i).replace(/\s+/g, ' ').trim());
      start = i + 1;
    } else if (ch === '}') {
      stack.pop();
      start = i + 1;
    } else if (ch === ';') {
      const raw = s.slice(start, i);
      const m = /^\s*([a-z0-9-]+)\s*:\s*([\s\S]*)$/.exec(raw);
      if (m) {
        const lead = raw.length - raw.trimStart().length;
        out.push({
          line: s.slice(0, start + lead).split('\n').length,
          selector: stack.filter((x) => !x.startsWith('@')).at(-1) ?? '',
          prop: m[1],
          value: m[2].replace(/\s+/g, ' ').trim(),
          atRules: stack.filter((x) => x.startsWith('@')),
        });
      }
      start = i + 1;
    }
  }
  return out;
}

const SPACING = /^(gap|row-gap|column-gap|padding(-[a-z-]+)?|margin(-[a-z-]+)?)$/;
// A length that is not zero: 6px, -10px, 1.2em, 0.5rem (0px and 0 are fine).
const RAW = /(^|[^\w.-])-?(\d*\.\d+|\d+)(px|em|rem)\b/;
const decls = declarations(CSS);
const inScope = (d: Decl) =>
  !d.selector.startsWith(':root') && !d.atRules.some((a) => /^@media\b.*\bprint\b/.test(a));

describe('spacing tokens (ADR-114)', () => {
  it('reads the stylesheet', () => {
    expect(decls.filter((d) => SPACING.test(d.prop)).length).toBeGreaterThan(400);
  });

  it('no gap, padding or margin outside :root and print uses a raw length', () => {
    const raw = decls
      .filter((d) => SPACING.test(d.prop) && inScope(d))
      .filter((d) => RAW.test(d.value.replace(/\b0(px|em|rem)\b/g, '0')))
      .filter((d) => !ALLOW.some((a) => a.selector === d.selector && a.prop === d.prop))
      .map((d) => `${d.line}: ${d.selector} { ${d.prop}: ${d.value} }`);
    expect(raw).toEqual([]);
  });

  it('every allowed raw value is still there and still needed', () => {
    for (const a of ALLOW) {
      const hits = decls.filter(
        (d) => d.selector === a.selector && d.prop === a.prop && RAW.test(d.value),
      );
      expect(hits.length, `${a.selector} ${a.prop}`).toBeGreaterThan(0);
    }
  });

  it('the spacing tokens are the 4 px scale', () => {
    const root = decls.filter((d) => d.selector === ':root' && /^--s-\d+$/.test(d.prop));
    expect(Object.fromEntries(root.map((d) => [d.prop, d.value]))).toEqual({
      '--s-1': '4px',
      '--s-2': '8px',
      '--s-3': '12px',
      '--s-4': '16px',
      '--s-5': '20px',
      '--s-6': '24px',
      '--s-8': '32px',
    });
  });

  it('a field hint sits 4 px under its control and the side panel groups 16 px apart', () => {
    const rule = (sel: string) => decls.filter((d) => d.selector === sel && !d.atRules.length);
    expect(rule('.field').find((d) => d.prop === 'gap')?.value).toBe('var(--s-1)');
    expect(rule('.inspector').find((d) => d.prop === 'gap')?.value).toBe('var(--s-4)');
  });
});

describe('the top bar (ADR-114)', () => {
  const bar = decls.filter((d) => d.selector === '.bar');
  it('has one base rule and one phone rule', () => {
    const rules = new Set(bar.map((d) => d.atRules.join(' | ')));
    expect([...rules]).toEqual(['', '@media (max-width: 760px)']);
    // One block each: a property is never declared twice for the same context.
    const keys = bar.map((d) => `${d.atRules.join(' | ')} ${d.prop}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('never toggles wrapping', () => {
    expect(bar.filter((d) => d.prop === 'flex-wrap').map((d) => d.value)).toEqual(['nowrap']);
  });
});

describe('the heading scale (ADR-114)', () => {
  const base = (sel: string, prop: string) =>
    decls.find((d) => d.selector === sel && d.prop === prop && !d.atRules.length)?.value;
  it('h1 24, h2 20, h3 17, all 600', () => {
    expect([base('h1', 'font-size'), base('h2', 'font-size'), base('h3', 'font-size')]).toEqual([
      'var(--fs-2xl)',
      'var(--fs-xl)',
      'var(--fs-lg)',
    ]);
    expect([
      base('h1', 'font-weight'),
      base('h2', 'font-weight'),
      base('h3', 'font-weight'),
    ]).toEqual(['600', '600', '600']);
  });
  it('the section labels are 13 px uppercase', () => {
    for (const sel of ['.list-head', '.card-title']) {
      expect(base(sel, 'font-size'), sel).toBe('var(--fs-xs)');
      expect(base(sel, 'text-transform'), sel).toBe('uppercase');
    }
  });
});
