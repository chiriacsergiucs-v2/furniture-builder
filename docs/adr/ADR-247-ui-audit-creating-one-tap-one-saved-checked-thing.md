# ADR-247: UI audit — Creating: one tap makes one saved thing, checked against what is there

- Status: Pending
- Date: 2026-11-10
- Depends on: none
- Design: docs/ui-design.md
- Backlog: none
- Acceptance: full

## Context

The user asked for a domain-by-domain UI audit (2026-11-10): map every sub-flow, find what breaks it, propose the
best fix, then cross-examine. This ADR is domain 01, **Creating** (`src/ui/info/features.ts:29-118`). The full
sub-flow map (14 feature lines, entry → steps → end state, code and tests per row) and the evidence are in
[docs/research/ui-audit-01-creating.md](../research/ui-audit-01-creating.md).

Summary of the map: every creation path starts from ⋯ More → New… (`src/ui/Dialogs.tsx:148-292`), the Catalog's
New piece (`src/ui/CatalogPage.tsx:285`), the Projects page (`src/ui/shell/ProjectsPage.tsx:108-115,262`, project
templates `src/ui/ProjectTemplates.tsx:375-410`), a project's Add a piece (`src/ui/Project.tsx:2934-2990`) or ⋯ →
Fill the room… (`src/ui/shell/MoreMenu.tsx:144-149`). All are reachable at 390 and 1280 px.

ADR-193 already settled two rules for one row of the New dialog: a new project is saved before it opens and a
failure is said, and a double tap makes one project (`Dialogs.tsx:177-200`). Four other creation paths do not keep
them, and one "checked" suggestion is not checked against the open project.

## Findings

| Id     | Class        | Severity | Finding                                                                                                                                                               |
| ------ | ------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D01-F1 | Proven       | major    | A double tap on a room preset makes two projects (`Dialogs.tsx:303-313`); reproduced: 2 projects.                                                                     |
| D01-F2 | Proven       | major    | Projects page Create project opens the project and ignores a failed save (`ProjectsPage.tsx:108-115`); reproduced: editor open, no alert, unhandled rejection.        |
| D01-F3 | Proven       | major    | Add this mix appends the mix on top of the project's pieces (`designStore.ts:1814-1821`, mixes checked alone, `roomfill.ts:906-909`); reproduced: 32 overlap errors.  |
| D01-F4 | Proven       | major    | Wizard Create piece / Add to project double tap saves two pieces (`Wizard.tsx:799-827`); reproduced: 2 designs.                                                       |
| D01-F5 | Proven/Code  | minor    | Named problems whose field is not marked invalid: Fill a wall tall height and wall depth (proven), Fill the room walkway and budget ceiling (`RoomFill.tsx:653-698`). |
| D01-F6 | Code-evident | minor    | Fill the room… is inside the More menu's Files group (`MoreMenu.tsx:121-149`).                                                                                        |
| D01-F7 | Code-evident | minor    | The room preset error outlives the dialog and uses other wording than the row above (`Dialogs.tsx:196,300-303`).                                                      |
| D01-F8 | Code-evident | minor    | The wizard's draft offer has buttons and no sentence (`Wizard.tsx:862-875`).                                                                                          |
| D01-F9 | Suspected    | minor    | A draft started in one project resumes elsewhere with that project's board answer (`Wizard.tsx:701-711,756-758`).                                                     |

## Decision

One rule for every creation path: **one tap makes one thing, it is saved before it opens, a failure is said where
the user tapped, and a mix said to be checked is checked against what it is added to.**

1. **F1:** `RoomPresets` gets the ADR-193 guard (a `saving` ref, cleared on failure) and keeps the made project in a
   ref, as `ProjectTemplates.tsx:389-392` does, so a retry saves the same project.
2. **F2:** `ProjectsPage.create` awaits `saveProject` before `openProject`; on failure it opens nothing and shows
   "The project could not be saved in this browser’s storage." in the page message (`setMsg`), the same text as
   ADR-193.
3. **F3:** `suggestRoomMixes` takes the open project's items (`existing`, optional, `src/core/roomfill.ts`); with
   them, each mix is checked as `existing + mix` and kept only when it adds no error. When every mix is refused for
   that reason, the dialog says "No mix fits beside the pieces already in this project. Untick the walls that are
   already filled." Core only, no `src/core/types.ts` change; `RoomFill.tsx` passes the items in add mode.
4. **F4:** `Wizard.create` gets an in-flight ref; the primary button is disabled while it saves.
5. **F5:** pass `problem` to Fill a wall's tall height and wall depth fields; give the `room-island` issue the field
   `walkway` and map it; mark Budget ceiling `aria-invalid` while it is not an amount.
6. **F6:** move Fill the room… out of the Files group to right under New…, outside any group.
7. **F7:** clear the preset error each time the New dialog opens; use the ADR-193 sentence.
8. **F8:** add the sentence "You have a draft of a new piece from earlier in this session." before the two buttons
   (`t()` with its Russian entry).
9. **F9:** no change until reproduced; FLOW 02 decides.

## Alternatives considered

- **F3: warn after adding instead of filtering** — the error would show, but the card's "each checked for problems"
  would still be untrue, and undo would be the only way back.
- **F3: untick filled walls by default** — helps, but a partly filled wall would still overlap; can come on top.
- **F1/F4: disable the button only** — a keyboard Enter and a fast second pointer event can still pass before the
  render; the ref is what makes it one.

## Scope

- In scope: F1–F8 as decided; tests for each.
- Out of scope: Fill a wall adding into an open project (not asked); persisting the wizard draft past the session
  (ADR-211 chose the session).

## Consequences

- Positive: the same save-and-say rule on every creation path; add-mode mixes are honest.
- Negative / risks: F3 builds each mix with the project's pieces, so add mode is slower for large projects; the
  room-fill timing check is already deferred (ADR-242).

## Done when

- [ ] A double tap on a room preset makes one project; a failed save says the ADR-193 sentence and opens nothing (test).
- [ ] Projects page Create project with a failing save opens nothing, says the sentence, and leaves no unhandled rejection (test).
- [ ] In a filled room, Add this mix offers no mix that overlaps the project's pieces, and says so when none fits (core test + find-it).
- [ ] A double tap on Create piece and on Add to project saves one piece and adds one (test).
- [ ] Wrong tall height, wall depth, walkway and budget ceiling mark their fields `aria-invalid` and point to the problem (test).
- [ ] Fill the room… is not inside the Files group of the More menu (find-it).
- [ ] The preset error is gone on the next opening and the draft offer has its sentence, in English and Russian (test).
- [ ] Find-it test passes from the bare app at phone and desktop widths.

## Open questions

- F9: reproduce in FLOW 02; if real, keep the draft's origin or drop a board answer that is not offered.
