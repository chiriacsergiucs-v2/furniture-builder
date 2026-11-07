import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

// Layer boundaries (ADR-219). `tests/core-boundary.test.ts` scans src/ for the same rules, so CI fails even if this
// file changes. ESLint gives one file the last matching block's `no-restricted-imports`, so each block repeats the
// patterns of the blocks it narrows.
const CORE = [
  {
    regex: '^(\\.\\./)+(store|ui|persist|viewer|online)(/|$)',
    message: 'src/core imports nothing from the app layers (ADR-004, ADR-219).',
  },
  {
    regex: '^(react|react-dom|three|dexie|zustand)(/|$)|^@react-three/|^@supabase/',
    message: 'src/core imports no framework, 3D, storage or online package (ADR-219).',
  },
];
// prettier-ignore
const MODEL = ['geometry', 'cabinet', 'build', 'panel', 'panelset', 'frame', 'shape', 'corner', 'desk', 'rules', 'clearance', 'cutlist', 'materials'];
const MODEL_UP = (design) => ({
  regex: `^\\./(project|room|i18n/print${design ? '|design' : ''})$|^\\./(catalog|nesting|wizard|research|sellers)(/|$)`,
  message: 'The model files import only the document, i18n and each other (ADR-219).',
});
const NESTING = {
  regex: '^(?!\\./(place|validate|types)$)',
  message:
    'The nesting engine (place, validate, types) imports nothing outside those three files (ADR-219).',
};
const APP = [
  {
    regex: '(^|/)core/nesting/(place|validate)$',
    message:
      'The app reaches the nesting engine through core/nesting, not place or validate (ADR-219).',
  },
];
// Allowance until ADR-230 moves them: the ui modules the viewer imports today, by name. A new one fails.
const VIEWER_UI = [
  'Clearances',
  'CountStepper',
  'MoveTo',
  'ProblemBanner',
  'keepProportions',
  'planDrag',
  'renderSupport',
  'useLook',
  'useMediaQuery',
  'useSnap',
  'useSolidWalls',
  'useTheme',
  'useView',
  'wallPictures',
];
const VIEWER = {
  regex: `^\\.\\./ui/(?!(${VIEWER_UI.join('|')})$)`,
  message: 'The 3D viewer imports no new ui module (ADR-014, ADR-219, ADR-230).',
};
const restrict = (patterns) => ({ 'no-restricted-imports': ['error', { patterns }] });

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'node_modules'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2023, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  { files: ['src/core/**/*.{ts,tsx}'], rules: restrict(CORE) },
  {
    files: MODEL.filter((m) => m !== 'desk').map((m) => `src/core/${m}.ts`),
    rules: restrict([...CORE, MODEL_UP(true)]),
  },
  // Allowance: desk.ts → ./design until diagnostics leave the model (G-491).
  { files: ['src/core/desk.ts'], rules: restrict([...CORE, MODEL_UP(false)]) },
  {
    files: ['src/core/nesting/{place,validate,types}.ts'],
    rules: restrict([...CORE, NESTING]),
  },
  { files: ['src/{ui,store,persist,viewer,online}/**/*.{ts,tsx}'], rules: restrict(APP) },
  { files: ['src/viewer/**/*.{ts,tsx}'], rules: restrict([...APP, VIEWER]) },
  // Vite-only module syntax stays in the data loaders (ADR-219). Allowance: src/ui/Gaps.tsx reads the gaps ledger
  // as text (G-503).
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      'src/core/catalog/brands/**',
      'src/core/sellers/**',
      'src/core/research/**',
      'src/ui/Gaps.tsx',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.type='MetaProperty'][property.name='glob']",
          message: 'import.meta.glob only in catalog/brands, sellers and research (ADR-219).',
        },
        {
          selector: 'ImportDeclaration[source.value=/\\?raw$/]',
          message: '?raw imports only in catalog/brands, sellers and research (ADR-219).',
        },
        {
          selector: 'ImportExpression[source.value=/\\?raw$/]',
          message: '?raw imports only in catalog/brands, sellers and research (ADR-219).',
        },
      ],
    },
  },
  {
    // Find-it tests find by role and visible text, never by class name (CLAUDE.md R3, ADR-224).
    files: ['tests/find-it/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.property.name=/^querySelector(All)?$/]',
          message:
            'Find-it tests find by role and visible text (getByRole, within), not querySelector (ADR-224).',
        },
      ],
    },
  },
);
