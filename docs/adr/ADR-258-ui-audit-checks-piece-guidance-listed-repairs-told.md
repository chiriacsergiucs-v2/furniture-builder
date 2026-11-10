# ADR-258: UI audit — Checks and problems: every piece's guidance listed, repairs told truly

- Status: Pending
- Date: 2026-11-10
- Depends on: none
- Design: docs/ui-design.md
- Backlog: N267
- Acceptance: full

## Context

The user asked for a domain-by-domain UI audit (2026-11-10): map every sub-flow, find what breaks it, propose the
best fix, then cross-examine. This ADR is domain 11, **Checks and problems** (`src/ui/info/features.ts:860-894`).
The full sub-flow map (6 feature lines, entry → steps → end state, code and tests per row) and the evidence are in
[docs/research/ui-audit-11-checks.md](../research/ui-audit-11-checks.md).

Summary of the map: the checks run in the core (`src/core/build.ts`, `src/core/project.ts:1504-1780`,
`src/core/room.ts:585-670`, `src/core/rules.ts`) and are listed under Results › Checks (`src/ui/Output.tsx:415-480`).
In a project, tapping a check with a place selects its pieces and opens the banner with previewed repairs above the
plan (`src/ui/ProblemBanner.tsx`, `src/store/focusedProblem.ts`) and in 3D (`src/viewer/Viewer3D.tsx:2393`). All are
reachable at 390 and 1280 px.

ADR-008 is the rule here: an error is never hidden or softened, and errors block export. The Results panel keeps it
(`Output.tsx:101-180`, `Shopping.tsx:180-195`, `useNesting.ts:24`); the exports outside the Results panel that do not
(Fusion 360 script, Print assembly steps, Front view drawing) are ADR-260's D13-F1. Here, in a project every piece's
guidance warnings disappear, and the problem banner says more than the app did.

## Findings

| Id     | Class            | Severity | Finding                                                                                                                                                                            |
| ------ | ---------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D11-F1 | Proven           | major    | A piece's warnings (construction guidance) never reach the project's Checks or printed sheet (`project.ts:1551-1561`); reproduced: `shelf-span` on the piece, none in the project. |
| D11-F2 | Moved to ADR-260 | major    | Fusion 360 script and Print assembly steps stay enabled with an error (`MoreMenu.tsx:182-194`, `Assembly.tsx:200-228`); reproduced. Already ADR-260 D13-F1.                        |
| D11-F3 | Code-evident     | minor    | The banner says "No repair clears this without causing another problem" for codes no repair is tried on (`ProblemBanner.tsx:74-79`, `repairs.ts:465`).                             |
| D11-F4 | Proven/Code      | minor    | The Checks tab is named "Checks1" (proven); the problem banner appears with no announcement and no focus move (`Output.tsx:47-70`, `ProblemBanner.tsx:42`).                        |
| D11-F5 | Rejected         | —        | "Runs into an obstacle" is an error with no place to outline (`room.ts:616-621`); see Cross-examination.                                                                           |
| D11-F6 | Moved to ADR-260 | —        | The front view drawing (SVG) is downloadable with an error (`MoreMenu.tsx:171-180`). Already ADR-260 D13-F1, which blocks it.                                                      |

## Decision

One rule for the checks: **every check a piece reports is listed wherever the project's checks are read, and the
problem banner claims only what the app did.**

1. **F1:** `buildProjectModel` carries each piece's warnings into the project's diagnostics, keeping code, severity
   and panel ids, with the message "{name}: {message}" (`t()` with its Russian entry), `nodeId` the item id and
   `itemIds: [item id]`. Errors stay summarised as `piece-errors` (`project.ts:1551-1561`). Warnings still never block
   (ADR-035). No `src/core/types.ts` change: `Diagnostic` already has these fields.
2. **F2:** moved to ADR-260 (D13-F1 disables the same two exports); no change here.
3. **F3:** when the code has no repair family (`!mayRepair(d)`), the banner says "This problem has no automatic repair.
   Move or change the pieces yourself." (`t()` with its Russian entry); the current sentence stays for a repairable
   problem whose repairs were all refused or dropped.
4. **F4:** the Checks tab gets `aria-label` "Checks: {n|# problem|# problems}" (or "Checks: {n} to check" for
   warnings only, or "Checks"), the visible label unchanged; the banner gets `tabIndex={-1}` and takes focus each time
   a check is tapped (`tapped`, `problemStore.ts:15`), so its message is read.
5. **F5:** no change (rejected in the cross-examination).
6. **F6:** moved to ADR-260 (D13-F1 disables the Front view drawing); no change here.

## Alternatives considered

- **F1: show piece warnings only on the piece card** — the Checks list and the printed sheet are what the user reads
  before cutting; the card shows one piece at a time.
- **F1: one summary warning per piece ("3 checks; open it")** — keeps the list short but hides which guidance applies
  until each piece is opened; guidance must say what it is (ADR-035).
- **F4: `role="status"` on the banner message** — a live region that mounts with its content is not reliably read;
  moving focus is.

## Scope

- In scope: F1, F3 and F4 as decided; tests for each.
- Out of scope: where/amount for more diagnostic codes (F5, rejected); blocking the Fusion script, the assembly print
  and the front view drawing (F2, F6: ADR-260).

## Consequences

- Positive: guidance warnings are listed and printed for projects as for single pieces; the banner's sentence is true.
- Negative / risks: projects with many pieces get longer Checks lists; `tests/diagnostic-golden.test.ts` snapshots of
  project diagnostics change and must be updated with the new rows. The Checks badge counts the new warnings.

## Done when

- [x] A project with a bookcase whose shelf span gives `shelf-span` lists that warning, named by the piece, in Checks and on the printed project sheet; it does not block export (core test + find-it).
- [ ] Tapping a `connection-broken` (or `common-gap`) check shows "This problem has no automatic repair…"; an overlap with all repairs refused keeps the old sentence (test).
- [ ] The Checks tab's accessible name is "Checks: 1 problem" with one error, and a tapped check moves focus to the banner (test).
- [x] Find-it test passes from the bare app at phone and desktop widths.

Evidence: tests/audit-checks.test.ts, tests/find-it/audit-checks-output.test.tsx, tests/audit-extra.test.ts (run 2026-11-10 in the sandbox: the full suite and the files above pass).

## Cross-examination

One round, 2026-11-10. The skeptic checked each finding for duplicates (within this ADR, against ADR-248 and the other audit ADRs), for
behaviour an implemented ADR intends, for conflicts with the hard rules, for over-engineering and for missing tests.

| Id     | Skeptic                                                                                                               | Proposer                                                                                                                                                                                                                                                                             | Verdict          |
| ------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| D11-F1 | ADR-008 protects errors only; warnings are visible when the piece is opened (`Inspector.tsx:458-470`).                | ADR-035 makes guidance labelled warnings with no exemption for projects; no ADR found that drops them (`project.ts:1551-1561` keeps errors only). Reproduced: `shelf-span` on the piece, empty project list; the printed sheet reads the same list.                                  | Accepted         |
| D11-F2 | Duplicate of ADR-260 D13-F1 (Output domain), which blocks Print assembly steps and Fusion 360 script with the reason. | Agreed: same buttons, same rule, same reproduction (Fusion enabled, Print assembly steps enabled, CSV disabled). The export buttons belong to the Output domain.                                                                                                                     | Moved to ADR-260 |
| D11-F3 | Copy polish; the user still sees the problem.                                                                         | The sentence claims repairs were tried and failed (`ProblemBanner.tsx:76-78`), which is untrue for five codes with a place and no repair family (`repairs.ts:67-75`, research file D11-F3), and contradicts the row's "Show on the plan" (`Output.tsx:469-473`). One text, no logic. | Accepted         |
| D11-F4 | "Checks1" is a jsdom artefact.                                                                                        | The accessible name is computed from the DOM text, the same in a browser: the badge is a child of the button with no label (`Output.tsx:69-70`). The focus move reuses `tapped`, which exists for scrolling.                                                                         | Accepted         |
| D11-F5 | ADR-071's scope gives where and amount to overlap, door-blocked and outside-room only.                                | Agreed: the tap still selects the piece and the error is listed and blocks export; adding a place to more codes is a new feature, not a defect against an implemented ADR.                                                                                                           | Rejected         |
| D11-F6 | ADR-260 D13-F1 already blocks the Front view drawing; asking the user here would contradict it.                       | Agreed: ADR-260 decided it under the same rule; any question about it belongs to that ADR.                                                                                                                                                                                           | Moved to ADR-260 |

No question needs the user here. Decided without asking: piece warnings are listed one by one rather than summarised
(ADR-035 wants each labelled).
