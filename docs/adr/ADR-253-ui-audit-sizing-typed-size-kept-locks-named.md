# ADR-253: UI audit — Sizing: a typed size stays until it is valid, locks name what they lock

- Status: Pending
- Date: 2026-11-10
- Depends on: none
- Design: docs/ui-design.md
- Backlog: N262
- Acceptance: full

## Context

The user asked for a domain-by-domain UI audit (2026-11-10): map every sub-flow, find what breaks it, propose the
best fix, then cross-examine. This ADR is domain 06, **Sizing** (`src/ui/info/features.ts:441-485`). The full
sub-flow map (7 rows, entry → steps → end state, code and tests per row) and the evidence are in
[docs/research/ui-audit-06-sizing.md](../research/ui-audit-06-sizing.md).

Summary of the map: a piece's Width, Height and Depth are `PieceSize` (`src/ui/PieceSize.tsx`) in Compose with the
whole piece selected (`src/ui/Inspector.tsx:233-235`) and in a project's Selected piece card
(`src/ui/Project.tsx:414-432`); a group's are `GroupSize` (`src/ui/Selection.tsx:323-366`); locks are in the piece's ⋯
menu (`src/ui/Project.tsx:970-1037`). All use `MmField` (`src/ui/controls.tsx:14-108`) and are reachable at 390 and
1280 px.

## Findings

| Id     | Class  | Severity | Finding                                                                                                                                                       |
| ------ | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D06-F1 | Proven | major    | A size out of range is thrown away on blur or Enter and its error goes with it (`controls.tsx:52-59`); reproduced: 5000 → 600, no error, no message.          |
| D06-F2 | Proven | minor    | "Pieces differ", but typing the shown (largest) value sets nothing (`controls.tsx:53`, `groupSize.ts:71-91`); reproduced: 720 and 900, 900 → 0 changes.       |
| D06-F3 | Proven | minor    | Lock Height on a bed or Lock Depth on a panel: note " locked — unlock to change" with no axis, no field off (`Project.tsx:1017-1037`, `PieceSize.tsx:59-67`). |
| D06-F4 | Proven | minor    | The group's "Kept: …" message is a literal, English in Russian (`designStore.ts:2058`); the `t()` key exists (`ru/core2.ts:652`).                             |

## Decision

One rule for sizing: **what the user typed stays on screen until it is valid or they cancel it, and a lock names only
sizes the piece has.**

1. **F1:** `MmField` keeps an invalid draft after blur and Enter, with `aria-invalid` and "Whole number from {min} to
   {max}." until the user types a valid value or presses Escape, as `SizeShareField` does since ADR-199
   (`SizeShareField.tsx:41-57`). A valid value the store refuses still goes back to the stored value (ADR-199, test
   `piece-editor-inputs.test.tsx:112-132`). The − / + buttons step from the stored value and clear the draft.
2. **F2:** `MmField` gets an optional `commitSame` prop; `GroupSize` sets it for a field whose pieces differ, so
   committing the shown value sets every piece to it (one undo step, the existing `resizeGroup`).
3. **F3:** the ⋯ menu offers Lock {axis} only for the sizes `sizeFields` or `bedSizeFields` give the piece (core, no
   new rule); `PieceSize` names a bed's locked fields by their labels ("Mattress width locked — unlock to change") and
   shows no note when none of its fields is locked. Locks already stored on other axes stay and keep working.
4. **F4:** `designStore.resizeGroup` returns `t('Kept: {list}.', { list })`.

## Alternatives considered

- **F1: revert on blur but say "Not changed: …" in a status line** — still hides what was typed; ADR-199 chose to
  keep the draft.
- **F2: show the field empty when pieces differ** — then no value is shown at all and Enter on an empty field is
  invalid.
- **F3: keep the axis buttons and refuse with a message** — offers an action that does nothing for that piece.

## Scope

- In scope: F1–F4 as decided; tests for each.
- Out of scope: other `MmField` users get the F1 behaviour too (114 fields, `rg "<MmField" src/ui`); that is wanted
  (same rule everywhere) but each area's own wording is not reviewed here.

## Consequences

- Positive: a mistyped size is never lost silently; a group can be evened out to its largest size in one step; lock
  notes are always readable; the message is translated.
- Negative / risks: F1 changes a shared control: tests that expect an invalid draft to vanish on blur must change;
  a field left invalid keeps its error until fixed or Escaped.

## Done when

- [x] Out-of-range Width, then Enter or blur: the typed value and the field error stay, nothing changes; Escape restores the stored value (test).
- [ ] A group of a 720 and a 900 mm piece set to the shown 900 makes both 900 in one undo step (test).
- [ ] A bed's and a panel's ⋯ menus offer no Lock for a size they lack; a bed's width lock says "Mattress width locked" (test).
- [x] In Russian, resizing a group with a size-locked piece says "Сохранено: …" (test).
- [x] Find-it passes from the bare app at phone and desktop widths.

Evidence: tests/audit-typed-sizes.test.tsx, tests/find-it/audit-typed-sizes.test.tsx, tests/audit-extra.test.ts (run 2026-11-10 in the sandbox: the full suite and the files above pass).

## Cross-examination

One round, 2026-11-10. The skeptic checked each finding for duplicates (of each other and of ADR-248), for behaviour an
implemented ADR intends, for conflicts with the hard rules, for over-engineering and for missing tests.

| Id     | Skeptic                                                                                                                                   | Proposer                                                                                                                                                                                                                                                                                | Verdict  |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| D06-F1 | ADR-199 kept `MmField`'s reset on purpose (its comment says it shows the authoritative value); only split and drawer fields were changed. | That comment covers a _valid_ refused value (`controls.tsx:53-57`); the invalid branch (`:58`) is ADR-199's rejected alternative, "resetting on blur hides the mistake" (ADR-199 line 36), and breaks ADR-106 line 34. Not in ADR-248 (its F5 is `aria-invalid` on Fill wizard fields). | Accepted |
| D06-F2 | Over-engineering: type 901 then 900.                                                                                                      | Two undo steps and a hidden trick for the one action "Pieces differ" invites; the fix is one optional prop. Reproduced: 0 changes.                                                                                                                                                      | Accepted |
| D06-F3 | ADR-171 locks each of the three sizes one by one for any piece.                                                                           | ADR-171 locks a piece's sizes; a bed has no height field and a panel no depth (`pieceSize.ts:52-61,78-86`). Reproduced: an empty note and no field off. Stored locks stay valid, no data change.                                                                                        | Accepted |
| D06-F4 | Cosmetic.                                                                                                                                 | The translation rule is hard (CLAUDE.md, ADR-153); reproduced English in Russian; one line.                                                                                                                                                                                             | Accepted |

No question needs the user: every accepted fix follows an implemented ADR's rule (ADR-106, ADR-199, ADR-171, ADR-153).
Decided without asking: F1 applies to every `MmField`, not only the size fields.
