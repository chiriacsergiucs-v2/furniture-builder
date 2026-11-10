# ADR-256: UI audit — Hardware: typed counts and names are kept as typed, in every language

- Status: Implemented
- Date: 2026-11-10
- Implemented: 2026-11-10
- Depends on: none
- Design: docs/ui-design.md
- Backlog: N265
- Acceptance: full

## Context

The user asked for a domain-by-domain UI audit (2026-11-10): map every sub-flow, find what breaks it, propose the
best fix, then cross-examine. This ADR is domain 09, **Hardware** (`src/ui/info/features.ts:751-784`). The full
sub-flow map (5 feature lines, entry → steps → end state, code and tests per row) and the evidence are in
[docs/research/ui-audit-09-hardware.md](../research/ui-audit-09-hardware.md).

Summary of the map: the schedule is the Results › Hardware tab (`src/ui/Output.tsx:369-411`); handles are chosen per
space in Compose (`src/ui/Inspector.tsx:681-731`); fasteners in a piece's or the project's Settings
(`src/ui/Fasteners.tsx:35-232`, `src/ui/Settings.tsx:71,109`, `src/ui/Project.tsx:255`); fittings the user chooses
in the front editor (`src/ui/Editors.tsx:88-157`). All are reachable at 390 and 1280 px.

ADR-010 and ADR-074 hold: no hardware line or fastener invents a spec; every typical value is labelled. What breaks is
the user's own input: a typed decimal becomes ten times the count, a named fitting loses its translation, and two
controls show something other than what is saved.

## Findings

| Id     | Class        | Severity | Finding                                                                                                                                                   |
| ------ | ------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D09-F1 | Proven       | major    | Fasteners Per and From each end strip "." (`Fasteners.tsx:147,168`); reproduced: "1.5" saved as 15 per joint, "37.5" mm as 375.                           |
| D09-F2 | Proven       | minor    | User-named flap fitting and panel-set screw lines stay English in Russian (`cabinet.ts:718-720`, `panelset.ts:137`, `Output.tsx:403`); keys exist unused. |
| D09-F3 | Proven       | minor    | After a failed fastener save the row still shows the unsaved name (`Fasteners.tsx:89-92`, `fastenerStore.ts:53-58`); reproduced: field kept, store empty. |
| D09-F4 | Proven       | minor    | Hole centres shows "96 mm" for a valid design handle of 150 mm (`Inspector.tsx:657,711-719`, `design.ts:1012-1013`); the Hardware line says 150.          |
| D09-F5 | Code-evident | polish   | Fitting you chose is cut to 200 characters on blur with no `maxLength` and no word (`Editors.tsx:141-152`).                                               |

## Decision

One rule for the hardware the user names or counts: **what is typed is saved exactly or refused with its reason;
what is shown is what is saved; a name the user gives is shown inside a translated sentence.**

1. **F1:** the Per and From each end fields keep "." and "," in their text (letters still stripped), so "1.5" shows
   their existing errors ("Whole number, 1 or more. Not saved until it is." and "Whole number from 0 to 5000. Not
   saved until it is.") and is not saved. Same rule as ADR-254 item 1.
2. **F2:** `trLoose` (`src/core/i18n/index.ts`) also matches a key whose placeholders are names: the label is
   compared with each key that has non-numeric placeholders (built once, like `shapeOf`) and filled with the text it
   captured, so `'Flap fitting: {name}'` and `'Screws: {a} to {b}'` translate. Core only; no change to
   `src/core/types.ts` or to any hardware line. The user's own words stay as typed.
3. **F3:** each fastener row is keyed by its saved choice (`joint|name|per|edge`) so a re-read after a failed save
   shows what is really saved; the alert stays as it is.
4. **F4:** when the handle's hole centres are not in the list, the select adds that value as one more option
   ("{n} mm", the existing key), so the field shows what the model uses. The list is imported from
   `src/core/project.ts` (`BAR_SPACINGS`) instead of being copied.
5. **F5:** the fitting input gets `maxLength={200}`, as the loose-panel Name has; the `slice` stays as a guard for
   imported text.

## Alternatives considered

- **F2: store a label key and parameters on each hardware line** — changes the model shape (ADR-011) for two lines;
  the keys already exist.
- **F2: add literal Russian entries** — impossible for names the user types.
- **F4: refuse other centres on import** — would make saved designs unreadable (ADR-011, ADR-012); showing the value
  is enough.
- **F3: keep the row text and add "not saved" under it** — a second message beside the group alert, and the row
  would still disagree with the Hardware tab.

## Scope

- In scope: F1–F5 as decided; tests for each.
- Out of scope: translating backrest and recliner positions other than the built-in ones (they come only from a
  file); any new hardware spec (ADR-010).

## Consequences

- Positive: counts to buy and drilling guidance can no longer grow tenfold from a typed decimal; Russian hardware
  lists have no English left in them for user-named fittings.
- Negative / risks: F2 adds a pattern pass to `tr()` for Russian only; it runs after the exact and numeric lookups,
  so existing translations are unchanged.

## Done when

- [x] Typing "1.5" in Per and "37.5" in From each end saves nothing and shows each field's error with `aria-invalid` (test).
- [x] In Russian, a flap with a named fitting and a panel set with a screwed joint show "Механизм клапана: {name}" and "Шурупы: {a} к {b}" in the Hardware tab (test).
- [x] After a failed fastener save the row shows what is saved and the alert is shown (test).
- [x] A design handle with 150 mm centres shows "150 mm" in Hole centres (test).
- [x] Fitting you chose takes at most 200 characters (test).
- [x] Find-it test passes from the bare app at phone and desktop widths.

Evidence: tests/audit-typed-sizes.test.tsx, tests/find-it/audit-typed-sizes.test.tsx; tests/audit-rest.test.tsx (run 2026-11-10 in the sandbox: the full suite and the files above pass).

## Cross-examination

One round, 2026-11-10. The skeptic checked each finding for duplicates (also of ADR-248 and ADR-254), for behaviour
an implemented ADR intends, for conflicts with the hard rules, for over-engineering and for missing tests.

| Id     | Skeptic                                                                                                           | Proposer                                                                                                                                                                                                    | Verdict  |
| ------ | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| D09-F1 | Duplicate of ADR-254's D07-F1.                                                                                    | Same rule, other component (`Fasteners.tsx`, not `MmField`) with its own tests; here it multiplies what is bought and moves drilling guidance. ADR-254 does not touch this file. Reproduced at both widths. | Accepted |
| D09-F2 | Fitting names and panel names are the user's words; nothing to translate.                                         | The user's words stay; the English around them ("Flap fitting:", "Screws: … to …") is app text, and its Russian keys exist (`ru/data-parts.ts:220-221`). Reproduced: MISSING for both.                      | Accepted |
| D09-F3 | The alert already says the save failed (ADR-008 is kept).                                                         | The alert is kept; the row then disagrees with the Hardware tab ("choose your fastener"), and a reload would show it empty. Keying the row is one line. Reproduced: field kept, store `undefined`.          | Accepted |
| D09-F4 | Only an imported or hand-edited file gets other centres; run handles are limited to the list (`project.ts:4380`). | `validateDesign` accepts it (reproduced `validate=[]`), so the app opens it and then shows 96 for 150: the field lies. One extra option; no spec invented (the value is the user's).                        | Accepted |
| D09-F5 | 200 characters is far beyond a maker and type.                                                                    | Rare, so polish; but a silent cut is what ADR-008 forbids, and `maxLength` is one attribute already used beside it.                                                                                         | Accepted |

No question needs the user: no fix decides a hardware spec, load, drilling depth or screw (ADR-010); the drilling
positions stay the user's values.
