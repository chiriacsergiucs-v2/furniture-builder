# ADR-113: Fix the high-severity layout bugs from the 2026-10-27 critique

- Status: Pending
- Date: 2026-10-27
- Depends on: none
- Design: docs/ui-design.md (sections 3 and 4)
- Backlog: N111
- Acceptance: browser
- Agreed: 2026-10-27 "High bugs"

## Context

The user, 2026-10-27: "Run a critique for listings, headers, text, button sizes, gaps, groupings." Critique: [2026-10-27 UI critique](../retros/2026-10-27-ui-critique.md). Asked what to
build now, the user picked "High bugs".

## Decision

- New dialog: rows keep their content height under touch (`.dialog-body { grid-auto-rows: max-content }`); no overlap.
- Settings › Run parts: nothing spills past its card (`minmax(0, 1fr)` track).
- Catalog: the sticky filter row sits under the phone app bar (`top: var(--bar-h)` at ≤ 760 px), never behind it.
- Settings head: `.dialog header` styles only `.dialog > header`; "Whole cabinet" no longer wraps.
- Under touch every input is at least 44 px tall: ask-text, wizard Name, wizard step buttons, template-editor inputs.
- The template editor's trash button gets an accessible name ("Remove variant") and the `icon` class.

## Alternatives considered

- **Fold into ADR-112** — kept apart so the bugs ship without waiting for the full rule.

## Scope

- In scope: the six fixes above and a browser find-it script.

## Consequences

- Positive: no overlapping or hidden controls.
- Negative / risks: none known.
- Harder to change later: nothing.

## Done when

- [ ] At 390 with touch the New dialog's rows do not overlap (each row's box contains its text).
- [ ] At 390 Settings › Run parts has no child wider than its card.
- [ ] After scrolling the Catalog at 390, "Templates" in the filter row is visible below the app bar.
- [ ] Under touch the ask-text input, wizard Name, wizard step buttons and template-editor inputs are ≥ 44 px tall;
      the trash button is found by the name "Remove variant".
- [ ] Find-it passes from the bare app at phone and desktop widths (`tools/critique-bugs/find-it.mjs`, production
      build).
