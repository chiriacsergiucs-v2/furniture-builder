# ADR-248: UI audit — Composition: ask before any edit drops contents, and fill in no appliance size

- Status: Pending
- Date: 2026-11-10
- Depends on: none
- Design: docs/ui-design.md
- Backlog: none
- Acceptance: full

## Context

The user asked for a domain-by-domain UI audit (2026-11-10): map every sub-flow, find what breaks it, propose the
best fix, then cross-examine. This ADR is domain 02, **Composition** (`src/ui/info/features.ts:120-238`). The full
sub-flow map (19 feature lines, entry → steps → end state, code and tests per row) and the evidence are in
[docs/research/ui-audit-02-composition.md](../research/ui-audit-02-composition.md).

Summary of the map: every space edit goes through the space editor (`src/ui/Inspector.tsx:413-655`), shown in
Compose and, in a project, under "Inside this piece" (`src/ui/Project.tsx:445-456`); the quick-count card
(`src/ui/CountStepper.tsx`) sits on the drawing, over 3D and over the project front view; the whole-inside bays are in
Settings (`Inspector.tsx:1943-1997`). All are reachable at 390 and 1280 px.

ADR-246 settled that an edit that drops contents asks first, only when something would be lost (`holdsSomething`).
Two paths that drop contents do not ask. ADR-036 settled that the app never defaults appliance niche sizes; the niche
toggle does.

## Findings

| Id     | Class        | Severity | Finding                                                                                                                                                        |
| ------ | ------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D02-F1 | Proven       | major    | The quick count's "Fewer … dividers" removes the last part with its contents and asks nothing (`counts.ts:98-109`); reproduced: 3 drawers gone, 0 dialogs.     |
| D02-F2 | Proven       | major    | The niche toggle sets Oven and caps height and depth at 590 and 550 mm (`Editors.tsx:205-214`); reproduced: 514×590×432 "as entered" in a 684 mm high opening. |
| D02-F3 | Proven       | minor    | "Apply a layout from the catalog" replaces a space's contents with no question (`Editors.tsx:279-285`); reproduced: 3 drawers became a shelf, 0 dialogs.       |
| D02-F4 | Proven       | minor    | Esc inside a drilled project piece clears the piece instead of going up one level (`App.tsx:541-545`); reproduced: drill and "Inside this piece" gone.         |
| D02-F5 | Rejected     | —        | On a phone "Up one level" and "Select the divided space around this one" go to different levels (`Inspector.tsx:382-391,647-651`); see Cross-examination.      |
| D02-F6 | Code-evident | —        | The sink-trap notch starts at 250 × 200 mm (`Inspector.tsx:559-565`); a physical-fact default, kept by the user (User decision).                               |

## Decision

One rule for the space editor: **an edit that drops contents asks first wherever it is made, and no size is filled in
that the user did not type or the model did not measure.**

1. **F1:** the quick count's "−" on Vertical or Horizontal dividers asks the ADR-246 question "Remove the last parts
   and what is in them?" (Remove, danger, Cancel first) when the part it removes `holdsSomething`; an empty last part
   still goes in one tap. The question lives in `CountStepper` (it is UI); `stepCount` stays pure. The same card is
   used on the drawing, over 3D and over the project front view, so all three get it.
2. **F2:** the toggle starts the niche at the space's own opening size (`opening.box`, measured by the model) and the
   kind **Other**; the 590/550 caps and the `?? 560/590/550` fallbacks go. With no opening the toggle stays off. A
   stored "not yet typed" flag, so the hardware line stops saying "as entered" before a size is typed, is a model
   change and out of scope.
3. **F3:** `LayoutPicker` asks "Replace what is in this space with {name}?" (confirm Replace) when the space
   `holdsSomething`; the tip drops "Undo brings it back." New text through `t()` with its Russian entry.
4. **F4:** in a project with a drilled piece, Esc with a space selected inside it selects `parentOf` (as in the piece
   editor, ADR-203 item 8); only when the whole piece is the selection does Esc clear the project selection.
5. **F5:** no change (rejected in the cross-examination).
6. **F6:** no change; the user kept 250 × 200 (User decision).

## Alternatives considered

- **F1/F3: rely on undo** — ADR-246 rejected it: "the user is not told anything was lost".
- **F1: make "−" remove the first empty part instead** — changes which bay goes, against ADR-086 (the last bay goes).
- **F2: empty niche fields and an error until typed** — the honest version of ADR-036, but `appliance.w/h/d` must be
  whole numbers today (`src/core/design.ts:1022-1034`), so it needs a model change and its own ADR.
- **F4: leave Esc as "clear" in the project** — the drill is the main piece editor since ADR-241, so one key would
  keep two meanings for the same panel.

## Scope

- In scope: F1–F4 as decided; tests for each.
- Out of scope: F2's stored "not yet typed" flag (model change).

## Consequences

- Positive: the ADR-246 rule holds on every control that drops contents; no appliance size is invented (ADR-010).
- Negative / risks: one more tap when the quick count removes a filled bay; `tests/find-it/count-stepper.test.tsx`
  and `tests/counts.test.ts` are unaffected (they add drawers), any test that removes a filled bay with the card must
  answer the question.

## Done when

- [ ] Quick count "Fewer vertical dividers" on a filled last part asks, Cancel keeps it, Remove removes it; on an empty last part it does not ask (test).
- [ ] The niche toggle starts at the opening's width, height and depth and kind Other; no 590 or 550 appears (test).
- [ ] Applying a catalog layout to a space with contents asks first and Cancel changes nothing, in English and Russian (test).
- [ ] Esc with a space selected inside a drilled project piece selects the space around it and keeps the piece (test).
- [ ] Find-it test passes from the bare app at phone and desktop widths.

## Cross-examination

One round, 2026-11-10. The skeptic checked each finding for duplicates, for behaviour an implemented ADR intends, for
conflicts with the hard rules, for over-engineering and for missing tests.

| Id     | Skeptic                                                                                                                | Proposer                                                                                                                                                                                                                      | Verdict                             |
| ------ | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| D02-F1 | ADR-084/086 made the card one tap; ADR-246 cites the quick count only as the model for keeping the first bay.          | ADR-246 Decision covers "a lower part count"; the card removes a part like Parts −, which asks. The question comes only when something is lost, so the one-tap path stays for empty bays. Reproduced: 3 drawers, 0 dialogs.   | Accepted                            |
| D02-F2 | The user must check every size anyway (the guidance tip, `Editors.tsx:226-231`); a start value is convenience.         | ADR-036 lines 26-28 and 43 forbid default niche sizes as an ADR-010 breach; 590 matches neither the opening (684) nor any drawing, and the hardware line calls it "as entered". The opening's size is measured, not invented. | Accepted                            |
| D02-F3 | Applying a catalog layout is an explicit replace, and the tip says so.                                                 | The tip says undo restores it, the reason ADR-246 rejected; Bays and shelves asks for the same replace (`Inspector.tsx:1946-1953`). Asked only when the space holds something.                                                | Accepted                            |
| D02-F4 | ADR-097 says Esc clears in a project; ADR-203 scoped "up one level" to the piece editor.                               | ADR-241 moved piece editing into the project's drill; the same space editor and crumbs then answer Esc two ways. Esc still clears when the whole piece is selected, so ADR-097 holds. Reproduced.                             | Accepted                            |
| D02-F5 | ADR-211 made "Up one level" match Esc on purpose; the link names its target, and the crumbs show and reach "Interior". | The two sit in one panel and differ from a top part (reproduced).                                                                                                                                                             | Rejected                            |
| D02-F6 | 250 × 200 is the catalog's own sink-base value, and the field says to measure.                                         | Whether a notch size may start filled in is a physical-fact default (ADR-010); not ours to decide.                                                                                                                            | Rejected (user kept it, 2026-11-10) |

No finding moved to another domain. Decided without asking: F2 starts at the opening's measured size and kind Other;
the stored "not yet typed" flag is left for a model ADR.

## User decision (2026-11-10)

- **D02-F6:** Keep 250 × 200 with the "Measure your trap and pipes" hint (today). No change; the finding is closed.
