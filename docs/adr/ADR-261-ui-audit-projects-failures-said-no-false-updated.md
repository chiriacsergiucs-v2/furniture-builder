# ADR-261: UI audit — Projects: a failed write is said, a refused update is never called done

- Status: Pending
- Date: 2026-11-10
- Depends on: none
- Design: docs/ui-design.md
- Backlog: none
- Acceptance: full

## Context

The user asked for a domain-by-domain UI audit (2026-11-10): map every sub-flow, find what breaks it, propose the
best fix, then cross-examine. This ADR is domain 14, **Projects** (`src/ui/info/features.ts:1153-1268`). The full
sub-flow map (25 feature lines, entry → steps → end state, code and tests per row) and the evidence are in
[docs/research/ui-audit-14-projects.md](../research/ui-audit-14-projects.md).

Summary of the map: saved work is opened, duplicated and deleted on the Projects page
(`src/ui/shell/ProjectsPage.tsx:128-243`, a ⋯ menu per row on a phone, `:353-416`); a project is changed from the
side panel (`src/ui/Project.tsx:169`, the Compose sheet on a phone, `src/ui/App.tsx:907,917`), its History
(`src/ui/History.tsx:29-387`) and Settings › Variables and value sets (`src/ui/Variables.tsx`). All are reachable at
390 and 1280 px; the sheet handle and peek row are phone-only by design (ADR-160, ADR-211).

Version history, Save as a project template and Versions of deleted projects already keep one write in flight and say
a failure (ADR-200, ADR-211). Two other writes in this domain do neither, one action reports success after the store
refused it, and some failures and problems are shown as nothing.

## Findings

| Id     | Class        | Severity | Finding                                                                                                                                                                |
| ------ | ------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D14-F1 | Proven       | major    | Projects page Delete with a failing storage says nothing (`ProjectsPage.tsx:136-164`); reproduced: no alert, row still listed, unhandled rejection.                    |
| D14-F2 | Proven       | major    | Value set Save as separate project: a double tap saves two projects, a failed save is silent (`Variables.tsx:534-544`); reproduced: 2 projects; no alert.              |
| D14-F3 | Proven       | major    | Update from saved piece says "Updated from the saved piece." after the size lock refused it (`Project.tsx:225-243`, `designStore.ts:1049-1057`); reproduced.           |
| D14-F4 | Rejected     | —        | Projects page Duplicate: a double tap makes two copies (`ProjectsPage.tsx:128-135`); see Cross-examination.                                                            |
| D14-F5 | Proven       | minor    | Edit history "As opened" after more than 100 steps jumps to the oldest kept step, not the opened project (`History.tsx:357-360`, `designStore.ts:614`); reproduced.    |
| D14-F6 | Code-evident | minor    | A read failure shows as an empty list: Add a piece saved pieces and project templates (`Project.tsx:2954-2966`), Versions of deleted projects (`History.tsx:245-247`). |
| D14-F7 | Code-evident | minor    | Variable values, the Bind formula and value set values with a problem are not `aria-invalid` nor tied to their problem text (`Variables.tsx:230-248,333-348,626-645`). |

## Decision

One rule for every write and report in a project: **a write is made once per tap, a failure is said where the user
tapped, and an action the store refused is never reported as done.**

1. **F1:** `ProjectsPage.remove` catches a failed delete and shows "The project could not be deleted from this
   browser’s storage." (or "The piece could not be deleted from this browser’s storage.") in the page message
   (`setMsg`, `ProjectsPage.tsx:69`); the list is read again either way. A failure of `deleteProjectVersions` after
   the project was deleted says "The project was deleted; its kept versions could not be deleted." Each text through
   `t()` with its Russian entry.
2. **F2:** `ValueSets.save` gets an in-flight ref and keeps the made project in a ref so a retry saves the same one
   (as `ProjectTemplates.tsx:389-392` does); the button is disabled while it saves. A failed save asks nothing and
   shows "The project could not be saved in this browser’s storage." (the ADR-193 sentence) under the set card.
3. **F3:** `updateItem` returns the refusal reason from `commitProject` (store action signature only; no
   `src/core/types.ts` change). `updateFromLibrary` shows "Updated from the saved piece." only when it returns null;
   otherwise the panel line shows the reason, as `ReplaceDialog` does (`Replace.tsx:53-56`).
4. **F4:** no change (rejected in the cross-examination).
5. **F5:** the store remembers when the 100-step history dropped its oldest step (`projectHistoryTrimmed`, reset by
   `openProject`); Edit history then labels the first row "Earliest kept step" instead of "As opened" (`t()` with its
   Russian entry).
6. **F6:** the three lists keep a read error and say "Saved work could not be read from this browser." (the Projects
   page sentence, `ProjectsPage.tsx:91`) in place of the list; Versions of deleted projects shows its group with that
   line and Retry, as the project's own versions do (`History.tsx:132-139`).
7. **F7:** each value, formula and set-value input with a problem gets `aria-invalid="true"` and
   `aria-describedby` pointing at its problem text; the set-value problem gets the same `role="alert"` as the
   variable rows; "New variable" is marked while its name problem is shown.

## Alternatives considered

- **F2: disable Save as separate project only** — a keyboard Enter and a fast second pointer event can still pass
  before the render (ADR-248 F4); the ref makes it one.
- **F3: hide Update from saved piece on a size-locked piece** — the saved piece may differ in boards or name only,
  which the lock allows; only a size change is refused, so the action stays and reports the truth.
- **F5: keep the whole history** — unbounded memory for long sessions; the label is what is untrue, not the limit.
- **F6: log and keep the empty list** — the user would read "no saved pieces" as lost work; saying it is the
  Projects page's rule already.

## Scope

- In scope: F1–F3 and F5–F7 as decided; tests for each.
- Out of scope: a retry button on the Projects page delete (the user can tap Delete again); Duplicate guarding (F4,
  rejected).

## Consequences

- Positive: every storage write in the Projects domain says its failure; no success line contradicts a refusal
  notice; problem fields are announced with their field.
- Negative / risks: `updateItem` gains a return value; its other callers ignore it unchanged. Seven new texts with
  their Russian entries.

## Done when

- [ ] Projects page Delete with a failing storage shows the delete sentence, keeps the row, and leaves no unhandled rejection, for a project and a piece (test).
- [ ] A double tap on Save as separate project saves one project; a failed save shows the ADR-193 sentence, asks nothing, and a retry saves the same project (test).
- [ ] Update from saved piece on a size-locked piece whose saved width differs shows the lock reason and not "Updated from the saved piece."; unlocked, it updates and says so (test).
- [ ] After 101 project changes Edit history's first row reads "Earliest kept step"; after fewer it reads "As opened" (test).
- [ ] With the storage read failing, Add a piece and Versions of deleted projects say "Saved work could not be read from this browser." (test).
- [ ] A variable value, a Bind formula and a set value with a problem are `aria-invalid` and described by their problem (test).
- [ ] Find-it test passes from the bare app at phone and desktop widths.

## Cross-examination

One round, 2026-11-10. The skeptic checked each finding for duplicates (within this ADR and against ADR-248), for
behaviour an implemented ADR intends, for conflicts with the hard rules, for over-engineering and for missing tests.

| Id     | Skeptic                                                                                                                       | Proposer                                                                                                                                                                                                                  | Verdict  |
| ------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| D14-F1 | Duplicate of ADR-248 D01-F2 (Projects page, failed write)?                                                                    | D01-F2 is Create project; this is Delete, another function (`ProjectsPage.tsx:136-164`) with its own texts. Reproduced: no alert, the row stays, unhandled rejection. ADR-203 settled which versions go, not failures.    | Accepted |
| D14-F2 | ADR-167 item 4 only asks for a new project with new ids; a double tap is rare.                                                | ADR-167 does not exempt it from ADR-193's rule; new ids per call (`sets.ts:502`) make every extra tap a real extra project the user must find and delete. Reproduced: 2 projects; failure silent.                         | Accepted |
| D14-F3 | The refusal notice is shown, so the user is told (ADR-008 satisfied).                                                         | Two contradicting lines are shown, and the panel line is the one beside the tapped button. Reproduced: "Updated" with the width unchanged. `ReplaceDialog` already reads the refusal (`Replace.tsx:53-56`).               | Accepted |
| D14-F4 | Duplicate stays on the page and each tap visibly adds a "(copy)" row; two taps asking for two copies is the expected outcome. | The editor's Duplicate (Ctrl+D, `Project.tsx:1192-1214`) also makes one copy per press; nothing opens or closes, so the second copy is seen at once and removed by Delete. No rule breaks.                                | Rejected |
| D14-F5 | ADR-123 chose a bounded history; this is intended.                                                                            | The bound is kept; only the label "As opened" is untrue past it. Reproduced: kerf 1, opened with none. One boolean in the store, one text.                                                                                | Accepted |
| D14-F6 | ADR-012 only forbids deleting unreadable rows; an empty list deletes nothing.                                                 | Right on ADR-012, but the same failure is said on the Projects page and in the project's versions (`ProjectsPage.tsx:89-97`, `History.tsx:132-139`); here it reads as "nothing saved". Consistency fix, no new behaviour. | Accepted |
| D14-F7 | Accessibility polish; ADR-166 tests only check the alert text.                                                                | The problem is shown but not tied to its field, against the focus-and-label rule and ADR-193 (problems name their field); ADR-248 D01-F5 applies the same fix to another domain. Small, testable.                         | Accepted |

No question needs the user: every accepted fix follows an implemented ADR's rule (ADR-193, ADR-200, ADR-122). Decided
without asking: the delete and read-failure sentences reuse the Projects page wording; Duplicate stays unguarded.
