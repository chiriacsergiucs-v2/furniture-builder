---
name: add-model-feature
description: Add or change a capability of the furniture model in src/core — a new product kind or option, a generator change, a check, a cut-list or hardware rule — with its types, document validation, independent checks, store action, tests and fuzz, following the patterns already in the repo. This repo's counterpart of reserv's add-endpoint (there is no backend here). Use when the user says "add a new kind of piece", "support X in the model", "new option for drawers/doors/shelves", "add a check", or when an ADR requires a model capability.
---

# Add a model feature

Project: **Furniture Builder**. There is no API: the app's "backend" is the pure model in
`src/core` (ADR-004). Every view, list and export is a projection of `buildModel()`, so a new
capability is built there first, and the UI only edits the design document and shows the model.

## Workflow

1. **Read the ADR** that requires the change, ADR-003 to ADR-011, and the existing code for the
   nearest similar feature (e.g. `cabinet.ts` for a carcass option, `frame.ts` for a frame part,
   `rules.ts` for guidance). Reuse `buildCabinet` where a carcass exists (ADR-007).
2. **The design document first (contract).** Add the fields to `src/core/types.ts` as optional
   where old documents lack them, with defaults applied in one place. Extend `validateDesign`
   (`src/core/design.ts`) so a bad value is refused with a message, never thrown. A required
   shape change bumps `schemaVersion` and upgrades older documents in `upgradeDesign`
   (`add-storage-version`). The change cites its ADR.
3. **Generator.** Produce panels as integer-mm, axis-aligned boxes (or the shaped parts of
   ADR-040) in the documented axes (ADR-003). Exact integer splits; gaps from the arithmetic of
   ADR-006. Out-of-range input becomes a diagnostic, never a silent clamp or an exception.
4. **Independent checks (ADR-008).** `build.ts` must still catch overlaps, envelope and
   thickness problems without trusting the generator. Add a dedicated check if the feature has
   its own failure mode; errors block export.
5. **Outputs.** Cut list grouping, edge banding, grain, Romanian names for print/CSV
   (`ro.ts`), hardware schedule entries labelled as guidance — never invented specs (ADR-010),
   Fusion export, sheet nesting: make each output that should show the feature show it.
6. **Store action.** One action in `src/store/designStore.ts` that goes through `commit` (undo,
   autosave, project sync); selectors stay stable.
7. **UI.** Only edits the document and reads the model (`implement-design`); no geometry in UI.
8. **Tests** (`add-tests`): a unit test per rule; extend the seeded fuzz generators and
   invariants; a validation test for bad documents; an old-document test if the shape changed.
   Check that a deliberate code mutation fails a test.
9. **Verify:** the `verify` skill, then `FUZZ_N=30000 pnpm exec vitest run tests/fuzz.test.ts`;
   `pnpm catalog:docs` / `catalog:snapshots` if catalog templates change; a find-it test
   for anything visible.

## Rules

- `src/core` imports nothing from React, three or Dexie.
- Unknown physical facts (loads, drilling, screw specs, supplier values) go under *Open
  questions*; ask the user instead of choosing a number.
- Never change how an existing saved design builds without an ADR that says so; old designs
  must still build the same way.
