import { readdirSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';
import { files, sourceTexts } from './helpers/sourceFiles';

// ADR-219: the layer rules of CLAUDE.md, checked on the source itself, so CI fails even if eslint.config.js (which
// holds the same rules) changes. Paths are repo-relative with forward slashes; targets are resolved without extension.
const ROOT = new URL('..', import.meta.url).pathname;

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
const CORE_PACKAGE = /^(react|react-dom|three|dexie|zustand)(\/|$)|^@react-three\/|^@supabase\//;
const APP = /^src\/(store|ui|persist|viewer|online)(\/|$)/;
const MODEL_UP =
  /^src\/core\/(project|room|design|i18n\/print)$|^src\/core\/(catalog|nesting|wizard|sellers)(\/|$)|^@furniture-builder\/nesting(\/|$)/;
// ADR-279: a workspace package is reached by its name and exports, never by its files.
const DEEP = /^@furniture-builder\/[^/]+\/(src|tests)(\/|$)|(^|\/)packages\//;
// Allowance: src/ui/Gaps.tsx reads the gaps ledger as text (G-503).
const RAW_ALLOWED = /^src\/core\/(catalog\/brands|sellers)\/|^src\/ui\/Gaps\.tsx$/;
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
  }
  if (DEEP.test(spec) || target.startsWith('packages/'))
    return 'deep import into a workspace package';
  // ADR-230: the viewer imports nothing from src/ui (no allowance).
  if (file.startsWith('src/viewer/') && /^src\/ui(\/|$)/.test(target)) return 'viewer imports ui';
  return null;
}

const SOURCES = sourceTexts(ROOT);

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
    expect(violation('src/core/cabinet.ts', '@furniture-builder/nesting')).not.toBeNull();
    expect(violation('src/core/projectEstimate.ts', '@furniture-builder/nesting')).toBeNull();
    expect(violation('src/ui/a.tsx', '@furniture-builder/nesting/client')).toBeNull();
    expect(violation('src/ui/a.tsx', '@furniture-builder/nesting/src/place')).not.toBeNull();
    expect(violation('src/ui/a.tsx', '../../packages/nesting/src/place')).not.toBeNull();
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

// ADR-279 (after ADR-228): each workspace package imports only its own files and the packages its package.json
// declares; nothing reaches into a package's files. Checked on the files themselves and through ESLint
// (`pnpm lint`), each with a self-check that a forbidden import is caught.
const PACKAGES = readdirSync(join(ROOT, 'packages')).map((name) => `packages/${name}`);
const manifest = (dir: string): Record<string, Record<string, string> | undefined> =>
  JSON.parse(readFileSync(join(ROOT, dir, 'package.json'), 'utf8'));
const declared = (dir: string): string[] => {
  const m = manifest(dir);
  return Object.keys({ ...m.dependencies, ...m.peerDependencies });
};
/** The package name of a bare specifier (`@scope/name/sub` → `@scope/name`), or null for a relative one. */
const packageOf = (spec: string): string | null =>
  spec.startsWith('.')
    ? null
    : spec
        .split('/')
        .slice(0, spec.startsWith('@') ? 2 : 1)
        .join('/');

/** Why `file` (repo-relative, inside package `dir`) may not import `spec`, or null. */
function packageViolation(dir: string, file: string, spec: string, deps: string[]): string | null {
  const name = packageOf(spec);
  if (name === null)
    return posix.normalize(posix.join(posix.dirname(file), spec)).startsWith(`${dir}/src/`)
      ? null
      : 'leaves the package source';
  if (!deps.includes(name)) return `undeclared package ${name}`;
  return DEEP.test(spec) ? 'deep import into a workspace package' : null;
}

describe('workspace packages (ADR-279)', () => {
  it('each package source imports only itself and its declared packages', () => {
    const hits = PACKAGES.flatMap((dir) =>
      files(join(ROOT, dir, 'src')).flatMap((abs) => {
        const file = abs.slice(ROOT.length).split(/[\\/]/).join('/');
        return specifiers(readFileSync(abs, 'utf8')).flatMap((s) => {
          const why = packageViolation(dir, file, s, declared(dir));
          return why ? [`${file} → ${s}: ${why}`] : [];
        });
      }),
    );
    expect(hits).toEqual([]);
  });

  it('the app imports only the workspace packages it declares', () => {
    const deps = declared('.');
    const hits = SOURCES.flatMap(({ file, text }) =>
      specifiers(text)
        .filter((s) => s.startsWith('@furniture-builder/') && !deps.includes(packageOf(s)!))
        .map((s) => `${file} → ${s}`),
    );
    expect(hits).toEqual([]);
  });

  it('every package is private, scoped and exports TypeScript source', () => {
    for (const dir of PACKAGES) {
      const m = manifest(dir) as unknown as { name: string; private: boolean; exports: object };
      expect(m.name).toBe(`@furniture-builder/${dir.split('/')[1]}`);
      expect(m.private).toBe(true);
      expect(Object.values(m.exports).every((t) => /^\.\/src\/.+\.ts$/.test(t))).toBe(true);
    }
  });

  it('the file scan catches an import leaving a package', () => {
    const d = 'packages/nesting';
    const f = `${d}/src/place.ts`;
    expect(packageViolation(d, f, './validate', [])).toBeNull();
    expect(packageViolation(d, f, '../tests/nesting.test', [])).not.toBeNull();
    expect(packageViolation(d, f, '../../../src/core/types', [])).not.toBeNull();
    expect(packageViolation(d, f, 'react', [])).toBe('undeclared package react');
    expect(packageViolation(d, f, '@furniture-builder/i18n', [])).not.toBeNull();
    expect(
      packageViolation(d, f, '@furniture-builder/i18n', ['@furniture-builder/i18n']),
    ).toBeNull();
    expect(
      packageViolation(d, f, '@furniture-builder/i18n/src/x', ['@furniture-builder/i18n']),
    ).not.toBeNull();
    expect(packageOf('@a/b/c')).toBe('@a/b');
    expect(packageOf('three/examples/x')).toBe('three');
    expect(packageOf('./x')).toBeNull();
  });

  it('pnpm lint enforces the same boundary', async () => {
    const eslint = new ESLint({ cwd: ROOT });
    const errors = async (filePath: string, code: string) =>
      (await eslint.lintText(code, { filePath: join(ROOT, filePath) }))
        .flatMap((r) => r.messages)
        .filter((m) => m.ruleId === 'no-restricted-imports').length;
    for (const file of ['place', 'validate', 'types', 'worker', 'index', 'client'].map(
      (m) => `packages/nesting/src/${m}.ts`,
    )) {
      expect(await errors(file, "import { a } from './validate';\nexport const b = a;\n")).toBe(0);
      for (const spec of [
        '../tests/x',
        '../../../src/core/types',
        'react',
        '@furniture-builder/i18n',
      ])
        expect(
          await errors(file, `import { a } from '${spec}';\nexport const b = a;\n`),
        ).toBeGreaterThan(0);
    }
    for (const file of [
      'src/ui/a.tsx',
      'src/store/a.ts',
      'src/main.tsx',
      'src/core/projectEstimate.ts',
    ]) {
      const ok = ['@furniture-builder/nesting', '@furniture-builder/nesting/client'];
      for (const spec of ok)
        expect(await errors(file, `import { a } from '${spec}';\nexport const b = a;\n`)).toBe(0);
      for (const spec of [
        '@furniture-builder/nesting/src/place',
        '../../packages/nesting/src/place',
      ])
        expect(
          await errors(file, `import { a } from '${spec}';\nexport const b = a;\n`),
        ).toBeGreaterThan(0);
    }
    expect(
      await errors(
        'src/core/cabinet.ts',
        "import { nest } from '@furniture-builder/nesting';\nexport const b = nest;\n",
      ),
    ).toBeGreaterThan(0);
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
