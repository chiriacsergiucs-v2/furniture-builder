# ADR-257: UI audit — Room and walls: name the field, one tap one corner, names in the user's language

- Status: Pending
- Date: 2026-11-10
- Depends on: none
- Design: docs/ui-design.md
- Backlog: N266
- Acceptance: full

## Context

The user asked for a domain-by-domain UI audit (2026-11-10): map every sub-flow, find what breaks it, propose the
best fix, then cross-examine. This ADR is domain 10, **Room and walls** (`src/ui/info/features.ts:785-859`). The full
sub-flow map (14 feature lines, entry → steps → end state, code and tests per row) and the evidence are in
[docs/research/ui-audit-10-room.md](../research/ui-audit-10-room.md).

Summary of the map: every room sub-flow starts in the project's Compose panel → Room (`src/ui/Project.tsx:3220-3409`):
Add the room or Draw the room, then the fold with Shape, sizes, Room height, Walls (each with its background,
`WallBackground.tsx`), Floor background and Plan picture (`RoomSurfaces.tsx`), and the doors, windows, obstacles,
pipes and outlets (`RoomFeatures.tsx`). Clearances are set on the selected piece (`Clearances.tsx`) and drawn with
Clear. on the plan. All are reachable at 390 and 1280 px.

ADR-193 made Fill the room name a wrong room size at its field (`checkRoomSizes`, `room.ts:246-283`). The project's
own Room section, where the same sizes are typed, does not; and the room checks name generated door and window labels
in English in a Russian app (ADR-156).

## Findings

| Id     | Class        | Severity | Finding                                                                                                                                                      |
| ------ | ------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D10-F1 | Proven       | major    | Room → L-shape → Cut-out width 3000 says "Wall 5 has no length.", the field is not `aria-invalid` (`Project.tsx:3243,3326-3346`); reproduced at both widths. |
| D10-F2 | Proven       | minor    | Room problems name features in English in Russian (`room.ts:555-641`): "Door 1 выходит на 600 мм за конец стены 4 …".                                        |
| D10-F3 | Proven       | minor    | Add door, Add door, remove Door 1, Add door gives "Door 2" twice (`RoomFeatures.tsx:29`).                                                                    |
| D10-F4 | Proven       | minor    | A double tap while drawing adds the same corner twice → "Room: Wall 2 has no length." (`designStore.ts:1911-1920`).                                          |
| D10-F5 | Proven       | polish   | Two Set the scale taps on one spot end the scale mode and say nothing (`designStore.ts:1953-1957`).                                                          |
| D10-F6 | Code-evident | polish   | Floor picture input is named "Add a picture for the floor" while it reads Replace picture; a dropped floor picture is not said (`RoomSurfaces.tsx:226,273`). |

## Decision

One rule for the room: **a wrong value is named at the field where it was typed, one tap adds one thing, and every
name in a message is in the user's language.**

1. **F1:** `RoomSection` runs `checkRoomSizes(shape, shown, room.height)` for a ready shape and shows each issue under
   its field as the field's error (`aria-invalid`, `aria-describedby`, `role="alert"`), as Fill the room does
   (`RoomFill.tsx:369`, ADR-193); the outline is still set, so the room problems stay (never a clamp, ADR-008). The
   wall-level `outlineIssues` hints stay for drawn rooms.
2. **F2:** the room checks pass `tr(f.label)` for every feature name (`room.ts:555,567,574,619,628,641,751,765`), as
   `build.ts` and `shape.ts` do for part labels. Codes and severities do not change.
3. **F3:** `newFeature` numbers a new feature with the lowest number its kind does not use yet.
4. **F4:** `addRoomCorner` ignores a corner equal to the last one (it adds no wall); the banner count stays.
5. **F5:** a second scale tap on the first tap's pixel keeps Set the scale on, waiting for a different point, and the
   banner adds "Tap a different point." (`t()` with its Russian entry).
6. **F6:** the floor's file input is named "Replace picture for the floor" once a picture is set (new `t()` key with
   its Russian entry); a floor picture dropped because the choice changed says the wall's sentence adapted to the
   floor: "The prepared picture was not applied because the floor background changed." (`t()` with its Russian entry).

## Alternatives considered

- **F1: clamp the cut-out to the room's width** — refused by ADR-008; the value would change without the user.
- **F1: refuse the edit in `MmField` with a dynamic max** — the bound would change with another field, and the message
  "Whole number from 100 to 2999." would not say why.
- **F3: let the user rename features** — useful, but a new control; the number fix removes the clash now.
- **F4: an Undo last corner button in the banner** — helps any wrong tap; can come on top, it does not stop the double
  tap.

## Scope

- In scope: F1–F6 as decided; tests for each.
- Out of scope: renaming room features; Undo last corner while drawing (not asked); keyboard drawing (Add the room and
  wall lengths already reach every outline, ADR-059).

## Consequences

- Positive: the Room section and Fill the room judge sizes alike; Russian room problems read in Russian.
- Negative / risks: F1 shows a size error and the wall hint together for one wrong size; the field error comes first.
  `tests/i18n.test.ts` and room tests that match English messages in Russian need the translated label.

## Done when

- [x] Room → L-shape → Cut-out width 3000 marks that field `aria-invalid` with "Cut width 3000 mm must be less than the width, 3000 mm." (find-it, 390 and 1280).
- [x] With Russian chosen, a door past its wall's end gives a message that starts "Дверь 1" (core test).
- [x] Add door, Add door, remove Door 1, Add door gives Door 2 and Door 1, no repeat (unit test).
- [x] Two taps on one spot while drawing add one corner; closing the room gives no "has no length" problem (store test).
- [ ] Two scale taps on one pixel keep Set the scale on and show "Tap a different point." (store test + find-it).
- [ ] The floor's file input is named "Replace picture for the floor" with a picture set; a dropped floor picture is said, in English and Russian (test).
- [x] Find-it test passes from the bare app at phone and desktop widths.

Evidence: tests/audit-room.test.ts, tests/find-it/audit-room.test.tsx, tests/room-surfaces.test.ts (run 2026-11-10 in the sandbox: the full suite and the files above pass).

## Cross-examination

One round, 2026-11-10. The skeptic checked each finding for duplicates (of other findings and of ADR-248), for
behaviour an implemented ADR intends, for conflicts with the hard rules, for over-engineering and for missing tests.

| Id     | Skeptic                                                                                                | Proposer                                                                                                                                                                                                                                             | Verdict  |
| ------ | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| D10-F1 | The problem is shown, not hidden (ADR-008); ADR-193 was scoped to the New… flows. Duplicate of D01-F5? | ADR-193's stated outcome is "wrong sizes named where typed" (ADR-193 line 75) and its checker exists; while the outline is wrong every room check is skipped (`room.ts:537-547`). D01-F5 covers Fill a wall and Fill the room, not the project Room. | Accepted |
| D10-F2 | Feature labels are user data and stay as typed.                                                        | They are generated defaults that the UI cannot edit (`RoomFeatures.tsx:11-18,81-198`), and the UI already shows them with `tr()` (`Project.tsx:2440-2480`); ADR-156 asks for Russian problem messages. Reproduced.                                   | Accepted |
| D10-F3 | Cosmetic.                                                                                              | Two fieldsets with one accessible name and two identical problem messages ("Door 2 runs … past the end") cannot be told apart. One-line change; reproduced.                                                                                          | Accepted |
| D10-F4 | Dropping a tap is ignoring input (ADR-008).                                                            | A corner equal to the last one adds no wall; ADR-008 forbids changing a value, not skipping a repeat. Without it the result is a room error and a full redraw. Reproduced in the store.                                                              | Accepted |
| D10-F5 | The store comment says keeping the old scale is intended (`designStore.ts:1955`).                      | Keeping the old scale is intended; ending the mode without a word is not stated by ADR-208 item 5. Waiting for a different point keeps the intent and tells the user.                                                                                | Accepted |
| D10-F6 | Polish, two different things.                                                                          | Both are the floor copy of the wall picker (ADR-208 item 2 "reuses … the wall finish … picker") drifting from it; a name that differs from the visible text fails label-in-name. One small change each.                                              | Accepted |

No question needs the user: every accepted fix follows an implemented ADR's rule (ADR-008, ADR-156, ADR-193, ADR-208).
Decided without asking: F5 waits for a different point instead of ending; F3 reuses the lowest free number.
