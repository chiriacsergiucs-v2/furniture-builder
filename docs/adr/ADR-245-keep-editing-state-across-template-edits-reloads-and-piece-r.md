# ADR-245: Keep editing state across template edits, reloads and piece renames

- Status: Pending
- Date: 2026-11-10
- Depends on: none
- Design: n/a
- Backlog: N253

## Context

Same request as [ADR-243](ADR-243-keep-locks-in-force-in-every-editing-flow.md). The flow map found state lost or
out of step while editing:

- Editing a template variant closed the open project; finishing the edit did not reopen it.
- "Change all copies" (ADR-111) was a session flag: on again after every reload.
- In the project editor the header field names the project, so a project piece could not be renamed in the UI.
- Opening another project did not forget the base of a piece-editor session (`projectBeforeEdit`).
- In the full piece editor, Edit history was offered while project undo is refused there.
- Placing a new piece by a tap made a second undo step after the one that added it.

## Decision

- `editTemplateVariant` keeps the open project, its undo history and session base; `finishTemplateEdit` restores
  them.
- "Change all copies" is remembered on this device (`localStorage` key `fb:link-all-off`, try/catch; on unless
  turned off).
- More actions gets "Rename…", which asks for the piece's name (`askText`) and renames that project piece.
- `openProject` clears `projectBeforeEdit`.
- Edit history is off in the full piece editor, with the title "Go back to the project to use its edit history".
- The placing tap amends the add step, as for a template (ADR-123).

## Alternatives considered

- **Save "Change all copies" in the project document** — it is a working preference, not part of the design
  (ADR-011); no schema change was wanted.
- **Make the header name the drilled piece** — the header would then name different things in the same view.

## Scope

- In scope: the store and UI changes above.
- Out of scope: the piece editor's own undo history still resets on leaving (ADR-231 keeps edits as project
  steps); a template saved to the catalog stays when its link is undone (the catalog is not project history).

## Consequences

- Positive: no lost project after a template edit; a setting the user turned off stays off.
- Negative / risks: one more `localStorage` key.

## Done when

- [x] Finishing a template edit gives back the open project and its undo history (`tests/editing-flows.test.ts`)
- [x] "Change all copies" is written to and read from this device (`tests/editing-flows.test.ts`)
- [x] Find-it: More actions → Rename… renames the piece at 390 and 1280 px (`tests/find-it/editing-flows.test.tsx`)
