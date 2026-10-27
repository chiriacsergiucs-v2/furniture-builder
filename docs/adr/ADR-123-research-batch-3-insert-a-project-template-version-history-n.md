# ADR-123: Research batch 3: insert a project template, version history, named undo steps, style suggestions

- Status: Deferred (open questions G-155, G-156, G-157, G-158)
- Date: 2026-10-27
- Depends on: ADR-051, ADR-055, ADR-060
- Design: docs/ui-design.md (project editor, project panel, Add a piece list)
- Backlog: N124

## Context

The user (2026-10-27): "Check which features are left in the features reasearch, and that we dont have, for all
missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features, and ship it as
1 big change, 1 Pr, 1 run of the tests, 1 ship, 4 features."

Third batch of the features left after ADR-093…120 (list in [ADR-121](ADR-121-research-batch-1-render-3d-on-demand-review-pack-typed-rotat.md)), all rated Medium:

| Research feature (id)                                                           | What is missing here                                    |
| ------------------------------------------------------------------------------- | ------------------------------------------------------- |
| "Paste ensemble" workflow (`paste-ensemble`)                                    | inserting a saved project template into an open project |
| Version history and recovery (`version-recovery`)                               | older versions of a project to go back to (G-083)       |
| Command/transaction log (`command-log`); compound steps of `transactional-undo` | named steps, a step list, explicit transactions         |
| Style/material recommendations (`style-recommendations`)                        | no suggestions                                          |

Undo today keeps unlabelled snapshots (`src/store/designStore.ts`, ADR-051). Versions add saved data: a Dexie
version (ADR-012, `add-storage-version` skill). The research sees style matching as an AI use; here it is offline
and rule-based (no remote AI, ADR-002).

## Decision

1. **Insert a project template.** The **Add a piece** list (ADR-094) gets a **Project templates** group; tapping one
   then tapping the plan (or dragging) places all its pieces at that point, keeping their relative positions,
   groups, linked copies and run parts (ADR-060 `projectFromTemplate` remapping) with new ids (ADR-011). Overlaps
   are diagnostics (ADR-008). One undo step.
2. **Version history.** The project panel gets **History**: a list of kept versions (date, piece count, name) with
   **Restore** and **Delete**. Restore keeps the current state as a version first, then opens the chosen one; it
   never rewrites a version. Stored in a new table `projectVersions` (next Dexie version, additive; ADR-012).
   When versions are kept waits for G-155, how many for G-156.
3. **Named undo steps.** Every project change is recorded with a name ("Move Base 600", "Group 3 pieces", "Replace
   Wall 800"); a compound action (replace + run parts + repair) is one transaction and one step. Undo/Redo show the
   step's name, and **Edit history** lists the steps and jumps back to any of them. How it is stored waits for G-157.
4. **Style suggestions.** **Suggest a style** on the finish panel (ADR-055) lists board and handle combinations,
   each with a preview swatch; applying one uses finish scope (This piece / This run / Selected / Whole project),
   one undo step. Suggestions are taste, not physical facts, and are labelled as suggestions. Where they come
   from waits for G-158.

Built as one change, one pull request, one test run and one ship (the user's request).

## Alternatives considered

- **Versions as exported files only** — no in-app recovery, which is what the research reports users want.
- **AI style suggestions** — needs a remote model (ADR-002).

## Scope

- In scope: the four features above, the Dexie version, core, storage and UI-logic tests, jsdom find-it.
- Out of scope: nothing; the undecided parts are the open questions (G-155 to G-158).

## Consequences

- Positive: saved layouts reused inside projects; mistakes recoverable across sessions; undo says what it undoes.
- Negative / risks: version storage grows on the device; the store's history code changes shape.
- Harder to change later: the `projectVersions` table (Dexie versions are never edited).

## Done when

- [ ] Inserting a template adds its pieces with new ids, relative positions, groups and links, one undo step (tests).
- [ ] The new Dexie version keeps every existing row; projects and designs read back unchanged (storage tests).
- [ ] Restore keeps the current state as a version first and never rewrites or deletes a version (storage tests).
- [ ] Each project action records its step name; a replace with run parts and a repair undoes as one step (tests).
- [ ] Applying a style through finish scope changes only the scoped pieces, one undo step (tests).
- [ ] jsdom find-it at 390 and 1280 px: "Project templates", "History", "Restore", "Undo Move", "Edit history",
      "Suggest a style".

## Open questions

- **G-155** When is a version kept: automatically once per editing session plus **Save a version** by hand, by hand
  only, or on every change? Suggested: per session plus by hand (estimate +10 % work, +30 % of value).
- **G-156** How many: every version until the user deletes it, or the last N with older ones dropped automatically?
  Suggested: keep every version (nothing deleted without the user, ADR-012).
- **G-157** Undo storage: labelled snapshots grouped into transactions, or inverse commands? Suggested: labelled
  snapshots (gives the named log and atomic steps; inverse commands estimate +80 % work, under +5 % of value).
- **G-158** Style source: built-in named styles from the shipped board and handle lists, the user's own past
  combinations, or both? Suggested: both (estimate +30 % work, +40 % of value).
