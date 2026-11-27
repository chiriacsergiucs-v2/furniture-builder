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
    /\b(?:import|export)\s[^;'"]*?\bfrom\s*['"]([^'"]+)['"]/g,
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
  /^src\/core\/(project\w*|room|design)$|^src\/core\/(catalog|nesting|wizard|sellers)(\/|$)|^@furniture-builder\/(nesting(\/|$)|i18n\/print$)/;
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
    expect(violation('src/core/x/b.ts', 'three/examples/jsm/x.js')).not.toBeNull();
    expect(violation('src/core/a.ts', 'dexie')).not.toBeNull();
    expect(violation('src/core/a.ts', '../ui/x')).not.toBeNull();
    expect(violation('src/core/x/y/a.ts', '../../../store/designStore')).not.toBeNull();
    expect(violation('src/core/cabinet.ts', '@furniture-builder/i18n/print')).not.toBeNull();
    expect(violation('src/core/cabinet.ts', '@furniture-builder/i18n')).toBeNull();
    expect(violation('src/core/ro.ts', '@furniture-builder/i18n/print')).toBeNull();
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
    // ADR-280: the i18n package is the bottom package.
    for (const file of ['index', 'print', 'print-text', 'warning-text', 'ru/shell'].map(
      (m) => `packages/i18n/src/${m}.ts`,
    )) {
      expect(await errors(file, "import { a } from './x';\nexport const b = a;\n")).toBe(0);
      for (const spec of [
        '../tests/x',
        '../../../src/core/ro',
        'react',
        '@furniture-builder/nesting',
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
    expect(
      await errors(
        'src/core/cabinet.ts',
        "import { pt } from '@furniture-builder/i18n/print';\nexport const b = pt;\n",
      ),
    ).toBeGreaterThan(0);
    expect(
      await errors(
        'src/core/cabinet.ts',
        "import { t } from '@furniture-builder/i18n';\nexport const b = t;\n",
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

// G-485, G-530: import cycles. A cycle of static imports (value or type, re-exports included) is a group of files
// that can only be read, tested and loaded together. Each group found must be one of the allowed groups below,
// exactly, so a new cycle or a file joining an allowed one fails. Dynamic `import()` is lazy loading and is not an
// edge. The model files (ADR-219) must not reach the project layer even through other files (G-530).
const STATIC = [
  /\b(?:import|export)\s[^;'"]*?\bfrom\s*['"]([^'"]+)['"]/g,
  /^\s*import\s*['"]([^'"]+)['"]/gm,
];
const ALLOWED_CYCLES: { files: string[]; why: string }[] = [
  {
    why: 'the project model (the files project.ts re-exports and the files they name) is one unit (G-485 pick, G-548)',
    files: [
      'arrange',
      'common',
      'compat',
      'connections',
      'groupMove',
      'projectDoc',
      'projectModel',
      'projectMove',
      'projectPlace',
      'projectProfiles',
      'projectRuns',
      'projectWorktops',
      'selection',
      'shared',
      'sizeLock',
      'variables',
    ].map((m) => `src/core/${m}.ts`),
  },
];
// Allowances for the transitive model rule: desk.ts reads ./design (G-491), and design.ts reads the catalog's room list
// (`ROOMS`). The document types name no catalog file any more (G-613).
const MODEL_REACH_ALLOWED = ['src/core/design.ts', 'src/core/catalog/types.ts'];

/** Static import edges between the given files, resolved like Vite does (`.ts`, `.tsx`, `/index`). */
function importGraph(sources: { file: string; text: string }[]): Map<string, string[]> {
  const known = new Set(sources.map((s) => s.file));
  const resolve = (file: string, spec: string): string | null => {
    if (!spec.startsWith('.')) return null;
    const base = posix.normalize(
      posix.join(posix.dirname(file), spec.replace(/\.(js|ts|tsx)$/, '')),
    );
    return (
      [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find((c) =>
        known.has(c),
      ) ?? null
    );
  };
  const graph = new Map<string, string[]>();
  for (const { file, text } of sources) {
    const out = new Set<string>();
    for (const re of STATIC)
      for (const m of text.matchAll(re)) {
        const r = resolve(file, m[1]);
        if (r) out.add(r);
      }
    graph.set(file, [...out]);
  }
  return graph;
}

/** The groups of two or more files that import each other, each sorted (Tarjan's strongly connected components). */
function cycles(graph: Map<string, string[]>): string[][] {
  let next = 0;
  const index = new Map<string, number>(),
    low = new Map<string, number>(),
    stack: string[] = [],
    on = new Set<string>(),
    out: string[][] = [];
  const visit = (v: string) => {
    index.set(v, next);
    low.set(v, next++);
    stack.push(v);
    on.add(v);
    for (const w of graph.get(v) ?? []) {
      if (!index.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (on.has(w)) low.set(v, Math.min(low.get(v)!, index.get(w)!));
    }
    if (low.get(v) !== index.get(v)) return;
    const group: string[] = [];
    let w: string;
    do {
      w = stack.pop()!;
      on.delete(w);
      group.push(w);
    } while (w !== v);
    if (group.length > 1) out.push(group.sort());
  };
  for (const v of [...graph.keys()].sort()) if (!index.has(v)) visit(v);
  return out;
}

/** Every file `from` reaches through static imports, each with the path that reaches it. */
function reach(graph: Map<string, string[]>, from: string): Map<string, string[]> {
  const path = new Map<string, string[]>([[from, [from]]]);
  const queue = [from];
  while (queue.length) {
    const v = queue.shift()!;
    for (const w of graph.get(v) ?? [])
      if (!path.has(w)) {
        path.set(w, [...path.get(v)!, w]);
        queue.push(w);
      }
  }
  return path;
}

const GRAPH = importGraph(SOURCES);

describe('import cycles (G-485, G-530)', () => {
  it('every import cycle in src/ is one of the allowed groups, exactly', () => {
    const allowed = new Set(ALLOWED_CYCLES.map((c) => [...c.files].sort().join(' ')));
    const found = cycles(GRAPH).map((c) => c.join(' '));
    expect(found.filter((c) => !allowed.has(c))).toEqual([]);
  });

  it('the document types are in no import cycle (G-613), and no core file imports the project barrel (G-548)', () => {
    const typeFiles = [
      'types',
      'kernelTypes',
      'materialTypes',
      'modelTypes',
      'productTypes',
      'designTypes',
      'diagnosticCodes',
      'catalog/types',
    ].map((m) => `src/core/${m}.ts`);
    expect(
      cycles(GRAPH)
        .flat()
        .filter((f) => typeFiles.includes(f)),
    ).toEqual([]);
    const barrelUsers = [...GRAPH]
      .filter(([f, to]) => f.startsWith('src/core/') && to.includes('src/core/project.ts'))
      .map(([f]) => f);
    expect(barrelUsers).toEqual([]);
  });

  it('no model file reaches the project layer, not even through other files', () => {
    const hits = MODEL.flatMap((m) =>
      [...reach(GRAPH, m)].flatMap(([file, path]) =>
        MODEL_UP.test(file.replace(/\.tsx?$/, '')) && !MODEL_REACH_ALLOWED.includes(file)
          ? [path.join(' → ')]
          : [],
      ),
    );
    expect(hits).toEqual([]);
  });

  it('the scan finds a cycle, a type-only one, and a model file reaching project.ts through another file', () => {
    const g = importGraph([
      { file: 'src/a.ts', text: "import { b } from './b';" },
      { file: 'src/b.tsx', text: "export { c } from './c';\nimport('./a');" },
      { file: 'src/c.ts', text: "import type { A } from './a';" },
      { file: 'src/d.ts', text: "import './b';" },
      { file: 'src/e/index.ts', text: "import { d } from '../d';" },
      { file: 'src/f.ts', text: "import { e } from './e';" },
    ]);
    expect(cycles(g)).toEqual([['src/a.ts', 'src/b.tsx', 'src/c.ts']]);
    expect(reach(g, 'src/f.ts').get('src/a.ts')).toEqual([
      'src/f.ts',
      'src/e/index.ts',
      'src/d.ts',
      'src/b.tsx',
      'src/c.ts',
      'src/a.ts',
    ]);
    expect(cycles(importGraph([{ file: 'src/x.ts', text: "await import('./y');" }]))).toEqual([]);
    const model = importGraph([
      { file: 'src/core/build.ts', text: "import { v } from './variables';" },
      { file: 'src/core/variables.ts', text: "import type { Project } from './project';" },
      { file: 'src/core/project.ts', text: '' },
    ]);
    expect(reach(model, 'src/core/build.ts').has('src/core/project.ts')).toBe(true);
    expect(MODEL_UP.test('src/core/project')).toBe(true);
  });
});
