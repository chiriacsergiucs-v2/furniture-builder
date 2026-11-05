# ADR-187: Fix the fourteen findings of the New-piece wizard critique

- Status: Pending
- Date: 2026-11-05
- Depends on: ADR-044, ADR-045, ADR-046
- Design: docs/ui-design.md (New-piece wizard)
- Backlog: N191

## Context

The user asked (2026-11-05): "Critique the create furniture wizard. List findings, each finding must have 1 suggested
fix", then "Group in 1 critique findings adr, all 14. Create the adr, output before merge, no implementation."

The critique ran on the production build at 390 and 1280 px, on engine probes in Vitest and on the browser find-it
script `tools/wizard/find-it.mjs` (170/170 pass). It found fourteen problems in `src/ui/Wizard.tsx` and
`src/core/wizard/*` ([ADR-044](../adr-done/ADR-044-new-piece-is-a-data-driven-wizard-a-step-library-and-a-const.md),
[ADR-045](../adr-done/ADR-045-suggested-combinations-come-from-generator-axes-declared-per.md),
[ADR-046](../adr-done/ADR-046-a-wizard-result-is-an-ordinary-saved-design-in-the-existing.md)). None changes the
model, the design document or storage. Finding 4 keeps the Skip behaviour ADR-044 decided and changes only its
label; finding 5 builds the Review summary ADR-044 already names.

## Decision

Build the fix chosen for each finding, numbered as in the critique.

1. **Closing loses every answer.** The wizard ignores backdrop clicks; × asks "Discard the answers?" (Cancel / Discard)
   whenever any answer differs from `resolve({})`.
2. **Type change keeps foreign answers.** On a type change keep only the Size answers that are inside the new type's
   range and are not in its `hide` or `labels`; drop every other answer and every `done` id.
3. **A size typo builds a 0 mm model.** `check()` skips `toDesign` and `buildModel` while `fieldProblems` holds an
   error; the preview then reads "Fix the marked fields" (not "Choose a type to see the piece.").
4. **Skip is destructive and unexplained.** The button reads "Use defaults"; on the Type step "Use <label of the first
   type option>", read from `fieldOptions` (no type id in the UI). The `title` tooltip goes.
5. **Review shows no answers.** Review lists one row per visible step with `summary(r)` and an Edit button that opens
   that step.
6. **Done steps can hold errors.** The rail shows a step as done only while it has no error.
7. **Red error before any action** (user answer 2026-11-05: hint until the user leaves the step). The untouched Type
   step shows "Choose a construction type." as a hint; it is an error once the user leaves Type or uses defaults.
   Model diagnostics are untouched (ADR-008).
8. **Same error twice on one screen.** The preview panel lists only problems of other steps.
9. **Per-compartment doors differ by hand and by card.** Choosing "Per compartment" by hand fills the list like the
   card axis: one door on every compartment without drawers.
10. **Shelves 0 duplicates Open.** The shelves counter starts at 1 for the kinds that use shelves.
11. **Preview re-serialised every render.** The preview picture is memoised on the built model.
12. **Scroll-to-top targets the first open dialog.** The wizard scrolls its own `.dialog-body` found from a ref.
13. **Type picker semantics.** The type options are a `radiogroup` of `radio` rows with `aria-checked`.
14. **Wizard UI untested in CI.** `tests/find-it/wizard.test.tsx` (jsdom, ADR-108) opens the wizard, picks a type,
    sets a size, reaches Review and creates a piece at 390 and 1280 px.

Every text added or changed gets its Russian entry (ADR-153).

## Alternatives considered

- **Keep a draft after closing (1)** — more state, and nothing says a draft should outlive the dialog (G-354).
- **Drop all answers on a type change (2)** — loses a typed name and sizes needlessly.
- **Build with the last valid size (3)** — silent substitution, against ADR-008.
- **Remove Skip (4)** — changes the ADR-044 decision; a label fixes the misreading.
- **Enable Next on an untouched Type step (7)** — keeps the premature red text; not chosen by the user.

## Scope

- In scope: the fourteen fixes above, their tests, the jsdom find-it test, Russian entries.
- Out of scope: a wizard draft that survives closing (G-354); the Doors dropdown on desktop (G-355); any change to
  steps, types, axes or the design document.

## Consequences

- Positive: no lost work on a misclick; a type change cannot leave hidden errors; one typo gives one error; Review
  shows what will be built; the wizard UI runs in CI.
- Negative / risks: skipping the build on a field error hides later model diagnostics until the field is fixed.
- Harder to change later: the Review summary list becomes the place users check answers; removing it later would
  need an ADR.

## Done when

- [ ] Backdrop click keeps the wizard open; × with changed answers shows "Discard the answers?" (find-it, 1 and 14).
- [ ] Cabinet with drawers → Open shelving gives no Contents error; cabinet height 400 → Bed gives no headboard
      error and takes the Bed default (tests, 2).
- [ ] Width "abc" gives exactly one problem and no "too small" diagnostic; preview reads "Fix the marked fields"
      (tests and find-it, 3).
- [ ] Footer reads "Use defaults", on Type "Use Cabinet (closed box)" read from the options; no `title` (find-it, 4).
- [ ] Review lists a summary row with Edit for every visible step; Edit opens that step (find-it, 5).
- [ ] A done step with an error is not shown done; untouched Type shows the hint, not an error; the preview panel
      omits current-step problems (tests and find-it, 6, 7, 8).
- [ ] Hand-picked "Per compartment" gives one door on compartments without drawers; shelves counter min 1; type
      options are radios; preview picture memoised; scroll uses the wizard's own body (tests, 9–13).
- [ ] `tests/find-it/wizard.test.tsx` passes at 390 and 1280 px in `pnpm test`; every new text has its Russian
      entry (`pnpm typecheck`).
