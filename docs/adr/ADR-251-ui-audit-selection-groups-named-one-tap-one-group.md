# ADR-251: UI audit — Selection and groups: groups named in the user's language, one tap makes one group

- Status: Pending
- Date: 2026-11-10
- Depends on: none
- Design: docs/ui-design.md
- Backlog: none
- Acceptance: full

## Context

The user asked for a domain-by-domain UI audit (2026-11-10): map every sub-flow, find what breaks it, propose the
best fix, then cross-examine. This ADR is domain 05, **Selection and groups** (`src/ui/info/features.ts:398-440`). The
full sub-flow map (8 feature lines, entry → steps → end state, code and tests per row) and the evidence are in
[docs/research/ui-audit-05-selection.md](../research/ui-audit-05-selection.md).

Summary of the map: one shared **Select** state (`multiSelect`) drives the Pieces list, the plan, the front view and
the 3D view (`src/ui/Project.tsx:294,1864,2698`, `src/viewer/Viewer3D.tsx:704-713`); Shift/Ctrl/Cmd-click and
Ctrl/Cmd+A work on a desktop (`src/ui/App.tsx:529-536`); a drag on empty plan or front view draws a selection box;
several selected pieces show the selection card with **Group** / **Ungroup** (`src/ui/Selection.tsx:19-196`) and the
project lists its groups (`Selection.tsx:369-411`). All are reachable at 390 px (with Select on) and 1280 px.

[ADR-246](../adr-done/ADR-246-ask-before-an-edit-drops-contents-and-hold-the-assistant-to.md) made 3D models part of
the selection (Ctrl+A, a click). Grouping and the selection box were not brought along, and a group's name is written
in English whatever the app language.

## Findings

| Id     | Class      | Severity | Finding                                                                                                                                     |
| ------ | ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| D05-F1 | Proven     | major    | New groups are named "Group N" in English and shown untranslated in the Russian UI (`selection.ts:196-201`, `Selection.tsx:48,52,392,400`). |
| D05-F2 | Proven     | minor    | Group on one piece and a 3D model does nothing and says nothing; the card says "2 pieces selected" (`Selection.tsx:39,103-107`).            |
| D05-F3 | Proven     | minor    | A double tap on Group groups and then ungroups: the buttons swap in place (`Selection.tsx:98-107`); reproduced: 0 groups, 2 undo steps.     |
| D05-F4 | Proven     | minor    | The plan and front-view selection boxes never take a 3D model (`selection.ts:249-254,272-277`), though a tap and Ctrl+A do (ADR-246).       |
| D05-F5 | Rejected   | polish   | The 3D view's Select has no About Select ⓘ (`Viewer3D.tsx:704-713`); see Cross-examination.                                                 |
| D05-F6 | Needs user | minor    | No control renames a group (not found in the repo; `groupItems` takes a name no caller passes, `selection.ts:207-211`); see Open questions. |

## Decision

One rule for the selection: **what the user selected is what the action takes, a tap does one thing, and every name
the app writes is in the user's language.**

1. **F1:** `nextName` (`src/core/selection.ts`) writes `t('Group {n}', { n })` with its Russian entry ("Группа {n}") and
   counts the names already taken in that form. Saved groups keep their stored names (ADR-011: saved designs are not
   rewritten).
2. **F2:** **Group** shows only while two or more pieces are selected; models in the selection are left out of the
   group and the card says "3D models are not grouped." (`role="status"`). With pieces and models selected, the card
   names both: "{p|# piece|# pieces} and {m|# 3D model|# 3D models} selected". Both texts through `t()` with Russian
   entries; the find-it regexes that read "N pieces selected" for pieces only stay valid.
3. **F3:** **Group** and **Ungroup** on the card and in the Groups list ignore a click whose `detail` is above 1 (the
   second click of a double tap); a keyboard press (`detail` 0) still works.
4. **F4:** `itemsInBox` and `itemsInFrontBox` also return placed 3D models whose box the rectangle touches (plan
   footprint and front extent from the project model's `models[].box`), after the pieces. Core only; no
   `src/core/types.ts` change.
5. **F5:** no change (rejected in the cross-examination).

## Alternatives considered

- **F1: translate stored names at display (`tr(g.name)`)** — works only for the exact stored text "Group 1"; numbers
  and renamed groups would not match.
- **F3: an in-flight ref as ADR-247 used** — the action is synchronous; there is nothing in flight, the second click
  is a new event.
- **F3: Ungroup in another place on the card** — moves a control users already know; `detail` is one line.
- **F4: keep boxes for pieces only** — the front view already builds the models' boxes for the box
  (`Project.tsx:2523-2530`) and then drops them.

## Scope

- In scope: F1–F4 as decided; tests for each.
- Out of scope: renaming a group (open question); grouping 3D models (ADR-097 groups pieces); the 3D Select tip
  (rejected).

## Consequences

- Positive: groups read in the app's language; the box, a tap and Ctrl+A select the same kinds of things.
- Negative / risks: a project with groups made in both languages may hold "Group 1" and "Группа 1"; numbering counts
  each form apart. A box over a fridge now selects it, so a box move also moves models (as Ctrl+A already does).

## Done when

- [ ] In Russian, Group names the new group "Группа 1"; saved names are unchanged (test).
- [ ] With one piece and a 3D model selected, Group is not offered; with two pieces and a model it groups the pieces and says so (test).
- [ ] A double tap on Group leaves one group and one undo step; Enter on Group still groups (test).
- [ ] A plan box and a front-view box over a 3D model select it (core test).
- [ ] Find-it test passes from the bare app at phone and desktop widths.

## Cross-examination

One round, 2026-11-10. The skeptic checked each finding for duplicates (of each other and of ADR-247), for behaviour
an implemented ADR intends, for conflicts with the hard rules, for over-engineering and for missing tests.

| Id     | Skeptic                                                                                        | Proposer                                                                                                                                                                                               | Verdict             |
| ------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| D05-F1 | A group name is stored data, like a project name; the translation rule is for app text.        | The user never typed it: the app wrote it, and nothing lets the user change it. Other app-made names are written through `t()` (`Dialogs.tsx:732`). Reproduced: "Group 1" twice on a Russian screen.   | Accepted            |
| D05-F2 | 3D models are display only (ADR-076); grouping them was never promised.                        | Agreed, so the fix does not group them; it stops offering a button that silently does nothing. Ctrl+A takes models since ADR-246 lines 33-34, so a mixed selection is the common case.                 | Accepted            |
| D05-F3 | Undo brings the group back; polish.                                                            | Two undo steps and no group, with nothing on screen saying why; the one-tap rule of ADR-247 (F1, F4) covers it. Reproduced with `user.dblClick`.                                                       | Accepted            |
| D05-F4 | ADR-097 and ADR-211 say the box takes "every piece"; models are not pieces.                    | ADR-246 brought models into the selection for a tap and Ctrl+A; the front view already hands the models' boxes to the box (`Project.tsx:2523-2530`). Reproduced in core: a box over a fridge is empty. | Accepted            |
| D05-F5 | ADR-211 item 8 gave the tip to "the three Select toggles"; the 3D button has its own `title`.  | The feature line says "each Select", but the implemented ADR chose three; the feature tree changes only when the user asks (CLAUDE.md, user 2026-11-07).                                               | Rejected            |
| D05-F6 | "Named groups" with a fixed number is still named; a rename field is a new feature, not a bug. | ADR-097 never specified renaming; whether to add one is the user's choice.                                                                                                                             | Needs user decision |

No physical-fact question arose. Decided without asking: models stay out of groups (ADR-097, ADR-076).

## Open questions

- **D05-F6:** Should a group be renameable? Options: (a) a Name field on the group's selection card; (b) the name is
  asked when Group is tapped, "Group N" prefilled; (c) no rename, the number is enough. Suggested: (a), not applied.
