# ADR-NNN: <Short, imperative title>

- Status: Pending
- Date: YYYY-MM-DD
- Depends on: none
- Design: n/a
- Backlog: none

<!--
HOW TO USE THIS TEMPLATE
- Copy to docs/adr/ADR-NNN-short-kebab-title.md (3-digit number, next free one).
- Header lines are machine-read by the next-adr and ship-adr skills. Keep them exactly in
  the "- Key: value" form, one per line, right under the title.
- Allowed status values: Pending, Deferred (<reason>), Implemented. Never set Implemented
  by hand — the ship-adr skill does it (and moves the file to docs/adr-done/).
- The dependency line takes "none" or a comma-separated list, e.g. "ADR-001, ADR-004".
- The design line takes a path or link to the design reference (e.g. docs/ui-design.md),
  or "n/a" for work with no screen.
- The backlog line names the docs/backlog.md items (e.g. "N45"), or "none".
- Optional "- Acceptance:" line. Omitted or "full" = R3 with the default jsdom find-it
  (`tests/find-it/<area>.test.tsx`, ADR-108). "browser" = the Chromium script `tools/<area>/find-it.mjs`;
  use it for layout/CSS, 3D view or Move mode work (ADR-108). "light" (only when the user asks) skips the
  find-it test; the backlog rows keep the gap `find-it pending (light, ADR-066)` until a catch-up run.
- One ADR = one unit that can be built without loading the rest of the plan.
  Target: up to ~110 lines, ~6.5 KB, 8 checklist items. Bigger means split it.
- Link sibling ADRs as [ADR-XXX](ADR-XXX-short-title.md).
- If this ADR changes an earlier decision, say so in Context and link the old ADR.
  Do not edit ADRs that are already Implemented.
- Delete these comments (and any sections that do not apply) when you write the real ADR.
-->

## Context

Why this is needed now. Product context, constraints and forces in play
(offline only, phone first, integer mm, what the user asked for, in their words).

## Decision

What we build or choose, and why. Concrete enough to implement without further
discussion. For a pure technology choice, state the choice and the reasons.

## Alternatives considered

- **Option A** — why it was not chosen.
- **Option B** — why it was not chosen.

## Scope

- In scope: ...
- Out of scope: ... (each item cites its gap, G-NNN in GAPS.md, ADR-082)

## Consequences

- Positive: ...
- Negative / risks: ...
- Harder to change later: ...

## Done when

- [ ] <Verifiable item, e.g. "Two drawers that overlap give an error diagnostic (covered by tests)">
- [ ] <Verifiable item>
- [ ] <For a pure decision: "Decision recorded and the repo scaffold reflects it">
- [ ] <For anything visible: "Find-it test passes from the bare app at phone and desktop widths">

## Open questions

- <Question for the user, with the options and the suggested pick (not applied until the user picks it), and its gap (G-NNN). Delete the section when there are none.>
