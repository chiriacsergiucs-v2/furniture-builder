# ADR-300: Merge an assembly step with the next one

- Status: Implemented
- Date: 2026-11-27
- Implemented: 2026-11-27
- Depends on: ADR-207
- Design: n/a
- Backlog: N427

## Context

ADR-207 made the assembly steps editable: the user moves steps up and down and renames them, saved in the design
(`Design.assembly`, schemaVersion 9), and Reset the steps brings the generated steps back. The user asked for an
"Ordered step list + 3D highlight" (2026-11-04); its remainder G-422 says two neighbouring steps cannot be merged into
one. The user accepted the suggested pick on 2026-11-27 ("Also do the medium work", "Auto-accept if confidence > 85%"):
"Merge with the next step, saved in the design's step order, undone by Reset the steps."

Saving the merge changes the design document (`AssemblyEdit` in `src/core/types.ts`), so this ADR is required
(ADR-011).

## Decision

- `AssemblyEdit` gets an optional `merged: StepId[]`: each listed step joins the step shown right before it in the
  order, so a run of them is one step. A listed step that comes first stays on its own; unknown ids are ignored.
- The design document goes to **schemaVersion 13**. `validateDesign` checks `merged` (step ids, at most 40, each once)
  and refuses it below 13 ("Merged assembly steps need schemaVersion 13"); versions 1 to 12 load unchanged
  (`upgradeDesign` adds nothing).
- `assemblySteps()` orders the generated steps (ADR-207), then merges: the merged step keeps the first step's id,
  its lists are both steps' lists (parts, drawer boxes, fronts hung again, prepared items, joints, fasteners per joint
  type added up, hardware grouped), its title is the titles joined with " + " and its instruction both instructions in
  order (`AssemblyStep.from`). A user name on the first step names the merged step.
- `mergeStep()` returns the edit; `moveStep()` moves a merged step as one; `renameStep()` keeps the merges.
- The Assembly tab gets **Merge with the next step** on every step (disabled on the last), one undo step; the print
  follows the tab. Reset the steps deletes `Design.assembly`, merges included.
- Decided by Claude: no "Split" button (Reset the steps undoes, as the pick says); the merged title joins the step
  titles with " + " in the tab and print language, so no new text key is needed for it.

## Alternatives considered

- **Merged pairs `[a, b][]`** — the gap's wording; a list of joined ids is simpler, chains naturally and cannot name a
  pair that is no longer adjacent.
- **A group id per step** — needs a new id space and more validation for the same result.
- **Merging in the UI only** — not saved, so the print and a reload would lose it; rejected.

## Scope

- In scope: the document field and version, validation, the core merge, the tab button, tests and the find-it test.
- Out of scope: splitting one merged step back without a reset (scope; the pick names Reset the steps).

## Consequences

- Positive: the user can shape the step list to how they actually build.
- Negative / risks: designs saved with a merge need version 13; an older app refuses them, as for every version bump.
- Harder to change later: the `merged` field is part of the saved design.

## Done when

- [x] Merging two neighbouring steps gives one step with both steps' parts, joints, fasteners and instructions, and every panel stays in exactly one step (`tests/assembly-merge.test.ts`)
- [x] The last step cannot merge; a merged step moves as one and keeps its merge when renamed (`tests/assembly-merge.test.ts`)
- [x] Design 13 validates `merged`; design 12 files load unchanged and refuse it (`tests/assembly-merge.test.ts`)
- [x] The merge is saved with the design in one undo step and Reset the steps restores the generated steps (`tests/assembly-merge.test.ts`)
- [x] Find-it from the bare app at phone and desktop widths: Assembly → "Merge with the next step" → "Bottom + Sides to the bottom"; Reset the steps restores (`tests/find-it/assembly-merge.test.tsx`)
