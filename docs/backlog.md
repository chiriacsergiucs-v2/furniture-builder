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
| F14 | Local library: autosave, reopen last, list, duplicate, delete, import/export design file | Partially done | storage unit-tested (`tests/persist.test.ts`); library dialog not exercised by automation |
| F15 | Undo / redo (buttons, Ctrl+Z / Ctrl+Shift+Z) | Partially done | implemented in `designStore.ts`; no automated test |
| F16 | Materials editor (name, thickness, grain, colour, add) | Partially done | implemented in `Dialogs.tsx`; no automated test |
| F17 | Offline PWA with update prompt | Partially done | service worker builds; offline start not verified on a device |
| F18 | Responsive layout phone → wide desktop | Done | screenshots 390 / 1280 / 1600 px; no horizontal page scroll at 390 px |

## Next slices (not started)

| ID | Item | Status | Notes |
|---|---|---|---|
| N01 | Sheet nesting: guillotine optimiser from the cut list, with independent validator | Not done | ADR-0018, ADR-0019; Previous app had one; rebuild from ADR-level rules (kerf stripe, grain, trim) |
| N02 | Printable cut sheet / PDF and SVG drawings | Not done | ADR-0020 |
| N03 | Fusion 360 export from `FurnitureModel` | Not done | ADR-0021; Must be labelled unverified until run in Fusion |
| N04 | Several pieces in one project (kitchen run, room) | Not done | ADR-0022; Needs a project document above `Design` |
| N05 | Unequal drawer heights, adjustable shelves (pin rows) | Not done | ADR-0023; New space options, same engine |
| N06 | Inset / half-overlay fronts, handles | Not done | ADR-0024; Front zone already central; handles need physical spec |
| N07 | Wall and corner cabinets, worktop joins | Not done | ADR-0025 |
| N08 | Selectable pedestal internals on desks | Done | ADR-0026; `tests/core.test.ts` editable pedestals; 20,000-design fuzz passed |
| N09 | Committed browser test suite | Not done | Only when the user asks (pre-MVP rule) |

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
