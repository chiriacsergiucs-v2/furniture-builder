# ADR-038: A frame root for tables, benches, stools and beds, with solid (linear) stock alongside sheet stock

- Status: Implemented
- Date: 2026-10-22
- Implemented: 2026-10-23
- Decided by: user request; defaults below await confirmation
- Depends on: none
- Design: n/a
- Related: ADR-004, ADR-007, ADR-009, ADR-018, ADR-032, ADR-035
- Backlog: N28

## Context

Tables (dining, coffee, end, patio), benches (indoor, garden), stools, straight-back chairs and beds (bed, daybed,
futon frame, bunk bed, cradle) are not carcasses: they are legs, rails, stretchers, slats and a top or deck. Their
parts are still axis-aligned boxes (ADR-004), but many are solid timber cut from lengths, not sheets.

## Decision

- New root `frame` (ADR-007): `FrameParams { kind: 'table' | 'bench' | 'stool' | 'chair' | 'bed', width, depth,
  height, top?, legs: { section, inset }, rails: { height, thickness, set: 'apron' | 'trestle' | 'panel-ends' },
  stretchers?, slats?: { width, thickness, gap, ledger }, back?: { height, rails | slats }, deck? ,
  headboard?/footboard? (bed), tiers? (bunk) }`. Topology is fixed per `kind`; there is no space tree, except that a
  bench, bed or table may hold a **cabinet** for under-storage (drawers under a bed, a coffee-table drawer) built by
  `buildCabinet` with an origin offset, as desk pedestals are.
- **Stock kind:** `Material.stock: 'sheet' | 'solid'` (absent = sheet). Solid parts go to a **lengths list** (by
  section, longest first, with kerf) instead of sheet nesting; sheet nesting ignores them (ADR-018). The cut list
  keeps finished sizes (ADR-009) and marks solid parts.
- Only vertical/horizontal members: chair and bench backs are vertical in this root; a raked back, splayed or tapered
  legs and curved parts need a shaped-panel ADR (ADR-039).
- Mattress presets (EU/UK/US sizes) are a picker that sets the bed's inner size + clearance; they are labelled as
  typical sizes to confirm against the actual mattress.
- Rules (ADR-035): slat gap, centre support for wide beds, table span needing a centre rail, outdoor material
  reminder — all guidance. Bunk beds and cradles are safety-regulated (ADR-035) and wait for user-confirmed values.

## Alternatives considered

- **Model tables as cabinets** — rejected: fake panels, wrong cut list.
- **Treat solid parts as sheets** — rejected: nesting would plan timber as boards.

## Consequences

- New `PanelRole`s: `leg`, `rail`, `stretcher`, `slat`, `ledger`, `seat`, `headboard`, `footboard`.
- Fusion export (ADR-021) and printing (ADR-020) take the new roles unchanged — they read panels.

## Evidence (repository files)

- `src/core/desk.ts` (a root reusing `buildCabinet`), `src/core/cutlist.ts`, `src/core/nesting/fromDesign.ts`.

## Compliance check

When accepted: tests — each frame `kind` builds with no overlaps at min/max size; solid parts never reach the sheet
layout and appear in the lengths list; a bed with drawers reuses `buildCabinet`; fuzz covers the frame root.

## Open questions (defaults used until answered)

1. Solid stock lengths you buy (default 2400 and 3000 mm) and sections (default 45 × 45, 20 × 90).
2. Joinery (mortise-tenon, dowels, bed-rail brackets) — listed as a hardware/guidance line only (default) or not at all?

## Implementation (2026-10-23)

Built: the `frame` root with kinds table, bench, stool, chair, bed (bunk = a bed with `tierGap`, daybed = a bed with
a side panel); `Material.stock: 'solid'` with `lengths`; solid parts skip the thickness check and sheet nesting and
appear in a **lengths list** (first fit decreasing per section, kerf between parts, parts longer than any length
reported). New panel roles as listed plus `stile` and `rung` (ladder). Slatted tops need rails under them (error
otherwise) and the front and back slats sit over the legs. Defaults for the open questions: stock lengths 2400 and
3000; joinery not listed. Not built: drawers built into a frame (`frame:under-storage`), arm rests (`frame:arms`).

Evidence: `src/core/frame.ts`, `src/core/cutlist.ts` (`lengthsList`), `src/core/nesting/index.ts`,
`src/ui/Editors.tsx` (`FrameEditor`), `src/ui/Output.tsx` (`Lengths`); `tests/constructions.test.ts` (frame block,
6 tests), frame fuzz (`tests/fuzz.test.ts`).

Verification 2026-10-23 (branch `feat/catalog-templates`): `npm run lint`, `npm run typecheck`, `npm test` (157 passed), `npm run build` passed; `FUZZ_N=30000` fuzz passed (cabinets with the new fronts and flags, and frames); scripted headless Chromium against the production build at 1280 and 390 px, 18/18 checks, no page errors, no sideways scroll. Six code mutations each fail a test. Not checked on a real phone, with a screen reader, or on the deployed site.

## Answers (2026-10-23, from the user)

1. Stock lengths **2400 and 3000 mm**. 2. Joinery **not listed**.
