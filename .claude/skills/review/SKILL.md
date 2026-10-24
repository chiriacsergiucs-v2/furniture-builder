---
name: review
description: Review a change (current branch, uncommitted work or a pull request) against its ADR's "Done when" list, the user's requirements and the repo's hard rules, and report findings by severity. Read-only unless asked to fix. Use when the user says "review this", "review my changes", "is this ready for PR", "check this against the ADR", or before opening or approving a pull request.
---

# Review a change

Project: **Furniture Builder** — offline PWA. The review is an independent check: do not
trust a claim you did not see run. Default mode is **read-only**: report, do not edit.

## Workflow

1. **Scope the change.** `git status` and `git diff origin/main...HEAD` (or the PR diff).
   Identify the ADR from the branch name (`adr-NNN-...`), commit messages or the user, and
   the backlog ids it touches.
2. **Read the plan.** The ADR and its `Depends on` ADRs. Build a table mapping every
   `Done when` item **and every requirement in the user's words** (R1) to evidence: code,
   test, find-it result. Items with no evidence are unmet, and an unmet requirement fails
   the delivery. A requirement that was dropped or relabelled ("reference", "gap", "waits")
   instead of built is a blocking issue (R2).
3. **Run `verify`** (or confirm a green CI run on this exact commit). Do not approve on red.
   Evidence copied from a document is labelled as reported, not executed.
4. **Review the change itself:**
   - **Geometry** (`src/core`): integer mm, exact splits and gaps, no geometry outside
     `src/core`, no throw or silent clamp on user input, independent checks still catch
     the case, a test per new rule, deep fuzz run for geometry changes. No invented
     hardware, load, drilling or supplier values (ADR-003, ADR-004, ADR-008, ADR-010).
   - **Storage** (`src/persist`): a new Dexie version instead of an edited one, unreadable
     rows never deleted, designs validated before load/import, imported designs get new ids
     (`add-storage-version`). Anything that deletes or rewrites saved designs is blocking
     unless the user decided it.
   - **Design document / types:** `types.ts` or document-shape changes cite an ADR; new
     shapes bump `schemaVersion` and keep old readers (ADR-011).
   - **UI** (`src/ui`, `src/viewer`): stable Zustand selectors, the viewer only selects and
     stays lazy, focus visible, no horizontal scroll at 390 px, error diagnostics not
     hidden; find-it test from the bare app at phone and desktop widths (R3), or, for an
     `Acceptance: light` ADR, the backlog marker `find-it pending (light, ADR-066)` (ADR-066).
   - **Release:** no network request, CDN or telemetry (ADR-002), lockfile committed, no
     dependency with unknown licence, base path intact, README claims match behaviour.
   - **Scope:** changes outside the ADR, unasked refactors, polish or browser suites (ADR-016).
   - **Ledger:** `docs/backlog.md` updated with evidence; `pnpm docs:check` passes.
5. **Skip what tools already enforce** (ESLint style).
6. **Report**, short and specific, with `file:line` references:
   - **Verdict:** ready / needs changes.
   - **Blocking issues**, each with why and a suggested fix.
   - **Suggestions** (non-blocking).
   - **Requirement / Done-when table:** item → evidence → met / unmet.

## Rules

- Separate facts (what the code does) from opinions, and label each.
- Do not edit files unless the user asks you to apply the fixes.
- If intent is unclear, ask instead of assuming it is a bug.
