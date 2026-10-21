# Backlog — the single ledger

Statuses: **Done** (acceptance met, evidence cited) · **Partially done** (code exists, gap named) · **Not done** ·
**Dropped** (reason given). IDs are never reused or renumbered. Change a status only with evidence (ADR-0016).

## Rebuild v1 — first slice: parametric furniture + 3D (branch `rebuild/v1`)

| ID | Item | Status | Evidence / gap |
|---|---|---|---|
| F01 | Core model: panels as integer-mm boxes, one `FurnitureModel` | Done | `src/core/types.ts`, `build.ts`; `tests/core.test.ts` |
| F02 | Cabinet carcass: sides, top on/between sides, bottom, plinth, back nailed-on / set-in / none | Done | `src/core/cabinet.ts`; template tests |
| F03 | Space subdivision: split side-by-side / stacked, fixed or share sizes, dividers | Done | `cabinet.ts` split case; split tests; fuzz |
| F04 | Contents: shelves, drawers (runner choice, clearances), hanging rail | Done | chest/runner tests; fuzz runner check |
| F05 | Doors (one / pair) on any space; internal drawers behind doors | Done | sideboard, internal-drawer, doors-in-doors tests |
| F06 | Full-overlay front gap arithmetic | Done | gap tests; fuzz exact-gap invariant |
| F07 | Desk: worktop, gables, left/right/both pedestals (cabinet generator), modesty panel | Done | `src/core/desk.ts`; desk tests |
| F08 | Independent checks: integer, size, thickness, overlap, envelope, guidance warnings | Done | `build.ts`; `tests/fuzz.test.ts` (3,000 seeded; 30,000 deep run passed) |
| F09 | Cut list: finished sizes, L/W edge notation, grain, grouping, m², edge-band metres, CSV | Done | `src/core/cutlist.ts`; cut-list tests |
| F10 | Hardware schedule: runners, hinges (labelled typical), rails | Done | `hardwareSummary`; hinge regression test |
| F11 | Front-elevation editor with tap-to-select spaces, breadcrumbs, inspector | Done | `src/ui/Elevation.tsx`, `Inspector.tsx`; screenshots during build |
| F12 | 3D preview: lazy, highlight from parts list, click to select, no-WebGL message | Done | `src/viewer/Viewer3D.tsx`; screenshots (SwiftShader) |
| F13 | Templates: chest, bookcase, base cabinet, sideboard, wardrobe, pedestal desk, panel desk | Done | every-template test |
| F14 | Local library: autosave, reopen last, list, duplicate, delete, import/export design file | Done | storage unit-tested (`tests/persist.test.ts`); browser run 2026-10-22: rename autosaves, duplicate, delete (disabled on the open piece), export → import, reopen after reload. Found and fixed: each reload saved a stray placeholder piece |
| F15 | Undo / redo (buttons, Ctrl+Z / Ctrl+Shift+Z) | Done | browser run 2026-10-22: buttons and keyboard shortcuts both undo and redo a drawer-count change |
| F16 | Materials editor (name, thickness, grain, colour, add) | Done | browser run 2026-10-22: rename and thickness change reach the parts CSV; add material; screenshot |
| F17 | Offline PWA with update prompt | Done | 2026-10-22, production build of deployed commit 7274eef served under `/furniture-builder/`: SW scope correct, offline start reopens last piece, 3D works offline; simulated deploy shows "A new version is ready", old version kept until "Update now", then new build loads with edits intact. Not checked on the github.io URL itself (unreachable from the build workspace) or on a real phone |
| F18 | Responsive layout phone → wide desktop | Done | screenshots 390 / 1280 / 1600 px; no horizontal page scroll at 320–768 px. 2026-10-22: Parts CSV, Print and Export were hidden off-screen in a sideways scroller on phones; buttons now wrap to a second row (verified at 390 px, all reachable) |

## Release check 2026-10-22 (commit 7274eef, deployed)

Clean `npm ci` → lint → typecheck → 87 tests → build (the deploy job's steps), served under `/furniture-builder/`;
scripted Chromium run 24/24 at 1440 px and 390 px: load, fonts, manifest scope, edit/undo/redo, sheets (worker), 3D,
Romanian CSV (BOM, `;`), SVG, Fusion script compiles, design file export/import, Romanian print PDF, project with 3
pieces + sheets + reopen, offline start, no page errors or failed requests. Pages deployment SHA = main SHA.

## Next slices (not started)

| ID | Item | Status | Notes |
|---|---|---|---|
| N01 | Sheet nesting: guillotine optimiser from the cut list, with independent validator | Done | ADR-0018/0019; `tests/nesting.test.ts` (fuzz + mutation), template layout test; screenshots |
| N02 | Printable cut sheet / PDF and SVG drawings | Done | ADR-0020; `tests/ro.test.ts`; PDF rendered from the app (headless Chrome) |
| N03 | Fusion 360 export from `FurnitureModel` | Partially done | ADR-0021; exporter built and syntax-checked (`tests/fusion.test.ts`); not yet run inside Fusion |
| N04 | Several pieces in one project (kitchen run, room) | Done | ADR-0022; `tests/project.test.ts` (7); browser run: edit persisted across reload; project PDF |
| N05 | Unequal drawer heights, adjustable shelves (pin rows) | Done | ADR-0023; 5 tests; fuzz covers heights and adjustable shelves (20,000 passed) |
| N06 | Inset / half-overlay fronts, handles | Done | ADR-0024; 5 tests; fuzz covers all three styles and handles (20,000 passed); screenshots |
| N07 | Wall and corner cabinets, worktop joins | Done | ADR-0025; 4 tests incl. 400 random corners; screenshots of wall, blind and L corners |
| N08 | Selectable pedestal internals on desks | Done | ADR-0026; `tests/core.test.ts` editable pedestals; 20,000-design fuzz passed |
| N09 | Committed browser test suite | Not done | Only when the user asks (pre-MVP rule) |
| N10 | Fixes from independent review (2026-10-22) | Done | Pin holes per-panel grid (faces never coincide), rows measured on the shelf, "one face" text, setback ≥ 8 mm, size caps, project materials split by grain + sheet-conflict warning, mirrored L-corner handle, L-corner plinth notch; 7 regression tests fail on the old code, pass now; reviewer's fuzz re-run passed |

## Dropped

| ID | Item | Reason |
|---|---|---|
| D01 | Migrate data from the previous app | User chose a clean break (ADR-0001) |

## Decisions from the user (2026-10-21)

All open questions are answered and recorded in the ADRs: kerf 4 mm, PAL/HDF 2800 × 2070, MDF 2440 × 1220, 10 mm
trim, full sheets only (ADR-0018/0019); A4 portrait, Romanian on paper and CSV (ADR-0020); Fusion grouped per piece
(ADR-0021); projects keep copies (ADR-0022); 37 mm hole rows, 1 mm shelf clearance (ADR-0023); inset gap 3 mm,
bar/knob/push-to-open handles (ADR-0024); blind and L-shaped corners, bracket-and-rail wall mounting (ADR-0025);
independent pedestals (ADR-0026); finished sizes, never band-subtracted (ADR-0009); ball-bearing side runners and
35 mm soft-close clip-on hinges (ADR-0010); no orchestration runtime (ADR-0017).
