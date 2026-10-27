# ADR-106: Save a project piece to the catalog, and make new pieces inside a project

- Status: Pending
- Date: 2026-10-27
- Depends on: ADR-034, ADR-044, ADR-088, ADR-096
- Design: docs/ui-design.md (project editor, selected-piece card; dialogs)
- Backlog: N104
- Agreed: 2026-10-27 "New adr to add the possibility to save a new piece to catalog when created it inside a project"; answers "Catalog template"; "Any piece, plus wizard"; "Linked"; "Full find-it"; "Name, room and type"; "Added to the project"

## Context

The user asked (2026-10-27): "New adr to add the possibility to save a new piece to catalog when created it inside a
project". Today a project piece is a copy of a design; it can be drilled into and edited in place (ADR-088,
ADR-090), but it cannot be saved to the catalog. _Save this piece as a template_ (ADR-034, `templateFromDesign` in
`src/core/catalog/local.ts`) exists only on the Catalog page, asks only for a name and files the template under room
"other", type "storage". _New piece, step by step_ (ADR-044) is reachable from _New_ and the Catalog, not from a
project's _Add a piece_, and its _Create piece_ replaces the open design.

Answers: save as a **catalog template** (a local family, ADR-034); **any** project piece can be saved, and the wizard
is added to _Add a piece_; the piece stays **linked** to the new template; the dialog asks **name, room and type**;
a wizard piece is **added to the project**; **full find-it** acceptance.

No change to `src/core/types.ts`: the link uses the existing `CatalogMeta.origin` (ADR-028), and templates use the
existing Dexie `templates` table (ADR-034). No `schemaVersion` bump.

## Decision

- **Save to catalog** on the selected-piece card in the project editor (Compose, and when drilled in, ADR-088). Not
  shown for display-only 3D models (ADR-076) or run parts.
- It opens a dialog: **Name** (default: the piece's name), **Room** and **Type** (the catalog's own room and function
  lists, defaults: the piece's template's values if it has one, else "other" / "storage"). **Save** is disabled while
  the name is blank.
- Save calls `templateFromDesign` (extended to take `rooms` and `function` from the dialog) with the piece's
  current design, stored through `useTemplates.save`. It always makes a **new** template (G-125).
- **Linked:** the project item's `design.catalog.origin` is set to the new template (`catalogId` = family id,
  `variantId`, `revision: 1`, `productName` = name, `takenAt` now). The card then reads "From _<name>_, revision 1"
  (ADR-096). One undo step (ADR-051) reverts the link; the template stays.
- The card confirms **Saved to the catalog** with a link **Open in Catalog**; the template shows in Catalog ›
  Templates under its room/type and in _Add a piece_ › Start from.
- **New piece, step by step** row in _Add a piece_ (both the dialog and the piece list beside the plan, ADR-094).
  It opens the wizard (ADR-044); in this mode the last button reads **Add to project**: the piece is still saved on
  this device (as today), then added to the project with `addPiece(design, savedId)` and selected. The open project
  stays open.
- Errors (blocked save, storage failure) show a message in the dialog; nothing is half-saved.

## Alternatives considered

- **Saved on this device only** — rejected by the user ("Catalog template").
- **Independent copy, no link** — rejected by the user ("Linked").
- **Wizard saves to the catalog in one step** — rejected by the user ("Added to the project").

## Scope

- In scope: the button and dialog, `templateFromDesign` rooms/type, the origin link, the wizard row and _Add to
  project_, tests, find-it.
- Out of scope: overwriting the template a piece came from (G-125); saving a group or several pieces as one item
  (G-126).

## Consequences

- Positive: a piece designed in context of the room becomes reusable in one tap.
- Negative / risks: an edited copy of a shipped item becomes a second, separate template; the original is untouched.
- Harder to change later: the origin link points to a local template id.

## Done when

- [ ] `templateFromDesign` with name, room and type gives a family with those values whose only variant deep-equals
      the piece's design without `catalog` (test).
- [ ] Saving a project piece stores one template and sets that item's `origin` to it with revision 1; undo removes
      the link and keeps the template; the other items are unchanged (store test).
- [ ] Wizard in project mode adds one item to the open project, saves the design, and keeps the project (test).
- [ ] Find-it from the bare app at 1440 and 390 px: open a project, select a piece, "Save to catalog", type a name,
      pick a room, "Save", see "Saved to the catalog", then Catalog › Templates lists the name.
- [ ] Find-it: in a project, "Add a piece" › "New piece, step by step" › "Add to project"; the project lists one more
      piece; no horizontal scroll at 390 px.

## Open questions

- None open; scope limits are recorded as G-125 and G-126.
