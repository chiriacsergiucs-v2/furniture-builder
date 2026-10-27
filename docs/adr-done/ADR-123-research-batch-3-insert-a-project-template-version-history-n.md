# ADR-123: Research batch 3: insert a project template, version history, named undo steps, style suggestions

- Status: Implemented
- Date: 2026-10-27
- Implemented: 2026-10-27
- Depends on: ADR-051, ADR-055, ADR-060
- Design: docs/ui-design.md (project editor, project panel, Add a piece list)
- Backlog: N124
- Agreed: 2026-10-27: "Accept default" (G-155 to G-158: the suggested picks)

## Context

The user (2026-10-27): "Check which features are left in the features reasearch, and that we dont have, for all
missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features, and ship it as
1 big change, 1 Pr, 1 run of the tests, 1 ship, 4 features."

Third batch of the features left after ADR-093…120 (list in [ADR-121](../adr-done/ADR-121-research-batch-1-render-3d-on-demand-review-pack-typed-rotat.md)), all rated Medium:

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
   adds all its pieces to the right of the project's pieces and selects them; the next tap on the plan places the
   block there (its left-back corner at the tap), and a drag moves the selection (ADR-097). Relative positions,
   placements, linked copies (with new link ids, so they never join the project's own links) and the run-part
   recipe are kept, with new ids (ADR-011). Overlaps are diagnostics (ADR-008). Insert and place are one undo step.
2. **Version history.** The project panel gets **History**: a list of kept versions (date, piece count, name) with
   **Restore** and **Delete**. Restore keeps the current state as a version first, then opens the chosen one; it
   never rewrites a version. Stored in a new table `projectVersions` (Dexie v10, additive; ADR-012).
   **When (G-155):** automatically once per editing session (the project as it was opened, kept at the first
   change after opening) plus **Save a version** by hand. **How many (G-156):** every version is kept until the
   user deletes it; nothing removes versions automatically.
3. **Named undo steps.** Every project change is recorded with a name ("Move Base 600", "Group 3 pieces", "Replace
   Wall 800"); a compound action (replace + run parts + repair) is one transaction and one step. Undo/Redo show the
   step's name, and **Edit history** lists the steps and jumps back to any of them. **Storage (G-157):** labelled
   snapshots: the existing project snapshots, each with its step name, given by the action or derived from what
   changed (pure `describeChange` in `src/core/history.ts`); `transact(name, fn)` folds every change made inside
   it into one step.
4. **Style suggestions.** **Suggest a style** on the finish panel (ADR-055) lists board and handle combinations,
   each with a preview swatch; applying one uses finish scope (This piece / This run / Selected / Whole project),
   one undo step. Suggestions are taste, not physical facts, and are labelled as suggestions. **Source (G-158):**
   built-in named styles (front board, carcass board and handle kind from the shipped board list and the ADR-024
   handle kinds only) and the user's own combinations, counted from the pieces of their saved projects. A style's
   handle kind replaces the kind on fronts that already have a handle; fronts without one stay so.

Built as one change, one pull request, one test run and one ship (the user's request).

## Alternatives considered

- **Versions as exported files only** — no in-app recovery, which is what the research reports users want.
- **AI style suggestions** — needs a remote model (ADR-002).

## Scope

- In scope: the four features above, the Dexie version, core, storage and UI-logic tests, jsdom find-it.
- Out of scope: nothing; the open questions G-155 to G-158 are answered above.
- Found while building: versions of a deleted project stay on the device, unlisted (G-190).

## Consequences

- Positive: saved layouts reused inside projects; mistakes recoverable across sessions; undo says what it undoes.
- Negative / risks: version storage grows on the device; the store's history code changes shape.
- Harder to change later: the `projectVersions` table (Dexie versions are never edited).

## Done when

- [x] Inserting a template adds its pieces with new ids, relative positions and new links, one undo step (tests).
- [x] The new Dexie version keeps every existing row; projects and designs read back unchanged (storage tests).
- [x] Restore keeps the current state as a version first and never rewrites or deletes a version (storage tests).
- [x] Each project action records its step name; a replace with run parts and a repair undoes as one step (tests).
- [x] Applying a style through finish scope changes only the scoped pieces, one undo step (tests).
- [x] jsdom find-it at 390 and 1280 px: "Project templates", "History", "Restore", "Undo Move", "Edit history",
      "Suggest a style".

## Open questions

None. Answered 2026-10-27 ("Accept default"): G-155 per session plus by hand; G-156 keep every version; G-157
labelled snapshots grouped into transactions; G-158 built-in styles and the user's own combinations.
