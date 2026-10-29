# ADR-151: Give any single part of a piece its own board

- Status: Pending
- Date: 2026-10-29
- Depends on: ADR-011
- Design: docs/ui-design.md (Settings dialog, collapsible groups)
- Backlog: N152

## Context

User 2026-10-27: "Ff any piece of the item can have own material changed." Answers the same day: 1. one generated
part (for example the left side or one shelf) — "Yes"; 2. a part that no longer exists after the piece changes —
"Warn"; 3. every product kind — "Yes"; then "No adr".

The feature was built and merged without an ADR on that explicit decision (PR #132, deploy run 40861670678). User
2026-10-29 asked for this ADR afterwards ("2") to record the design document change that ADR-011 requires an ADR
for. It changes no earlier decision: until now a piece set boards per group only (`bodyMaterialId`,
`frontMaterialId`, `backMaterialId`, drawer `boxMaterialId`/`bottomMaterialId`, frame `panelMaterialId`/
`solidMaterialId`); panel sets (ADR-041) already had a board per loose part.

## Decision

- `Design.partMaterials?: Record<panelId, materialId>`: a board for one generated part instead of its group's board.
  Absent or empty = every part uses its group's board. Design `schemaVersion` 4; versions 1–3 still load and upgrade
  in memory (`upgradeDesign`); `partMaterials` in a file older than 4 is invalid (ADR-011).
- Validation: the value must be a material of the piece; at most 2000 entries; never throws.
- `buildModel` swaps the part's `materialId` after the generator runs, so every projection (3D, parts list, sheets,
  band, shopping) follows it. Geometry is unchanged: a board of another thickness gets the existing `thickness`
  error, which blocks export (ADR-008).
- A key whose part the piece no longer builds is kept, never dropped, and gives the `part-board-lost` warning
  ("Warn"); the user clears it.
- Store `setPartMaterial(panelId, materialId | null)`, one undo step; null goes back to the group's board.
- UI: Settings → **Part boards** (collapsed) for cabinet, desk, corner, panel and frame; one select per part
  ("Same as its group" or any board); lost parts listed with **Clear**.

## Alternatives considered

- **Boards per role (all doors, all shelves)** — not asked; the user chose one generated part.
- **Drop a lost key silently** — the user chose "Warn"; silent loss would also break ADR-008.
- **Resize the part to the new board's thickness** — changes geometry and the neighbours; the existing thickness
  error keeps the user in control.

## Scope

- In scope: the document field, validation, model, store action, Settings group, tests.
- Panel sets keep their own per-part board picker (ADR-041); their Settings get no Part boards group.

## Consequences

- Positive: any part can differ (for example an oak side on a white carcass); cut list and sheets follow.
- Negative / risks: part ids follow the generator (`${nodeId}/${role}[/${index}]`); renumbered parts lose their
  board, shown by the warning.
- Harder to change later: the saved field keyed by panel id.

## Done when

- [x] A part with its own board shows that board in the model and the parts list (`tests/part-boards.test.ts`).
- [x] A board of another thickness gives the `thickness` error (`tests/part-boards.test.ts`).
- [x] A lost part gives the `part-board-lost` warning and the key is kept (`tests/part-boards.test.ts`).
- [x] An unknown board and `partMaterials` in a version-3 file are invalid (`tests/part-boards.test.ts`).
- [x] Old files (versions 1–3) still validate and upgrade to 4 (`tests/edge-band.test.ts`, `tests/core.test.ts`).
- [x] Find-it at 390 and 1280 px: Settings → "Part boards" → "Left side" → board; Parts list; "no longer exists" →
      "Clear" (`tests/find-it/part-boards.test.tsx`).

## Open questions

None. All answered by the user on 2026-10-27 (see Context).
