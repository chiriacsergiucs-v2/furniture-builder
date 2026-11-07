import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix, relative } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// ADR-219: the layer rules of CLAUDE.md, checked on the source itself, so CI fails even if eslint.config.js (which
// holds the same rules) changes. Paths are repo-relative with forward slashes; targets are resolved without extension.
const ROOT = new URL('..', import.meta.url).pathname;
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });

/** Every module specifier in a source text: static imports and re-exports, side-effect and dynamic imports. */
function specifiers(text: string): string[] {
  const out: string[] = [];
  for (const re of [
    /\b(?:import|export)\s[^;]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /^\s*import\s*['"]([^'"]+)['"]/gm,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ])
    for (const m of text.matchAll(re)) out.push(m[1]);
  return out;
}

const MODEL = [
  'geometry',
  'cabinet',
  'build',
  'panel',
  'panelset',
  'frame',
  'shape',
  'corner',
  'desk',
  'rules',
  'clearance',
  'cutlist',
  'materials',
].map((m) => `src/core/${m}.ts`);
const NESTING = ['place', 'validate', 'types'].map((m) => `src/core/nesting/${m}`);
const CORE_PACKAGE = /^(react|react-dom|three|dexie|zustand)(\/|$)|^@react-three\/|^@supabase\//;
const APP = /^src\/(store|ui|persist|viewer|online)(\/|$)/;
const MODEL_UP =
  /^src\/core\/(project|room|design|i18n\/print)$|^src\/core\/(catalog|nesting|wizard|research|sellers)(\/|$)/;
// Allowance: src/ui/Gaps.tsx reads the gaps ledger as text (G-503).
const RAW_ALLOWED = /^src\/core\/(catalog\/brands|sellers|research)\/|^src\/ui\/Gaps\.tsx$/;
const RAW = /\?raw$/;
const GLOB = /\bimport\.meta\.glob\b/;

/** Why `file` may not import `spec`, or null. */
function violation(file: string, spec: string): string | null {
  const target = spec.startsWith('.')
    ? posix.normalize(posix.join(posix.dirname(file), spec))
    : spec;
  const bare = !spec.startsWith('.');
  if (RAW.test(spec) && !RAW_ALLOWED.test(file)) return '?raw outside the data loaders';
  if (file.startsWith('src/core/')) {
    if (bare && CORE_PACKAGE.test(spec)) return 'core imports a framework package';
    if (APP.test(target)) return 'core imports an app layer';
    if (MODEL.includes(file) && MODEL_UP.test(target)) {
      if (!(file === 'src/core/desk.ts' && target === 'src/core/design'))
        return 'model imports upward';
    }
    if (NESTING.includes(file.replace(/\.ts$/, '')) && !NESTING.includes(target))
      return 'nesting engine imports outside itself';
  } else if (/^src\/core\/nesting\/(place|validate)$/.test(target))
    return 'app imports the nesting engine';
  // ADR-230: the viewer imports nothing from src/ui (no allowance).
  if (file.startsWith('src/viewer/') && /^src\/ui(\/|$)/.test(target)) return 'viewer imports ui';
  return null;
}

const SOURCES = files(join(ROOT, 'src')).map((f) => ({
  file: relative(ROOT, f).split(/[\\/]/).join('/'),
  text: readFileSync(f, 'utf8'),
}));

describe('layer boundaries (ADR-219)', () => {
  it('no module in src/ imports across a layer boundary', () => {
    const hits = SOURCES.flatMap(({ file, text }) =>
      specifiers(text).flatMap((s) => {
        const why = violation(file, s);
        return why ? [`${file} → ${s}: ${why}`] : [];
      }),
    );
    expect(hits).toEqual([]);
  });

  it('import.meta.glob only in the data loaders', () => {
    const hits = SOURCES.filter(({ file, text }) => GLOB.test(text) && !RAW_ALLOWED.test(file));
    expect(hits.map((h) => h.file)).toEqual([]);
  });

  it('the scan itself catches each forbidden import', () => {
    expect(specifiers('import { a } from \'react\';\nimport type { B } from "three";')).toEqual([
      'react',
      'three',
    ]);
    expect(
      specifiers("export { x } from './y';\nimport './z.css';\nawait import('dexie');"),
    ).toEqual(['./y', './z.css', 'dexie']);
    expect(violation('src/core/a.ts', 'react')).not.toBeNull();
    expect(violation('src/core/a.ts', 'three')).not.toBeNull();
    expect(violation('src/core/i18n/b.ts', 'three/examples/jsm/x.js')).not.toBeNull();
    expect(violation('src/core/a.ts', 'dexie')).not.toBeNull();
    expect(violation('src/core/a.ts', '../ui/x')).not.toBeNull();
    expect(violation('src/core/i18n/ru/a.ts', '../../../store/designStore')).not.toBeNull();
    expect(violation('src/core/cabinet.ts', './project')).not.toBeNull();
    expect(violation('src/core/cabinet.ts', './design')).not.toBeNull();
    expect(violation('src/core/desk.ts', './design')).toBeNull();
    expect(violation('src/core/nesting/place.ts', '../types')).not.toBeNull();
    expect(violation('src/core/nesting/place.ts', './validate')).toBeNull();
    expect(violation('src/ui/a.tsx', '../core/nesting/place')).not.toBeNull();
    expect(violation('src/viewer/a.tsx', '../ui/x')).not.toBeNull();
    expect(violation('src/viewer/a.tsx', '../ui/planDrag')).not.toBeNull();
    expect(violation('src/viewer/a.tsx', '../ui/CountStepper')).not.toBeNull();
    expect(violation('src/viewer/a.tsx', '../store/useView')).toBeNull();
    expect(violation('src/viewer/a.tsx', '../shared/planDrag')).toBeNull();
    expect(violation('src/ui/a.tsx', './x.md?raw')).not.toBeNull();
    expect(violation('src/core/sellers/index.ts', './regency.json?raw')).toBeNull();
    expect(GLOB.test("const f = import.meta.glob('./*.json');")).toBe(true);
    expect(violation('src/ui/a.tsx', 'react')).toBeNull();
    expect(violation('src/core/a.ts', './types')).toBeNull();
  });
});

// ADR-228: the nesting engine (place, validate, types) is an internal module. Its three files import only each
// other, and only src/core reaches place or validate; the app goes through core/nesting. Checked on the files
// themselves and through ESLint (`pnpm lint`), each with a self-check that a forbidden import is caught.
describe('nesting engine boundary (ADR-228)', () => {
  const engine = NESTING.map((f) => `${f}.ts`);
  /** Engine files' imports that leave the engine. */
  const outside = (file: string, text: string): string[] =>
    specifiers(text).filter(
      (s) => !s.startsWith('./') || !NESTING.includes(posix.join(posix.dirname(file), s.slice(2))),
    );

  it('the three engine files import only each other', () => {
    const hits = engine.flatMap((file) =>
      outside(file, readFileSync(join(ROOT, file), 'utf8')).map((s) => `${file} → ${s}`),
    );
    expect(hits).toEqual([]);
  });

  it('only src/core imports place or validate', () => {
    const hits = SOURCES.filter(({ file }) => !file.startsWith('src/core/')).flatMap(
      ({ file, text }) =>
        specifiers(text)
          .filter((s) => /(^|\/)core\/nesting\/(place|validate)$/.test(s))
          .map((s) => `${file} → ${s}`),
    );
    expect(hits).toEqual([]);
  });

  it('the file scan catches an import leaving the engine', () => {
    const f = 'src/core/nesting/place.ts';
    expect(
      outside(f, "import { a } from './validate';\nimport type { T } from './types';"),
    ).toEqual([]);
    expect(outside(f, "import { x } from './index';")).toEqual(['./index']);
    expect(outside(f, "import { x } from './fromDesign';")).toEqual(['./fromDesign']);
    expect(outside(f, "import { x } from '../cutlist';")).toEqual(['../cutlist']);
    expect(outside(f, "export * from '../types';")).toEqual(['../types']);
    expect(outside(f, "const m = await import('./worker');")).toEqual(['./worker']);
    expect(outside(f, "import { x } from 'some-package';")).toEqual(['some-package']);
    expect(violation('src/main.tsx', './core/nesting/validate')).not.toBeNull();
    expect(violation('src/store/a.ts', '../core/nesting')).toBeNull();
    expect(violation('src/core/projectEstimate.ts', './nesting/place')).toBeNull();
  });

  it('pnpm lint enforces the same boundary', async () => {
    const eslint = new ESLint({ cwd: ROOT });
    const errors = async (filePath: string, code: string) =>
      (await eslint.lintText(code, { filePath: join(ROOT, filePath) }))
        .flatMap((r) => r.messages)
        .filter((m) => m.ruleId === 'no-restricted-imports').length;
    for (const file of engine) {
      expect(await errors(file, "import { a } from './validate';\nexport const b = a;\n")).toBe(0);
      for (const spec of ['./index', './fromDesign', './worker', '../cutlist', '../types', 'react'])
        expect(
          await errors(file, `import { a } from '${spec}';\nexport const b = a;\n`),
        ).toBeGreaterThan(0);
    }
    for (const file of ['src/ui/a.tsx', 'src/store/a.ts', 'src/main.tsx', 'src/langInit.ts']) {
      const up = file.split('/').length === 2 ? './core' : '../core';
      expect(
        await errors(file, `import { nest } from '${up}/nesting';\nexport const b = nest;\n`),
      ).toBe(0);
      for (const m of ['place', 'validate'])
        expect(
          await errors(file, `import { a } from '${up}/nesting/${m}';\nexport const b = a;\n`),
        ).toBe(1);
    }
    expect(
      await errors(
        'src/core/projectEstimate.ts',
        "import { nest } from './nesting/place';\nexport const b = nest;\n",
      ),
    ).toBe(0);
    // ADR-230: the viewer imports nothing from src/ui.
    for (const [spec, n] of [
      ['../ui/CountStepper', 1],
      ['../ui/planDrag', 1],
      ['../store/useView', 0],
      ['../shared/planDrag', 0],
    ] as const)
      expect(
        await errors('src/viewer/a.tsx', `import { a } from '${spec}';\nexport const b = a;\n`),
      ).toBe(n);
  }, 60_000);
});
