# Architecture review, 2026-11-07

User request: "current code structure/architecture modularity and overall design analysis role to suggest the complete
code quality critique and suggest architectural improvements, listed from high to low weight and performance improvement
% estimate. No regressions shall be introduced, ensure before and after testing tdd style" plus "a report on how we can
decouple certain parts as separate standalone bits and pieces". Twenty improvements are listed here; the rest are
requested after the pull request is opened.

Nothing in this document is built. Every change below needs the user's pick and, where marked, an ADR. Every figure
marked _measured_ comes from commands run on this branch (commit `f13535f`, 2-core container unless stated); every
figure marked _estimate_ is a labelled estimate. Five analysis passes ran in parallel (module graph, store and persist,
UI and viewer, tests and CI, core decoupling); three adversarial verification passes then re-checked every claim behind
the twenty items against the code. Claims that failed verification were dropped or corrected (section 9).

## 1. Baseline (measured, before any change)

| Check                                                  | Result                                       | Time   |
| ------------------------------------------------------ | -------------------------------------------- | ------ |
| `pnpm install --frozen-lockfile`                       | ok                                           | 4 s    |
| `pnpm lint`                                            | ok                                           | 22 s   |
| `pnpm format:check`                                    | ok                                           | 18 s   |
| `pnpm typecheck`                                       | ok                                           | 17 s   |
| `pnpm test`                                            | 135 files, 1139 tests (1138 pass, 1 skipped) | 105 s  |
| `pnpm build`                                           | ok, chunk-size warning                       | 29 s   |
| `pnpm docs:check`                                      | ok                                           | 1 s    |
| `FUZZ_N=30000 pnpm exec vitest run tests/fuzz.test.ts` | 4 pass                                       | 12 s   |
| CI, one serial job (sum + ~40 s runner setup)          | —                                            | ~230 s |

Test time split (JSON reporter, sum of per-file time 232 s): `tests/find-it/*` 34 files = 86 %. Slowest files:
`find-it/connections` 14.8 s (4 tests), `find-it/research-batch-4` 13.2 s, `find-it/variables` 12.3 s,
`roomfill.test.ts` 8.2 s (one 4.7 s fuzz test).

Build chunks (raw / gzip): `index` 2 376 KB / 708 KB; `regency` (seller catalog, lazy) 2 706 KB / 664 KB; `three.module`
747 KB / 191 KB; `Viewer3D` 305 KB / 94 KB; `pathtrace` 208 KB / 60 KB. Service worker precache: 146 entries, 7.28 MB,
of which 13 JS files = 6.42 MB. `index` holds 391 KB of Cyrillic bytes (455 KB of Russian-bearing string literals),
the research data (`src/core/research/*`, 6 053 lines) and the full 92 KB research markdown imported with `?raw`.

Source: 243 TS/TSX files, 80 097 lines; `src/core` 46 630 (flat 26 086, research 6 053, catalog 3 056, wizard 1 637,
nesting 994), `src/ui` 24 806, `src/viewer` 2 770, `src/store` 2 345, `src/persist` 1 428, `src/online` 1 051.

## 2. Module graph and layer violations

Edges counted by regex over every file (1 398 import edges). Confidence high.

| From → to               | Static | Type | Dynamic | Note                                                                     |
| ----------------------- | ------ | ---- | ------- | ------------------------------------------------------------------------ |
| core → core             | 236    | 112  | 3       | two `?raw` markdown imports, one `?raw` JSON                             |
| core → core/i18n        | 60     | 1    |         | 58 core files call `t()`/`tr()`                                          |
| store → core            | 35     | 11   |         |                                                                          |
| store → persist         | 3      |      |         | `templatesStore.ts:3`, `versions.ts:7` (raw `db`), `researchStore.ts:10` |
| store → online          |        |      | 1       | `accountStore.ts:123`                                                    |
| persist → core          | 24     | 7    |         |                                                                          |
| ui → core               | 154    | 52   | 1       | plus a Worker URL, `useNesting.ts:42`                                    |
| ui → store              | 57     |      |         |                                                                          |
| ui → persist            | 39     |      | 1       | 27 files static, `SavedData.tsx:26` imports raw `db`                     |
| ui → viewer             | 1      |      | 3       |                                                                          |
| ui → online             |        |      | 2       |                                                                          |
| viewer → ui             | 14     |      |         | 11 distinct ui modules (section 6, I-12)                                 |
| viewer → store          | 5      |      |         |                                                                          |
| viewer → persist        | 2      |      |         | `Viewer3D.tsx:78-79`                                                     |
| online → core / persist | 6 / 2  | 3    |         | `client.ts:26` imports raw `db`                                          |

Holds today (verified): `src/core` imports no package and nothing from store, ui, persist, viewer or online; every
import of `src/online` is dynamic; `fetch(` appears once, in `src/online/sellerPictureFile.ts:11`; no Zustand selector
in `src/ui` or `src/viewer` returns a fresh array or object (451 inline selectors scanned, 15 multi-line ones read).

Violations and smells:

- Nothing enforces the boundary: `eslint.config.js` has no `no-restricted-imports` or `import/no-cycle`; only
  `tests/network-boundary.test.ts` scans source, and only for `fetch`/online.
- Cycle of 9 core files, all value imports: `project ↔ arrange, common, compat, connections, groupMove, selection,
sizeLock, variables` (one path: `project.ts:52 → connections.ts:10 → groupMove.ts:9 → selection.ts:7 → arrange.ts:25
→ project.ts`). A second 3-cycle `shopping → fasteners/prices → shopping` is type-only on two edges.
- UI cycles: `Dialogs ↔ BoardBand/SellerLinks/Catalog/Account/ProductPicker` (6 files), `CountStepper ↔ Inspector`,
  `Project ↔ Settings`.
- `src/core` is not pure of the platform: `Diagnostic.message` is translated inside generators (`tx()` ×60 in
  `cabinet.ts`, ×20 in `build.ts`), the language is a module singleton (`i18n/index.ts:23`), and English `panel.label`
  is used as a semantic key by regex in `clearance.ts:24-38`, `build.ts`, `shape.ts`, `replace.ts`, `assembly.ts`.
- `persist` is not framework-free: `persist/images.ts:1` imports React; `persist/gltf.ts` imports three.
- Six Zustand stores live in `src/ui` (`priceStore.ts:20`, `problemStore.ts:21`, `Fasteners.tsx:35`, `Confirm.tsx:19`,
  `shell/uiStore.ts:52`, `pieceDrag.ts:38`); `priceStore.ts:7` and `Fasteners.tsx:16` call persist directly.
- Vite-only syntax in core: `import.meta.glob` (`catalog/brands/index.ts:9`), `?raw` (`sellers/index.ts:21`,
  `research/ensemble-2026-10-23.ts:7`, `research/ensemble-2026-10-23.features.ts:7`).

## 3. Inventory

Largest files: `ui/Project.tsx` 3 240, `core/project.ts` 2 950, `core/research/ensemble-2026-10-23.ts` 2 227,
`ui/Inspector.tsx` 1 880, `store/designStore.ts` 1 844, `viewer/Viewer3D.tsx` 1 822, `ui/Research.tsx` 1 755,
`core/design.ts` 1 379, `ui/Catalog.tsx` 1 310, `core/cabinet.ts` 1 300.

Longest functions: `buildCabinet` 1 104 lines (`core/cabinet.ts:115`, with a 725-line inner `visit` at `:482`),
`App` 815 (`ui/App.tsx:171`), `Viewer3D` 433, `RoomSection` 406 (`ui/Project.tsx:2835`), `buildFrame` 325,
`PrintSheet` 308, `MaterialsPanel` 293, `buildModel` 222 (`core/build.ts:20`).

Hubs: `core/project.ts` exports 84 symbols and has 127 importers (38 core, 21 ui, 63 tests); `core/types.ts` 60
exports, 152 importers, zero imports; `persist/db.ts` 57 exports.

Type escapes (comments and strings stripped): no `any`; `as X` casts core 308 (`design.ts` 69, `project.ts` 61),
ui 65, persist 28, online 19, viewer 16, store 6; non-null `!` core 170, ui 97 (13 of them
`useDesign((s) => s.project)!`); `eslint-disable` 3; no `@ts-ignore`.

Dead exports: of 473 exports in the 30 largest core modules, 117 (25 %) have no importer outside their own file
(mostly unnecessary `export`, not dead code); `core/room.ts:168 wallCount` has zero references anywhere.
`core/samples/mobila.ts` is imported only by tests; `core/features.ts` (791 lines) only by `ui/Info.tsx`.

Test coverage gaps (no test imports the module directly; reached only through `buildModel` or the catalog):
`core/corner.ts`, `frame.ts`, `desk.ts`, `panel.ts`, `panelset.ts`, `nesting/place.ts`, `nesting/validate.ts`,
`catalog/storage.ts` (570 lines), `catalog/furniture.ts`, `wizard/axes.ts`, `setRoom.ts`. Design-document fixtures
per `schemaVersion` 1..7 are not kept as explicit tests (ADR-011 "keeps old readers" is covered only indirectly).

Docs drift: CLAUDE.md lists ADR-085 and ADR-093 as the only viewer edits; the code also edits from the viewer in
`viewer/heightDrag.ts:89` (ADR-122), `modelResize.ts:99` (ADR-102), `wallPictureDrag.ts:58` (ADR-146) and the turn
hotkey `Viewer3D.tsx:306-330` (ADR-169). `scripts/check-docs.py` does not catch this.

## 4. Critique by area

| Area      | Strengths                                                                                                                                                            | Defects (evidence)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Conf. |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| core      | No framework imports; `types.ts` has zero imports; `nesting/place+validate+types` have zero outside imports; `buildModel` is cheap (0.42 ms for 30 panels, measured) | 9-file cycle around `project.ts`; i18n inside generators; label-as-key regexes; `project.ts` re-runs `placeItem` → `buildModel` from 13 call sites with no memo (`project.ts:490, 1090, 1574, 1698, 1735, 1747, 1861, 2186`, `connections.ts:55,130`, `common.ts:88`, `moveTo.ts:223,433,452`); `projectCutlist :2380` and `projectHardware :2435` rebuild every item instead of reading `projectModel.pieces[i].model`                                                                                                                                                                | High  |
| store     | Immutable document snapshots with structural sharing, history capped at 100; `designStore` imports only core                                                         | `commitProject` (`designStore.ts:605-661`) runs 12 steps; `backToProject` (`:1265-1297`) runs 3 of them and skips `syncRef`, `sizeLockBlocked`, `syncSets`, `applyBindings`, `heldByBinding`, 4 prunes, the `schemaVersion` stamp and `keepSelected`; 60 actions share the `get().project` guard, 11 are the same 4-line wrapper, `updateCabinet/Desk/PanelSet/Panel/Frame` (`:1640-1685`) are identical; 2–5 `set()` calls per edit, each re-running every mounted selector (Zustand 5 does not batch; React 19 merges the renders)                                                   | High  |
| persist   | Additive Dexie versions 1..11, no `.upgrade()` callbacks, corrupt rows skipped and kept (ADR-012 upheld); every `db.ts` function takes a `db` parameter              | `listDesigns`/`listProjects` return raw rows (`db.ts:231-233, 247-248`) and `shell/ProjectsPage.tsx:123-135 duplicate()` re-saves them without `validateDesign`/`validateProject` (ADR-011 gap); `restoreFiles` (`backup.ts:277-285`) writes N rows without a transaction; raw `db` exported and used from `SavedData.tsx:26`, `online/client.ts:26`, `store/versions.ts:7`                                                                                                                                                                                                            | High  |
| ui        | Disciplined selectors; native `<dialog>` + `showModal`; 157 `role=`, 373 `aria-*`, no clickable `div`; every string through `t()` except the brand and the Gaps page | `App.tsx` has 27 store subscriptions and 11 effects in one 815-line component; 0 `memo(` in ui and viewer; `Project.tsx` holds 28 components and 99 subscriptions; 27 files import persist statically and 8 call `saveProject` themselves; sizing rules in components: `Project.tsx:2843-2854` (room auto-size `Math.max(3000, …)`, `deep + 1000`), `Editors.tsx:735-738, 753, 773-775` (footrest 380, arms +220, backrest `min(650, width/3)`); same `yaw → front edge` ternary in `Project.tsx:1654-1661` and `Models3D.tsx:411-419`; `Elevation.tsx:138` is a click-only SVG target | High  |
| viewer    | `frameloop="demand"` (`Viewer3D.tsx:348`), lazy and mounted only on the editor page, explicit `dispose` for textures and composer                                    | 11 imports from `src/ui` plus DOM side channels (`document.body.dataset.seams/lit :689,1544`, `'fb:fit'` window event `:1461`, CSS vars `:206,213`, `#count-dock :243`); one `<boxGeometry>` + `<meshStandardMaterial>` + drei `<Edges>` per panel (`:1613-1650`): 40 panels ≈ 80 geometries + 80 materials; `three` is a separate chunk only by accident of `React.lazy`                                                                                                                                                                                                              | High  |
| online    | All entry points dynamic; supabase chunk absent when the URL is unset; CSP built from the same origin list                                                           | `accountStore.ts:76-80 backendConfigured` and `online/origins.ts:6-19 onlineConfigured` disagree (regex vs `new URL`, key required vs not)                                                                                                                                                                                                                                                                                                                                                                                                                                             | High  |
| i18n      | `Key = keyof typeof ru` makes a missing Russian entry a type error (proved by `tests/i18n.test.ts:32-35`)                                                            | Singleton language; one `Key` union over 16 UI areas ties the model to shell keys; 345 module-scope `t()` calls in 44 files (so the dictionary cannot be lazy without making `App` itself lazy); `tr()` accepts any string (`Research.tsx:844`); nothing finds unused keys                                                                                                                                                                                                                                                                                                             | High  |
| tests     | 1 139 tests, seeded fuzz, 108 SVG goldens, source-scanning tests for network, security and spacing tokens                                                            | Find-it is 86 % of test time: 33 files × `describe.each(WIDTHS)` run every test twice although jsdom applies no CSS, ~100–200 ms per `user.click` through the whole `App` tree (measured); 11 files re-declare `addPiece`/`projectWithTwoPieces` (three different `addPiece` bodies); 20 files assert on `querySelector` class names; `roomfill.test.ts:202` is a 4.7 s fuzz test in the regular suite; `persist.test.ts` shares one fake IndexedDB across tests                                                                                                                       | High  |
| CI, tools | CI is the source of truth; `ship-check` skip is explicit                                                                                                             | One serial job; `deploy.yml:23-28` re-runs lint, typecheck, test and build on every push to `main` next to `ci.yml`; `tsc -b` is never incremental (buildinfo 12 KB, no `incremental`); no `eslint --cache`/`prettier --cache`; 59 `tools/*/find-it.mjs` import `playwright`, which is in neither `package.json` nor the lockfile; `tools/catalog/test_extract_pdf.py` runs nowhere                                                                                                                                                                                                    | High  |

## 5. Performance audit

Model hot path (Node 24, median of 20, measured by a scratch Vitest bench):

| Op                                                                  | ms   | `buildModel` calls |
| ------------------------------------------------------------------- | ---- | ------------------ |
| `buildModel`, 30-panel sideboard                                    | 0.42 | 1                  |
| `nestingJobs + nest`, 1 design (5 runs)                             | 18.8 | 0                  |
| `buildProjectModel`, mobilaLiving (6 items)                         | 0.34 | 9                  |
| `buildProjectModel`, synthetic 30 items (455 panels)                | 4.8  | 30                 |
| `buildProjectModel`, synthetic 60 items (903 panels)                | 10.8 | 60                 |
| `useView` derivation (`projectCutlist + projectHardware`), 60 items | 4.2  | 120                |

One edit on a plain 60-item project in drill mode (verified call paths): 1 (`commit`) + 60 (`buildProjectModel`)

- 120 per mounted `useView()` instance. At least three instances are mounted in project view (`App.tsx:214`,
  `Viewer3D.tsx:193`, the open Output pane), so ≥ 421 `buildModel` calls, ≈ 25–30 ms estimate, before the nesting worker
  starts after 250 ms. `runHandles` or `runSettings.auto` add 60 more in each of `buildProjectModel`, `projectCutlist`
  and `projectHardware`. `buildModel` itself is ≈ 14 µs per panel; the cost is repetition, not the generator.

Store: Zustand 5 `setState` notifies every listener synchronously per call; 370 `useDesign(` subscriptions re-run
their selector per `set()`; React 19 batches the renders. Cost is selector passes and a transient state with new
`design` and old `project` between the first and third `set()`.

Persistence: autosave is debounced 400 ms and writes one project row (97 KB JSON for 60 items, 0.3 ms to stringify).
Each save also does a read-before-write of the full row (Dexie `updating` hook, `db.ts:208-221`), three settings
reads or writes (`SavedData.tsx:52-60`, `backup.ts:88-92`) and, on the first change, a `projectVersions.add`. With a
backup folder chosen, `backupNow` 4 s later reads all 12 tables including image and model bytes and base64-encodes
every row before diffing (`backup.ts:150-154`, `core/backup.ts:38-100`); without a folder nothing heavy runs, but
`folder()` re-reads IndexedDB every window because `chosen ??=` never caches `undefined` (`backup.ts:106`).

Loading: first visit downloads 6.42 MB of JS for the precache, including the 2.7 MB seller catalog and the path
tracer, whichever features the user opens. `index` carries every page, the research data and the Russian dictionary.

Rendering: `frameloop="demand"` keeps idle cost at zero; the per-panel material and edge objects are the only scaling
concern (reasoned, not profiled).

Tests and CI: measured on 4 cores, `eslint --cache` 19.3 → 1.1 s on a second run; `prettier --check --cache` 17.4 →
6.4 s; `tsc -b --noEmit` with `"incremental": true` 16.2 → 0.4 s warm (local only; CI checks out fresh). Pool and
isolation flags changed find-it time by ≤ 4 % (noise); the cost is the render work per interaction.

## 6. Decoupling report: standalone bits and pieces

Scores: cohesion and reuse 1–5. Effort is an estimate relative to a typical ADR. Packaging options: (a) internal
module with an enforced import boundary, (b) pnpm workspace package in this repo, (c) separate published package,
(d) CLI.

| Unit                                                                                                                                         | Files, lines                      | Inbound                                             | Outbound                                              | Cohesion / reuse | Recommended                                                         | Effort                          | ADR needed                            |
| -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------------- | ----------------------------------------------------- | ---------------- | ------------------------------------------------------------------- | ------------------------------- | ------------------------------------- |
| Nesting engine (`nesting/place, validate, types`)                                                                                            | 3 files, 894                      | `nesting/index`, `fromDesign`, `worker`, 6 core, ui | none                                                  | 5 / 4            | (b) `packages/nesting`                                              | +25 %                           | No (ADR-018 unchanged)                |
| Geometry and model engine (`geometry, cabinet, build, panel, panelset, frame, shape, corner, desk` + `materials, rules, clearance, cutlist`) | 13 files, ≈ 4 700                 | 51 importers of `build`, store, 3 ui, 37 tests      | `types`, `design` (one upward edge `desk.ts:3`), i18n | 5 / 4            | (a) now, (b) `packages/model` after I-07                            | +10 % then +40 %                | Yes for (b): ADR-008, ADR-153 amended |
| Design document (`types, design, surface`)                                                                                                   | 3 files, 2 335                    | 152 importers of `types`                            | i18n (`design.ts` 111 `t()` calls), `Date`, `crypto`  | 4 / 3            | merge into `packages/model`                                         | +0 % merged                     | ADR-011 cited                         |
| Print and CSV (`ro, i18n/print, print-text, reviewPack, template`)                                                                           | 5 files, 1 123                    | ui/PrintSheet, Output, MoreMenu, assembly           | cutlist, project (`reviewPack`), print singleton      | 3 / 3            | (a) `core/print`, language passed explicitly                        | +20 %                           | No                                    |
| Fusion export (`fusion.ts`)                                                                                                                  | 167                               | `shell/MoreMenu.tsx`                                | cutlist, shape, `new Date()` at `:93`                 | 4 / 2            | (a) outputs module; (d) CLI after model package                     | +5 %                            | No (ADR-021 unchanged)                |
| Procurement (`shopping, prices, fasteners`)                                                                                                  | 3 files, 1 000                    | ui/Shopping, useEstimate, assembly                  | cutlist, project, sellers, i18n                       | 4 / 2            | (a); break the type cycle with `shopping-types.ts`                  | +3 %                            | No                                    |
| Catalog data (`catalog/*` minus `local.ts`), sellers, samples                                                                                | 2 600 + 419 + 305 (+2.7 MB JSON)  | design, wizard, ui pickers, tests                   | `design.ts` helpers, `import.meta.glob`, `?raw`       | 4 / 3            | (b) `packages/catalog` + `packages/sellers` with an injected loader | +30 %                           | ADR-161, ADR-162 cited                |
| i18n runtime (`format, ruPlural, makeT`)                                                                                                     | ≈ 120 lines of `i18n/index.ts`    | 140 files                                           | none                                                  | 4 / 5            | (a) `i18n/runtime.ts`; per-unit dictionaries later                  | +15 %, +40 % with per-unit keys | Yes for per-unit keys (ADR-153)       |
| Research data (`research/*`)                                                                                                                 | 8 files, 6 053 (80 % data)        | `store/researchStore.ts:3`, `ui/Research.tsx`       | `?raw` markdown, i18n                                 | 3 / 1            | generated lazy JSON under `public/research/`                        | +25 %                           | Yes (data layout, ADR-043 lineage)    |
| Feature tree (`features.ts`)                                                                                                                 | 791                               | `ui/Info.tsx`                                       | `Key` type                                            | 5 / 1            | move to `src/ui/info/`                                              | +3 %                            | No (ADR-158 unchanged)                |
| Device transport (`zip, shareCode, backup, sync, account`)                                                                                   | 5 files, 652                      | persist, online, store                              | design, project, i18n, `btoa`, `CompressionStream`    | 4 / 3            | (a) `core/device`; `zip.ts` is package-ready                        | +5 %                            | No                                    |
| Persist (`src/persist`)                                                                                                                      | 7 files, 1 428                    | 27 ui files, 3 store, online, viewer                | core, React (`images.ts`), three (`gltf.ts`)          | 4 / 3            | (a): hide the raw `db`, move the React hook to ui                   | +10 %                           | No (ADR-012 unchanged)                |
| Online (`src/online`)                                                                                                                        | 7 files, 1 051                    | 3 dynamic imports                                   | core, persist (raw `db`)                              | 4 / 2            | already the cleanest boundary; keep (a)                             | 0 %                             | No                                    |
| Viewer (`src/viewer`)                                                                                                                        | 2 770                             | `App.tsx`, `Share.tsx` (lazy)                       | 11 ui modules, store, persist, DOM side channels      | 3 / 2            | (a) after I-12                                                      | +20 %                           | ADR-014 cited                         |
| Find-it browser harness (`tools/*/find-it.mjs`)                                                                                              | 59 scripts, ~40 shared lines each | none from `src`                                     | `playwright` (unlisted), `node:fs`                    | 3 / 3            | `tools/lib/harness.mjs` + declared dependency                       | +10 %                           | No                                    |
| Docs tooling (`scripts/check-docs.py`, `gaps.py`)                                                                                            | 2 files                           | CI, Stop hook                                       | hard-coded repo paths                                 | 4 / 1            | stays (ADR-050, ADR-082 by design)                                  | —                               | —                                     |

Anti-candidates (keep together): `project.ts` and its 9-file cycle (the app's model layer, 127 importers);
"checks" as one layer (`compat`, `connections` sit inside the cycle; `rules`, `clearance` belong to the engine;
`repairs`, `envelopes`, `fasteners` consume `Project`); `assembly.ts` (mixes `t()` ×67 and `pt()` ×50 and consumes
`Project`); editor helpers (`boards`, `counts`, `pieceSize`, `selectPath`, `styles`, `finish`); persistence-shaped
core (`catalog/local.ts`, `projectVersion.ts`, `templateRevision.ts`, `gaps.ts`, `backupReminder.ts`); placement and
editing over `Project` (`room`, `roomfill`, `wallfill`, `snap`, `moveTo`, `drag3d`, `align`, `merge`, `sets`,
`replace`, `ownEdits`).

Target units and allowed import directions (today's graph already satisfies every arrow except the two marked):

```
app (ui, viewer, store, persist, online) ──► everything below, never the reverse
  ├─ core/wizard ──► catalog, project, model, document, i18n
  ├─ core/device (backup, sync, account, shareCode, zip) ──► project, document, i18n
  ├─ core/print (ro, print-text, reviewPack, template) ──► project, outputs, model
  ├─ core/procurement (shopping, prices, fasteners) ──► project, model, sellers
  ├─ core/project (hub cycle + room/snap/moveTo/… + nesting adapters) ──► model, document, catalog, nesting, i18n
  ├─ core/catalog (data) ──► document, model ; core/sellers (data + loader) ──► document types
  ├─ outputs (fusion, snapshot) ──► model
  ├─ model (geometry, shape, cabinet, corner, desk, frame, panel, panelset, build, rules, clearance, cutlist, materials)
  │     ──► document, i18n-runtime        [today: desk.ts → design.ts upward; t() inside generators]
  ├─ document (types, design, surface) ──► i18n-runtime
  ├─ nesting (place, validate, types) ──► nothing
  ├─ i18n-runtime (format, plural, makeT) ──► nothing ; dictionaries beside each unit
  └─ research (JSON data + view code) ──► i18n-runtime ; features → src/ui/info
```

Extraction order (each step ships alone with no behaviour change; later steps depend only on earlier ones):

| #   | Step                                                                                                                                                   | Effort (est.) | ADR                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | ------------------------------- |
| 1   | ESLint `no-restricted-imports` per layer + `tests/core-boundary.test.ts` (source scan); no file moves                                                  | +10 %         | No                              |
| 2   | `shopping-types.ts`; `features.ts` → `src/ui/info`; `samples/mobila.ts` → `tests/fixtures`                                                             | +5 %          | No                              |
| 3   | `packages/nesting` with seeded golden layouts (`maxMs: Infinity`)                                                                                      | +25 %         | No                              |
| 4   | `packages/zip` or `core/util`                                                                                                                          | +3 %          | No                              |
| 5   | Research → generated lazy JSON; delete the two `?raw` edges                                                                                            | +25 %         | Yes                             |
| 6   | i18n runtime split (`runtime.ts` + `makeT`), singletons kept for the app                                                                               | +15 %         | No                              |
| 7   | Diagnostics as `{ code, params }`, translated at the edge; `t()` out of model files; `pedestalRoot` out of `desk.ts`                                   | +60–80 %      | Yes (ADR-008, ADR-153, ADR-156) |
| 8   | `packages/model` (+ document, materials, cutlist, rules, clearance, snapshot, fusion) with a golden suite; then `packages/catalog`, `packages/sellers` | +40 %         | Yes (ADR-011)                   |
| 9   | Optional CLI `design.json → csv / py / svg` on top of 8                                                                                                | +15 %         | Yes                             |

Boundaries enforceable today without moving files (all hold on the current graph except the two allowances noted):

```js
// eslint.config.js, 'no-restricted-imports' per files block
{ files: ['src/core/**'], rules: { 'no-restricted-imports': ['error', { patterns: [
  '**/src/{store,ui,persist,viewer,online}/**', 'react', 'react-dom', 'three', '@react-three/*', 'dexie', 'zustand', '@supabase/*' ] }] } },
{ files: ['src/core/nesting/{place,validate,types}.ts'], rules: { 'no-restricted-imports': ['error', { patterns: ['../*', './index', './fromDesign', './worker'] }] } },
{ files: ['src/core/{geometry,cabinet,build,panel,panelset,frame,shape,corner,desk,rules,clearance,cutlist,materials}.ts'],
  rules: { 'no-restricted-imports': ['error', { patterns: ['./project', './catalog/*', './i18n/print', './nesting/*', './room', './wizard/*', './research/*', './sellers/*'] }] } },
  // allowance: desk.ts → ./design until step 7
{ files: ['src/{ui,store,persist,viewer,online}/**'], rules: { 'no-restricted-imports': ['error', { patterns: ['**/core/nesting/place', '**/core/nesting/validate'] }] } },
{ files: ['src/viewer/**'], rules: { 'no-restricted-imports': ['error', { patterns: ['../ui/*'] }] } },
  // allowance: the 11 ui modules listed in I-12 until they move
```

## 7. Ranked improvements

Weight = Impact (1–5: correctness > maintainability > speed) × Breadth (1–5: files and layers touched) × Confidence
(High 1.0, Medium 0.8, Low 0.5). Performance estimates name the metric from sections 1 and 5; "n/a" means
maintainability or correctness only. Effort is relative to a typical ADR.

| Id   | Title                                                                                                                     | Tags                    | Weight (I×B×C) | Perf estimate                                                                      | Effort (est.) | ADR needed                                                            | Quick win |
| ---- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------- | -------------- | ---------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------- | --------- |
| I-01 | Enforce layer boundaries with ESLint and a source-scan test                                                               | structural, decoupling  | 15 (3×5×1.0)   | n/a                                                                                | +10 %         | No                                                                    | Yes       |
| I-02 | Parallel CI jobs, 4 test shards, lint/format/tsc caches, deploy builds only                                               | perf, quality           | 12 (4×3×1.0)   | CI wall ≈ 230 s → ≈ 80 s (−65 %); runner minutes +4.5 per run                      | +15 %         | No                                                                    | Yes       |
| I-03 | Memoise `placeItem`; read `projectModel` in `projectCutlist`/`projectHardware`; derive the view once in the store         | perf, structural        | 12 (4×3×1.0)   | `buildModel` calls per edit on 60 items ≥ 421 → ≈ 61 (−85 %); ≈ 25 ms → ≈ 4 ms     | +30 %         | No (ADR-004 cited)                                                    | No        |
| I-04 | Bundle: `manualChunks` for three, fiber, drei, dexie, supabase; lazy pages; research as lazy JSON                         | perf, decoupling        | 12 (3×4×1.0)   | `index` gzip 708 KB → ≈ 450 KB (−35 %); first paint JS −35 %                       | +35 %         | Yes for research JSON (ADR-043 lineage); no for chunks and lazy pages | Partly    |
| I-05 | Route every save and list through `src/store`; hide the raw `db` export                                                   | structural, decoupling  | 12 (3×4×1.0)   | n/a                                                                                | +30 %         | No (ADR-012 cited)                                                    | No        |
| I-06 | Find-it cost: shared helpers in `setup.tsx`, role-based assertions, width policy                                          | quality, perf           | 12 (3×4×1.0)   | test CPU −40 % if width policy changes (needs ADR); helpers alone 0 %              | +20 %         | Yes for the width policy (amends ADR-108, R3)                         | Partly    |
| I-07 | Diagnostics as `{ code, params }`; translate at the edge; `t()` out of the model                                          | decoupling, structural  | 12 (3×5×0.8)   | n/a; enables `packages/model`                                                      | +60–80 %      | Yes (ADR-008, ADR-153, ADR-156)                                       | No        |
| I-08 | `backToProject` must go through `commitProject`                                                                           | correctness             | 10 (5×2×1.0)   | n/a                                                                                | +10 %         | No                                                                    | Yes       |
| I-09 | Validate rows on duplicate; list functions return summaries (ADR-011)                                                     | correctness             | 10 (5×2×1.0)   | n/a                                                                                | +10 %         | No (ADR-011 cited)                                                    | Yes       |
| I-10 | `packages/nesting` with seeded goldens; deterministic default `maxMs`                                                     | decoupling, correctness | 8 (4×2×1.0)    | n/a                                                                                | +25 %         | Yes for the `maxMs` default (ADR-018)                                 | No        |
| I-11 | Lazy Russian and print dictionaries (requires a dynamic `App` import)                                                     | perf                    | 6.4 (2×4×0.8)  | `index` raw −391 KB, gzip ≈ −80 KB (−11 %) for English users                       | +25 %         | No (ADR-153 cited)                                                    | No        |
| I-12 | Move the 11 ui modules the viewer uses to a shared layer; replace DOM side channels with store fields                     | decoupling              | 6 (2×3×1.0)    | n/a                                                                                | +20 %         | No (ADR-014 cited)                                                    | No        |
| I-13 | `designStore`: one `set()` per commit, one `updateParams(kind, patch)`, one `projectAction(f, name)` helper, slices       | quality                 | 6 (2×3×1.0)    | selector passes per edit −50 % (2 → 1 `set`)                                       | +25 %         | No                                                                    | No        |
| I-14 | Sizing rules out of components (room auto-size, seating defaults) (ADR-004)                                               | correctness, structural | 6 (3×2×1.0)    | n/a                                                                                | +10 %         | No (ADR-004 cited)                                                    | Yes       |
| I-15 | Extend `network-boundary` to media loads and chunk placement; one origin rule                                             | correctness             | 6 (3×2×1.0)    | n/a                                                                                | +10 %         | No (ADR-126 cited)                                                    | Yes       |
| I-16 | Precache the shell only; runtime-cache the seller catalog and path tracer                                                 | perf                    | 4.8 (3×2×0.8)  | first-visit download 7.3 MB → ≈ 4.4 MB (−40 %)                                     | +10 %         | Yes (ADR-002, ADR-161 offline promise)                                | No        |
| I-17 | Autosave path: drop the read-before-write hook, cache the folder lookup, dirty-set backups                                | perf                    | 4 (2×2×1.0)    | IndexedDB ops per save 5 → 2 (−60 %); backup with a folder O(library) → O(changed) | +15 %         | No (ADR-133 cited)                                                    | Partly    |
| I-18 | Housekeeping: dead exports, `wallCount`, `features.ts` → ui, samples → tests, shopping type cycle, CLAUDE.md viewer list  | docs, quality           | 4 (1×4×1.0)    | n/a                                                                                | +5 %          | No                                                                    | Yes       |
| I-19 | Tools and test hygiene: declare `playwright`, run `test_extract_pdf.py`, move the roomfill fuzz, reset IndexedDB per test | quality                 | 4 (2×2×1.0)    | `pnpm test` −5 s (roomfill)                                                        | +10 %         | No                                                                    | Yes       |
| I-20 | Share materials and box geometries per key in the viewer; one merged edge geometry                                        | perf                    | 2.4 (3×1×0.8)  | 40 panels: 80 geometries + 80 materials → ≈ 10 + 10 (reasoned, not profiled)       | +20 %         | No (ADR-014 cited)                                                    | No        |

Dropped after verification: "Dexie `blocked`/`versionchange` unhandled" (Dexie 4 closes and reopens by default;
only a reload notice is missing), "backup re-reads every blob on every save" (only with a chosen folder; folded into
I-17), "25 duplicated wrapper actions" (11 exact, 22 with a variant; folded into I-13), "drill-mode piece history
leak" (`closeProject` has no caller; latent; folded into I-13).

## 8. Improvement detail

### I-01 Enforce layer boundaries (weight 15)

- Files: `eslint.config.js` (18 lines today), new `tests/core-boundary.test.ts` modelled on
  `tests/network-boundary.test.ts:14-30`.
- Problem: every rule in CLAUDE.md about layers holds today by discipline only (section 2). One static `three` import
  in `src/persist/models.ts:94` (currently a type) would pull 747 KB into `index` unnoticed.
- Change: the `no-restricted-imports` blocks in section 6 plus `no-restricted-syntax` for `import.meta` and `?raw`
  outside `catalog/brands`, `sellers`, `research`; the test scans `src/` for the same patterns so CI fails even if
  lint config changes.
- Invariants: enforces ADR-002, ADR-004, ADR-014, ADR-126; no behaviour change.
- Risk: Low; failure mode is a false positive on an allowed import (the two allowances are listed).
- Guard: the test itself; `pnpm lint` on the current tree must stay green.
- Order: first; everything in section 6 builds on it.

### I-02 Faster CI (weight 12)

- Files: `.github/workflows/ci.yml:28-58`, `.github/workflows/deploy.yml:23-28`, `package.json` scripts,
  `tsconfig.app.json`, `tsconfig.node.json`, `.gitignore`.
- Problem: one serial job of 230 s; `deploy.yml` runs lint, typecheck, test and build a second time on every push to
  `main`; no caches; `tsc -b` writes a 12 KB buildinfo with no incremental state.
- Change: jobs `lint-format`, `typecheck`, `test` (matrix `shard: [1..4]`, `vitest run --shard=N/4`), `build-docs`,
  and a `verify` job that requires all four (the single required status); `eslint --cache`, `prettier --check
--cache` with `actions/cache`; `"incremental": true` in both tsconfigs; `deploy.yml` builds only. No check is
  removed or weakened; the commands stay the ones in CLAUDE.md.
- Perf (estimate from section 1 figures): serial ≈ 230 s → parallel ≈ 145 s → with 4 shards ≈ 75–85 s, bounded by
  build + docs ≈ 70 s. Runner minutes rise by ≈ 4.5 per run.
- Invariants: CI stays the source of truth; `ship-check` unchanged.
- Risk: Low; failure mode is a shard imbalance (find-it files are 5–15 s each, four shards land at 25–35 s).
- Guard: CI run ids before and after; `pnpm test` locally unchanged.

### I-03 Stop rebuilding the same item (weight 12)

- Files: `src/core/project.ts:963-1000` (`placeItem`), `:2380` (`projectCutlist`), `:2435` (`projectHardware`),
  `:2440-2443` (`projectNestingJobs`), `src/ui/useView.ts:46-57`, `src/store/designStore.ts:605-661`.
- Problem: section 5; `placeItem` is called from 13 sites with no memo; the view derivation runs per mounted
  `useView()` (16 call sites, ≥ 3 mounted at once).
- Change: a `WeakMap<ProjectItem, PlacedPiece>` keyed by item and options inside `placeItem` (items are immutable);
  `projectCutlist(project, projectModel)` and `projectHardware(projectModel)` read `pieces[i].model`; derive
  `projectCutlist`/`projectHardware` once in `commitProject` and store them (ADR-004: still a projection of
  `buildModel()`).
- Perf (estimate from the measured bench): ≥ 421 → ≈ 61 `buildModel` calls per edit on 60 items; ≈ 25 ms → ≈ 4 ms.
- Risk: Medium; failure mode is a stale cache after an item changes without identity change (none today: the store is
  immutable) or a cut-list row that differs from today.
- Guard: a test that mocks `buildModel` with a counter and asserts one `commitProject` plus the view derivation on a
  30-item project makes ≤ 31 calls; snapshot of `projectCutlist` rows for `mobilaLiving` before and after
  (byte-identical).

### I-04 Bundle and lazy loading (weight 12)

- Files: `vite.config.ts:42`, `src/ui/App.tsx:18-54`, `src/core/research/*`, `src/store/researchStore.ts:3`.
- Problem: section 1; `three` is a separate chunk by accident of `React.lazy`; Research, Gaps, Info, Catalog,
  Account, Share pages and 6 053 lines of research data plus a 92 KB markdown ship to every user on every load.
- Change: `build.rollupOptions.output.manualChunks` for `three`, `@react-three/*`, `dexie`, `@supabase/*`; `lazy()`
  the six pages like `Viewer3D`; a test-time generator writes `public/research/ensemble-2026-10-23.json` (the pattern
  of `pnpm catalog:docs`) and `researchStore` imports it on first use; a `tests/bundle-boundary.test.ts` that reads
  `dist/assets` after `pnpm build` in CI and asserts `index-*.js` contains no `WebGLRenderer`, no `createClient`, no
  `"ens-2026-10-23"` and stays under a byte budget.
- Perf (estimate): `index` gzip 708 KB → ≈ 450 KB; chunks load on first use and stay offline afterwards (precache
  unchanged until I-16).
- Invariants: ADR-002 holds because every chunk stays in the precache; the research JSON changes a data layout
  (ADR-043 lineage) and needs an ADR; `pnpm docs:check` unaffected.
- Risk: Medium; failure mode is a page missing its Suspense fallback or the research page reading before the JSON
  loads.
- Guard: the bundle test; find-it jsdom at 390 and 1280 px reaching every page by role and text through the fallback;
  `tests/research-built-rows`, `i18n-research*` become checks of the generated file.

### I-05 Persistence behind the store (weight 12)

- Files: the 27 `src/ui` files listed in section 2, `src/ui/SavedData.tsx:26`, `src/online/client.ts:26`,
  `src/store/versions.ts:7`, `src/persist/db.ts` (57 exports), `src/persist/images.ts:1`.
- Problem: 8 `saveProject(` call sites in `src/ui` (`Variables.tsx:309`, `WallFill.tsx:210`, `App.tsx:421`,
  `Dialogs.tsx:159`, `ProjectsPage.tsx:110,133`, `ProjectTemplates.tsx:72`, `RoomFill.tsx:268`); the raw `db` handle
  reachable from three layers; a React hook inside persist.
- Change: one `saveProject` owner in the store; list/load/delete actions in `src/store/libraryStore.ts`; `db` not
  exported (the `db` parameter on every function already enables test databases); `useImageUrls` moves to ui.
- Risk: Medium; failure mode is a save path that no longer fires the Dexie hook listeners (backup, upload).
- Guard: `tests/layering.test.ts` asserting no `from '../persist/db'` under `src/ui/**` outside an allowlist; find-it
  jsdom for history, variables, wall-fill and projects-page save flows; `persist.test.ts` with a hook spy.

### I-06 Find-it cost (weight 12)

- Files: `tests/find-it/setup.tsx:12,72-86`, 33 `tests/find-it/*.test.tsx`.
- Problem: section 4, tests row. Each `it` runs twice; 11 files re-declare `addPiece` (three bodies) or
  `projectWithTwoPieces` (byte-identical); 20 files assert on `querySelector` class names against the R3 rule.
- Change, no rule change: move `projectWithTwoPieces`, `addPiece` (one body), `selectRows`, `openMore`, `openMenu`
  into `setup.tsx`; an ESLint `no-restricted-syntax` on `querySelector` under `tests/find-it/`; replace class-name
  queries with role- and text-scoped assertions.
- Change, rule change (ADR): keep `describe.each(WIDTHS)` only where the rendered path depends on width (phone
  "Options" menu in `Project.tsx:1456,1680`, catalog actions `Catalog.tsx:193-194`, info domains `Info.tsx:63`,
  estimate chip `App.tsx:652,732`, projects page `ProjectsPage.tsx:34,187`); other tests run at one width. This
  conflicts with CLAUDE.md R3 and ADR-108 ("at two widths") and is the user's decision (section 10).
- Perf (estimate): helpers and assertions 0 %; one width where allowed −40 % test CPU (≈ 90 s of 232 s).
- Risk: Low; failure mode is a phone-only regression no longer caught by a test that dropped the phone width.
- Guard: the find-it tests themselves; a review rule in the `setup.tsx` header comment.

### I-07 Diagnostics as codes, i18n out of the model (weight 12)

- Files: `src/core/types.ts:259-271` (`Diagnostic`), `cabinet.ts` (60 `tx()`), `build.ts` (20), `corner.ts`,
  `frame.ts`, `panel.ts`, `panelset.ts`, `shape.ts`, `rules.ts`, `design.ts` (111 `t()`), `materials.ts:21-27`,
  `src/core/i18n/ru/core.ts`, `core2.ts`, `data-parts.ts`; `clearance.ts:24-38` label regexes.
- Problem: the model's output depends on the language singleton; `panel.label` doubles as a semantic key; the model
  cannot be a package.
- Change: `Diagnostic { code, params }` with `messageOf(d, lang)` at the edge; a `role`/`kind` field on `Panel`
  replacing label regexes; `materials.ts` labels resolved by the caller. Needs an ADR amending ADR-008 (diagnostic
  shape) and ADR-153 (translation rule for codes) and citing ADR-156.
- Risk: High; failure mode is a changed diagnostic text or a check that keyed on a label.
- Guard: golden JSON of `buildModel` (panels, hardware, diagnostic codes) for all 108 catalog variants and the samples,
  byte-identical before and after except the code field; `tests/i18n.test.ts` extended with the code table.
- Order: after I-01; prerequisite for `packages/model` (section 6, step 8).

### I-08 `backToProject` through `commitProject` (weight 10)

- Files: `src/store/designStore.ts:1265-1297`, `:605-661`; caller `src/ui/App.tsx:627`.
- Problem: verified: `backToProject` runs `propagateLinks → resolvePlacements → refreshRunParts` and skips `syncRef`,
  `sizeLockBlocked`, `syncSets`, `applyBindings`, `heldByBinding`, the four prunes, the `schemaVersion` stamp and
  `keepSelected`. `commit()` checks `resizeBlocked` for the edited piece itself (`:522-529`), so what escapes is a
  size-locked linked copy rewritten by `propagateLinks` (`linked.ts:92-96`), a bound field edited without
  `applyBindings`, value-set duplicates and stale `ref.overrides`. `setRunRequest` (`:1361-1385`) re-implements run
  planning the same way.
- Change: `commitProject(next, name, { base: projectBeforeEdit })` and route both callers through it.
- Risk: Low; failure mode is a refusal notice where the old path silently accepted.
- Guard: a store test that edits a bound size in the piece editor, calls `backToProject`, and asserts the binding is
  reapplied and a size-locked linked copy is refused exactly as `updateItem` does; `tests/project-undo.test.ts:60,70`,
  `linked.test.ts:117`, `place-and-undo.test.ts:53` unchanged.

### I-09 Validate on duplicate (weight 10)

- Files: `src/ui/shell/ProjectsPage.tsx:123-135`, `src/persist/db.ts:227-254`.
- Problem: verified: `duplicate()` spreads raw rows from `listProjects`/`listDesigns` into `saveProject`/`saveDesign`
  with no `validateProject`/`validateDesign`; a row `loadProject` would refuse becomes two unreadable rows with the old
  `schemaVersion` (ADR-011).
- Change: `copyDesign(id)`/`copyProject(id)` in `db.ts` that load through the validating path and return a reason;
  `listDesigns`/`listProjects` return `{ id, name, updatedAt }` summaries.
- Risk: Low.
- Guard: `persist.test.ts`: store a corrupt row, call copy, assert rejection with a message and an unchanged row
  count; find-it jsdom projects page "Duplicate" still found by role and text at 390 and 1280 px.

### I-10 Nesting as a package, deterministic by default (weight 8)

- Files: `src/core/nesting/place.ts:70,432-433,473`, `validate.ts`, `types.ts`, `index.ts`, `fromDesign.ts`,
  `worker.ts`, `src/ui/useNesting.ts:42,51`, `src/ui/PrintSheet.tsx:25`.
- Problem: the engine has zero outside imports (verified) and is the best package candidate; the default `maxMs =
1500` makes production results depend on machine speed (comment at `place.ts:429` admits it; tests mask it with
  `maxMs: 1e9`).
- Change: `packages/nesting` (plain `tsc`, its own Vitest project); adapters and the worker stay in the app; golden
  layouts per seed with `maxMs: Infinity`; decide the production default (section 10, ADR-018).
- Risk: Low for the move; the `maxMs` change needs a user decision because it can change a sheet layout a user has
  already printed.
- Guard: golden layouts asserting everything except `elapsedMs`; `validateNest` accepts every golden;
  `tests/nesting.test.ts` moved with the package.

### I-11 Lazy dictionaries (weight 6.4)

- Files: `src/main.tsx:17`, `src/langInit.ts`, `src/core/i18n/index.ts:13,37`, `print.ts:8`.
- Problem: verified: 345 module-scope `t()` calls in 44 files run while the static `App` graph evaluates, before
  `main.tsx`'s body; an `await import('./ru')` only works if `App` itself is imported dynamically after it. Russian
  literals are 391 KB raw in `index`.
- Change: `main.tsx` awaits the dictionary for the chosen language, then `import('./ui/App')`; `Key` stays
  `import type`; `PRINT_RU`/`PRINT_EN` loaded by `setPrintLang`.
- Perf (estimate): `index` gzip −80 KB (−11 %) for English users; none for Russian users.
- Risk: Medium; failure mode is an English constant captured at module scope in Russian mode.
- Guard: `tests/i18n.test.ts` unchanged; a bundle check that `index-*.js` has fewer than N Cyrillic bytes; find-it
  `language.test.tsx` at 390 and 1280 px finds Russian labels after a switch.

### I-12 Viewer without ui imports (weight 6)

- Files: `src/viewer/Viewer3D.tsx:66,83-91,206,213,243,689,1461,1544`, `heightDrag.ts:7`, `pieceDrag.ts:8`,
  `wallPictureDrag.ts:7`, `modelResize.ts:7-8`; `src/ui/App.tsx:869,934`.
- Problem: 11 distinct ui modules (`wallPictures`, `useView`, `useMediaQuery`, `useTheme`, `useLook`,
  `useSolidWalls`, `CountStepper`, `useSnap`, `MoveTo`, `planDrag`, `keepProportions`) plus DOM side channels.
- Change: hooks to `src/store` or `src/shared`; `CountStepper`/`MoveTo` passed as render props from `App`; `seams`,
  `lit`, `fit` as store fields.
- Risk: Medium; the Move-mode paths (ADR-093) are browser-acceptance only.
- Guard: the I-01 boundary test for `src/viewer/**`; browser find-it `tools/move-3d`, `tools/drill-select` on the
  production build.

### I-13 `designStore` shape (weight 6)

- Files: `src/store/designStore.ts:538-559` (`commit`), `:605-673`, `:1640-1685` (`update*`), 11 wrappers at
  `:942-1010`, `:1062-1105`, `:1261-1265`; `:592-601` (`syncDrill`), `:804-819` (`closeProject`).
- Problem: 2–5 `set()` calls per edit; six identical `update*` actions; 11 exact and 11 near-identical wrappers;
  piece history pushed in drill mode and never cleared; `closeProject` unreachable from the UI.
- Change: collect partials and `set` once at the end of `commit`/`commitProject`; `updateParams(kind, patch)`;
  `projectAction(f, name?)`; slices `projectSlice`, `selectionSlice`, `viewSlice` with `commit`/`commitProject` as the
  only seams; skip piece history when `drillItemId && !editingItemId`; delete or wire `closeProject`.
- Perf (estimate): selector passes per edit −50 %.
- Risk: Medium; failure mode is an action that relied on the intermediate state between two `set()` calls.
- Guard: a subscription counter test (one `updateCabinet` in drill mode notifies once); a table-driven test that each
  wrapper is a no-op when `f(p) === p`; existing store tests.

### I-14 Sizing rules out of components (weight 6)

- Files: `src/ui/Project.tsx:2843-2854`, `src/ui/Editors.tsx:735-738,753,773-775`; new `core/room.ts
suggestRoomSize(pieces)`, `core/desk.ts` seating defaults.
- Problem: verified as sizing decisions in UI (ADR-004); the duplicated `frontLine`/`frontEdge` ternary
  (`Project.tsx:1654-1661`, `Models3D.tsx:411-419`) is display-only and only needs one home.
- Change: pure functions in core; components call them; the constants 3000, 1000, 380, 220, 650 move with them and
  stay labelled as defaults (ADR-010: no new physical values are invented).
- Risk: Low.
- Guard: unit tests for the two pure functions; find-it jsdom at 390 px shows the suggested room width text.

### I-15 Network boundary test coverage (weight 6)

- Files: `tests/network-boundary.test.ts:15-16`, `src/store/accountStore.ts:76-80`, `src/online/origins.ts:6-19`.
- Problem: the regex covers `fetch`, XHR, WebSocket, `sendBeacon`, `EventSource` and static online imports only; not
  `new Image(`, remote `src=`, `import('https://`, `navigator.serviceWorker`, `@supabase` outside `src/online`; no
  test reads `dist/assets`. `backendConfigured` and `onlineConfigured` disagree on `"https://"` alone and on whether
  the key is required.
- Change: extend the regex; add the bundle assertion from I-04; one `isHttpsOrigin` in core used by both.
- Risk: Low.
- Guard: the extended test and its self-check at `:29`; a fixture-URL test that both functions agree.

### I-16 Precache the shell only (weight 4.8)

- Files: `vite.config.ts:36-37`.
- Problem: first visit downloads 7.3 MB, 2.7 MB of it the seller catalog that only the product picker loads
  (`src/core/sellers/index.ts:20-21`, sole caller `ProductPicker.tsx:68`), plus the path tracer.
- Change: `globIgnores` for `regency-*.js` and `pathtrace-*.js`; a `runtimeCaching` route (`CacheFirst`, same-origin
  `/assets/`) so they stay offline after first use. ADR-161 calls the catalog "an offline snapshot"; whether it must
  be available before first use is the user's call (section 10).
- Perf (estimate): first-visit download −40 %; no change after first use.
- Risk: Low technically; product risk is a user offline before ever opening the picker.
- Guard: a test that parses `dist/sw.js` and asserts the two chunks are absent from the manifest and the runtime
  route exists.

### I-17 Autosave path (weight 4)

- Files: `src/ui/App.tsx:380-384,411-424`, `src/persist/db.ts:208-221`, `src/persist/backup.ts:88-92,106,150-154,
242-252`, `src/ui/SavedData.tsx:52-60`, `src/core/backup.ts:38-100`.
- Problem: verified: the `updating` hook makes Dexie read the full row before every `put`; three settings operations
  per save; `folder()` never caches `undefined`; with a folder, `backupNow` reads and base64-encodes all 12 tables
  including image and model bytes before diffing.
- Change: `creating`/`updating` hooks replaced by explicit `emitSavedChange` calls in the save functions; cache the
  folder lookup and the persist-asked flag per session; keep a dirty set of `{ table, key }` and back up only dirty
  rows with a cached per-row text map.
- Perf (estimate): IndexedDB operations per save 5 → 2; backup work with a folder O(library) → O(changed rows).
- Risk: Medium; failure mode is a save that no longer triggers the folder backup or the online upload.
- Guard: fake-indexeddb test: save one project, assert `db.models.toArray` and `db.images.toArray` are not called by
  `backupNow` and `settings.get` is called once across three saves; upload spy in `account-ui.test.tsx`.

### I-18 Housekeeping (weight 4)

- Files: `src/core/room.ts:168` (`wallCount`, unreferenced), 117 unnecessary `export`s (list in the inventory
  script output), `src/core/features.ts` → `src/ui/info/features.ts`, `src/core/samples/mobila.ts` →
  `tests/fixtures/`, `src/core/shopping-types.ts` (breaks the type cycle), CLAUDE.md viewer exception list
  (ADR-102, ADR-122, ADR-146, ADR-169), the six Zustand stores under `src/ui`.
- Risk: Low.
- Guard: `pnpm typecheck`, `pnpm lint`, `pnpm docs:check`; the I-01 boundary test.

### I-19 Tools and test hygiene (weight 4)

- Files: `package.json` (add `playwright` as a devDependency or a `tools/package.json`; Apache-2.0, no telemetry
  with a system Chromium), `.github/workflows/ci.yml` (run `python3 -I -m unittest discover tools/catalog`),
  `tests/roomfill.test.ts:202-285` → `tests/fuzz.test.ts` under the same `FUZZ_N` contract, `tests/persist.test.ts:1`
  (`beforeEach` with `new IDBFactory()` as `setup.tsx:74` does), `tools/lib/harness.mjs` shared by the 59 scripts.
- Perf (measured for roomfill): `pnpm test` −4.7 s.
- Risk: Low.
- Guard: a Vitest test that parses `tools/*/find-it.mjs` imports and asserts each bare specifier is declared.

### I-20 Viewer resource sharing (weight 2.4)

- Files: `src/viewer/Viewer3D.tsx:105-143` (`geoCache`), `:1477-1651` (`Panels`).
- Problem: verified: 40 box panels create ≈ 80 geometries and ≈ 80 materials (box + drei `Edges` line objects).
- Change: materials keyed by `(color, map, faded, side, role)` in a `useMemo` map; one `BoxGeometry` per `(w, h, d)`;
  one merged `EdgesGeometry` per model as a single `LineSegments`, disposed on model change.
- Perf: reasoned, not profiled; worth measuring first on a 20-piece room.
- Risk: Medium (ADR-014 browser-acceptance area).
- Guard: `@react-three/test-renderer` test counting `Material`/`BufferGeometry` instances ≤ unique keys; browser
  find-it `tools/move-3d` unchanged.

## 9. Regression-safety contract (for any later implementation)

TDD per item, in this order, no step skipped:

1. Freeze fixtures: for every unit the item touches, write golden files of today's outputs (model panels and hardware,
   cut-list rows, nesting layouts with `maxMs: Infinity`, CSV and review-pack text per print language, Fusion script
   with a fixed date, `dist/sw.js` manifest where relevant) from the sample projects and the 108 catalog variants.
2. Write or extend the guarding test named in section 8 so it pins current behaviour and is red for the new
   behaviour where behaviour changes.
3. Make the change on branch `adr-NNN-short-title` under its ADR, or on an `ff` push where CLAUDE.md allows it.
4. Run the full baseline set and compare every number with section 1:

   ```
   pnpm install --frozen-lockfile
   pnpm lint
   pnpm format:check
   pnpm typecheck
   pnpm test
   pnpm build
   pnpm docs:check
   FUZZ_N=30000 pnpm exec vitest run tests/fuzz.test.ts
   ```

   A drop in test count, a chunk growing more than 2 %, or a measured time beyond noise is reported, never explained
   away. Golden files match byte for byte unless the ADR says the output changes.

5. No test is skipped, weakened, quarantined or deleted to go green. Fix the cause, never the check.
6. Fuzz after any geometry change; `tests/persist.test.ts` and the storage tests after any Dexie or document change;
   find-it (jsdom, or the browser script for layout, CSS, 3D and Move mode) after any UI change; golden diff after any
   extraction.

## 10. Open questions for the user

None of these is answered by assumption. Each blocks the item it names.

1. I-06: may width-independent find-it tests run at one width? This amends CLAUDE.md R3 and ADR-108.
2. I-10: should the production nesting default become deterministic (`maxMs: Infinity` or an attempt bound), accepting
   a possibly slower first layout on a weak phone and a layout that may differ from one already printed?
3. I-16: must the seller catalog and the path tracer be available offline before the user ever opens them, or is
   "offline after first use" enough (ADR-002, ADR-161)?
4. I-07: accept `Diagnostic { code, params }` as the new document shape for diagnostics (amends ADR-008 and the
   translation rule in ADR-153)?
5. I-04: is a generated `public/research/*.json` an acceptable home for the research data (ADR-043 lineage)?
6. Order: which of I-01, I-02, I-08, I-09, I-14, I-15, I-18, I-19 (quick wins, no ADR) go first?

## 11. Candidate ADR titles (titles only)

- Enforce layer boundaries with lint rules and a source-scan test
- Parallel CI jobs with sharded tests and tool caches
- Memoise placed pieces and derive the project view once
- Split the bundle: manual chunks, lazy pages, research as lazy data
- Persistence behind the store
- Find-it at one width where the rendered path does not depend on width
- Diagnostics as codes translated at the edge
- Nesting as a workspace package with deterministic defaults
- Precache the shell, cache feature chunks on first use

## Skipped this iteration

- No code, config, test or workflow change; no gaps entries (nothing here was requested to be built yet).
- The remaining improvement candidates beyond the twenty (viewer accessibility of the elevation SVG, `Catalog.tsx:681`
  per-card `buildModel` in render, `restoreFiles` transaction, Dexie reload notice, `tr()` typing, unused i18n keys,
  `App.tsx` split and `memo` of `RoomPlan`/`Panels`) wait for the user's request after the pull request is opened.
- No browser profiling of the viewer (I-20 is reasoned).
