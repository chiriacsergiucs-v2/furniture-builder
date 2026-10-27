# ADR-111: Linked copies of a piece in a project: change one, all change

- Status: Pending
- Date: 2026-10-27
- Depends on: ADR-069, ADR-088, ADR-106
- Design: docs/ui-design.md (project editor, selected-piece card)
- Backlog: N110
- Acceptance: light
- Agreed: answers 2026-10-27: "Explicit linked copies", "Any piece", "Toggle on the card", "Light (ADR-066)",
  "Add a linked copy", "Whole design"

## Context

The user asked (2026-10-27): "Implement new adr to: use a piece, a item created by the user, added to the project,
added multiple times, and give the possibility to bulk update the width/height/drawers, just like it would be 1
piece, with 2 symlinks to it, change to 1 changes all the other, including internal, and it should be propagated
further to the ones in the 100% same." It replaces an earlier request the same day to update the original template
and its copies (recorded as G-137).

Today each project item embeds its own copy of a design (ADR-022). Duplicate (ADR-069) makes an independent copy;
editing a drilled-in piece (ADR-088) or its width and depth (ADR-106) changes that item only.

Answers: copies are linked **explicitly** (a stored link, not by comparing designs); **any** piece can be linked;
a **toggle on the card** decides whether an edit goes to all copies; linked copies are made with **Add a linked
copy**; the **whole design** is shared; **light** acceptance.

This changes the project document (`src/core/project.ts`, ADR-011): a new optional field and a `schemaVersion` bump.

## Decision

- **Storage:** `ProjectItem.linkId?: string`. Items with the same `linkId` in one project are linked copies.
  `PROJECT_SCHEMA` 8 → 9; projects of versions 1–8 still load (no `linkId` = not linked). Project templates
  (ADR-060) and project files keep the field; imported projects get a new `linkId` per group, consistently.
  Validation drops a `linkId` that is not a non-empty string.
- **Shared:** the whole `design` (size, interior, drawers, doors, boards, name). Each copy keeps its own id,
  position, rotation, placement, quantity, lock and `templateSeen`.
- **Add a linked copy** on the selected-piece card: places a copy as Duplicate does (ADR-069) and gives both the same
  `linkId` (the original's, or a new one). One undo step.
- **Card:** a linked piece shows **Linked: N copies** and a switch **Change all copies**, on by default (UI state,
  not saved).
- **Edits:** every store write of a project item's design (drilled-in edits ADR-088, the editor, width and depth
  ADR-106, quick counts ADR-084/ADR-109, Replace ADR-098) goes through one pure function
  `applyLinked(project, itemId, design, all)` in `src/core`. With the switch on it sets that design on every item with
  the same `linkId`; with it off it sets it on this item and removes its `linkId`. A group left with one item loses
  its `linkId`. One undo step per edit.
- Diagnostics, the cut list and the hardware schedule are unchanged: each copy is still a placed item.

## Alternatives considered

- **Link pieces whose designs are 100% identical, no stored link** — rejected by the user ("Explicit linked
  copies"); kept as G-136.
- **Always change all copies; an Unlink button** — rejected by the user ("Toggle on the card").

## Scope

- In scope: `linkId` and the schema bump, Add a linked copy, the card line and switch, `applyLinked` on every design
  write, undo, save and reload, tests.
- Out of scope: linking existing identical pieces, Duplicate or re-adding the same item making linked copies (G-136);
  propagation to templates, other projects or saved designs (G-137).

## Consequences

- Positive: one change to a reused piece reaches its copies, inside too.
- Negative / risks: a design write that bypasses `applyLinked` would split a group silently; the store test covers
  each write path.
- Harder to change later: `linkId` is in saved projects.

## Done when

- [ ] `applyLinked`: switch on changes every copy's design and nothing else; switch off changes one copy and unlinks
      it; a group of one loses its `linkId` (unit tests).
- [ ] Add a linked copy, then width (ADR-106), a drawer count and a drilled-in shelf change on one copy reach the
      other; undo reverts both in one step (store test).
- [ ] Projects of schemaVersion 8 load unlinked; `linkId` survives save and reload, project templates and file
      export/import (storage test).
- [ ] Find-it (light — catch-up): "Add a linked copy", "Linked: 2 copies", "Change all copies".

## Open questions

- None; out-of-scope items are G-136 and G-137.
