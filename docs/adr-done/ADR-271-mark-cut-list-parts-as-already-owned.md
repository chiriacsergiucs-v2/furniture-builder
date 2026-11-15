# ADR-271: Mark cut-list parts as already owned

- Status: Implemented
- Date: 2026-11-14
- Implemented: 2026-11-14 (Built 2026-11-14; tests/owned.test.ts, tests/owned-view.test.tsx, tests/find-it/owned-parts.test.tsx)
- Depends on: ADR-011, ADR-012
- Design: n/a
- Backlog: N295

## Context

User, 2026-11-14: "Add the possibility to mark from the cut list 'already own this piece'; if the same piece has
multiple occurrences, on marking that I have that piece I should be prompted to choose how many do I own, and it should
be excluded from the cut list, just the cut list, and the sheets should be re-optimized."

Answers: only the cut list and the sheets drop the owned parts (3D, parts counts for the estimate, board area, shopping
list and price stay as designed); "the same piece" is a cut-list row — same board, size, edges and drilling — matched
across the whole project.

## Decision

- A new optional document field `ownedParts?: Record<string, number>` on the design (schemaVersion 9) and on the
  project (schemaVersion 21): owned key → how many the user owns. No version bump: both versions are still the
  current ones and gain only optional fields (ADR-205, ADR-207, ADR-209 did the same). A file older than that version
  that carries the field fails validation; older readers ignore it. No Dexie change (ADR-012).
- The key is `ownedKey(row)` in `src/core/owned.ts`: length × width, banded edges, thickness, drilling text and the
  board (`materialKey`). The edge band's name is not part of it. Generated geometry is never saved (ADR-011).
- `applyOwned(rows, owned)` (pure) takes the owned count off the rows with that key, in row order, and returns the
  rows to cut, the fully or partly owned rows, and the owned entries that match nothing now. A part count above what
  the design needs, or a part the design no longer builds, is kept and shown as "no longer matches" with a Clear
  button; nothing is dropped silently (ADR-012, ADR-151).
- The view layer gives the cut list, its CSV, the printed cutting sheet, the solid-timber lengths and the sheet
  layouts `cutRows` (after owned); the estimate, shopping list and client sheet keep all rows. The sheets are
  re-laid out from `cutRows` as they already are whenever the view changes.
- Parts tab: each row has "I own this…". A row of one part is marked at once; a row of several asks "How many do you
  own?" (1 to the row's quantity, a number field). A marked row shows "{n} owned" and "Own fewer / Not owned". Fully
  owned rows move to an "Already owned" list under the table, still clearable.
- Inside a project, a piece opened for editing shows that piece's own marks (its design's `ownedParts`); the project
  marks apply to the project view. Decided by Claude.
- One undo step per change; a refused change (a locked piece) is said, as every store action.

## Alternatives considered

- **Mark single parts by panel id** — breaks when a part is rebuilt and cannot cover identical parts across pieces.
- **Remove owned parts from the model** — would change 3D, price and hardware; the user asked for the cut list only.
- **Store only in browser storage** — outside the design document: lost on export, import and sync.

## Scope

- In scope: the field and its validation, `applyOwned`, store action, Parts-tab controls, sheets, print and CSV.
- Out of scope: owned offcuts or board stock; owned hardware; price or shopping changes.

## Consequences

- Positive: the cut list and sheets show only what is left to cut; the marks follow the part by its size, not its id.
- Negative / risks: a size change leaves a mark that matches nothing until the user clears it.
- Harder to change later: the key format (a new format needs a migration of saved marks).

## Done when

- [x] `applyOwned` removes the owned count from matching rows across pieces and returns unmatched entries (unit tests).
- [x] `validateDesign` and `validateProject` accept a valid `ownedParts` and reject bad keys, counts and old versions.
- [x] Sheets are laid out from the rows after owned parts (test: fewer parts on sheets).
- [x] Parts tab: "I own this…" asks "How many do you own?" for a row of several; the row leaves the cut list (find-it).
- [x] CSV and printed sheet leave out owned parts; the estimate keeps them.
- [x] Russian entries for every new text.
