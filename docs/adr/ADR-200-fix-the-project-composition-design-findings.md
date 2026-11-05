# ADR-200: Fix the project composition design findings

- Status: Deferred (fix choices need the user's answer; production-browser critique incomplete)
- Date: 2026-11-06
- Depends on: ADR-022, ADR-093, ADR-107, ADR-160
- Design: docs/ui-design.md (Project composition)
- Backlog: N205

## Context

The user asked to implement ADRs 198, 199 and 200 using the Claude Flow audit. On main at `f1f7b70`,
all three were empty placeholders: no findings, Decision or agreed fixes. Original request: "run a /batch
for 1 through 7 with a critique of design … 1 adr with high and medium issues and fixes per flow".
This records a code critique and diagnostic evidence; it does not interpret that request as an answer to
choices absent from the placeholders. ADR-191 and ADR-193 to ADR-196 are excluded. Project-template actions here are distinct from ADR-195 catalog-family editing.

## Decision

Not agreed yet. The fixes below remain proposals pending the user's choice under Open questions.

## Proposed findings and fixes

1. **History hides storage failures (High).** `src/ui/History.tsx:32-36` converts failed version reads into
   an empty list; Save/Restore/Delete at 67-71,98-112,120-136 await writes without catches. Probe: rejected
   listProjectVersions shows No versions kept yet, no alert. Proposed fix: separate loading/empty/error;
   catch actions, retain data, show translated errors and guard duplicate pending actions. Alternative:
   a toast without state still permits false empty lists and duplicate writes.
2. **Project-template actions can fail silently (High).** `src/ui/ProjectTemplates.tsx:126-129,142-151,
164-177,184-191`: Use/Create, Rename, Export and Delete await work without catches (source evidence).
   Proposed fix: operation-specific translated alerts, preserve operation input for retry, refresh only on
   success and prevent duplicate submissions; keep new ids and save-before-open. Alternative: a global
   unhandled-rejection message cannot preserve the operation's input or identify its failed action.
3. **A finishing picture import overwrites newer room edits (High).** `src/ui/WallBackground.tsx:38-51`
   closes over room before awaiting importImage; `src/ui/Project.tsx:3084` passes the store setter directly.
   Probe: start upload at height 2500, rerender room height 2800, complete import: setter receives 2500.
   Proposed fix: apply only the finish to the latest matching project's room, guarding changed/removed wall,
   newer import and changed background; report a stale completion instead of overwriting. Alternatives:
   freeze all project edits during import, or reject every room-reference change (including unrelated edits).
4. **Cancel still creates a project template (Medium).** `ProjectTemplates.tsx:26-42` treats false from
   Include the room as save without room, but askConfirm's other button says Cancel and Escape returns false.
   Probe: accepted name and false room answer still saves without room. Proposed fix: one form with name,
   explicit Include room checkbox, Save and Cancel; Cancel/Escape writes nothing. Alternative: rename Cancel
   to Without room still leaves Escape creating a template.

## Alternatives considered

The alternatives beside each finding were compared with the proposed fix. They remain unselected until
the user answers; no alternative or proposal has been written into application code.

## Scope and consequences

Only the four proposed fixes and their regression/find-it coverage, translations and relevant feature entries.
No new physical specifications, model rules, storage schema or dependency. Keep existing undo semantics and
validate through the authoritative model. UI behaviour changes only after the user chooses the fixes.
For ADR-200 the save form changes layout and requires production-browser acceptance.

## Evidence and remaining critique

Ran locally on 2026-11-06: frozen-lockfile install; pnpm build; three project probes passed within an 11/11
scratch Vitest diagnostic run. Probes assert existing defects, not corrected behaviour; removed after use.
The shell drag probe is a synthetic event sequence; unhandled project-template writes are source evidence.
No application code changed. Node 24.22.1, pnpm 11.25.0 (package.json pins pnpm 12.6.0).
Production screenshots at 390 × 844 and 1280 × 900 were not obtained: Chromium failed to launch/render
(GPU/font initialization). No browser, visual, 3D or gesture acceptance is claimed. G-367 remains Open.
Completion prompt: obtain the user's fix choices; capture this domain's production states at both sizes in
light/dark themes; finish the original critique scope, check physical gestures and ask about additional fixes.

## Open questions

- Choose the four numbered fixes, or identify changes. Proposal: all four, to prevent the demonstrated
  misleading state, hidden edits or lost work while preserving existing capabilities. Effort/value percentages
  cannot be determined from current evidence. No proposed option is accepted by default. G-367.

## Done when

- [ ] User choices and the production-browser critique are complete and recorded.
- [ ] Version failures show alerts, never false emptiness/success; current data stays intact.
- [ ] Failed template actions retain retry input and show errors; opening happens only after a successful save.
- [ ] Picture completion preserves newer room edits and never writes to a stale project/wall/background.
- [ ] Save-template Cancel/Escape writes nothing; Save respects name and Include room.
- [ ] Russian copy/feature entries, regression and production acceptance at both widths and CI checks pass.
