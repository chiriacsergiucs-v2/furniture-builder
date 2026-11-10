# ADR-265: UI audit — Information: the pages say only what is true and offer only what works

- Status: Pending
- Date: 2026-11-10
- Depends on: none
- Design: docs/ui-design.md
- Backlog: none
- Acceptance: full

## Context

The user asked for a domain-by-domain UI audit (2026-11-10): map every sub-flow, find what breaks it, propose the
best fix, then cross-examine. This ADR is domain 19, **Information** (`src/ui/info/features.ts:1407-1443`). The full
sub-flow map (7 feature lines, entry → steps → end state, code and tests per row) and the evidence are in
[docs/research/ui-audit-19-information.md](../research/ui-audit-19-information.md).

Summary of the map: ⋯ More opens Information and guides, Feature Research and Gaps (`src/ui/shell/MoreMenu.tsx:255-266`;
`src/ui/Info.tsx`, `src/ui/Research.tsx`, `src/ui/Gaps.tsx`); the Gaps page exports and imports marks
(`Gaps.tsx:129-176`); ⓘ buttons (`src/ui/controls.tsx:470-561`), arrow keys in segmented controls
(`controls.tsx:110-145`) and the theme switch (`src/ui/App.tsx:816-826`) work across the app. All are reachable at 390
and 1280 px.

ADR-120 settled when "Back to the editor" shows, ADR-212 the gap-marks file, ADR-244 that a result is never reported as
applied when it was not. One page breaks the first, the import count and two error banners say untrue things, and the
Research tabs are only half the tab pattern.

## Findings

| Id     | Class        | Severity | Finding                                                                                                                                   |
| ------ | ------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| D19-F1 | Proven       | minor    | Information and guides shows "Back to the editor" with no design open; Research and Gaps hide it (`Info.tsx:55-58`, `App.tsx:899`).       |
| D19-F2 | Proven       | minor    | Import marks says "Imported 1 mark" when the device's mark is newer and nothing changed (`gaps.ts:290-298`, `Gaps.tsx:170-173`).          |
| D19-F3 | Proven       | minor    | Moved to ADR-259: the Results tab bar has no arrow keys, six Tab stops and no name (`src/ui/Output.tsx:56-75`).                           |
| D19-F4 | Code-evident | minor    | Research section tabs have no tab panel or `aria-controls` (`Research.tsx:164-210`).                                                      |
| D19-F5 | Proven       | minor    | "Your decision could not be saved…" stays after the same decision saves; Gaps does the same (`researchStore.ts:84-91`, `Gaps.tsx:72-73`). |

## Decision

One rule for the Information pages: **a page offers only what works from where the user is, and every message says
what really happened.**

1. **F1:** `InfoPage` takes `designOpen` like Research and Gaps; "Back to the editor" shows only when a design is open
   (ADR-120 item 5).
2. **F2:** `readGapMarksFile` also returns `kept` (valid rows older than the device's mark); the page says "Imported N
   marks, kept M (yours are newer), skipped K." with N the applied rows. English only (the Gaps page is not
   translated). This changes the message ADR-212 item 2 fixed; ADR-212 stays as it is.
3. **F3:** moved to ADR-259 (domain 13, Output); not built here.
4. **F4:** the Research section buttons get `id` and `aria-controls`; the content under them is a `role="tabpanel"`
   labelled by the selected tab, as `Output.tsx:66,76-80` does.
5. **F5:** the research store and the Gaps page remember the ids whose save failed, write them again with the next
   save, and clear the banner only when those ids are saved; a failure for another id keeps it.

## Alternatives considered

- **F1: send Back to the Projects page when nothing is open** — a second meaning for one button; the places bar
  already reaches Projects.
- **F2: count only applied rows and drop the kept number** — the user would not learn why a row did not arrive.
- **F5: clear the banner on any later success** — would hide an earlier failure for another decision (ADR-008).

## Scope

- In scope: F1, F2, F4, F5 as decided; tests for each.
- Out of scope: F3 (domain 13, ADR-259); a "follow the system" theme choice (not asked, ADR-030).

## Consequences

- Positive: the three pages behave alike; import and storage messages match what is stored.
- Negative / risks: the gap-marks import message changes; `tests/gap-marks-file.test.ts` and
  `tests/find-it/band-list-gap-marks.test.tsx` that read it change with it.

## Done when

- [ ] Bare app → Information and guides shows no "Back to the editor"; with a project open it shows it (find-it).
- [ ] Importing marks older than the device's says "Imported 0 marks, kept 1 (yours are newer), skipped 0." (core test + find-it).
- [ ] Research section tabs control a `tabpanel` named by the selected tab (find-it).
- [ ] A failed decision save shows the banner; saving that decision again clears it; a later save of another decision does not (store test).
- [ ] Find-it test passes from the bare app at phone and desktop widths.

## Cross-examination

One round, 2026-11-10. The skeptic checked each finding for duplicates (of each other and of ADR-247), for behaviour an
implemented ADR intends, for conflicts with the hard rules, for over-engineering and for missing tests.

| Id     | Skeptic                                                                                                                                  | Proposer                                                                                                                                                                                                                       | Verdict            |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| D19-F1 | ADR-158 built the page after ADR-120 and may have chosen an always-on Back; it is a static page.                                         | ADR-158 says nothing about the button; ADR-120 item 5 (line 23) is a rule for every "Back to the editor", and Research and Gaps follow it (`Research.tsx:96`, `Gaps.tsx:48`: "as the Catalog (ADR-120, ADR-211)"). Reproduced. | Accepted           |
| D19-F2 | ADR-212 item 2 fixed the text "Imported N marks, skipped M"; changing it edits a settled decision.                                       | The words stay; what N counts was not decided, and ADR-244 forbids reporting as applied what was not. This ADR records the change and leaves ADR-212 unedited. Reproduced: apply 0, "Imported 1 mark".                         | Accepted           |
| D19-F3 | The Results tabs are not a segmented control; ADR-202 item 9 listed its groups and left them out, so the feature line is true as worded. | Agreed that the feature line holds; the missing arrow keys, roving Tab stop and tablist name are still real (reproduced) and belong to the component's own domain, Output.                                                     | Moved to ADR-259   |
| D19-F4 | Polish; screen readers still read the buttons.                                                                                           | `role="tab"` promises a panel; without one the announcement is false. The fix copies the pattern already in `Output.tsx:66,76-80`.                                                                                             | Accepted           |
| D19-F5 | Clearing an error banner could hide a real failure (ADR-008, never hide an error).                                                       | Agreed for "clear on any success": a save writes only the ids it is given (`researchStore.ts:75-85`), so another id's failure would be hidden. The decision was revised to clear only when the failed ids are saved again.     | Accepted (revised) |

No physical-fact question arose and no question needs the user. Decided without asking: F1 hides the button rather
than sending it to Projects; F2 adds a kept count.
