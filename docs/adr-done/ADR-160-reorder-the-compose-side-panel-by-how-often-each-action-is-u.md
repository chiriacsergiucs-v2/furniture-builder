# ADR-160: Reorder the Compose side panel by how often each action is used

- Status: Implemented
- Date: 2026-10-30
- Implemented: 2026-10-30 (PR #140, CI verify run 40989459081)
- Depends on: ADR-117, ADR-147, ADR-159
- Design: docs/ui-design.md (§4 Screens, whole-piece inspector); critique with before/after screenshots in the session log
- Backlog: N162
- Acceptance: browser

## Context

A UI critique of the project's Compose side panel (2026-10-29) scored every control by its estimated uses in a day
of configuring a whole room (8–10 pieces). The most used actions sat lowest: "Add a piece" 1130 px down, Position
closed, Duplicate and Turn under twelve equal-weight buttons, a 1100 px tall Room once set. The user, in their
words: "Agree with all, implement, fix, remove the how many completely, there already is rotation in toolbar, no
more need for the 4 buttons, also remove the rotation degree input, hidden for now". On the saved quantities the
user picked "Keep, no control". On the skipped parts (2026-10-30): the single-piece panel "Flatten + order",
Build & Preview "Same as Compose", the rotation field "Keep hidden".

This changes [ADR-117](../adr-done/ADR-117-put-the-pieces-list-first-and-fold-the-selected-piece-s-sect.md)
("Position, Clearance, Finish and Merge each become a closed Group") and hides the "Rotation (°)" field of
[ADR-121](../adr-done/ADR-121-research-batch-1-render-3d-on-demand-review-pack-typed-rotat.md) and the
"How many" counter on the card. Implemented ADRs are not edited.

## Decision

UI only, in the project's Compose panel (`src/ui/Project.tsx`, `App.tsx`, `styles.css`). No model, store or
document change.

1. **Pieces list (S1, S2).** One-line rows (name left, W × H × D right). "Add a piece" moves into the list header
   beside Select. With exactly one piece selected (Select off), the list gives way to a row
   "‹ All pieces (N)" with previous / next buttons in project order; "All pieces" clears the selection.
2. **Card (S3).** No frame and no "Selected piece" eyebrow; the region keeps its name "Selected piece: <name>".
   The source line stays on one line. The floor footprint ("800 × 300 mm of floor, 1800 mm high") sits under the
   name, and "N ×" before it when the saved quantity is above 1.
3. **Actions (S4).** Title row: a Lock toggle and a "More actions" (⋯) menu holding Replace…, Save to catalog,
   Update from saved piece, Lock size, Mirror the run (N pieces) and Remove from project. "Edit this piece" is
   full width. A toolbar of five icon-and-label buttons: Duplicate, Linked, Turn ↺, Turn ↻, Mirror. Delete or
   Backspace on a selected piece (focus not in a field) asks to remove it, as the menu item does.
4. **How many (S5).** The counter is removed from the panel. Saved quantities stay and still count.
5. **Position (S6)** opens by default. The 0°/90°/180°/270° buttons are removed (the toolbar turns) and the
   "Rotation (°)" field is hidden for now. Move to shows only the actions that work now, then a fold
   "N more are off" that lists each other action with its reason.
6. **Order (S7).** Position, Finish, Project settings, then "More: clearance, merge" holding Clearance and Merge.
   An error in Clearance opens it (ADR-008).
7. **Room (S8).** Set: a closed group "Room" whose summary reads "<Shape> · W × D × H" and "N walls · M items".
   Not set: one hint and "Add the room" (rectangle; shape changes inside) and "Draw the room".
8. **History (S9)** title shows the number of saved versions: "History · N versions".
9. **Phone sheet (S10).** With one piece selected, the peek row carries Edit this piece, Duplicate and Turn ↻
   beside the name, usable with the sheet closed; with none selected it carries "Add a piece".
10. **Single piece (G-309).** A space of a piece outside a project: no section frames, "Divide this space" right
    under the title, Contents and Doors and handles open, "Layouts" a closed fold.

## Alternatives considered

- **Keep the order, only shrink buttons** — leaves Position closed and Add 1100 px down; not chosen.
- **Tabs (Size / Position / Finish)** — more taps on a phone (rejected in ADR-117 as well).
- **Convert saved quantities into duplicates** — rewrites saved designs (ADR-011, ADR-012); the user chose to keep.

## Scope

- In scope: the project Compose panel at desktop and phone widths, the phone peek row, and the space editor of a
  single piece (G-309).
- Out of scope: a different side panel in Build & Preview (G-310, the user keeps it the same); bringing back the
  Rotation (°) field (G-311).

## Consequences

- Positive: Add, Duplicate, Turn and Position sit in the first screen; the editor no longer moves down as pieces
  are added; the clipped "Mirror the run" label is gone.
- Negative / risks: a quantity above 1 can no longer be changed from the panel; an angle other than a quarter
  turn can no longer be typed (G-311). Find-it tests and scripts that looked for the old controls change.
- Harder to change later: nothing; UI only.

## Done when

- [x] At 1280 px with one piece selected, "Add a piece", the toolbar (Duplicate, Linked, Turn ↺, Turn ↻, Mirror)
      and an open Position group are in the first 900 px of the panel (browser find-it).
- [x] "How many", "Rotation (°)" and the 0°/90°/180°/270° buttons are absent; Move to shows only working
      actions plus "N more are off" with reasons (find-it).
- [x] "More actions" lists Replace…, Save to catalog, Lock size and Remove from project; each works (find-it).
- [x] "‹ All pieces (N)" and next / previous switch the selected piece; "All pieces" shows the list (find-it).
- [x] With a room set, the Room group is closed and its summary names shape and sizes (find-it).
- [x] At 390 px the peek row's Duplicate adds a piece with the sheet closed; no horizontal scroll (browser find-it).
- [x] A space of a single piece shows "Divide this space" before "Contents" and a closed "Layouts" fold (find-it).
- [x] lint, format:check, typecheck, test, build and docs:check pass.
