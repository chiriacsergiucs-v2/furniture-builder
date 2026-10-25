# ADR-086: Quick counts change only the selected section

- Status: Pending
- Date: 2026-10-25
- Depends on: ADR-083, ADR-084
- Design: docs/ui-design.md (§3 Components and states)
- Backlog: N81

## Context

Bug report from the user, 2026-10-25, in their words:

> Cabinet, 2 vertical dividers = 3 interior spaces. Click middle one, add divider results in divider aplied on the
> entire piece of furniture, but should be applie to that middle section only, also applies to shelvds and
> everything else. Fix it

[ADR-084](../adr-done/ADR-084-change-counts-with-a-plus-minus-stepper-above-the-selected-s.md) decided that a bay
inside a divided space shows and changes its parent's dividers along the parent's axis. So with the middle bay
selected, `+` on Vertical dividers added a fourth bay to the whole cabinet. ADR-084 is implemented and stays as it
is; this ADR replaces that one rule.

## Decision

- Every row of the quick-count card changes the selected space only (`countRows` in `src/core/counts.ts`: the target
  is always the selected space).
- A selected bay shows its own dividers: 0 when it is not divided; `+` divides that bay (its contents go into the
  first of the two new parts), `−` is disabled at 0.
- A selected divided space shows the dividers along its own axis, as before.
- To change the cabinet's own sections, select the whole piece (first tap, ADR-083): the card then shows the
  interior's counts.
- Shelves, drawers and doors already changed the selected space only; tests now pin that down.

## Alternatives considered

- **Keep the parent rule and add a separate "divide this bay" row** — two divider rows per axis is the confusion the
  user reported.

## Scope

- In scope: the rule above, regression tests, the find-it script updated with the user's steps.

## Consequences

- Positive: a tap on a section and `+` does what the user expects.
- Negative / risks: adding a bay to the whole cabinet now needs the whole piece selected first.

## Done when

- [x] With the middle of 3 bays selected, `+` Vertical dividers divides only that bay; shelves `+` on a bay changes
      only that bay (`tests/counts.test.ts`; both tests fail on the old rule)
- [x] `tools/count-stepper/find-it.mjs` passes at 1280 and 390 px with the user's steps: middle section selected,
      "More vertical dividers" splits it in two, the side sections keep their size
- [x] lint, format:check, typecheck, test, build, docs:check pass
