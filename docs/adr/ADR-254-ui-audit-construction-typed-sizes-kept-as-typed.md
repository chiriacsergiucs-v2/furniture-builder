# ADR-254: UI audit — Construction: a typed size is kept as typed or refused out loud

- Status: Pending
- Date: 2026-11-10
- Depends on: none
- Design: docs/ui-design.md
- Backlog: N263
- Acceptance: full

## Context

The user asked for a domain-by-domain UI audit (2026-11-10): map every sub-flow, find what breaks it, propose the
best fix, then cross-examine. This ADR is domain 07, **Construction** (`src/ui/info/features.ts:486-638`). The full
sub-flow map (43 feature lines in five groups, entry → steps → end state, code and tests per row) and the evidence are
in [docs/research/ui-audit-07-construction.md](../research/ui-audit-07-construction.md).

Summary of the map: carcass, front, drawer and furniture-kind choices are in a piece's Settings (`src/ui/Settings.tsx:64-72`,
`src/ui/Inspector.tsx:997-1705`, `src/ui/Editors.tsx:42-930`); space fronts and handles in Compose
(`Inspector.tsx:413-655`); kitchen-run parts, handles, sinks, hobs and corners in the project
(`src/ui/Project.tsx:251,3102,3176-3178`, `src/ui/RunRequests.tsx`). All are reachable at 390 and 1280 px.

ADR-199 settled how a size field treats wrong input for split and drawer sizes: keep the text, say what is wrong,
`aria-invalid`, Enter commits once, Escape cancels. The shared `MmField` that carries nearly every Construction size,
and four other fields, do not keep that rule; one of them turns a decimal into a ten-times-larger size.

## Findings

| Id     | Class       | Severity | Finding                                                                                                                                                                |
| ------ | ----------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D07-F1 | Proven      | major    | "." and "," are stripped while typing (`controls.tsx:81`, `RunRequests.tsx:556,592,656`, `Clearances.tsx:58`); reproduced: "2.5" saved as 25, "10,5" as 105.           |
| D07-F2 | Proven      | minor    | Out-of-range text and its error vanish on blur and the old value returns, unsaid (`controls.tsx:52-59`); reproduced at both widths.                                    |
| D07-F3 | Proven/Code | minor    | Runner lengths you can buy drops wrong entries silently and keeps unsaved text shown (`Inspector.tsx:1284-1295`); loose-panel Name the same (`:1586-1597`).            |
| D07-F4 | Proven      | minor    | Doubled, then Two rails: warning `top-layers-rails` about the hidden Top layers control (`Inspector.tsx:1099-1116`, `cabinet.ts:384-388`). Accepted (user 2026-11-10). |
| D07-F5 | Proven      | minor    | Corner Type › Diagonal replaces drawers with one shelf and a door without asking (`Inspector.tsx:1352-1366`); every other replacement asks.                            |

## Decision

One rule for every typed size in Construction: **what is typed is saved exactly, or it stays on screen marked
invalid with the reason, until the user fixes it or presses Escape (ADR-199, ADR-008).**

1. **F1:** `MmField` keeps "." and "," in its text (it strips letters only), so "2.5" fails "Whole number from {min}
   to {max}." and is not saved. `HeightField`, `TypedMm`, `OffsetMm` (`RunRequests.tsx`) and `Clearances.tsx` keep
   ".", "," and "-" the same way and show their existing errors. No new text.
2. **F2:** `MmField` keeps invalid text and its error on blur (no reset); Escape restores the saved value, as
   ADR-199's size fields do. The stepper buttons keep clamping to the range (they never produce invalid text).
3. **F3:** Runner lengths you can buy saves only when every entry is a positive whole number (the rule it applies today); otherwise it keeps
   the text, sets `aria-invalid` and says "Whole numbers in mm, separated by commas. Not saved until they are."
   (`t()` with its Russian entry). The loose-panel Name says "Enter a name. Not saved until there is one." for an
   empty name (`t()` with its Russian entry).
4. **F4:** decided by the user: see the last Decision item.
5. **F5:** choosing Diagonal while the inside is not shelves asks "A diagonal corner holds shelves only. Replace what
   is inside with one shelf and a door?" (`askConfirm`, confirm label "Replace", `t()` with Russian entries); Cancel
   keeps the type.
6. **F4 (D07-F4, user 2026-11-10):** choosing Two rails when Top layers is Doubled sets it to Single in the same undo step, so no warning names a hidden control.

## Alternatives considered

- **F1: accept decimals and round** — a silent clamp (ADR-008) and against integer millimetres (ADR-003).
- **F1: `type="number"` inputs** — browsers differ on "," and on what an invalid number reports; the text field with
  an explicit error is what ADR-199 chose.
- **F2: keep the reset but announce it** — the typed value is lost; the user must type it again to fix one digit.
- **F3: show what was dropped and save the rest** — a partial save the user did not confirm.

## Scope

- In scope: F1, F2, F3 and F5 as decided; tests for each; Russian entries for the new texts.
- Out of scope: a decimal millimetre model (ADR-003 keeps integers).

## Consequences

- Positive: the same input rule in every Construction field; no size can grow tenfold from a typed decimal.
- Negative / risks: `MmField` is shared with other domains, so their fields change the same way; find-it tests that
  type over a field and rely on the reset need a valid value or Escape.

## Done when

- [ ] Typing "2.5" or "10,5" in a Construction size, Trim height, Cut-out width, From left or a clearance saves nothing and shows the field's error with `aria-invalid` (test).
- [x] Out-of-range text stays with its error after Tab and Enter; Escape restores the saved value (test).
- [ ] Runner lengths with a wrong entry, and an empty loose-panel Name, save nothing and say why, in English and Russian (test).
- [x] Choosing Diagonal over drawers asks first; Cancel keeps Blind and the drawers (test).
- [x] Doubled, then Two rails: Top layers becomes Single, no `top-layers-rails` warning, and one undo restores both (test).
- [x] Find-it test passes from the bare app at phone and desktop widths.

Evidence: tests/find-it/audit-typed-sizes.test.tsx (run 2026-11-10 in the sandbox: the full suite and the files above pass).

## Cross-examination

One round, 2026-11-10. The skeptic checked each finding for duplicates (also of ADR-248), for behaviour an implemented
ADR intends, for conflicts with the hard rules, for over-engineering and for missing tests.

| Id     | Skeptic                                                                                                         | Proposer                                                                                                                                                                                                                | Verdict                    |
| ------ | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| D07-F1 | Phones show a digit keypad (`inputMode="numeric"`), so nobody types "."; and `MmField` belongs to every domain. | Many phone keypads and every desktop keyboard have "." and ","; the runner hint itself says "12.5–13 mm" (`Inspector.tsx:1249`). Reproduced at 390 and 1280 px. Construction holds most `MmField` uses; not in ADR-248. | Accepted                   |
| D07-F2 | The error is shown while typing; the reset is old behaviour, not a regression.                                  | ADR-199 line 31 rejected the reset for size fields because it hides the mistake; after Enter the user sees the old value and no reason. Reproduced: error shown=false after Tab.                                        | Accepted                   |
| D07-F3 | Few users edit runner lengths; the list is sorted and de-duplicated, which is helpful.                          | Dropping "5OO" and "550.5" without a word is a silent change (ADR-008), and text that is not saved looks saved. One validation and one message.                                                                         | Accepted                   |
| D07-F4 | ADR-105 lines 36-37 chose both the warning and the "shown for a full panel" rule; this is intended.             | Intended, but the warning names a control the user cannot reach without two extra changes. Either fix changes an implemented ADR's UI rule, so it is the user's choice.                                                 | Accepted (user 2026-11-10) |
| D07-F5 | A diagonal holds shelves only (`corner.ts:166-171`); undo brings the drawers back.                              | The replacement is needed; asking first is not. Four other replacements in the same editor ask (`Inspector.tsx:507-515,855-860,979-984,1947-1951`). One confirm.                                                        | Accepted                   |

No physical fact is asked or decided here (ADR-010).

## User decision (2026-11-10)

- **D07-F4:** Choosing Two rails sets Top layers to Single, in one undo step.
