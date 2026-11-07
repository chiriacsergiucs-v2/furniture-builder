# ADR-200: Fix the project composition design findings

- Status: Implemented
- Date: 2026-11-06
- Implemented: 2026-11-05 (Built in PR #169 (merged 353108e, CI run 42126747931); production find-it re-run on main 2026-11-05)
- Depends on: ADR-022, ADR-093, ADR-107, ADR-160
- Design: docs/ui-design.md (Project composition)
- Backlog: N205
- Acceptance: browser

## Context

The user asked to implement ADRs 198, 199 and 200 using the Claude Flow audit. On main at `f1f7b70`,
all three were empty placeholders: no findings, Decision or agreed fixes. Original request: "run a /batch
for 1 through 7 with a critique of design … 1 adr with high and medium issues and fixes per flow".
This records a code critique and diagnostic evidence; it does not interpret that request as an answer to
choices absent from the placeholders. ADR-191 and ADR-193 to ADR-196 are excluded. Project-template actions here are distinct from ADR-195 catalog-family editing.

## Decision

User answer 2026-11-06: "Yes" to implementing all twelve proposed fixes across ADR-198 to ADR-200.
The four fixes below are accepted. No unresolved product decision blocks this implementation.

## Findings and agreed fixes

1. **History hides storage failures (High).** `src/ui/History.tsx:32-36` converts failed version reads into
   an empty list; Save/Restore/Delete at 67-71,98-112,120-136 await writes without catches. Probe: rejected
   listProjectVersions shows No versions kept yet, no alert. Fix: separate loading/empty/error;
   catch actions, retain data, show translated errors and guard duplicate pending actions. Alternative:
   a toast without state still permits false empty lists and duplicate writes.
2. **Project-template actions can fail silently (High).** `src/ui/ProjectTemplates.tsx:126-129,142-151,
164-177,184-191`: Use/Create, Rename, Export and Delete await work without catches (source evidence).
   Fix: operation-specific translated alerts, preserve operation input for retry, refresh only on
   success and prevent duplicate submissions; keep new ids and save-before-open. Alternative: a global
   unhandled-rejection message cannot preserve the operation's input or identify its failed action.
3. **A finishing picture import overwrites newer room edits (High).** `src/ui/WallBackground.tsx:38-51`
   closes over room before awaiting importImage; `src/ui/Project.tsx:3084` passes the store setter directly.
   Probe: start upload at height 2500, rerender room height 2800, complete import: setter receives 2500.
   Fix: apply only the finish to the latest matching project's room, guarding changed/removed wall,
   newer import and changed background; report a stale completion instead of overwriting. Alternatives:
   freeze all project edits during import, or reject every room-reference change (including unrelated edits).
4. **Cancel still creates a project template (Medium).** `ProjectTemplates.tsx:26-42` treats false from
   Include the room as save without room, but askConfirm's other button says Cancel and Escape returns false.
   Probe: accepted name and false room answer still saves without room. Fix: one form with name,
   explicit Include room checkbox, Save and Cancel; Cancel/Escape writes nothing. Alternative: rename Cancel
   to Without room still leaves Escape creating a template.

## Alternatives considered

The user chose all four fixes on 2026-11-06. Alternatives beside each finding were rejected for the
reasons given. The accepted fixes are implemented on this branch.

## Scope and consequences

Only the four proposed fixes and their regression/find-it coverage, translations and relevant feature entries.
No new physical specifications, model rules, storage schema or dependency. Keep existing undo semantics and
validate through the authoritative model. The user approved these behaviour changes on 2026-11-06.
For ADR-200 the save form changes layout and requires production-browser acceptance.

## Initial critique evidence (before implementation)

Ran locally on 2026-11-06: frozen-lockfile install; pnpm build; three project probes passed within an 11/11
scratch Vitest diagnostic run. Probes assert existing defects, not corrected behaviour; removed after use.
The shell drag probe is a synthetic event sequence; unhandled project-template writes are source evidence.
No application code changed. Node 24.22.1, pnpm 11.25.0 (package.json pins pnpm 12.6.0).
Production screenshots at 390 × 844 and 1280 × 900 were not obtained: Chromium failed to launch/render
(GPU/font initialization). No browser, visual, 3D or gesture acceptance is claimed. G-367 remains Open.
The accepted implementation scope is the four findings above; current verification follows below.

## Open questions

None. The user accepted all four fixes. G-367 tracks implementation and verification.

## Done when

- [x] User choices and the production-browser critique are complete and recorded.
- [x] Version failures show alerts, never false emptiness/success; current data stays intact.
- [x] Failed template actions retain retry input and show errors; opening happens only after a successful save.
- [x] Picture completion preserves newer room edits and never writes to a stale project/wall/background.
- [x] Save-template Cancel/Escape writes nothing; Save respects name and Include room.
- [x] Russian copy/feature entries, regression and production acceptance at both widths and CI checks pass.

## Implementation evidence

Built the four approved fixes. Targeted failure/race tests 11/11 passed, including version failures, backup restore races, template Cancel/retry, and merging image finishes into the latest room. Lint and typecheck passed. Production acceptance pending.

Production verification 2026-11-06: tools/project-actions/find-it.mjs passed 22/22 at 390 × 844 and
1280 × 900. Browser IndexedDB quota failures exercise Save template, Save version, Rename and Create.
Cancel and Escape leave the template list empty; retries preserve input. Real image preparation was paused
while editing the room or removing its background; exported project JSON confirms newer edits are kept.
Created-copy JSON confirms name, one piece and the unchecked room choice. Light/dark screenshots captured;
no horizontal page scroll. Failure/race tests 11/11 and existing history/template regressions 4/4 passed.

## Requirement evidence

User request: "Implement ADR-s 198, 199, 200"; answer "Yes" to all twelve numbered fixes.

| Accepted requirement      | Evidence                                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| History failures          | Read/write failures are visible and retryable; pending writes cannot duplicate; stale restores are refused. |
| Project-template failures | Create/Rename keep input and retry ids; Export/Delete retain rows and expose Retry.                         |
| Delayed picture imports   | The latest room keeps height/features/other walls; changed targets reject the import.                       |
| Cancel saves a template   | Cancel/Escape leave no template; Save honours name and Include room.                                        |

Tests: tests/project-actions.test.tsx; tests/find-it/history.test.tsx; tests/find-it/template-keeps.test.tsx. Production acceptance: tools/project-actions/find-it.mjs — 22/22 passed
at 390 × 844 and 1280 × 900. Light/dark screenshots were inspected. Lint, formatting, types,
full test suite, production build and docs checks pass locally. One pre-existing skipped test remains.
No geometry rule, dependency or storage schema changed. Not merged, deployed or live-verified.
