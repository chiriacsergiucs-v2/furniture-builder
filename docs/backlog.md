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
| N11 | Project plan shows sizes (tape dimensions) and a room front view | Done | `src/ui/Project.tsx` (`RoomPlan`, `RoomFront`): overall width along the back wall and depth along the side wall, overall width and height in the front view, selected piece's sizes in green; tap a piece in either view to select it. Lint, typecheck, 87 tests, build passed; scripted Chromium screenshots of a 3-piece project at 1440 and 390 px, no page errors. No new unit test (drawing only) |
| N12 | Exploded 3D view | Done | User request 2026-10-22; ADR-0014 addendum. `src/core/explode.ts`; `tests/explode.test.ts` (sizes kept, whole mm, on the floor, no overlaps, every template and a project); fuzz checks no exploded overlaps (20,000 passed). Browser run 1440 / 390 px: piece and project exploded, no page errors, no sideways scroll |
| N13 | Gap between two pieces in a project | Done | User request 2026-10-22; ADR-0022 addendum. `leftNeighbour`/`setGapLeft` in `src/core/project.ts`; 4 tests. Browser run: gap set to 600 mm, the piece on its right moved with it. Gaps are along the wall (x) only |
| N14 | Catalog page: by category, brand, saved on this device | Not done | ADR-0027 (Proposed). User request 2026-10-22 |
| N15 | Catalog metadata and origin link kept on edited copies | Not done | ADR-0028 (Proposed). User request 2026-10-22 |
| N16 | Catalog feed: scheduled search for public assembly manuals, reconstruction into native designs, via PR | Not done | ADR-0029 (Proposed). Weekly routine "Furniture catalog feed" created 2026-10-22; no run yet |
| N17 | PDF extraction script `tools/catalog/extract_pdf.py` (local, deterministic, tested) | Partially done | ADR-0029 addendum. `tools/catalog/test_extract_pdf.py`: 10 tests pass on PDFs the test writes (dimensions incl. cm and non-whole mm, quantities, article numbers, labels vs steps, drawing regions, no-text warning, identical output, CLI refuses URLs); 5 code mutations each fail a test. Gap: never run on a real assembly manual (ikea.com blocked here), OCR path untested |
| N18 | UI overhaul: design tokens (light + dark), component layer, icons, steps rail, regrouped inspector, dialog footers, sticky table heads | Partially done | User request 2026-10-22; ADR-0030 (Proposed); audit, token spec, component states, before → after and rollout in `docs/ui-design.md`. Lint, typecheck, 94 tests, build passed; scripted Chromium at 360 / 390 / 1280 / 1600 px, light and dark: 47 screens each, no page errors, no horizontal page scroll; print emulation in dark mode renders the light sheet; token contrast ≥ 4.5:1 computed. Gap: not checked on a real phone, with a screen reader, or on the deployed site; four open questions in the doc need the user's decision |
| N19 | Project placement: floor, wall, on or above another piece (follows it) | Done | User request 2026-10-22; ADR-0031 (Proposed). `tests/mobila.test.ts` placement block (7 tests; two code mutations each fail a test). Scripted Chromium 1440 / 390 px: SUS placed on JOS with a 1730 mm gap, controls shown, no page errors, no sideways scroll. Not checked on a real phone |
| N20 | Cabinet bottom under the sides; "Bays and shelves" quick layout (uprights, shelves per bay, doors per bay) | Done | User request 2026-10-22; ADR-0031. 5 tests; fuzz now picks the bottom joint (3,000 seeded passed); screenshot of JOS editor at 1440 / 390 px |
| N21 | Mobila rooms rebuilt from `MOBILA_TOATE_CAMERELE_AI_CAD_PAL_MDF.json`: Living (Coloana, JOS, SUS) and Dormitor (nightstand A ×2) | Partially done | `src/core/samples/mobila.ts`, `docs/samples/*.project.json`, New → Mobila rooms. Living carcass parts match the file 47/47 by size (test); fronts and nightstand differ by 1–18 mm, listed in `docs/samples/mobila.md`. Gap: bed, splashback and RHS bench not built (no product type); per-panel materials (SUS bottom MDF) not supported |
| N22 | Template catalog: families + variants as design snapshots, in Start from and a Catalog tab, Room / Type grouping | Not done | ADR-0032 (Proposed). User request 2026-10-22; list in `docs/catalog.md` (42 families) |
| N23 | Default variants (1–5 per family) and *Apply layout* presets | Not done | ADR-0033 (Proposed). 112 variants listed, 57 interior-only |
| N24 | Editable templates saved as local templates (Dexie table), reset / compare with shipped | Not done | ADR-0034 (Proposed) |
| N25 | Rules registry: shelf span, door width, anti-tip, hanger depth, tilt-up; safety-regulated items gated | Not done | ADR-0035 (Proposed); thresholds unverified, await confirmation |
| N26 | Kitchen construction: tall units, rails top, no bottom, appliance niches, front-only panel, run fillers / covers / plinth / worktop | Not done | ADR-0036 (Proposed) |
| N27 | Sliding doors and flaps | Not done | ADR-0037 (Proposed) |
| N28 | Frame root (tables, benches, stools, chairs, beds) with solid stock lengths list | Not done | ADR-0038 (Proposed) |
| N29 | Reference entries for upholstered / mechanised / shaped pieces | Not done | ADR-0039 (Proposed) |

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
